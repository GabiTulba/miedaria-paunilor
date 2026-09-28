//! Outgoing email over SMTP. Sends run in spawned tasks, so a slow or
//! unreachable relay never holds up a request handler.

use std::str::FromStr;
use std::time::Duration;

use lettre::message::header::{ContentType, HeaderName, HeaderValue};
use lettre::message::{Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Address, AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

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
}

impl Mailer {
    pub fn new(config: SmtpConfig) -> Result<Self, String> {
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
        })
    }

    async fn send(&self, email: Email) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut builder = Message::builder()
            .from(self.from.clone())
            .to(Mailbox::new(None, email.to))
            .subject(email.subject);
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
                }
                tokio::time::sleep(BATCH_SEND_INTERVAL).await;
            }
            tracing::info!(total, failed, "email batch finished");
        });
    }
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
    fn parses_security_modes() {
        assert_eq!("starttls".parse(), Ok(SmtpSecurity::StartTls));
        assert_eq!("tls".parse(), Ok(SmtpSecurity::Tls));
        assert_eq!("none".parse(), Ok(SmtpSecurity::None));
        assert!("ssl".parse::<SmtpSecurity>().is_err());
    }
}
