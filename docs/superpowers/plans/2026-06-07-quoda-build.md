# Quoda Build — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each phase ends in a GATE that must pass before the next phase starts.

**Goal:** Build Quoda — an open-source, Cloudflare-native QR platform (static + dynamic QR, full customization, scan analytics, magic-link auth, premium UI) that runs 100% locally with `wrangler dev`.

**Architecture:** One Hono Worker. JSX SSR for pages, dependency-free vanilla-TS islands for interactivity. D1 (SQL), KV (counters/rate-limit/session), R2 (exports/logos/assets). Dynamic QR = `/r/:code` redirect logging scans then 302 to the current destination.

**Tech Stack:** TypeScript, Hono (+ hono/jsx), Cloudflare Workers/D1/KV/R2, `qrcode-generator` (matrix only) + custom SVG renderer, Vitest (`@cloudflare/vitest-pool-workers`), Playwright (E2E), esbuild (island bundling).

**Design source of truth:** `docs/design/DESIGN-GUIDELINE.md` + `docs/design/design-guideline.json`. Zero raw hex in components — only `var(--token)`.

---

## File Structure

```
quoda/
├── package.json, wrangler.toml, tsconfig.json, vitest.config.ts, playwright.config.ts
├── LICENSE (MIT), README.md, .dev.vars.example
├── migrations/0001_init.sql
├── scripts/build-tokens.mjs            # design-guideline.json -> src/styles/tokens.css
├── src/
│   ├── index.ts                        # Hono app, route mounting, static assets
│   ├── types.ts                        # Env bindings + shared types
│   ├── db/queries.ts                   # typed D1 helpers (one responsibility: data access)
│   ├── lib/
│   │   ├── qr/encoder.ts               # matrix via qrcode-generator (boolean[][])
│   │   ├── qr/render-svg.ts            # matrix -> themed SVG (module shape, eyes, logo, colors, frame)
│   │   ├── qr/scannability.ts          # contrast guard + safe-palette correction
│   │   ├── qr/content.ts               # type payload builders (URL/WiFi/vCard/...)
│   │   ├── qr/types.ts
│   │   ├── auth/magic-link.ts          # issue/verify token
│   │   ├── auth/session.ts             # create/read/destroy session (D1 + KV cache)
│   │   ├── auth/email.ts               # Resend if key else console (no silent failure)
│   │   ├── analytics.ts                # logScan + aggregate + read
│   │   ├── plans.ts                    # limits + enforcement
│   │   └── shortcode.ts                # collision-safe short codes
│   ├── routes/
│   │   ├── marketing.tsx               # / /features /pricing /use-cases /docs
│   │   ├── auth.tsx                     # /login /auth/verify
│   │   ├── onboarding.tsx              # /onboarding
│   │   ├── dashboard.tsx               # /app
│   │   ├── studio.tsx                  # /app/new /app/:id/edit
│   │   ├── qr-detail.tsx              # /app/:id (analytics)
│   │   ├── settings.tsx               # /app/settings
│   │   ├── redirect.ts                # /r/:code
│   │   ├── pages.tsx                  # /p/:slug (hosted dynamic landings)
│   │   └── api/{qr,analytics,upload,auth}.ts
│   ├── ui/
│   │   ├── layout.tsx                 # <html> shell, head, theme bootstrap, nav/footer
│   │   ├── components/{button,input,card,qr-preview,nav,modal,toast,badge,select,stat}.tsx
│   │   └── icons.tsx
│   ├── styles/{tokens.css,base.css,app.css}
│   └── client/{generator,studio,charts,theme}.ts   # islands, esbuild-bundled to /static
└── tests/{qr-encoder,scannability,content,redirect,analytics,auth,plans}.test.ts
    └── e2e/{landing,auth,studio,analytics}.spec.ts
```

---

## Phase 1 — Scaffold

**Outcome:** `wrangler dev` boots; `/` returns a styled "hello" page with tokens applied; D1 migrated locally.

