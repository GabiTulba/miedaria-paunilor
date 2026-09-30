//! Outgoing email over SMTP. Sends run in spawned tasks, so a slow or
//! unreachable relay never holds up a request handler.

use std::str::FromStr;
use std::time::Duration;

use lettre::message::header::{ContentType, HeaderName, HeaderValue};
use lettre::message::{Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Address, AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use crate::language::Language;
use crate::metrics::{self, Task};

const SMTP_TIMEOUT: Duration = Duration::from_secs(20);
/// Pause between messages of a batch, keeping well inside relay rate limits.
const BATCH_SEND_INTERVAL: Duration = Duration::from_millis(250);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SmtpSecurity {
    StartTls,
    Tls,
    /// Plaintext; only for a local mail catcher, never a real relay.
    None,
}

impl FromStr for SmtpSecurity {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "starttls" => Ok(SmtpSecurity::StartTls),
            "tls" => Ok(SmtpSecurity::Tls),
            "none" => Ok(SmtpSecurity::None),
            other => Err(format!(
                "SMTP_SECURITY must be one of starttls, tls, none (got `{other}`)"
            )),
        }
    }
}

pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub security: SmtpSecurity,
    pub username: String,
    pub password: String,
    pub from_address: String,
    pub from_name: String,
}

/// A rendered message, ready to send.
pub struct Email {
    pub to: Address,
    pub subject: String,
    pub text: String,
    pub html: String,
    /// One-click unsubscribe URL (RFC 8058), set on list mail only.
    pub list_unsubscribe: Option<String>,
}

#[derive(Clone)]
pub struct Mailer {
    transport: AsyncSmtpTransport<Tokio1Executor>,
    from: Mailbox,
    /// Marks every subject from a `MODE=dev` site.
    subject_prefix: &'static str,
}

impl Mailer {
    pub fn new(config: SmtpConfig, subject_prefix: &'static str) -> Result<Self, String> {
        let from_address = config
            .from_address
            .parse::<Address>()
            .map_err(|e| format!("SMTP_FROM_ADDRESS is not a valid address: {e}"))?;
        let builder = match config.security {
            SmtpSecurity::StartTls => {
                AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.host)
            }
            SmtpSecurity::Tls => AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host),
            SmtpSecurity::None => {
                tracing::warn!("SMTP_SECURITY=none: email is sent unencrypted");
                Ok(AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(
                    &config.host,
                ))
            }
        }
        .map_err(|e| format!("invalid SMTP_HOST `{}`: {e}", config.host))?;

        let transport = builder
            .port(config.port)
            .credentials(Credentials::new(config.username, config.password))
            .timeout(Some(SMTP_TIMEOUT))
            .build();

        Ok(Mailer {
            transport,
            from: Mailbox::new(Some(config.from_name), from_address),
            subject_prefix,
        })
    }

    async fn send(&self, email: Email) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut builder = Message::builder()
            .from(self.from.clone())
            .to(Mailbox::new(None, email.to))
            .subject(format!("{}{}", self.subject_prefix, email.subject));
        if let Some(url) = email.list_unsubscribe {
            builder = builder
                .raw_header(HeaderValue::new(
                    HeaderName::new_from_ascii_str("List-Unsubscribe"),
                    format!("<{url}>"),
                ))
                .raw_header(HeaderValue::new(
                    HeaderName::new_from_ascii_str("List-Unsubscribe-Post"),
                    "List-Unsubscribe=One-Click".to_string(),
                ));
        }
        let message = builder.multipart(
            MultiPart::alternative()
                .singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_PLAIN)
                        .body(email.text),
                )
                .singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_HTML)
                        .body(email.html),
                ),
        )?;
        self.transport.send(message).await?;
        Ok(())
    }

    /// Sends one message in the background. Failures are logged without the
    /// recipient address, which is personal data.
    pub fn send_in_background(&self, email: Email) {
        let mailer = self.clone();
        tokio::spawn(async move {
            if let Err(e) = mailer.send(email).await {
                tracing::error!(error = %e, "email delivery failed");
                metrics::record_failure(Task::email_delivery);
            }
        });
    }

    /// Sends messages one after another in the background, throttled by
    /// `BATCH_SEND_INTERVAL`. A failed message is logged and skipped.
    pub fn send_batch_in_background(&self, emails: Vec<Email>) {
        let mailer = self.clone();
        tokio::spawn(async move {
            let total = emails.len();
            let mut failed = 0usize;
            for email in emails {
                if let Err(e) = mailer.send(email).await {
                    failed += 1;
                    tracing::error!(error = %e, "email delivery failed");
                    metrics::record_failure(Task::email_delivery);
                }
                tokio::time::sleep(BATCH_SEND_INTERVAL).await;
            }
            tracing::info!(total, failed, "email batch finished");
        });
    }
}

const MAX_EMAIL_LEN: usize = 254;

/// Trimmed, lowercased address if it is a syntactically valid mailbox.
pub fn normalize_email(raw: &str) -> Option<Address> {
    let email = raw.trim().to_lowercase();
    if email.len() > MAX_EMAIL_LEN {
        return None;
    }
    email.parse::<Address>().ok()
}

/// A styled call-to-action link, rendered as a button in HTML mail.
pub struct Action<'a> {
    pub label: &'a str,
    pub url: &'a str,
}

/// Wraps pre-escaped HTML paragraphs in the shared email layout.
pub fn html_layout(
    lang: Language,
    heading: &str,
    paragraphs: &[String],
    action: Option<&Action>,
    footer: &str,
) -> String {
    let body: String = paragraphs
        .iter()
        .map(|p| format!(r#"<p style="margin:0 0 16px;line-height:1.5">{p}</p>"#))
        .collect();
    let button = action.map_or_else(String::new, |a| {
        format!(
            r#"<p style="margin:24px 0"><a href="{}" style="display:inline-block;padding:12px 24px;background:#1f3a5f;color:#ffffff;text-decoration:none;border-radius:4px">{}</a></p>"#,
            escape_html(a.url),
            escape_html(a.label)
        )
    });
    format!(
        r#"<!doctype html>
<html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px 16px;background:#f5f1e8;font-family:Georgia,serif;color:#2b2b2b">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px 24px">
<p style="margin:0 0 24px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#8a6d1d">Miedăria Păunilor</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3">{heading}</h1>
{body}
{button}
<p style="margin:32px 0 0;font-size:13px;line-height:1.5;color:#6b6b6b">{footer}</p>
</div></body></html>"#,
        lang = lang.code(),
        heading = escape_html(heading),
    )
}

/// Escapes text for interpolation into HTML element content or a quoted
/// attribute value.
pub fn escape_html(text: &str) -> String {
    let mut escaped = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&#39;"),
            _ => escaped.push(c),
        }
    }
    escaped
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapes_markup_and_quotes() {
        assert_eq!(
            escape_html(r#"<a href="x">Tom & 'Jerry'</a>"#),
            "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;"
        );
    }

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
    fn parses_security_modes() {
        assert_eq!("starttls".parse(), Ok(SmtpSecurity::StartTls));
        assert_eq!("tls".parse(), Ok(SmtpSecurity::Tls));
        assert_eq!("none".parse(), Ok(SmtpSecurity::None));
        assert!("ssl".parse::<SmtpSecurity>().is_err());
    }
}
