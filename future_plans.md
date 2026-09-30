# Future Plans

Planned features for Miedăria Păunilor, in rough implementation order. Each section describes the goal, the design, and the concrete changes needed, grounded in the current architecture (Rust/axum/diesel backend, React/Vite frontend, PostgreSQL, Stripe checkout, `site_settings` key-value table, cookie-consent system).

---

## 4. Mailing list (blog notifications + product news)

> **DONE 2026-09-28.** Implemented as designed, with these decisions: unsubscribing deletes the row outright (so no `unsubscribed_at`), and unsubscribe links carry an HMAC of the subscriber id (key derived from `JWT_SECRET`) instead of a stored token hash, so every email can include a working link without any secret at rest. The admin endpoint returns subscriber counts only, never addresses. Confirmation and unsubscribe links land on frontend pages that POST, so mail-filter link scanners cannot act on them. Local testing uses a Mailpit container (`mail-dev` compose profile). Still outstanding outside the code: revoke the old Brevo SMTP key, generate a new one, put it in the production `.env`, verify the sender domain (SPF/DKIM/DMARC), and have the privacy policy (built 2026-09-28 at `/:lang/privacy-policy`) reviewed.

**Goal:** Visitors can subscribe to a mailing list. When an admin publishes a blog post, they can optionally email it to the list. A non-intrusive popup on the home page invites subscription after a while.

### Design

