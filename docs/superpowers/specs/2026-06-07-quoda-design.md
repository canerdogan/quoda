# Quoda — Design Spec

**Date:** 2026-06-07
**Status:** Draft for review
**Owner:** can@canerdogan.me
**Repo:** `github.com/canerdogan/quoda` (public, MIT)

## 1. Summary

Quoda is an open-source, self-hostable QR-code platform — a feature-complete clone of qr.io's capability set — built entirely on Cloudflare. Its differentiator and emotional core: **dynamic QR codes whose destination is editable forever, so the printed code never breaks**, backed by scan analytics. The product must *feel* premium (Apple-grade calm minimalism) while converting effectively. Design direction is fixed by `docs/design/DESIGN-GUIDELINE.md` (multi-agent design team output); this spec covers product scope, architecture, data model, and the build/QA workflow.

**North star:** every token, interaction and pixel earns the word _reliable_ — including reliable conversion (time-to-first-QR < 3s).

## 2. Goals / Non-Goals

### Goals
- 100% working, locally-runnable on Cloudflare's local stack (`wrangler dev`) with zero external service required for core flows.
- Feature parity with qr.io: static + dynamic QR, full QR-type set, full visual customization, scan analytics, organization.
- Premium, accessible (WCAG AA), dark-mode-first UI compiled from the design guideline tokens.
- Complete journey: marketing site → magic-link auth → onboarding → QR Studio → dashboard/analytics.
- Lightweight open-source DevOps: one `wrangler.toml`, MIT license, optional minimal CI.

### Non-Goals (this iteration)
- Real payments. Plan/limit architecture is built and enforced; checkout is stubbed ("Coming in Cloud"). Stripe is a future hosted-edition concern.
- Team/multi-seat collaboration, SSO, white-label.
- Native mobile apps.
- Bulk CSV generation (may be a fast-follow).

## 3. Users & Core Value

Small businesses and professionals (restaurant owners, event organizers, freelancers) who print a QR once and need it to keep working and to know it's being scanned. They judge quality by feel; the UI must read as expensive and trustworthy, dark mode included (the midnight-laptop user).

## 4. Architecture (Cloudflare)

Single Hono application deployed as one Worker.

```
Worker (Hono)
├── SSR (Hono JSX)            marketing pages + app shell
├── Island JS (vanilla, no framework)   live generator, studio, dashboard charts
├── /r/:code                  dynamic-QR redirect core (logs scan → 302 to current destination)
├── /p/:slug                  hosted dynamic landing pages (menu, business, social, app-store, pdf)
├── /api/*                    JSON endpoints (auth, qr CRUD, analytics, upload)
└── bindings:
    ├── D1   relational data
    ├── KV   fast scan counters, rate-limit, session cache
    └── R2   QR SVG/PNG exports, uploaded logos, dynamic-page assets
```