### Task 1.1: Project init
**Files:** Create `package.json`, `tsconfig.json`, `wrangler.toml`, `LICENSE`, `.dev.vars.example`, `.gitignore` (exists).
- [ ] `npm init`; add deps: `hono`, `qrcode-generator`; devDeps: `wrangler`, `typescript`, `vitest`, `@cloudflare/vitest-pool-workers`, `@playwright/test`, `esbuild`.
- [ ] `wrangler.toml` with `main = "src/index.ts"`, `compatibility_date`, bindings: D1 `DB`, KV `SCAN_COUNTERS`, `RATE_LIMIT`, `SESSION_CACHE`, R2 `ASSETS_BUCKET`, vars block. Use `[[d1_databases]]`, `[[kv_namespaces]]`, `[[r2_buckets]]` with `preview_*`/local ids for `wrangler dev`.
- [ ] LICENSE = MIT (author Can Erdogan, 2026).
- [ ] Scripts: `dev` (`wrangler dev`), `build:tokens`, `build:client`, `test` (vitest), `test:e2e` (playwright), `migrate:local` (`wrangler d1 migrations apply DB --local`).
- [ ] **Commit:** `chore: scaffold wrangler + hono project`

### Task 1.2: D1 schema migration
**Files:** Create `migrations/0001_init.sql`.
- [ ] Write schema (this is the locked data model):

```sql
CREATE TABLE plans (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, limits_json TEXT NOT NULL
);
INSERT INTO plans (id,name,limits_json) VALUES
 ('free','Free','{"dynamicCodes":3,"staticCodes":-1,"analyticsRetentionDays":30,"logoUpload":true}'),
 ('pro','Pro','{"dynamicCodes":-1,"staticCodes":-1,"analyticsRetentionDays":365,"logoUpload":true}');

CREATE TABLE users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,
  plan_id TEXT NOT NULL DEFAULT 'free' REFERENCES plans(id),
  onboarded_at INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL, user_agent TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE magic_links (
  token_hash TEXT PRIMARY KEY, email TEXT NOT NULL,
  expires_at INTEGER NOT NULL, consumed_at INTEGER
);
CREATE TABLE folders (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE qr_codes (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,                       -- url|text|wifi|email|tel|sms|vcard|pdf|menu|business|appstore|social
  title TEXT NOT NULL, is_dynamic INTEGER NOT NULL DEFAULT 0,
  short_code TEXT UNIQUE,                    -- null for static
  destination TEXT,                          -- current target for dynamic
  content_json TEXT NOT NULL,                -- type-specific payload
  design_json TEXT NOT NULL,                 -- colors/shape/eyes/logo/frame/ecc
  folder_id TEXT REFERENCES folders(id),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX idx_qr_user ON qr_codes(user_id);
CREATE INDEX idx_qr_short ON qr_codes(short_code);
CREATE TABLE dynamic_pages (
  qr_id TEXT PRIMARY KEY REFERENCES qr_codes(id),
  kind TEXT NOT NULL, data_json TEXT NOT NULL, asset_keys TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE scans (
  id TEXT PRIMARY KEY, qr_id TEXT NOT NULL REFERENCES qr_codes(id),
  ts INTEGER NOT NULL, country TEXT, city TEXT, device TEXT, referer TEXT
);
CREATE INDEX idx_scans_qr_ts ON scans(qr_id, ts);
CREATE TABLE scan_daily (
  qr_id TEXT NOT NULL, day TEXT NOT NULL, country TEXT, device TEXT,
  count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (qr_id, day, country, device)
);
```
- [ ] Run `npm run migrate:local`; verify tables exist (`wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='table'"`).
- [ ] **Commit:** `feat: D1 schema + plan seed`

### Task 1.3: Token compilation
**Files:** Create `scripts/build-tokens.mjs`, output `src/styles/tokens.css`.
- [ ] Script reads `docs/design/design-guideline.json`, emits `:root { ...light }` and `:root[data-theme="dark"] { ...dark }` plus `@media (prefers-color-scheme: dark)` mapping, radius/shadow/typography custom props, and the motion duration vars with the `prefers-reduced-motion` override block. **No hardcoded colors** anywhere else.
- [ ] Run `npm run build:tokens`; assert `tokens.css` contains `--color-accent:#0A7EA4`.
- [ ] **Commit:** `feat: compile design tokens to CSS`

### Task 1.4: Hono app + base layout + env types
**Files:** Create `src/types.ts`, `src/index.ts`, `src/ui/layout.tsx`, `src/styles/base.css`.
- [ ] `types.ts`: `Bindings` interface (DB, three KV, R2, vars `RESEND_API_KEY?`, `APP_URL`).
- [ ] `layout.tsx`: `<html lang>` with inline theme-bootstrap script (reads `localStorage`/`prefers-color-scheme`, sets `data-theme` before paint — no FOUC), `<head>` linking tokens.css/base.css + self-hosted Inter `@font-face`, slot for page content, shared nav + footer.
- [ ] `index.ts`: Hono app, serve `/static/*` from R2-or-bundled, mount a temporary `/` returning `Layout` with an h1. Health route `/healthz`.
- [ ] **GATE 1:** `npm run dev` boots; `curl localhost:8787/` returns HTML containing the accent token usage; `/healthz` returns ok. Commit `feat: hono app shell + base layout`.

