//! Customer accounts: emailed tokens, login sessions, order linkage and
//! erasure. Tokens and sessions are stored only as SHA-256 hashes.

use chrono::{DateTime, Duration, Utc};
use diesel::prelude::*;
use diesel::result::{DatabaseErrorKind, Error as DieselError};
use diesel::sql_types::{Integer, Interval, Nullable, Timestamptz, Uuid as SqlUuid, Varchar};
use uuid::Uuid;

use crate::enums::{CustomerTokenPurpose, OrderStatus};
use crate::models::{AccountOrder, AccountOrderWithItems, Customer, OrderItem, ShipmentTracking};
use crate::schema::sql_types::CustomerTokenPurposeEnum;
use crate::schema::{
    customer_identities, customer_sessions, customer_tokens, customers, order_items, orders,
    shipments,
};
use crate::tokens::{hash_token, random_token};

/// A session ends after this long without use...
pub const SESSION_IDLE_TIMEOUT: Duration = Duration::days(7);
/// ...and this long after login in any case.
pub const SESSION_LIFETIME: Duration = Duration::days(30);
/// `last_seen_at` is refreshed at most this often, so reads rarely write.
const SESSION_TOUCH_INTERVAL: Duration = Duration::hours(1);
const MAX_SESSIONS_PER_CUSTOMER: i32 = 10;

pub const REGISTRATION_TOKEN_TTL: Duration = Duration::hours(24);
pub const PASSWORD_RESET_TOKEN_TTL: Duration = Duration::hours(1);
pub const EMAIL_CHANGE_TOKEN_TTL: Duration = Duration::hours(24);
/// Minimum gap between two emailed tokens of the same purpose to one account,
/// so the forms cannot be used to flood someone's inbox.
const TOKEN_RESEND_COOLDOWN_MINUTES: i32 = 10;

/// Orders a customer placed; abandoned checkouts (`pending`, `expired`) are
/// not part of their history.
const HISTORY_STATUSES: [OrderStatus; 3] = [
    OrderStatus::Processing,
    OrderStatus::Paid,
    OrderStatus::Failed,
];

diesel::define_sql_function!(fn lower(x: Nullable<Varchar>) -> Nullable<Varchar>);

pub fn count_verified(conn: &mut PgConnection) -> QueryResult<i64> {
    customers::table
        .filter(customers::email_verified_at.is_not_null())
        .count()
        .get_result(conn)
}

pub fn find_by_email(conn: &mut PgConnection, email: &str) -> QueryResult<Option<Customer>> {
    customers::table
        .filter(customers::email.eq(email))
        .select(Customer::as_select())
        .first(conn)
        .optional()
}

pub fn get(conn: &mut PgConnection, id: Uuid) -> QueryResult<Customer> {
    customers::table
        .find(id)
        .select(Customer::as_select())
        .first(conn)
}

/// The account for `email`, created without a password if there is none yet.
pub fn find_or_create(
    conn: &mut PgConnection,
    email: &str,
    language: &str,
) -> QueryResult<Customer> {
    diesel::insert_into(customers::table)
        .values((customers::email.eq(email), customers::language.eq(language)))
        .on_conflict(customers::email)
        .do_nothing()
        .execute(conn)?;
    customers::table
        .filter(customers::email.eq(email))
        .select(Customer::as_select())
        .first(conn)
}

pub fn set_language(conn: &mut PgConnection, id: Uuid, language: &str) -> QueryResult<()> {
    diesel::update(
        customers::table
            .find(id)
            .filter(customers::language.ne(language)),
    )
    .set(customers::language.eq(language))
    .execute(conn)
    .map(drop)
}

