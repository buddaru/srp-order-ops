# Cadro — Codebase Audit

_Audited on 2026-07-02, branch `cadro-audit-improvements` (based on `main`)._

## What the app does today

Cadro is an AI-native operations dashboard for food-service operators, currently running one live tenant (Sweet Red Peach, "SRP Carson"). Stack: React 18 + Vite SPA, Supabase (Postgres + Auth + RLS), Vercel serverless functions (`/api/*`), SendGrid (email), Twilio (SMS), Gmail OAuth (order ingest), Anthropic API (invoice parsing), Meez API (recipe import).

**Routing / tenancy.** `main.jsx` → `AuthProvider` → `App.jsx`. Authenticated users land on `/app/:locationSlug/*`, wrapped by `LocationProvider` + `BusinessProvider` → `LocationApp.jsx`. `AuthContext` loads the user + `organization_members` + `location_members` in parallel; `LocationContext` derives accessible locations and the current one from the URL slug; `isAdmin`/`isLocationAdmin` come from role membership with a `profiles.role` backward-compat fallback.

**Feature surface.**
- **Orders board** (`LocationApp` + `Board`/`ListView`/`OrderCard`/`Drawer`/`OrderModal`) — kanban of order stages (received → in-production → ready → picked-up), search, soft-delete, SMS/receipt sends, optimistic updates with rollback. Orders arrive by email: `api/sync-orders.js` pulls Bento order emails from Gmail (incremental history sync + backfill), parses HTML into structured orders, dedups by `gmail_message_id`/`bento_order_id`, and persists parse failures to `failed_imports` for retry.
- **Kitchen ops** — Daily Production, Food Waste, Schedule (emails shifts via SendGrid), Recipes (imported from Meez via `api/sync-meez.js`), Ingredients + cost calculator, Invoices (PDF → Anthropic extraction via `api/parse-invoice.js`, then `api/apply-invoice.js` writes prices/history), Reports.
- **Admin** — Team (creates users via `api/create-user.js`), Menu & Pricing, per-location Settings.

**Design system.** Mature CSS-variable token system in `index.css` (color, spacing, type scale, shadows, radii). Per-component CSS modules with responsive `@media` breakpoints at 640/768/1100px, safe-area insets in several places, skeleton loaders, empty states. Sentry wired in `main.jsx`.

---

## Findings by facet

Severity: **S1** critical / **S2** high / **S3** medium / **S4** low. Effort: **E1** trivial / **E2** small / **E3** medium / **E4** large.

### 1. Security

| # | Finding | Sev | Effort |
|---|---------|-----|--------|
| SEC-1 | **`api/create-user.js` is unauthenticated.** Anyone who can reach `POST /api/create-user` can create a Supabase auth user with `role: 'admin'` and a `location_members` row, using the service-role key. This is remote privilege escalation → full tenant data access. No caller identity is checked. | S1 | E2 |
| SEC-2 | **No API endpoint authenticates the caller.** `send-sms`, `send-receipt`, `send-schedule`, `apply-invoice`, `parse-invoice`, `sync-orders`, `sync-meez`, `fetch-rd-price` all execute for anonymous callers. Concrete abuse: Twilio toll fraud (`send-sms`), SendGrid spam from your verified domain (`send-receipt`/`send-schedule`), arbitrary writes to `invoices`/`ingredients` bypassing RLS via service role (`apply-invoice`), burning Anthropic credit (`parse-invoice`). | S1 | E3 |
| SEC-3 | **`GET /api/sync-orders?debug=1` leaks OAuth state** — returns the authorized Gmail address, current/last Gmail historyId, and unresolved-failure count to any anonymous caller. | S2 | E1 |
| SEC-4 | **Permissive CORS.** `apply-invoice.js` and `fetch-rd-price.js` set `Access-Control-Allow-Origin: *`. `apply-invoice` writes to the DB with the service role — it should never be `*`. | S2 | E1 |
| SEC-5 | **In-memory rate limiter is per-instance only** (`_rateLimit.js`) and is only applied to `send-sms`. Serverless scale-out defeats it; the expensive/abusable endpoints have none. | S3 | E2 |
| SEC-6 | **Single shared Gmail refresh token** stored in `gmail_tokens` (id=`default`), plus `BENTO_LOCATION_ID` hardcoded in `sync-orders.js`. Fine for one tenant; a second tenant's mail would import into SRP's location. Token is at-rest in a table (RLS `using(false)`, service-role only) — acceptable but not encrypted (Vault noted as P1 in schema comments). | S3 | E4 |

_No hardcoded secrets found in client or committed code (good). `VITE_SUPABASE_KEY` is the anon key (safe to ship)._

### 2. Architecture

| # | Finding | Sev | Effort |
|---|---------|-----|--------|
| ARCH-1 | **Order IDs are a global `SRP-###` sequence.** Both `LocationApp.fetchNextSeq()` and `sync-orders.nextOrderId()` scan `orders` across all locations and increment a shared counter. For a multi-tenant SaaS this (a) hardcodes the "SRP" brand into every future tenant's order numbers and (b) makes IDs collide/serialize across tenants. Should be per-location prefix + per-location sequence. | S2 | E3 |
| ARCH-2 | **`business_settings` id=1 fallback** still present in `BusinessContext` (pre-migration compat). Once all rows have `location_id`, this fallback can read/write the wrong tenant's row. | S3 | E2 |
| ARCH-3 | **Client-generated order IDs with retry-on-conflict** (`handleCreateOrder`, 5 attempts on 23505) is a race workaround, not atomicity. Under concurrent creation on the floor two devices can probe the same max. Belongs in a DB sequence/RPC. | S3 | E3 |
| ARCH-4 | Order-ingest is a single Gmail account + single Vercel function triggered manually from the header (SRP-only gated by slug). No scheduled trigger; relies on staff clicking "Sync". | S3 | E3 |