---

## Phase 2 — Design System (built to guideline)

**Outcome:** Reusable SSR components + island theme toggle, all token-driven, dark-mode correct, a11y-compliant. A `/styleguide` page renders every component for visual QA.

### Task 2.1: Core CSS (base + app)
**Files:** `src/styles/base.css`, `src/styles/app.css`.
- [ ] base.css: reset, body uses `--color-surface-0`/`--color-text-primary`, type scale utility classes from the guideline (`.t-display-hero` etc. with exact size/weight/line-height/tracking), focus-visible ring (`2px solid var(--color-accent); outline-offset:3px`), `@media (prefers-reduced-motion: no-preference)` wrapper pattern documented at top.
- [ ] **Commit:** `feat: base + app stylesheets`

### Task 2.2: Components (one file each, props-typed)
**Files:** `src/ui/components/{button,input,select,card,badge,modal,toast,nav,stat,qr-preview}.tsx`, `src/ui/icons.tsx`.
- [ ] Each component: token-only styles, `aria-*` correct, ≥44px touch targets, focus ring. Button variants: primary (accent), secondary, ghost; press = `translateY(1px)` 80ms. `qr-preview`: **mandatory comment** + forced `color-scheme:light;background:#fff`, dark modules; `aria-live="polite"`.
- [ ] **Commit:** `feat: design-system components`

### Task 2.3: Theme island + styleguide page
**Files:** `src/client/theme.ts`, `src/routes/styleguide.tsx` (dev-only, mounted in index).
- [ ] theme.ts toggles `data-theme`, persists to localStorage, respects reduced-motion.
- [ ] styleguide renders all components in light & dark.
- [ ] **GATE 2 (design-conformance):** dispatch design-conformance review agents against `/styleguide` (tokens used, no raw hex via grep, dark mode correct, focus rings present, QR preview forced-light, contrast AA). Fix all findings. Commit `feat: theme toggle + styleguide`.

---

## Phase 3 — Core Engine (TDD)

**Outcome:** QR generation, dynamic redirect, analytics, and auth all unit-tested and green.

### Task 3.1: QR matrix encoder
**Files:** `src/lib/qr/encoder.ts`, `src/lib/qr/types.ts`, `tests/qr-encoder.test.ts`.
- [ ] Wrap `qrcode-generator`: `encodeMatrix(data: string, ecc: 'L'|'M'|'Q'|'H'): boolean[][]`. Types for `QrDesign`, `QrContent`.
- [ ] TDD: test a known string produces a stable module count and is non-empty; ecc levels change matrix size as expected.
- [ ] **Commit:** `feat: QR matrix encoder + tests`

### Task 3.2: Content builders
**Files:** `src/lib/qr/content.ts`, `tests/content.test.ts`.
- [ ] `buildPayload(type, fields)` for url/text/wifi/email/tel/sms/vcard (e.g. `WIFI:T:WPA;S:ssid;P:pass;;`, `BEGIN:VCARD...`). Rich dynamic types resolve to a `/p/:slug` or `/r/:code` URL.
- [ ] TDD: each builder emits the canonical string; wifi escapes special chars; vcard well-formed.
- [ ] **Commit:** `feat: QR content payload builders + tests`

### Task 3.3: Scannability guard
**Files:** `src/lib/qr/scannability.ts`, `tests/scannability.test.ts`.
- [ ] `contrastRatio(fg,bg)`, `isScannable(design)` (ratio ≥ threshold, e.g. 3:1 minimum but warn <7:1), `safePalette(design)` correction.
- [ ] TDD: white-on-white fails; dark-on-white passes ≥15:1; correction returns a passing palette.
- [ ] **Commit:** `feat: scannability guard + tests`

### Task 3.4: SVG renderer
**Files:** `src/lib/qr/render-svg.ts` (visual QA in Phase 6, logic test here).
- [ ] `renderSvg(matrix, design)` → string. Supports module shapes (square/dots/rounded), eye styles, fg/bg colors (token-resolved at call site, literal in export), centered logo with quiet-zone knockout, optional frame + CTA label. Always dark-on-white in preview context.
- [ ] TDD: output is valid SVG, module count matches matrix, logo injects an `<image>`, custom fg color appears.
- [ ] **Commit:** `feat: themed SVG renderer + tests`

