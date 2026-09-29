//! Double opt-in mailing list: sign-up, confirmation, unsubscription, blog
//! post announcements and the purge of sign-ups that were never confirmed.

use std::sync::Arc;

use argon2::password_hash::rand_core::{OsRng, RngCore};
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use hmac::{Hmac, Mac};
use lettre::Address;
use serde::Serialize;
use sha2::{Digest, Sha256};
use ts_rs::TS;
use uuid::Uuid;

use crate::AppState;
use crate::db;
use crate::error::RepositoryError;
use crate::language::Language;
use crate::mailer::{Email, escape_html};
use crate::metrics::{self, Task};
use crate::models::BlogPost;
use crate::schema::{blog_posts, newsletter_subscribers};

const CONFIRMATION_TTL: chrono::Duration = chrono::Duration::hours(48);
/// Minimum gap between two confirmation emails to the same address, so the
/// sign-up form cannot be used to flood someone's inbox.
const CONFIRMATION_RESEND_COOLDOWN: chrono::Duration = chrono::Duration::minutes(10);
const CLEANUP_INTERVAL: std::time::Duration = std::time::Duration::from_secs(60 * 60);
const MAX_EMAIL_LEN: usize = 254;

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct NewsletterStats {
    #[ts(type = "number")]
    pub confirmed: i64,
    #[ts(type = "number")]
    pub pending: i64,
}

pub struct Subscriber {
    pub id: Uuid,
    pub email: String,
    pub language: Language,
}

/// Trimmed, lowercased address if it is a syntactically valid mailbox.
pub fn normalize_email(raw: &str) -> Option<Address> {
    let email = raw.trim().to_lowercase();
    if email.len() > MAX_EMAIL_LEN {
        return None;
    }
    email.parse::<Address>().ok()
}

fn random_token() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

/// Registers a sign-up and returns the confirmation token to email, or
/// `None` when nothing should be sent: the address is already confirmed, or
/// a confirmation went out within the cooldown.
pub fn subscribe(
    conn: &mut PgConnection,
    email: &Address,
    language: Language,
) -> QueryResult<Option<String>> {
    use newsletter_subscribers::dsl;

    let email: &str = email.as_ref();
    let token = random_token();
    let now = Utc::now();
    let pending_fields = (
        dsl::language.eq(language.code()),
        dsl::confirmation_token_hash.eq(hash_token(&token)),
        dsl::confirmation_sent_at.eq(now),
        dsl::token_expires_at.eq(now + CONFIRMATION_TTL),
    );

    let inserted = diesel::insert_into(newsletter_subscribers::table)
        .values((dsl::email.eq(email), pending_fields.clone()))
        .on_conflict(dsl::email)
        .do_nothing()
        .execute(conn)?;
    if inserted == 1 {
        return Ok(Some(token));
    }

    let refreshed = diesel::update(
        newsletter_subscribers::table
            .filter(dsl::email.eq(email))
            .filter(dsl::confirmed_at.is_null())
            .filter(dsl::confirmation_sent_at.lt(now - CONFIRMATION_RESEND_COOLDOWN)),
    )
    .set(pending_fields)
    .execute(conn)?;
    Ok((refreshed == 1).then_some(token))
}

/// Activates the sign-up holding `token`. Tokens are single-use and expire.
pub fn confirm(conn: &mut PgConnection, token: &str) -> QueryResult<bool> {
    use newsletter_subscribers::dsl;

    let now = Utc::now();
    let confirmed = diesel::update(
        newsletter_subscribers::table
            .filter(dsl::confirmation_token_hash.eq(hash_token(token)))
            .filter(dsl::confirmed_at.is_null())
            .filter(dsl::token_expires_at.gt(now)),
    )
    .set((
        dsl::confirmed_at.eq(now),
        dsl::confirmation_token_hash.eq(None::<String>),
        dsl::confirmation_sent_at.eq(None::<DateTime<Utc>>),
        dsl::token_expires_at.eq(None::<DateTime<Utc>>),
    ))
    .execute(conn)?;
    Ok(confirmed == 1)
}

/// Erases the subscriber entirely (right to erasure). Idempotent.
pub fn unsubscribe(conn: &mut PgConnection, id: Uuid) -> QueryResult<()> {
    diesel::delete(newsletter_subscribers::table.find(id)).execute(conn)?;
    Ok(())
}

pub fn stats(conn: &mut PgConnection) -> QueryResult<NewsletterStats> {
    use newsletter_subscribers::dsl;

    let confirmed = newsletter_subscribers::table
        .filter(dsl::confirmed_at.is_not_null())
        .count()
        .get_result(conn)?;
    let pending = newsletter_subscribers::table
        .filter(dsl::confirmed_at.is_null())
        .count()
        .get_result(conn)?;
    Ok(NewsletterStats { confirmed, pending })
}

