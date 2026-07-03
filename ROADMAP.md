# Cadro — Improvement Roadmap

Ranked by impact-to-effort. "Safe to implement" = code-only, reversible, no destructive/irreversible action. "Needs approval / manual" = touches DB schema, RLS, secrets, or live prod data (see MANUAL_ACTIONS.md).

## Tier 0 — Do now (critical security, code-only)

| Rank | Change | Facet | Impact | Effort | Status |
|------|--------|-------|--------|--------|--------|
| 1 | **Authenticate `create-user`** — require a valid Supabase session AND that the caller is an org/location admin before creating users. Closes the privilege-escalation hole (SEC-1). | Security | Very high | E2 | Safe |
| 2 | **Add auth to all `/api/*` endpoints** — shared `requireUser` helper verifying the Supabase JWT; frontend attaches the bearer token via a shared `apiFetch` (SEC-2). | Security | Very high | E3 | Safe |
| 3 | **Lock down `sync-orders` debug** — require auth for `?debug=1`, stop leaking the Gmail address/historyId (SEC-3). | Security | High | E1 | Safe |
| 4 | **Tighten CORS** on `apply-invoice`/`fetch-rd-price` to the allowed origin (SEC-4). | Security | Medium | E1 | Safe |

## Tier 1 — High value, low effort (code-only)

| Rank | Change | Facet | Impact | Effort | Status |
|------|--------|-------|--------|--------|--------|
| 5 | **Fix viewport zoom** — remove `user-scalable=no, maximum-scale=1.0`; add `viewport-fit=cover` (UX-1, UX-2, RESP-1/2). WCAG fix + activates existing safe-area CSS. | UX / a11y / mobile | High | E1 | Safe |
| 6 | **Rate-limit expensive endpoints** — apply the limiter to `create-user`, `parse-invoice`, `send-receipt`, `send-schedule`, `sync-*` as defense-in-depth (SEC-5). | Security | Medium | E2 | Safe |
| 7 | **Remove dead code** — `READY_SMS`, `PICKEDUP_SMS`, `withTimeout` (CQ-1). | Code quality | Low | E1 | Safe |
| 8 | **Styled access-denied + root loading** states (UX-3, UX-4). | UX / visual | Low-med | E2 | Safe |

## Tier 2 — High value, medium effort (code-only)

| Rank | Change | Facet | Impact | Effort | Status |
|------|--------|-------|--------|--------|--------|
| 9 | **Route-level code splitting** — `React.lazy` the heavy pages (Invoices, MenuManager, Schedule, Reports, Recipes*) so the Orders-only user downloads less (PERF-4). | Performance | Medium | E2 | Safe |
| 10 | **Scope `sync-orders` dedup query** to the target location + cap columns/age (PERF-2). | Performance | Medium | E2 | Safe |
| 11 | **Tests** for the order HTML parser and cost calculator (CQ-2) — highest-risk pure functions. Requires adding a test runner (Vitest). | Reliability | Medium | E3 | Safe (needs dep) |

## Tier 3 — Needs your approval (DB / RLS / data / product)

| Rank | Change | Facet | Impact | Effort | Status |
|------|--------|-------|--------|--------|--------|
| 12 | **Per-location order numbering** — replace global `SRP-###` with a per-location prefix + DB sequence/RPC (ARCH-1, ARCH-3, PROD-1). Touches ID generation on live prod data. | Architecture / product | High | E3 | **Manual** |
| 13 | **Add missing `location_id` indexes** (PERF-1). | Performance | Medium | E1 | **Manual (DB)** |
| 14 | **Remove `business_settings` id=1 fallback** once backfill verified (ARCH-2). | Architecture | Medium | E2 | **Manual gate** |
| 15 | **Per-location integration tokens** — move Gmail/SendGrid/Twilio into `location_integrations` (SEC-6, ARCH-4). | Architecture / security | High | E4 | **Manual** |
| 16 | **User invite/accept flow** to replace admin-set passwords (PROD-2). | Product | High | E4 | Design first |
| 17 | **Scheduled auto-sync** (cron) + generalize ingest beyond Bento (PROD-3). | Product | Medium | E4 | Design first |

## Explicitly NOT doing without sign-off
- Any visual redesign beyond spacing/consistency polish (per your workflow, I'll mock it up and wait).
- Any migration/backfill SQL execution — recommend only.
- Anything touching the live SRP order data or secrets.

Implementation order below follows Tier 0 → Tier 2, one commit each, verifying UI changes at phone/iPad/desktop before committing.