### Task 3.5: Shortcode + dynamic redirect
**Files:** `src/lib/shortcode.ts`, `src/lib/analytics.ts`, `src/routes/redirect.ts`, `tests/redirect.test.ts`, `tests/analytics.test.ts`.
- [ ] `genShortCode()` (base62, 7 chars), collision check vs D1.
- [ ] `logScan(env, qr, req)`: parse `cf.country/city`, device from UA, increment KV `qr:<id>:total` and `qr:<id>:<YYYY-MM-DD>`, insert `scans` row, upsert `scan_daily`.
- [ ] `redirect.ts`: GET `/r/:code` → lookup qr by short_code → `logScan` (via `ctx.waitUntil`) → 302 to `destination`; 404 if missing.
- [ ] TDD (Miniflare): unknown code → 404; known code → 302 to destination + counter incremented + scan row written; editing destination changes redirect target but not short_code.
- [ ] **Commit:** `feat: dynamic redirect + scan analytics + tests`

### Task 3.6: Magic-link auth + sessions + plans
**Files:** `src/lib/auth/{magic-link,session,email}.ts`, `src/lib/plans.ts`, `src/db/queries.ts`, `tests/auth.test.ts`, `tests/plans.test.ts`.
- [ ] `issueMagicLink(email)`: random token, store `sha256(token)` + 15-min expiry, send via `email.ts` (Resend if `RESEND_API_KEY` else `console.log` with a clear `[DEV MAGIC LINK]` banner — never silent).
- [ ] `verifyMagicLink(token)`: hash, check unexpired+unconsumed, mark consumed, upsert user, create session.
- [ ] `session.ts`: create (D1 + KV cache, httpOnly Secure SameSite=Lax cookie), `getSession(req)`, `destroy`.
- [ ] `plans.ts`: `getLimits(user)`, `canCreateDynamic(user, count)` enforcement.
- [ ] TDD: expired token rejected; consumed token rejected; valid flow creates user+session; free plan blocks 4th dynamic code.
- [ ] **GATE 3:** `npm test` all green. Commit `feat: magic-link auth, sessions, plan limits + tests`.

---

## Phase 4 — Pages (SSR)

**Outcome:** All marketing + app pages render server-side, token-styled, wired to data.

### Task 4.1: Marketing pages + API for generator
**Files:** `src/routes/marketing.tsx`, `src/routes/api/qr.ts` (public preview endpoint), copy in-file.
- [ ] Home: calm hero (one sentence, ≤9 words), **live generator centerpiece** (URL input + QR preview, real-time), CTA "Make it permanent" appearing after typing, feature highlights, footer. Features/Pricing(stub with "Coming in Cloud" upgrade)/Use-cases/Docs(self-host) pages. Marketing copy: voice = calm/confident/"reliable", tagline "The QR code that never breaks."
- [ ] `api/qr.ts` public `POST /api/preview` → returns SVG for given content+design (no auth, rate-limited via KV).
- [ ] **Commit:** `feat: marketing pages + preview API`

### Task 4.2: App pages (auth-guarded)
**Files:** `src/routes/{auth,dashboard,qr-detail,settings}.tsx`, `src/routes/api/{qr,analytics,upload}.ts`, auth middleware in `index.ts`.
- [ ] Login page (email → "check your console/inbox"); `/auth/verify` consumes token. Middleware guards `/app/*`.
- [ ] Dashboard: QR list (title, type, dynamic badge, scan count from KV), folders, search, "New QR" CTA.
- [ ] QR detail: analytics (total, over-time chart, by-country, by-device) reading `scan_daily`.
- [ ] Settings: email, plan (disabled upgrade), theme, sign out.
- [ ] API: qr CRUD (create/update/delete, enforce plan limits), analytics read, R2 logo upload.
- [ ] **GATE 4:** every page renders (curl + status 200/302), no broken imports, auth guard works. Commit `feat: app pages + CRUD/analytics/upload APIs`.

---

## Phase 5 — Onboarding + QR Studio

**Outcome:** End-to-end create/edit/customize flow and guided first-run.