pub fn confirmed_subscribers(conn: &mut PgConnection) -> QueryResult<Vec<Subscriber>> {
    use newsletter_subscribers::dsl;

    let rows = newsletter_subscribers::table
        .filter(dsl::confirmed_at.is_not_null())
        .select((dsl::id, dsl::email, dsl::language))
        .load::<(Uuid, String, String)>(conn)?;
    Ok(rows
        .into_iter()
        .map(|(id, email, language)| Subscriber {
            id,
            email,
            language: Language::from_code(&language),
        })
        .collect())
}

/// Records that `post_id` is being emailed to the list. Only published posts
/// qualify, and a post already announced needs an explicit `resend`. The row
/// lock makes concurrent clicks announce the post once.
pub fn claim_announcement(
    conn: &mut PgConnection,
    post_id: Uuid,
    resend: bool,
) -> Result<BlogPost, RepositoryError> {
    conn.transaction(|conn| {
        let post = blog_posts::table
            .find(post_id)
            .for_update()
            .first::<BlogPost>(conn)
            .optional()?
            .ok_or_else(|| RepositoryError::NotFound("Blog post not found".to_string()))?;
        if !post.is_published {
            return Err(RepositoryError::Conflict(
                "Only published posts can be emailed".to_string(),
            ));
        }
        if post.notified_at.is_some() && !resend {
            return Err(RepositoryError::Conflict(
                "This post was already emailed to subscribers".to_string(),
            ));
        }
        Ok(diesel::update(blog_posts::table.find(post_id))
            .set(blog_posts::notified_at.eq(Utc::now()))
            .get_result::<BlogPost>(conn)?)
    })
}

fn delete_expired_signups(conn: &mut PgConnection) -> QueryResult<usize> {
    use newsletter_subscribers::dsl;

    diesel::delete(
        newsletter_subscribers::table
            .filter(dsl::confirmed_at.is_null())
            .filter(dsl::token_expires_at.lt(Utc::now())),
    )
    .execute(conn)
}

/// Hourly purge of sign-ups whose confirmation link expired unused.
pub async fn run_cleanup_task(app_state: Arc<AppState>) {
    let mut interval = tokio::time::interval(CLEANUP_INTERVAL);
    loop {
        interval.tick().await;
        match db::get_db_connection(&app_state).map(|mut conn| delete_expired_signups(&mut conn)) {
            Ok(Ok(0)) => {}
            Ok(Ok(purged)) => tracing::info!(purged, "purged expired newsletter sign-ups"),
            Ok(Err(e)) => {
                tracing::warn!(error = ?e, "newsletter sign-up purge failed");
                metrics::record_failure(Task::newsletter_purge);
            }
            Err(e) => {
                tracing::warn!(error = ?e, "newsletter sign-up purge failed");
                metrics::record_failure(Task::newsletter_purge);
            }
        }
    }
}

/// Key for unsubscribe tokens, derived from `JWT_SECRET` under its own label
/// so an unsubscribe token can never double as a JWT signature.
pub fn derive_unsubscribe_key(secret: &str) -> [u8; 32] {
    let mut mac =
        Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key length");
    mac.update(b"newsletter-unsubscribe-v1");
    mac.finalize().into_bytes().into()
}

fn unsubscribe_mac(key: &[u8; 32], id: Uuid) -> Hmac<Sha256> {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(id.as_bytes());
    mac
}

/// Unsubscribe links carry an HMAC of the subscriber id instead of a stored
/// secret, so every email can include a working link without keeping any
/// token at rest.
pub fn unsubscribe_token(key: &[u8; 32], id: Uuid) -> String {
    hex::encode(unsubscribe_mac(key, id).finalize().into_bytes())
}

/// Constant-time check of an unsubscribe token.
pub fn verify_unsubscribe_token(key: &[u8; 32], id: Uuid, token: &str) -> bool {
    hex::decode(token)
        .map(|bytes| unsubscribe_mac(key, id).verify_slice(&bytes).is_ok())
        .unwrap_or(false)
}

/// A styled call-to-action link, rendered as a button in HTML mail.
struct Action<'a> {
    label: &'a str,
    url: &'a str,
}