**Email infrastructure (prerequisite, shared with feature 5)**
- Add the `lettre` crate (async SMTP with rustls) and env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_ADDRESS`, `SMTP_FROM_NAME`, documented in `env.sample`.
- **Chosen provider: Brevo.** A Brevo account with an SMTP key already exists from an earlier, discarded implementation of this feature: relay `smtp-relay.brevo.com`, port 587 (STARTTLS), sender `newsletter@miedaria-paunilor.ro` / "Miedăria Păunilor". The credentials were removed from `.env` while the feature is shelved; when resuming, revoke the old SMTP key in the Brevo dashboard, generate a new one, and verify the sender domain (SPF/DKIM/DMARC) in Brevo before the first send.
- New backend module `mailer.rs`: template rendering (simple HTML + plain-text pairs, bilingual by subscriber language) and a send helper. Sends run in a spawned `tokio` task with per-message error logging so a slow SMTP server never blocks request handlers; batch sends are throttled (e.g. a few messages/second) to stay within provider limits.

**Data model**
```sql
CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,           -- stored lowercased
  language VARCHAR(2) NOT NULL,                 -- which locale they subscribed from
  confirmed_at TIMESTAMPTZ,                     -- NULL until double opt-in completes
  confirmation_token_hash VARCHAR(512),         -- hashed, single-use, expires
  token_expires_at TIMESTAMPTZ,
  unsubscribe_token_hash VARCHAR(512) NOT NULL, -- long-lived, in every email footer
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);
```
Tokens are random 256-bit values sent by URL; only their hashes are stored (same posture as password hashing). **Double opt-in is mandatory for GDPR**: a subscription is inactive until the confirmation link is clicked, and `confirmed_at` is the proof-of-consent timestamp.

**API**
- `POST /api/newsletter/subscribe` — public; body `{ email }`, language from `Accept-Language`. Rate-limited with the existing `governor` setup (per-IP). Always returns 200 regardless of whether the email is new, resubscribed, or already present (no subscriber enumeration). Sends the confirmation email.
- `GET /api/newsletter/confirm?token=...` — activates the subscription; frontend confirmation page.
- `GET /api/newsletter/unsubscribe?token=...` — one-click unsubscribe (sets `unsubscribed_at`); also honored via `List-Unsubscribe` header. Unsubscribed rows are purged (or at least emails erased) by a periodic cleanup — right-to-erasure.
- `GET /api/admin/newsletter/subscribers` — paginated count/list for the admin dashboard (count is the useful part; avoid exposing full emails casually).

**Blog integration**
- `POST /api/admin/blog/{id}/notify` — admin-only; sends the post (title, excerpt, link; subscriber's language decides which bilingual fields) to all confirmed subscribers. Guards: post must be published; record `notified_at` on `blog_posts` (new nullable column) so the same post can't be mass-mailed twice accidentally (a `?resend=true` override is fine).
- Admin UI: in `BlogForm`/`AdminBlogEdit`, when publishing (or on the blog list for already-published posts), an "Email subscribers" action with a `ConfirmModal` showing the recipient count.

**Home page popup**
- New `NewsletterPopup` component, mounted on the home page only. Non-intrusive rules:
  - Appears after meaningful engagement (e.g. 25 s on page *and* ≥40 % scroll), never within the first seconds.
  - Never shown while the `AgeGate` or `CookieConsentBanner` is open.
  - Small bottom-corner card, not a screen-blocking modal; dismissible via X and Escape.
  - Frequency-capped: dismissal is remembered for ~60 days, successful subscription forever. Store the flag in `localStorage` when cookie consent is `accepted`; if consent is `declined`, keep it in `sessionStorage` only (per-visit memory, no persistent identifier — consistent with the existing consent semantics in `lib/consent.ts`).
- Inline email field + submit inside the popup; success state confirms "check your inbox".

**GDPR notes:** double opt-in, unsubscribe link in every email, purge on unsubscribe, subscription purpose stated at the form ("product updates and news"), no tracking pixels in emails.

**Effort:** Medium-large. The SMTP plumbing is the main new infrastructure and is reused by feature 5.

---

## 5. User accounts

> **Parts (a) and (b) plus the GDPR endpoints DONE 2026-09-29.** Implemented with these changes to the design below:
> - **Email-first registration.** Registering takes only an email address, and the password is chosen from the emailed link. This closes a hole in "register with a password, then verify": someone could register another person's address with their own password, and if the owner clicked the unsolicited verification link, that person's guest orders would be linked to an account the stranger controls. The same set-password page serves password resets.
> - **Database sessions instead of customer JWTs.** A random token in a `__Host-customer_session` cookie (HttpOnly, Secure, SameSite=Strict), stored as a hash, ending after 7 days idle or 30 days in all. Logging out, password changes, email changes and deletion revoke sessions immediately.
> - **Tokens in their own table.** Emailed tokens live in `customer_tokens` (one per customer and purpose) instead of columns on `customers`. The old `users` table is dropped.
> - **Re-authentication.** Email change, password change, data export and deletion all ask for the current password again.
> - **Credential-stuffing defences.** Password checks are limited per network and per account and counted in `account_logins_total`. A Grafana alert fires above 100 failures an hour.
> - **Guest-order linking.** Guest orders are linked when an address is verified, and later guest checkouts are linked when their Stripe email matches a verified account.
>
> **Deferred to #7 (Sameday):** saved addresses (`customer_addresses`), since Stripe still collects the delivery address and saved addresses would have nothing to fill.
>
> **Google sign-in added 2026-09-29.**
> - Server-side OpenID Connect with PKCE; no Google script on the site.
> - Identities are keyed by Google's `sub`, never by email.
> - An address that already has an account is only connected to Google by its owner, from Settings.
> - Google verifies the address and links guest orders only for Gmail and matching Workspace domains.
> - Accounts without a password confirm sensitive actions by signing in with Google again.
>
> **Still outstanding outside the code:** legal review of the new privacy-policy sections (accounts, Google as sign-in provider).

**Goal:** Customers can create accounts to track orders, see order history, and securely save delivery details.

### Design

**Scope decisions**
- **Guest checkout remains** — accounts are optional, never a purchase barrier.
- Email + password auth (Argon2id, same posture as `admin_users`) with mandatory email verification (reuses `mailer.rs` from feature 4). Password reset via emailed single-use token.
- Customer auth is **completely separate from admin auth**: separate table, separate JWT claims (`role: "customer"`), separate extractor (`CustomerAuth` alongside the existing `Auth`), so a customer token can never reach an admin route.

**Data model**
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,           -- lowercased
  hashed_password VARCHAR(512) NOT NULL,        -- Argon2id PHC string
  email_verified_at TIMESTAMPTZ,
  verification_token_hash VARCHAR(512),
  token_expires_at TIMESTAMPTZ,
  reset_token_hash VARCHAR(512),
  reset_token_expires_at TIMESTAMPTZ,
  language VARCHAR(2) NOT NULL DEFAULT 'ro',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label VARCHAR(64),                            -- "Home", "Office"
  recipient_name VARCHAR(256) NOT NULL,
  phone VARCHAR(32),
  street_address VARCHAR(512) NOT NULL,
  city VARCHAR(128) NOT NULL,
  county VARCHAR(128) NOT NULL,
  postal_code VARCHAR(16) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX idx_orders_customer ON orders(customer_id, created_at DESC);
```
The old empty `users` table gets dropped or replaced by `customers`.

