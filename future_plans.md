# Future Plans

Planned features for Miedăria Păunilor, in rough implementation order. Each section describes the goal, the design, and the concrete changes needed, grounded in the current architecture (Rust/axum/diesel backend, React/Vite frontend, PostgreSQL, Stripe checkout, `site_settings` key-value table, cookie-consent system).

---

## 3. RON as the single price entry point, EUR derived from the BNR rate

**Goal:** RON is the only legal trading currency in Romania, so admins should input prices **only in RON**. The English site should display a **dynamically converted EUR price** with a `*` footnote explaining that the EUR amount is indicative, derived from the official BNR exchange rate. The official rate is published by BNR at <https://curs.bnr.ro/nbrfxrates.xml>, updated at 13:00 Romania time each banking day.

### Current state
- `products` has both `price` (EUR, `DECIMAL(7,2)`) and `price_ron`; admins enter both manually in `PricingSection.tsx`.
- Localized public responses pick price + `currency` ("EUR" or "RON") from `Accept-Language`.
- Stripe checkout (`routes/checkout.rs`) charges EUR for `en` sessions and RON for `ro` sessions using the stored per-currency amounts.

### Design

**Data model**
- Drop the `price` (EUR) column from `products`; `price_ron` becomes the single source of truth (migration: drop column + its CHECK constraint; regenerate `schema.rs` and ts-rs types).
- New `exchange_rates` table: `(currency VARCHAR(3), rate DECIMAL(10,4), rate_date DATE, fetched_at TIMESTAMPTZ, PRIMARY KEY (currency, rate_date))`. Keeping history (rather than one `site_settings` key) gives an audit trail of which rate priced which order, and lets us backfill reporting.

**Rate fetching**
- New backend module `exchange_rate.rs`: fetch and parse `https://curs.bnr.ro/nbrfxrates.xml` (small XML — parse with `quick-xml`; the relevant node is `<Rate currency="EUR">`), upsert into `exchange_rates`.
- A `tokio` background task in `main.rs` runs on startup and then daily shortly after 13:00 Europe/Bucharest (e.g. 13:10 with retry/backoff every 15 min until success — BNR occasionally publishes late; weekends/holidays reuse the last published rate, which is exactly BNR semantics).
- Fallback policy: if fetching fails, keep serving the most recent stored rate and log a warning. Seed the table via migration or first-run fetch so there is never a "no rate" state; if the DB truly has no rate yet, the English site falls back to showing RON prices (never invent a rate).

**Price display**
- `localized.rs`: for `Language::En`, compute `price_eur = price_ron / rate`, rounded **half-up to 2 decimals**, and return it with `currency: "EUR"` plus a new field `is_converted: true` (Romanian responses keep `is_converted: false`). Expose the rate date too (`rate_date`) so the frontend footnote can say which day's rate was used.
- Frontend: everywhere a price renders on the English site (`ProductCard`, `ProductDetails`, `Cart`, home featured products), append `*` when `is_converted` is set, and render one shared footnote component: "\*Prices are charged in RON. EUR amounts are indicative, converted at the official BNR rate of {rate_date}." Add translations; on the Romanian site nothing changes.

**Checkout**
- Simplest compliant option (recommended): **charge everyone in RON.** `checkout.rs` stops branching currency by language; Stripe line items are always RON from `price_ron`, and the customer's bank does the conversion. The EUR display is purely informational. This removes the risk of the displayed EUR price and charged EUR price drifting apart.
- Alternative (only if EUR settlement is genuinely wanted): charge EUR computed from the day's stored rate at session-creation time and snapshot the rate on the order. More moving parts and reconciliation burden — not recommended.

**Admin**
- `PricingSection.tsx`: remove the EUR input; keep a single RON price field. Optionally show a read-only "≈ X EUR at today's BNR rate" hint (needs a small `GET /api/exchange-rate` public endpoint, which the footnote could also reuse).
- `AdminDashboard.tsx` inventory-value stat uses RON.

**Order of work:** migration + schema/type regen → rate fetcher + table → localized response change → checkout change → admin form → frontend display + footnote.

**Effort:** Medium. Touches DB, backend jobs, checkout, and every price render.

---

## 4. Mailing list (blog notifications + product news)

**Goal:** Visitors can subscribe to a mailing list. When an admin publishes a blog post, they can optionally email it to the list. A non-intrusive popup on the home page invites subscription after a while.

### Design

**Email infrastructure (prerequisite, shared with feature 5)**
- Add the `lettre` crate (async SMTP with rustls) and env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_ADDRESS`, `SMTP_FROM_NAME`. Any transactional SMTP provider works (e.g. Scaleway TEM, Brevo, Postmark).
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

## 6. Platform metrics (GDPR-compliant)

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
- Admin UI: `admin/dashboard/metrics` page with time-range picker and simple charts.

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

**Effort:** Medium. Start with the zero-cost sales/inventory metrics (pure queries over existing tables) — that alone makes the metrics page useful — then add the event pipeline.

---

## 7. Delivery integration with Sameday (courier + easybox lockers)

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

## Suggested implementation order

1. **Logo resize** (#1) and **toggle confirmation** (#2) — small, independent, immediate.
2. **RON/BNR pricing** (#3) — self-contained, high legal/correctness value.
3. **Mailing list** (#4) — builds the email infrastructure.
4. **Metrics, phase 1** (#6) — sales/inventory dashboards from existing data (can happen anytime).
5. **User accounts** (#5) — largest; reuses the mailer; builds the address/checkout groundwork Sameday needs.
6. **Sameday delivery** (#7) — depends on #5's checkout address step; AWB + lockers + tracking.
7. **Metrics, phase 2** (#6) — anonymous event pipeline + traffic dashboards (now including shipping funnel events).