### Task 5.1: QR Studio
**Files:** `src/routes/studio.tsx`, `src/client/studio.ts`.
- [ ] Studio: type picker (all 12 types), per-type content form, customization panel (color/shape/eyes/logo/frame/ecc) with **live scannability warnings**, static-vs-dynamic toggle, save → for dynamic creates short_code + destination, export (SVG/PNG via canvas/PDF). Island `studio.ts` drives live preview + export.
- [ ] **Commit:** `feat: QR studio (all types + customization + export)`

### Task 5.2: Rich dynamic landing pages
**Files:** `src/routes/pages.tsx`, studio support for menu/business/social/appstore/pdf, R2 asset handling.
- [ ] `/p/:slug` renders hosted landing per `dynamic_pages.kind` (menu list, business card, social links, app-store smart redirect, pdf viewer). Token-styled, dark-mode, mobile-first.
- [ ] **Commit:** `feat: rich dynamic landing pages`

### Task 5.3: Onboarding
**Files:** `src/routes/onboarding.tsx`.
- [ ] 3 steps (choose type → customize → save first QR), skippable, sets `onboarded_at`, redirects to dashboard with the new code. First-login users routed here.
- [ ] **GATE 5:** manual + scripted walk: login → onboarding → create dynamic QR → edit destination → see redirect change. Commit `feat: onboarding flow`.

---

## Phase 6 — QA (E2E + a11y + scannability)

**Outcome:** Automated proof the whole thing works and is accessible, and generated QR codes actually decode.

### Task 6.1: Playwright E2E
**Files:** `playwright.config.ts`, `tests/e2e/{landing,auth,studio,analytics}.spec.ts`.
- [ ] landing: hero generator updates QR on type, CTA appears after typing, keyboard path input→download. auth: magic link (read from server log/test hook) → onboarding. studio: create each type, customization reflects, export downloads. analytics: simulate scans via `/r/:code` then dashboard shows counts.
- [ ] **Commit:** `test: Playwright E2E across core journeys`

### Task 6.2: Scannability decode test
**Files:** `tests/e2e/decode.spec.ts`.
- [ ] Generate a QR for a known URL, rasterize, decode with a QR-decoder lib in-test, assert decoded value == input. Test default + customized (dots/rounded/logo) variants.
- [ ] **GATE 6:** `npm run test:e2e` green; a11y assertions (focus, aria, contrast) pass; decode test passes for all variants. Commit `test: scannability decode + a11y gates`.

---

## Phase 7 — Final Verification + Ship

**Outcome:** Adversarial sign-off, README, public GitHub repo.

### Task 7.1: README + self-host docs
**Files:** `README.md`, `.dev.vars.example`.
- [ ] README: what/why, screenshots, local dev (`npm i`, `npm run migrate:local`, `npm run dev`), self-host on Cloudflare (D1/KV/R2 create, `wrangler deploy`), env vars, architecture, MIT, contributing.
- [ ] **Commit:** `docs: README + self-host guide`

### Task 7.2: Final adversarial verification (orchestrator-run)
- [ ] Dispatch a multi-vote panel: code-reviewer (bugs/silent-failures), accessibility auditor, conversion auditor, scannability auditor, design-conformance auditor. Majority-refute filter. Fix every confirmed finding.
- [ ] Re-run full `npm test` + `npm run test:e2e`. All green.
- [ ] **GATE 7 (production-ready sign-off):** orchestrator confirms: boots locally with zero external services, all features work, all gates green, design-conformant, a11y AA, decodes verified. Sign off in writing.

### Task 7.3: Publish
- [ ] `gh repo create canerdogan/quoda --public --source=. --remote=origin --description "..."`, push `main`.
- [ ] Optional minimal GitHub Action: `npm ci && npm run build:tokens && npm test` (no deploy).
- [ ] **Commit/push:** final.

---

## Self-Review (author checklist — completed)

- **Spec coverage:** all spec §4–§10 map to tasks (architecture→P1/P3, data model→1.2, features→P3/P5, sitemap→P4/P5, marketing/onboarding→4.1/5.3, workflow/gates→phase gates, success criteria→P6/P7). ✓
- **Placeholders:** decision-locking code is concrete (schema, redirect, auth, scannability). Component JSX is task-scoped (built by agents) per CLAUDE.md Pareto override, not left as vague "TODO". ✓
- **Type consistency:** `short_code`/`destination`/`is_dynamic`/`content_json`/`design_json` consistent across schema, redirect, studio, queries. `logScan`, `issueMagicLink`/`verifyMagicLink`, `renderSvg`, `encodeMatrix` names stable across tasks. ✓