**Order linkage**
- Logged-in checkout: `create_checkout_session` attaches `customer_id` to the pending order and pre-fills Stripe's `customer_email`.
- Existing guest orders can be claimed lazily: on login/registration, orders whose `customer_email` (set by the Stripe webhook) matches the **verified** account email get linked. Only after verification — otherwise registering with someone else's email would expose their order history.

**API**
- `POST /api/account/register`, `POST /api/account/login` (rate-limited like admin login), `POST /api/account/logout`
- `GET /api/account/verify?token=...`, `POST /api/account/password-reset/request`, `POST /api/account/password-reset/confirm`
- `GET /api/account/me`, `PUT /api/account/me` (change email → re-verification; change password → requires current password)
- `GET/POST/PUT/DELETE /api/account/addresses`
- `GET /api/account/orders` — paginated order history with items and status
- `DELETE /api/account` — account deletion (GDPR): delete customer + addresses; orders are retained for the legal bookkeeping period but detached (`customer_id` NULL'd by `ON DELETE SET NULL`) — state this in the privacy policy.
- `GET /api/account/export` — JSON export of the customer's data (GDPR data portability).

**Frontend**
- New `AccountContext` mirroring the admin `AuthContext` but with separate token storage keys.
- Routes: `/account/login`, `/account/register`, `/account/verify`, `/account/reset-password`, and a protected `/account` area (profile, addresses, order history with per-order detail).
- Navbar: a small account icon (login link or account menu); cart/checkout offers "log in" but never requires it.
- Saved addresses surface at checkout. Note: today Stripe Checkout collects the shipping address on Stripe's page; saved addresses become fully useful if/when address collection moves into the site — the plan keeps them forward-compatible (pass the default address as Stripe session prefill where the API allows).

**Security checklist:** verification/reset tokens hashed at rest + single-use + short expiry; uniform responses on register/reset to avoid account enumeration; login rate limiting; cookie or storage handling consistent with the consent framework; customer JWTs signed with the same `JWT_SECRET` but distinct claims and shorter expiry.

**Effort:** Large — the biggest feature here. Depends on feature 4's mailer. Sensible split: (a) auth + account pages, (b) order linkage + history, (c) addresses + GDPR endpoints.

---

## 9. Order data retention

> **DONE 2026-09-29.** A daily task (`retention.rs`) erases the personal data of paid orders once 5 years have passed since the end of their financial year. Expired and failed orders are erased 90 days after they ended. The anonymous amounts and products stay for the accounting records and the metrics.
>
> **Still outstanding outside the code:**
> - Encrypt the production server's disk.
> - Set up encrypted, time-limited database backups. Erased data survives in older backups until they expire, so backup retention must be shorter than the time needed to answer an erasure request.
> - Include the updated privacy-policy wording in the legal review.

---

## 6. Platform metrics (GDPR-compliant)

> **Phase 1 DONE 2026-09-29, on Prometheus + Grafana** (an in-app admin metrics page built 2026-09-28 was replaced before commit). The backend exports request counters, background-task failures and shop totals (checkouts, paid orders and revenue per currency, bottles and revenue per product, stock and reserved stock per product, stale delayed payments, subscribers) on an internal-only port; Prometheus keeps 2 years; Grafana at `/grafana/` has a provisioned Shop dashboard and emailed alerts. Sales history starts when Prometheus is first deployed. The `processing` limitation below is resolved: a Grafana alert fires for orders stuck more than 3 days, and a daily backend task settles them from Stripe's PaymentIntent. Not built: checkout-toggle history, sell-through per lot (order items don't record the lot) and add-to-cart rejections (the cart never reaches the server); these need new data and belong with phase 2, whose event counters can now be added as Prometheus metrics instead of an `analytics_events` table.
>
> **Phase 2 DONE 2026-09-29, as in-memory Prometheus counters instead of an `analytics_events` table**, so no event is ever stored.
> - The browser posts each event to `POST /api/events` (`lib/analytics.ts`, `backend/src/analytics.rs`): page views with the previous page or the kind of referrer, product and blog post views, cart additions, cart-limit hits (the lost demand the phase-1 note mentioned), shop filters and the newsletter popup's outcomes.
> - Every label comes from a closed set or the live catalog, and referring hosts are reduced to direct, search, social, email or other.
> - Daily visitors are counted with an HMAC of the client network and user agent under an in-memory key that is replaced at midnight, together with the day's hashes.
> - Do Not Track, Global Privacy Control, `navigator.webdriver` and bot user agents are not counted.
> - Checkout-toggle history is the `shop_checkout_enabled` gauge.
> - Everything shows on a new Traffic dashboard, with the checkout timeline on the Shop dashboard.
>
> **Not built:** sell-through per lot. Order items don't record the lot, and lots don't record how many bottles were filled.