### Key technical decisions
- **Rendering:** Hono JSX SSR for all pages; progressive-enhancement "islands" of dependency-free vanilla JS for interactive surfaces. No React/Next — keeps it lightweight and OSS-friendly.
- **QR engine:** pure-JS QR encoder producing **SVG** server-side (deterministic, crisp, themeable within scannability limits). PNG/JPEG export rasterized client-side via canvas; multiple sizes. SVG is the source of truth.
- **Scannability guard:** foreground/background contrast computed before render; if below the safe threshold the UI warns and offers an auto-corrected palette. QR modules in the preview are always dark-on-white per the guideline.
- **Dynamic QR ("never breaks"):** a QR encodes `https://<host>/r/<shortCode>`. On scan, the Worker records the event (KV counter increment + D1 row), then 302-redirects to the code's *current* destination. Editing the destination never changes the printed code.
- **Analytics:** at redirect time capture `cf.country`, `cf.city` (coarse), device class from UA, timestamp, referer. Hot counters in KV for instant totals; durable rows in D1 aggregated to daily buckets for charts. No third-party analytics.
- **Auth:** passwordless magic link. **Dev:** the link is written to the Worker console/log (zero email setup, instant local testing). **Prod:** Resend API if `RESEND_API_KEY` is set, else falls back to log with a visible warning. Sessions stored in D1, cached in KV, delivered as an httpOnly, Secure, SameSite=Lax cookie.
- **Plans/limits:** `plans` table defines free vs pro quotas (e.g. # dynamic codes, analytics retention). Limits are enforced server-side now; the upgrade UI is present but disabled with a "Coming in Cloud" state. No payment code ships.

## 5. Data Model (D1)

- **users** — `id, email, created_at, plan_id, onboarded_at`
- **sessions** — `id, user_id, expires_at, created_at, user_agent` (also cached in KV)
- **magic_links** — `token_hash, email, expires_at, consumed_at`
- **qr_codes** — `id, user_id, type, title, is_dynamic, short_code (unique, nullable for static), destination, content_json, design_json, error_correction, folder_id, created_at, updated_at`
- **dynamic_pages** — `qr_id, kind (menu|business|social|appstore|pdf), data_json, asset_keys[]` (rendered at `/p/:slug`)
- **scans** — `id, qr_id, ts, country, city, device, referer` (raw, retention by plan)
- **scan_daily** — `qr_id, day, country, device, count` (aggregate for charts)
- **folders** — `id, user_id, name, created_at`
- **plans** — `id, name, limits_json`

KV namespaces: `SCAN_COUNTERS` (`qr:<id>:total`, `qr:<id>:<day>`), `RATE_LIMIT`, `SESSION_CACHE`.
R2 buckets/prefixes: `qr/<id>.svg|png`, `logos/<user>/<hash>`, `pages/<slug>/<asset>`.

## 6. Feature Set (qr.io parity)

- **Static QR:** URL, Text, WiFi, Email, Tel, SMS, vCard.
- **Dynamic QR (editable destination):** all of the above plus rich hosted types — PDF, Menu, Business page, App-store smart link, Social links.
- **Customization:** logo upload (centered, with quiet-zone protection), foreground/background color (scannability-guarded), frame + call-to-action label, module shape, eye (finder) style, error-correction level.
- **Analytics:** total scans, scans over time, by country, by device; per-QR detail and a global dashboard. `tnum` figures.
- **Organization:** folders, search, QR list with status (static/dynamic, scan count).
- **Export:** SVG, PNG (multiple sizes), PDF.

## 7. Site Map

- **Marketing:** Home (calm hero + live generator), Features, Pricing (stubbed plans), Use-cases, Open-source / Self-host docs.
- **App:** Login → Onboarding (3 guided steps, skippable) → Dashboard → QR Studio (create/edit) → QR Detail + Analytics → Settings.
- **Public render:** `/r/:code` (redirect + scan log), `/p/:slug` (hosted dynamic landing pages).

## 8. Marketing & Onboarding

- **Voice:** calm, confident, "reliable". Hero is a single sentence + the live generator. Primary CTA everywhere is **"Make it permanent"** (never "Generate"), surfaced only after the user types.
- **Onboarding:** magic link → guided first QR (choose type → customize → save) → "made permanent" confirmation → dashboard. Three steps, skippable, completes `onboarded_at`.

## 9. Build & QA Workflow (multi-agent, gated)

Each phase is an orchestrated workflow (fan-out build + adversarial verify). A gate must pass before the next phase.

| Phase | Work | Gate |
|---|---|---|
| 0. Spec + Plan | this doc → implementation plan | user approval |
| 1. Scaffold | Wrangler + Hono + D1 schema + `tokens.css` (compiled from guideline) + base SSR layout | `wrangler dev` boots locally |
| 2. Design System | button, input, card, QR-preview, nav, modal, toast components | design-conformance review passes |
| 3. Core | QR engine, dynamic redirect, analytics pipeline, magic-link auth | unit tests pass |
| 4. Pages | marketing + app pages (SSR) | pages render, no broken refs |
| 5. Onboarding + Studio | onboarding flow + QR Studio end-to-end | flow works end-to-end |
| 6. QA | Playwright E2E + visual QA + real scannability test (decode generated QR) | E2E + a11y + scannability gates pass |
| 7. Final Verify | adversarial panel (code-review, a11y, conversion, scannability), majority-vote refute → sign-off | production-ready sign-off by orchestrator |

**DevOps:** public repo, MIT, single `wrangler.toml`, optional minimal GitHub Action running build + typecheck. No heavy CI/CD.

## 10. Success Criteria

- `npm install && npm run dev` boots the full app locally with no external service; every core flow works against local D1/KV/R2.
- All seven QR types + rich dynamic types generate scannable codes (verified by decoding).
- Dynamic destination edit changes redirect without changing the QR.
- Analytics records and displays scans by time/country/device.
- Magic-link auth works locally (link in console) and onboarding completes.
- UI conforms to the design guideline (tokens, motion, dark mode, a11y) — verified by review agents.
- WCAG AA contrast + keyboard/screen-reader operability on the generator.
- Repo is public under MIT with a README that documents local dev and self-hosting.

## 11. Risks & Mitigations

- **Worker rasterization limits:** PNG export done client-side via canvas (no server raster dependency).
- **QR aesthetics vs scannability:** hard contrast/error-correction guard; preview always dark-on-white; decode test in QA gate.
- **Magic-link in dev:** explicit log output + warning when no email provider configured (no silent failure).
- **Scope (full set in one pass):** phased workflow with gates prevents half-built features from masking as complete; nothing advances until its gate passes.