/// Issues a token, replacing any earlier one of the same purpose. Returns
/// `None` while the previous one is younger than the resend cooldown.
pub fn issue_token(
    conn: &mut PgConnection,
    customer_id: Uuid,
    purpose: CustomerTokenPurpose,
    ttl: Duration,
    new_email: Option<&str>,
) -> QueryResult<Option<String>> {
    let token = random_token();
    let issued = diesel::sql_query(
        "INSERT INTO customer_tokens (customer_id, purpose, token_hash, new_email, expires_at) \
         VALUES ($1, $2, $3, $4, $5) \
         ON CONFLICT (customer_id, purpose) DO UPDATE SET \
             token_hash = EXCLUDED.token_hash, new_email = EXCLUDED.new_email, \
             expires_at = EXCLUDED.expires_at, created_at = NOW() \
         WHERE customer_tokens.created_at < NOW() - make_interval(mins => $6)",
    )
    .bind::<SqlUuid, _>(customer_id)
    .bind::<CustomerTokenPurposeEnum, _>(purpose)
    .bind::<Varchar, _>(hash_token(&token))
    .bind::<Nullable<Varchar>, _>(new_email)
    .bind::<Timestamptz, _>(Utc::now() + ttl)
    .bind::<Integer, _>(TOKEN_RESEND_COOLDOWN_MINUTES)
    .execute(conn)?;
    Ok((issued == 1).then_some(token))
}

/// The account a live token belongs to, without using the token up.
pub fn token_owner(
    conn: &mut PgConnection,
    purpose: CustomerTokenPurpose,
    token: &str,
) -> QueryResult<Option<Customer>> {
    customer_tokens::table
        .inner_join(customers::table)
        .filter(customer_tokens::token_hash.eq(hash_token(token)))
        .filter(customer_tokens::purpose.eq(purpose))
        .filter(customer_tokens::expires_at.gt(Utc::now()))
        .select(Customer::as_select())
        .first(conn)
        .optional()
}

/// Uses up a live token, returning its account and (for an email change) the
/// target address.
pub fn consume_token(
    conn: &mut PgConnection,
    purpose: CustomerTokenPurpose,
    token: &str,
) -> QueryResult<Option<(Uuid, Option<String>)>> {
    diesel::delete(
        customer_tokens::table
            .filter(customer_tokens::token_hash.eq(hash_token(token)))
            .filter(customer_tokens::purpose.eq(purpose))
            .filter(customer_tokens::expires_at.gt(Utc::now())),
    )
    .returning((customer_tokens::customer_id, customer_tokens::new_email))
    .get_result(conn)
    .optional()
}

/// Stores a new password hash. The token that authorised it was emailed to
/// the account's address, so the address counts as verified from now on. If
/// it was not verified before, a Google sign-in linked to the account did
/// not prove ownership of the address, so it is removed: the inbox owner now
/// holds the account.
pub fn set_password(conn: &mut PgConnection, id: Uuid, hashed_password: &str) -> QueryResult<()> {
    diesel::sql_query(
        "DELETE FROM customer_identities WHERE customer_id = $1 \
         AND EXISTS (SELECT 1 FROM customers WHERE id = $1 AND email_verified_at IS NULL)",
    )
    .bind::<SqlUuid, _>(id)
    .execute(conn)?;
    diesel::sql_query(
        "UPDATE customers SET hashed_password = $2, \
         email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1",
    )
    .bind::<SqlUuid, _>(id)
    .bind::<Varchar, _>(hashed_password)
    .execute(conn)
    .map(drop)
}

/// Moves an account to a verified new address. An account whose ownership of
/// that address was never proven (an unfinished registration, or a Google
/// sign-in Google is not authoritative for) is dropped; returns `false` if a
/// verified account already uses it.
pub fn change_email(conn: &mut PgConnection, id: Uuid, new_email: &str) -> QueryResult<bool> {
    diesel::delete(
        customers::table
            .filter(customers::email.eq(new_email))
            .filter(customers::email_verified_at.is_null()),
    )
    .execute(conn)?;
    match diesel::update(customers::table.find(id))
        .set((
            customers::email.eq(new_email),
            customers::email_verified_at.eq(Utc::now()),
        ))
        .execute(conn)
    {
        Ok(_) => Ok(true),
        Err(DieselError::DatabaseError(DatabaseErrorKind::UniqueViolation, _)) => Ok(false),
        Err(e) => Err(e),
    }
}