**Goal:** Give admins visibility into how the shop performs. The metric set is not final; below is a proposed catalog grounded in what the platform already records, plus the collection design.

### Approach: first-party, cookieless, aggregate-only

Rather than adding a third-party tracker, collect events server-side into Postgres and render them in a new admin dashboard page. Cookieless + no cross-session identifier means no personal data is processed for analytics, which keeps us out of consent-banner territory entirely (and matches the existing minimal-cookie philosophy — the current consent banner only governs cart/language cookies).

**Collection rules (the GDPR core):**
- No analytics cookies, no fingerprinting, no persistent identifiers.
- Never store raw IPs or user agents. For unique-visitor approximation use the Plausible-style daily-rotating anonymous hash: `hash(daily_salt, truncated_ip, coarse_UA)` where the salt is discarded every 24 h — yields daily uniques without any way to track a person across days.
- Store events with coarse timestamps and no URL query strings (querystrings can leak tokens/emails).
- Aggregate old data: keep raw events ~90 days, roll up into daily aggregate tables kept indefinitely (aggregates are anonymous by construction).
- Admin-only access; document the processing in the privacy policy under legitimate interest.

**Implementation sketch:**
- `analytics_events` table: `(id, event_type, path, product_id NULL, language, referrer_domain NULL, visitor_hash, created_at)` + daily rollup tables.
- Backend: `POST /api/events` (public, rate-limited, strict allowlist of event types — reject anything else), plus server-side recording for events the backend already sees (checkout created, order paid via webhook, out-of-stock rejections).
- Frontend: a tiny `track(event, props)` helper honoring `navigator.doNotTrack`, called from route changes and key interactions. No consent gate needed given the rules above, but if any future metric adds an identifier, it must move behind `useConsent`.
- Admin UI: panels on the Grafana Shop dashboard.

### Proposed metric catalog

**Sales / revenue (from `orders` — already collected, zero privacy cost):**
- Orders and revenue per day/week/month, split by currency and status (paid / pending / expired / failed).
- Checkout funnel: sessions created → paid (the expired/failed gap is the funnel leak).
- Average order value; units per order; top products by revenue and by bottles.
- Effect of the checkout-enabled toggle (time spent disabled).