/// Wraps pre-escaped HTML paragraphs in the shared email layout.
fn html_layout(
    lang: Language,
    heading: &str,
    paragraphs: &[String],
    action: &Action,
    footer: &str,
) -> String {
    let body: String = paragraphs
        .iter()
        .map(|p| format!(r#"<p style="margin:0 0 16px;line-height:1.5">{p}</p>"#))
        .collect();
    format!(
        r#"<!doctype html>
<html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px 16px;background:#f5f1e8;font-family:Georgia,serif;color:#2b2b2b">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px 24px">
<p style="margin:0 0 24px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#8a6d1d">Miedăria Păunilor</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3">{heading}</h1>
{body}
<p style="margin:24px 0"><a href="{url}" style="display:inline-block;padding:12px 24px;background:#1f3a5f;color:#ffffff;text-decoration:none;border-radius:4px">{label}</a></p>
<p style="margin:32px 0 0;font-size:13px;line-height:1.5;color:#6b6b6b">{footer}</p>
</div></body></html>"#,
        lang = lang.code(),
        heading = escape_html(heading),
        url = escape_html(action.url),
        label = escape_html(action.label),
    )
}

pub fn confirmation_email(site_url: &str, lang: Language, to: Address, token: &str) -> Email {
    let url = format!(
        "{site_url}/{}/newsletter/confirm?token={token}",
        lang.code()
    );
    let (subject, heading, intro, validity, ignore, button) = match lang {
        Language::Ro => (
            "Confirmă abonarea la noutățile Miedăriei Păunilor",
            "Confirmă abonarea",
            "Cineva (sperăm că tu) a cerut să primească pe această adresă noutăți despre miedurile noastre și articolele de pe blog.",
            "Linkul de confirmare este valabil 48 de ore.",
            "Dacă nu tu ai făcut cererea, ignoră acest mesaj: fără confirmare nu te vom abona și vom șterge adresa.",
            "Confirmă abonarea",
        ),
        Language::En => (
            "Confirm your Miedăria Păunilor newsletter subscription",
            "Confirm your subscription",
            "Someone (hopefully you) asked to receive news about our meads and blog posts at this address.",
            "The confirmation link is valid for 48 hours.",
            "If this wasn't you, just ignore this email: without confirmation you won't be subscribed and the address will be deleted.",
            "Confirm subscription",
        ),
    };
    Email {
        to,
        subject: subject.to_string(),
        text: format!("{heading}\n\n{intro}\n\n{button}: {url}\n\n{validity}\n\n{ignore}\n"),
        html: html_layout(
            lang,
            heading,
            &[escape_html(intro), escape_html(validity)],
            &Action {
                label: button,
                url: &url,
            },
            &escape_html(ignore),
        ),
        list_unsubscribe: None,
    }
}

/// Announcement of `post` in the subscriber's language, with a one-click
/// unsubscribe link in the footer and the `List-Unsubscribe` header.
pub fn blog_post_email(
    site_url: &str,
    unsubscribe_key: &[u8; 32],
    subscriber: &Subscriber,
    to: Address,
    post: &BlogPost,
) -> Email {
    let lang = subscriber.language;
    let (title, excerpt) = match lang {
        Language::Ro => (&post.title_ro, &post.excerpt_ro),
        Language::En => (&post.title, &post.excerpt),
    };
    let token = unsubscribe_token(unsubscribe_key, subscriber.id);
    let query = format!("id={}&token={token}", subscriber.id);
    let post_url = format!("{site_url}/{}/blog/{}", lang.code(), post.slug);
    let unsubscribe_page = format!("{site_url}/{}/newsletter/unsubscribe?{query}", lang.code());
    let (kicker, button, reason, unsubscribe_label) = match lang {
        Language::Ro => (
            "Articol nou pe blogul Miedăriei Păunilor",
            "Citește articolul",
            "Primești acest email pentru că te-ai abonat la noutățile Miedăriei Păunilor.",
            "Dezabonare",
        ),
        Language::En => (
            "New on the Miedăria Păunilor blog",
            "Read the article",
            "You are receiving this email because you subscribed to Miedăria Păunilor news.",
            "Unsubscribe",
        ),
    };
    Email {
        to,
        subject: title.clone(),
        text: format!(
            "{kicker}\n\n{title}\n\n{excerpt}\n\n{button}: {post_url}\n\n--\n{reason}\n{unsubscribe_label}: {unsubscribe_page}\n"
        ),
        html: html_layout(
            lang,
            title,
            &[escape_html(kicker), escape_html(excerpt)],
            &Action {
                label: button,
                url: &post_url,
            },
            &format!(
                r#"{} <a href="{}" style="color:#6b6b6b">{}</a>"#,
                escape_html(reason),
                escape_html(&unsubscribe_page),
                escape_html(unsubscribe_label),
            ),
        ),
        list_unsubscribe: Some(format!("{site_url}/api/newsletter/unsubscribe?{query}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_and_rejects_emails() {
        assert_eq!(
            normalize_email("  Ana.Pop@Example.RO ").map(|a| a.to_string()),
            Some("ana.pop@example.ro".to_string())
        );
        assert!(normalize_email("not-an-email").is_none());
        assert!(normalize_email("a@b\r\nBcc: x@y.z").is_none());
        assert!(normalize_email(&format!("{}@example.ro", "a".repeat(250))).is_none());
    }

    #[test]
    fn unsubscribe_tokens_are_bound_to_id_and_key() {
        let key = derive_unsubscribe_key("secret");
        let id = Uuid::new_v4();
        let token = unsubscribe_token(&key, id);
        assert!(verify_unsubscribe_token(&key, id, &token));
        assert!(!verify_unsubscribe_token(&key, Uuid::new_v4(), &token));
        assert!(!verify_unsubscribe_token(
            &derive_unsubscribe_key("other"),
            id,
            &token
        ));
        assert!(!verify_unsubscribe_token(&key, id, "zz"));
    }

    #[test]
    fn token_hash_is_stable_hex() {
        let token = random_token();
        assert_eq!(token.len(), 64);
        assert_eq!(hash_token(&token), hash_token(&token));
        assert_eq!(hash_token(&token).len(), 64);
    }
}