pub fn delete(conn: &mut PgConnection, id: Uuid) -> QueryResult<()> {
    diesel::delete(customers::table.find(id))
        .execute(conn)
        .map(drop)
}

/// Links guest orders placed with `email` to the account that has just
/// proven it owns that address.
pub fn link_guest_orders(conn: &mut PgConnection, id: Uuid, email: &str) -> QueryResult<usize> {
    diesel::update(
        orders::table
            .filter(orders::customer_id.is_null())
            .filter(lower(orders::customer_email).eq(email)),
    )
    .set(orders::customer_id.eq(id))
    .execute(conn)
}

/// Links a just-completed guest order to the verified account using the email
/// the customer gave Stripe, if there is one.
pub fn link_order_to_verified_account(conn: &mut PgConnection, order_id: Uuid) -> QueryResult<()> {
    diesel::sql_query(
        "UPDATE orders o SET customer_id = c.id FROM customers c \
         WHERE o.order_id = $1 AND o.customer_id IS NULL \
         AND c.email = lower(o.customer_email) AND c.email_verified_at IS NOT NULL",
    )
    .bind::<SqlUuid, _>(order_id)
    .execute(conn)
    .map(drop)
}

/// Starts a session and returns its cookie token. Keeps only the newest
/// sessions per account.
pub fn create_session(conn: &mut PgConnection, customer_id: Uuid) -> QueryResult<String> {
    let token = random_token();
    diesel::insert_into(customer_sessions::table)
        .values((
            customer_sessions::token_hash.eq(hash_token(&token)),
            customer_sessions::customer_id.eq(customer_id),
            customer_sessions::expires_at.eq(Utc::now() + SESSION_LIFETIME),
        ))
        .execute(conn)?;
    diesel::sql_query(
        "DELETE FROM customer_sessions WHERE customer_id = $1 AND token_hash NOT IN ( \
             SELECT token_hash FROM customer_sessions WHERE customer_id = $1 \
             ORDER BY created_at DESC LIMIT $2)",
    )
    .bind::<SqlUuid, _>(customer_id)
    .bind::<Integer, _>(MAX_SESSIONS_PER_CUSTOMER)
    .execute(conn)?;
    Ok(token)
}

/// A live session: its account and when it was signed in.
pub struct Session {
    pub customer_id: Uuid,
    pub signed_in_at: DateTime<Utc>,
}

pub fn session(conn: &mut PgConnection, token: &str) -> QueryResult<Option<Session>> {
    session_by_hash(conn, &hash_token(token))
}

pub fn session_by_hash(conn: &mut PgConnection, token_hash: &str) -> QueryResult<Option<Session>> {
    let now = Utc::now();
    let row: Option<(Uuid, DateTime<Utc>, DateTime<Utc>)> = customer_sessions::table
        .filter(customer_sessions::token_hash.eq(token_hash))
        .filter(customer_sessions::expires_at.gt(now))
        .filter(customer_sessions::last_seen_at.gt(now - SESSION_IDLE_TIMEOUT))
        .select((
            customer_sessions::customer_id,
            customer_sessions::created_at,
            customer_sessions::last_seen_at,
        ))
        .first(conn)
        .optional()?;
    let Some((customer_id, signed_in_at, last_seen_at)) = row else {
        return Ok(None);
    };
    if last_seen_at < now - SESSION_TOUCH_INTERVAL {
        diesel::update(customer_sessions::table.find(token_hash))
            .set(customer_sessions::last_seen_at.eq(now))
            .execute(conn)?;
    }
    Ok(Some(Session {
        customer_id,
        signed_in_at,
    }))
}