### 3. Code quality

| # | Finding | Sev | Effort |
|---|---------|-----|--------|
| CQ-1 | **Dead code:** `READY_SMS`, `PICKEDUP_SMS` in `helpers.js` (superseded by `BusinessContext` templates, unused); `withTimeout` alias in `supabase.js` (no importers). | S4 | E1 |
| CQ-2 | **Zero automated tests.** Order parsing (`sync-orders`), cost calculator, and dedup logic are complex and untested — highest-risk parse/money code has no safety net. | S3 | E4 |
| CQ-3 | Large multi-responsibility components (`Invoices` 833, `MenuManager` 767, `Schedule` 718 lines) mixing data access, modals, and view. Not a bug; raises change risk. | S4 | E4 |
| CQ-4 | Error handling is inconsistent — some paths `console.warn` and swallow, others toast. No shared query-error surface. | S4 | E3 |

### 4. Performance

| # | Finding | Sev | Effort |
|---|---------|-----|--------|
| PERF-1 | **Missing indexes** on several `location_id` columns that are filtered on every page load: `waste_log`, `shifts`, `employees`, `recipes`, `recipe_groups`, `menu_items`, `menu_categories`. The migration only indexed orders/production/ingredients/invoices. (DB change — recommend only.) | S3 | E1 |
| PERF-2 | **`sync-orders` loads the entire `orders` table** (`gmail_message_id, bento_order_id`, no location filter) on every sync to build dedup sets. Grows unbounded with order volume. | S3 | E2 |
| PERF-3 | Base64 order images stored inline in `orders.image` (can be MBs/row). Already mitigated well — list query excludes the column and lazy-loads per drawer. Note for future: move to Supabase Storage. | S4 | E3 |
| PERF-4 | No route-level code splitting; every page component is imported eagerly in `LocationApp`. Bundle ships all of Invoices/MenuManager/Schedule to a cashier who only opens Orders. | S3 | E2 |

### 5. UX / UI / visual

| # | Finding | Sev | Effort |
|---|---------|-----|--------|
| UX-1 | **`user-scalable=no, maximum-scale=1.0` in the viewport meta disables pinch-zoom** — a WCAG 1.4.4 failure and a real problem for operators reading small order details on a phone. The iOS input-zoom issue it was meant to prevent is _already_ solved by the `@media (pointer: coarse){ font-size:16px }` rule in `index.css`, so the zoom lock is redundant. | S2 | E1 |
| UX-2 | `index.html` viewport lacks `viewport-fit=cover`, yet several stylesheets use `env(safe-area-inset-*)`. Without `viewport-fit=cover` those insets resolve to 0 on notched iPhones, so the safe-area padding never actually applies. | S3 | E1 |
| UX-3 | Root loading state is an inline `Loading…`/`return null` (App.jsx) — a blank flash before the board. Minor polish opportunity. | S4 | E2 |
| UX-4 | Access-denied routes render a bare `<p>Access denied.</p>` with no styling or way back. | S4 | E2 |

### 6. Responsive / mobile & tablet

| # | Finding | Sev | Effort |
|---|---------|-----|--------|
| RESP-1 | Zoom disabled (see UX-1) — worst on phones. | S2 | E1 |
| RESP-2 | Safe-area insets present but inert without UX-2 fix. | S3 | E1 |
| RESP-3 | Good baseline: mobile sidebar drawer, coarse-pointer 16px inputs, full-screen Drawer/OrderModal on small screens, breakpoints at 640/768/1100. No obvious horizontal-scroll traps in the board (`overflow-x` handled). Verify tables (Invoices, Schedule, Reports) reflow — flagged for manual check. | S3 | E3 |

### 7. Reliability

| # | Finding | Sev | Effort |
|---|---------|-----|--------|
| REL-1 | Order-create race (see ARCH-3). | S3 | E3 |
| REL-2 | `sync-orders` dedup and failure persistence are solid (message-id + bento-id, `failed_imports` with retry). Good idempotency posture. | — | — |
| REL-3 | Global `fetch` 10s timeout in `supabase.js` is a nice touch; `safeQuery` never-throws wrapper is used widely. | — | — |
| REL-4 | `send-*` endpoints have no retry/queue — a transient SendGrid/Twilio failure just toasts an error; acceptable for manual sends. | S4 | E3 |

### 8. Product

| # | Finding | Sev | Effort |
|---|---------|-----|--------|
| PROD-1 | **Order-number branding** (ARCH-1) blocks onboarding a second tenant cleanly — every operator would see `SRP-###`. | S2 | E3 |
| PROD-2 | No user invite/accept flow — admins set passwords directly (`create-user`), which is why that endpoint is so dangerous. | S3 | E4 |
| PROD-3 | Order sync is manual + SRP-gated. Auto-sync (cron) and generalizing beyond Bento would be retention/expansion drivers. | S3 | E4 |
| PROD-4 | No customer-facing order status / pickup notifications beyond manual SMS; automating "ready" texts is an obvious value-add. | S4 | E3 |

---

See **ROADMAP.md** for prioritization and **MANUAL_ACTIONS.md** for items requiring database/RLS/secret changes outside Git's reach.