**Catalog / inventory (from `products`/`lots` — no privacy cost):**
- Stock-out events and days-out-of-stock per product; low-stock trend.
- Sell-through rate per lot (bottles sold vs. bottled).
- Add-to-cart rejections due to stock limits (signal of lost demand).

**Traffic / engagement (event-based, anonymous):**
- Page views + daily unique visitors (rotating-hash method), per path.
- Product detail views per product; view → add-to-cart → checkout conversion per product.
- Shop filter usage (which mead types / sweetness levels people filter by — informs production).
- Blog post views; blog → shop click-through.
- Language split (en/ro) and referrer domains (domain only).
- Newsletter popup: shown / dismissed / subscribed (measures feature 4's popup unobtrusiveness — a high dismiss rate means tune the trigger).

**Operational (backend logs → counters):**
- API error rates (4xx/5xx), Stripe webhook failures, BNR rate-fetch failures (feature 3), email delivery failures (features 4–5).
- Orders stuck in `processing`: count and age of orders whose delayed payment has not resolved.

### Known limitation: unresolved `processing` orders

An order paid with a delayed method (bank debit, transfer) moves to `processing` and keeps its stock reserved until Stripe sends `checkout.session.async_payment_succeeded` or `…_failed`. Unlike `pending` orders, these are exempt from the 15-minute reservation sweeper, so if that final webhook never arrives (endpoint misconfigured, not subscribed to the async events, or down beyond Stripe's 3-day retry window), the order stays `processing` and its bottles stay off sale indefinitely.

**Goal:**
- Surface it: the `processing` count/age metric above, with an admin-dashboard warning for any order in `processing` longer than a threshold (e.g. 3 days).
- Reconcile it: extend `stripe_checkout.rs` with a daily task that retrieves the PaymentIntent of each stale `processing` order from Stripe and applies the outcome (`succeeded` → `paid`; `requires_payment_method`/`canceled` → release stock as `failed`), sharing the transition functions the webhook already uses so both paths stay idempotent.

**Effort:** Medium. Start with the zero-cost sales/inventory metrics (pure queries over existing tables) — that alone makes the metrics page useful — then add the event pipeline.

---

## 7. Delivery integration with Sameday (courier + easybox lockers)

> **Code DONE 2026-09-29, not yet tested against Sameday.** Built with these decisions:
> - **Flat prices** per method (home, easybox), free above a threshold, set by the admin. No live cost estimate, so checkout never depends on Sameday being up.
> - **Stripe still collects the home address and phone.** The cart only chooses home or easybox (Sameday's own map widget, loaded on click). Saved addresses (`customer_addresses`, deferred from #5) are dropped: there is nothing for them to fill.
> - **18+ confirmation** at checkout, stored on the order; easybox parcels are capped at 18 kg.
> - **Admin-triggered AWBs** with label download and cancellation, a "your order is on its way" email, and tracking by polling every 30 minutes (Sameday has no webhooks).
> - **Everything Sameday is optional:** without the four `SAMEDAY_*` variables the site sells home delivery only and waybills are made by hand in eAWB.
>
> **Still outstanding outside the code:**
> - Ask Sameday for an account: demo API credentials, then production ones, and a locker-map `clientId`. Then test the whole flow on the demo environment: locker sync, easybox checkout, AWB creation, the label, tracking. The code was checked against Sameday's API documentation v3.5 (2026-09-30).
> - Confirm in the contract that alcohol and glass are accepted, including in easybox, and whether the 18 kg easybox cap needs lowering.
> - Customs: whether the mead needs an authorized tax warehouse (antrepozit fiscal).
> - Legal review: delivering alcohol to a locker with only an 18+ declaration, and the new privacy and cookie wording (Sameday as a recipient, the locker map). Fill in Sameday's legal entity name in the privacy policy; it could not be confirmed from an official source.
> - Set each product's packed weight in the admin (seeded at 1.8 g per ml) and review the seeded shipping prices.

**Goal:** Ship orders via Sameday, Romania's dominant courier: generate AWBs (waybills) from paid orders, print labels, track shipments, and offer **easybox locker delivery** at checkout.

### Can we use `sameday-courier/php-sdk`?

**Not directly — but it's still valuable.** The [official SDK](https://github.com/sameday-courier/php-sdk) is 99.7 % PHP and our backend is Rust, so the library itself cannot be embedded (and running a PHP sidecar just to call a REST API would add a container, another attack surface, and operational complexity for zero benefit). However, the SDK is a thin wrapper over Sameday's plain **RESTful API**, which has its own [interactive sandbox documentation](https://sameday-api.demo.zitec.com/documentation/client). **Decision: implement a small Rust client module against the REST API directly**, using the PHP SDK and the [official WooCommerce plugin](https://github.com/sameday-courier/woocommerce-plugin) as reference implementations — they document real-world request shapes (`SamedayPostAwbRequest.md` in the SDK's `docs/`), the demo-vs-production ID differences, and the easybox checkout flow (e.g. the plugin validates "Please choose your EasyBox Locker!" when an out-of-home service is selected without a locker).

Key API facts (from the SDK and sandbox docs):
- **Auth:** `POST /api/authenticate` with `X-AUTH-USERNAME` / `X-AUTH-PASSWORD` headers returns a token used on subsequent calls. Credentials come from a Sameday eAWB account (eawb.sameday.ro); production API access is granted by Sameday (software@sameday.ro).
- **Environments:** sandbox at `sameday-api.demo.zitec.com`, production at `api.sameday.ro`. Pickup-point/service IDs differ between the two — never hardcode IDs; always sync them per environment.
- **Core endpoints:** pickup points (`/api/client/pickup-points`), services (home delivery, NextDay, locker services incl. cross-border XB/XL), AWB creation (parcels with dimensions/weight, recipient, COD, insured value), AWB PDF label download (A6), tracking by AWB/parcel number, and locker listings.

### Design

**Prerequisite:** this builds on the address-collection part of user accounts (#5) — locker/courier choice must happen **on our checkout page before the Stripe session is created**, which means moving shipping-address (or locker) selection into the site rather than relying on Stripe Checkout's address collection.

**Backend (`sameday.rs` module + `routes/shipping.rs`):**
- Config via env: `SAMEDAY_API_URL`, `SAMEDAY_USERNAME`, `SAMEDAY_PASSWORD`, `SAMEDAY_PICKUP_POINT_ID`.
- Token management: authenticate lazily, cache the token in `AppState`, re-authenticate on 401.
- Reference-data sync: fetch services and lockers on startup and on a daily `tokio` task (same pattern as the BNR fetcher in #3); cache lockers in a `sameday_lockers` table so checkout can query "lockers near city X" without hitting the API per pageview.
- New tables: `shipments (id, order_id FK, awb_number, service_id, status, locker_id NULL, shipping_cost_cents, created_at, updated_at)`; add `shipping_method` (`home` / `locker`) and `shipping_address` / `locker_id` snapshot columns to `orders`.
- Shipping cost: request an AWB **cost estimate** from Sameday during checkout and add it as a Stripe line item (or a flat rate with free-shipping threshold as a simpler v1 — recommended starting point; estimates can come later).
- **AWB creation is admin-triggered, not automatic**: a mead business hand-packs boxes, so on the admin orders page a paid order gets a "Generate AWB" action (with `ConfirmModal`) → calls Sameday, stores the AWB number, exposes "Download label (PDF)" proxied through the backend. Automatic creation on `payment_intent.succeeded` can be a later toggle in `site_settings`.
- Tracking: poll shipment status daily (or on order-detail view with short-lived caching); surface status on the admin orders page and — once accounts exist — the customer's order-history page. Include the AWB number in the order-confirmation email (mailer from #4).

**Frontend:**
- Checkout step before payment: choose **home delivery** (address form, pre-filled from saved addresses for logged-in customers) or **easybox locker** (county/city selector → locker list with name + address; Sameday also offers an embeddable locker-picker map plugin, worth evaluating). Selection is validated server-side when the Stripe session is created — reject out-of-home service without a `locker_id`, mirroring the WooCommerce plugin's guard.
- Admin orders page: shipment column (AWB number, status badge, label download).

**Constraints to respect:** meads are alcohol — verify Sameday's terms for alcohol transport and locker eligibility for the products (bottle weight/dimensions matter for parcel declarations; store per-product weight, which likely means a new `weight_grams` column on `products`). Age verification (18+) at delivery is the courier's concern, but the site already has the AgeGate.

**Effort:** Large. Order: reference-data sync + tables → checkout shipping step → AWB generation + labels in admin → tracking → (later) automatic AWB and live cost estimates.

Sources: [Sameday PHP SDK](https://github.com/sameday-courier/php-sdk) · [sandbox API docs](https://sameday-api.demo.zitec.com/documentation/client) · [WooCommerce plugin](https://github.com/sameday-courier/woocommerce-plugin) · [easybox service info](https://sameday.ro/easybox/vreau-sa-utilizez-serviciul-easybox/?lang=en)

---

## 8. Cookie policy page

> **DONE 2026-09-28.** Implemented as designed at `/:lang/cookie-policy`, linked from the consent banner and the footer, and listed in the sitemap and the legacy-path nginx redirect. Decision on `theme`: treated as user-requested UI customisation (no consent needed), and it is now written only when the visitor explicitly picks light or dark; returning to the system theme deletes it. Still outstanding outside the code: legal review of the wording (Legea 506/2004, ANSPDCP). The privacy policy now exists at `/:lang/privacy-policy` and the two pages link to each other.

**Goal:** A bilingual page that lists every cookie and browser-storage item the site uses, what each is for, how long it lasts and whether it needs consent, and explains how to change the choice. The consent banner and footer link to it. It is needed before launch, since consent is only valid when informed.

### Design

- Route `/:lang/cookie-policy` (page `CookiePolicy.tsx`), content in `en.json` / `ro.json` like the other static pages. Add it to the static paths in `sitemap_crud.rs`.
- Link it from the cookie banner message ("Detalii") and from the footer next to "Setări cookie-uri". The page itself should also offer a button that calls `resetConsent()`.
- Inventory to document (keep it in sync with the code):

| Name | Where | Purpose | Lifetime | Needs consent |
| --- | --- | --- | --- | --- |
| `age_verified` | cookie | 18+ confirmation (legal requirement for alcohol) | 6 months | No, strictly necessary |
| `cookie_consent` | cookie | Remembers the consent choice | 6 months | No, strictly necessary |
| `cart` | cookie | Cart contents (product ids + quantities) | 7 days, renewed on change | No, strictly necessary |
| `admin_session` | httpOnly cookie, `/api/admin` only | Admin login | up to 24 h | No, strictly necessary (admins only) |
| `pending_checkout` | sessionStorage | Releases reserved stock if the customer leaves Stripe without paying | until the tab closes | No, strictly necessary |
| `lang` | cookie | Preferred language for the root redirect | 1 year | Yes |
| `i18nextLng` | localStorage | Preferred language | until cleared | Yes |
| `theme` | localStorage | Light/dark theme choice | until cleared | Currently stored without consent; decide whether it counts as strictly necessary (user-requested preference) or gate it like `lang` |

- Also mention that Stripe sets its own cookies on `checkout.stripe.com` during payment, under Stripe's policy (link it).
- Have the final wording reviewed for Romanian GDPR/ePrivacy practice (Legea 506/2004, ANSPDCP guidance). The same review should cover the separate privacy policy (order data, delivery addresses, retention), which this page should link to once it exists.

**Effort:** Small. One static page, two links, translations; the review of the wording is the main work.

---

## Suggested implementation order

Everything above is built. What remains is the work outside the code listed in each DONE note, starting with the Sameday account and its demo testing (#7).