pub fn end_session(conn: &mut PgConnection, token: &str) -> QueryResult<()> {
    end_session_by_hash(conn, &hash_token(token))
}

pub fn end_session_by_hash(conn: &mut PgConnection, token_hash: &str) -> QueryResult<()> {
    diesel::delete(customer_sessions::table.find(token_hash))
        .execute(conn)
        .map(drop)
}

/// Ends every session of an account except the one holding `keep`.
pub fn end_sessions(
    conn: &mut PgConnection,
    customer_id: Uuid,
    keep: Option<&str>,
) -> QueryResult<()> {
    let kept_hash = keep.map(hash_token).unwrap_or_default();
    diesel::delete(
        customer_sessions::table
            .filter(customer_sessions::customer_id.eq(customer_id))
            .filter(customer_sessions::token_hash.ne(kept_hash)),
    )
    .execute(conn)
    .map(drop)
}

/// Deletes expired tokens and sessions, then registrations whose link
/// expired unused (accounts with neither a password nor a linked sign-in). Returns the number of registrations removed.
pub fn purge_expired(conn: &mut PgConnection) -> QueryResult<usize> {
    let now = Utc::now();
    diesel::delete(customer_tokens::table.filter(customer_tokens::expires_at.le(now)))
        .execute(conn)?;
    diesel::delete(
        customer_sessions::table.filter(
            customer_sessions::expires_at
                .le(now)
                .or(customer_sessions::last_seen_at.le(now - SESSION_IDLE_TIMEOUT)),
        ),
    )
    .execute(conn)?;
    diesel::sql_query(
        "DELETE FROM customers c WHERE c.hashed_password IS NULL \
         AND c.created_at < NOW() - $1 \
         AND NOT EXISTS (SELECT 1 FROM customer_tokens t WHERE t.customer_id = c.id) \
         AND NOT EXISTS (SELECT 1 FROM customer_identities i WHERE i.customer_id = c.id)",
    )
    .bind::<Interval, _>(diesel::data_types::PgInterval::from_microseconds(
        REGISTRATION_TOKEN_TTL
            .num_microseconds()
            .unwrap_or(i64::MAX),
    ))
    .execute(conn)
}

pub fn count_orders(conn: &mut PgConnection, customer_id: Uuid) -> QueryResult<i64> {
    orders::table
        .filter(orders::customer_id.eq(customer_id))
        .filter(orders::status.eq_any(HISTORY_STATUSES))
        .count()
        .get_result(conn)
}

pub fn list_orders(
    conn: &mut PgConnection,
    customer_id: Uuid,
    limit: i64,
    offset: i64,
) -> QueryResult<Vec<AccountOrder>> {
    orders::table
        .filter(orders::customer_id.eq(customer_id))
        .filter(orders::status.eq_any(HISTORY_STATUSES))
        .order(orders::created_at.desc())
        .limit(limit)
        .offset(offset)
        .select(AccountOrder::as_select())
        .load(conn)
}

/// One of the customer's own orders; `None` for anyone else's.
pub fn get_order(
    conn: &mut PgConnection,
    customer_id: Uuid,
    order_id: Uuid,
) -> QueryResult<Option<AccountOrderWithItems>> {
    let order = orders::table
        .filter(orders::order_id.eq(order_id))
        .filter(orders::customer_id.eq(customer_id))
        .filter(orders::status.eq_any(HISTORY_STATUSES))
        .select(AccountOrder::as_select())
        .first(conn)
        .optional()?;
    order.map(|order| with_items(conn, order)).transpose()
}

/// Every order of the account, with items, for the data export.
pub fn all_orders(
    conn: &mut PgConnection,
    customer_id: Uuid,
) -> QueryResult<Vec<AccountOrderWithItems>> {
    orders::table
        .filter(orders::customer_id.eq(customer_id))
        .order(orders::created_at.desc())
        .select(AccountOrder::as_select())
        .load(conn)?
        .into_iter()
        .map(|order| with_items(conn, order))
        .collect()
}

fn with_items(conn: &mut PgConnection, order: AccountOrder) -> QueryResult<AccountOrderWithItems> {
    let items = order_items::table
        .filter(order_items::order_id.eq(order.order_id))
        .select(OrderItem::as_select())
        .load(conn)?;
    let tracking = shipments::table
        .find(order.order_id)
        .select(ShipmentTracking::as_select())
        .first(conn)
        .optional()?;
    Ok(AccountOrderWithItems {
        order,
        items,
        tracking,
    })
}

pub const GOOGLE: &str = "google";

/// The account a provider identity is linked to.
pub fn find_by_identity(
    conn: &mut PgConnection,
    provider: &str,
    subject: &str,
) -> QueryResult<Option<Customer>> {
    customer_identities::table
        .inner_join(customers::table)
        .filter(customer_identities::provider.eq(provider))
        .filter(customer_identities::subject.eq(subject))
        .select(Customer::as_select())
        .first(conn)
        .optional()
}

/// When the account's identity with `provider` was linked, if it has one.
pub fn identity_linked_at(
    conn: &mut PgConnection,
    customer_id: Uuid,
    provider: &str,
) -> QueryResult<Option<DateTime<Utc>>> {
    customer_identities::table
        .filter(customer_identities::customer_id.eq(customer_id))
        .filter(customer_identities::provider.eq(provider))
        .select(customer_identities::created_at)
        .first(conn)
        .optional()
}

pub enum LinkOutcome {
    Linked,
    AlreadyLinked,
    /// The identity belongs to another account, or this account already has
    /// another identity with the provider.
    Conflict,
}

pub fn link_identity(
    conn: &mut PgConnection,
    customer_id: Uuid,
    provider: &str,
    subject: &str,
) -> QueryResult<LinkOutcome> {
    if let Some(owner) = find_by_identity(conn, provider, subject)? {
        return Ok(if owner.id == customer_id {
            LinkOutcome::AlreadyLinked
        } else {
            LinkOutcome::Conflict
        });
    }
    match diesel::insert_into(customer_identities::table)
        .values((
            customer_identities::provider.eq(provider),
            customer_identities::subject.eq(subject),
            customer_identities::customer_id.eq(customer_id),
        ))
        .execute(conn)
    {
        Ok(_) => Ok(LinkOutcome::Linked),
        Err(DieselError::DatabaseError(DatabaseErrorKind::UniqueViolation, _)) => {
            Ok(LinkOutcome::Conflict)
        }
        Err(e) => Err(e),
    }
}

pub fn unlink_identity(
    conn: &mut PgConnection,
    customer_id: Uuid,
    provider: &str,
) -> QueryResult<bool> {
    diesel::delete(
        customer_identities::table
            .filter(customer_identities::customer_id.eq(customer_id))
            .filter(customer_identities::provider.eq(provider)),
    )
    .execute(conn)
    .map(|n| n > 0)
}

pub fn has_identity(conn: &mut PgConnection, customer_id: Uuid) -> QueryResult<bool> {
    diesel::select(diesel::dsl::exists(
        customer_identities::table.filter(customer_identities::customer_id.eq(customer_id)),
    ))
    .get_result(conn)
}

/// Marks an address as belonging to the account, when a provider that is
/// authoritative for it vouches for it, and links its guest orders.
pub fn verify_email_by_provider(conn: &mut PgConnection, customer: &Customer) -> QueryResult<()> {
    diesel::update(
        customers::table
            .find(customer.id)
            .filter(customers::email_verified_at.is_null()),
    )
    .set(customers::email_verified_at.eq(Utc::now()))
    .execute(conn)?;
    link_guest_orders(conn, customer.id, &customer.email).map(drop)
}
