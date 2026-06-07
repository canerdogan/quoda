# Quoda — Design Guideline

> Produced by an adversarial multi-agent design team (Art Director, Conversion PM, Brand & Motion, Accessibility & Systems) and synthesized by a Lead Design Director. This is the **single source of truth** for every pixel in Quoda. The machine-readable token set lives in `design-guideline.json` and is compiled to `src/styles/tokens.css`.

## North Star

> **Every token, every interaction, every pixel earns the word _reliable_.**

In design review the only test is: *does this element earn the word "reliable"?* If the answer needs more than one sentence, the element is removed. "Reliable" includes **reliable conversion** — a design that hides the generator or slows time-to-first-QR fails the test too.

- **Emotional target:** permanence made tangible.
- **Value proposition (marketing):** effortless trust — the fastest way to a QR you can rely on forever.
- **Tagline:** *The QR code that never breaks.*

## Brand

- **Name:** Quoda — invented, one-breath (KWO-da), identical for TR & US speakers, fully ownable.
- **Logomark:** the **Q** is constructed from QR-module squares. The brand mark *is* the product artifact.
- **Wordmark:** Inter 300, lowercase, tracking -0.02em. Never uppercase, never bold, never drop-shadowed.
- **Domain:** `getquoda.com` (exact `.com`/`.io` are parked by investors; not competing products). Repo: `github.com/canerdogan/quoda`.

## The 7 Resolved Tensions (with guardrails)

| # | Decision | Guardrail (the losing side's warning, kept) |
|---|----------|---------------------------------------------|
| **T1 Brand** | Quoda. Q logomark from QR modules. | Invented word ⇒ the visual system must do 100% of meaning-building. |
| **T2 Hero** | Calm Apple-style hero whose centerpiece **is** a live, usable generator. No signup wall for static generation. CTA = **"Make it permanent"**, never "Generate", appears only after the user types. | A visible generator risks reading as "free tool" — page frame, whitespace & type weight must signal product confidence. |
| **T3 Accent** | **`#0A7EA4`** deep teal-blue. 5.8:1 on white, 4.6:1 on near-black (WCAG AA verified). One accent, once per viewport. | Monitor teal SaaS saturation annually; it's a token, migratable. Indigo `#5B5BD6` was **rejected** — only 3.8:1, fails AA. |
| **T4 Type** | **Inter** variable, self-hosted WOFF2 on R2, <50KB, wght 300–600, latin+latin-ext. Precise tracking is the brand signal. | Neue Haas / Geist rejected (licensing trap for OSS / audience-captured). Apply tracking with rigor or it reads as default SaaS. |
| **T5 Motion** | Enter `cubic-bezier(0.16,1,0.3,1)` 220ms; exit `cubic-bezier(0.4,0,1,1)` 140ms (faster than enter). Max 380ms. No bounce/parallax. | `prefers-reduced-motion` → everything 0ms, one named 80ms opacity exception only. |
| **T6 Dark mode** | First-class from day one, same component / different tokens / same QA. | **QR preview card always forces `color-scheme: light` + white bg + dark modules** regardless of theme. Pure black `#000000` banned. |
| **T7 Philosophy** | "Reliable" is both brand promise and systems requirement. | If "reliable" is ever used to justify passive beauty over conversion, the conversion warning applies. |

## Design Tokens

### Color — Light
| Token | Value |
|---|---|
| `--color-surface-0` | `#FAFAFA` |
| `--color-surface-1` | `#FFFFFF` |
| `--color-surface-2` | `#F0F0F0` |
| `--color-surface-3` | `#E8E8E8` |
| `--color-text-primary` | `#0D0D0F` |
| `--color-text-secondary` | `#6B6B6B` |
| `--color-text-tertiary` | `#9A9A9A` |
| `--color-border` | `#E4E4E7` |
| `--color-border-subtle` | `#F0F0F2` |
| `--color-accent` | `#0A7EA4` |
| `--color-accent-hover` | `#086D8E` |
| `--color-accent-text` | `#FFFFFF` |
| `--color-accent-subtle` | `rgba(10,126,164,0.08)` |
| `--color-qr-module` | `#0D0D0F` (invariant) |
| `--color-qr-background` | `#FFFFFF` (invariant) |

### Color — Dark
| Token | Value |
|---|---|
| `--color-surface-0` | `#0D0D0F` |
| `--color-surface-1` | `#161618` |
| `--color-surface-2` | `#1E1E20` |
| `--color-surface-3` | `#2A2A2D` |
| `--color-text-primary` | `#F5F5F5` |
| `--color-text-secondary` | `#8A8A8A` |
| `--color-text-tertiary` | `#5A5A5A` |
| `--color-border` | `#2A2A2D` |
| `--color-border-subtle` | `#1E1E20` |
| `--color-accent` | `#0A7EA4` (same both modes) |
| `--color-accent-hover` | `#0B92BD` |
| `--color-accent-subtle` | `rgba(10,126,164,0.12)` |
| `--color-qr-module` | `#0D0D0F` (invariant) |
| `--color-qr-background` | `#FFFFFF` (invariant) |

**Rules:** pure black banned. No second accent — success/warning/error use opacity & lightness shifts of `--color-accent`. Zero raw hex in component code (build-time lint error).

### Typography — Inter variable (wght 300–600)
| Style | Size | Weight | Line-height | Tracking | Use |
|---|---|---|---|---|---|
| display-hero | 64px | 300 | 1.08 | -0.03em | hero sentence, ≤9 words |
| display-lg | 48px | 300 | 1.10 | -0.022em | section headings |
| display-md | 36px | 500 | 1.12 | -0.018em | card/feature titles |
| heading-sm | 24px | 500 | 1.20 | -0.01em | subsection |
| body-lg | 18px | 400 | 1.60 | 0 | lead/onboarding |
| body | 16px | 400 | 1.55 | -0.011em | body, labels |
| body-sm | 14px | 400 | 1.50 | 0 | helper text |
| ui-label | 14px | 600 | 1.20 | 0.01em | buttons, nav, badges |
| caption | 12px | 400 | 1.40 | 0.01em | timestamps, legal |
| numeric | — | — | — | — | `font-feature-settings:'tnum'` for all analytics figures |

Stack: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`. `font-display: swap`.

### Spacing — 8pt grid
`4` (micro only) · `8` · `12` · `16` · `24` · `32` · `48` · `64` · `96` · `128`. Component padding ≥16px. **Touch targets ≥44×44px.** Hero vertical padding 96/64. Section spacing 96 desktop / 64 mobile.

### Radius
`--radius-sm 4` · `--radius-md 8` (buttons, inputs) · `--radius-lg 12` (QR card) · `--radius-xl 16` (modal) · `--radius-2xl 24` · `--radius-full`.

### Shadow (soft, low-opacity black; same in dark)
- `--shadow-sm` `0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06)`
- `--shadow-md` `0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.06)` — QR card resting
- `--shadow-lg` `0 8px 32px rgba(0,0,0,.10), 0 4px 8px rgba(0,0,0,.06)` — dropdowns
- `--shadow-xl` `0 16px 48px rgba(0,0,0,.12), 0 8px 16px rgba(0,0,0,.08)` — modal
- `--shadow-qr-hover` `0 16px 48px rgba(0,0,0,.18), 0 8px 24px rgba(0,0,0,.12)`

Buttons carry no resting shadow — only focus ring.

## Motion System

- **Enter:** `cubic-bezier(0.16, 1, 0.3, 1)` (Expo Out, no bounce) — micro 200ms / reveal 350ms.
- **Exit:** `cubic-bezier(0.4, 0, 1, 1)` 140ms (leaves faster than it arrives).
- **QR update:** instant on keystroke — the typing *is* the animation; no transition on modules.
- **Hero QR hover:** `scale(1.02)` 200ms + shadow `--shadow-md → --shadow-qr-hover`.
- **Button press:** `translateY(1px)` 80ms linear on `:active`.
- **No-go:** bounce, parallax, looping ambient, staggered module "printing" (vestibular), anything >380ms.
- **Reduced motion:** all transition/animation/keyframe wrapped in `@media (prefers-reduced-motion: no-preference)`. Under `reduce`: 0ms. One named exception `opacity-minimal-exception` (opacity 0→1 at 80ms) requires explicit approval to extend.

## Component Principles

1. **Live generator is the hero.** URL input + QR preview are the primary composition. Works before signup. Real-time on keystroke. Input labeled, `role=form`, `aria-label`; preview region `aria-live=polite`. CTA "Make it permanent" appears only after typing.
2. **QR scannability overrides theme.** Preview card always dark modules on white, `color-scheme: light`, forced white bg, ≥15:1 contrast. Mandatory code comment: `/* QR scannability absolute: dark modules on white always — do not remove for theme consistency. */`
3. **One accent, one viewport.** `--color-accent` once, on the single highest-priority interactive element. Focus ring `outline: 2px solid var(--color-accent); outline-offset: 3px` on every interactive element, no aesthetic overrides.
4. **Token-first, zero raw hex.** Every color references a CSS custom property. Raw hex = broken component (build-time lint error).

## Accessibility Rules (shipping gates, not audits)

1. QR module contrast ≥15:1, dark-on-white, never colorized. Preview card forces `color-scheme: light`.
2. Visible focus indicator on every interactive element (2px accent, 3px offset). Touch targets ≥44×44px.
3. Motion opt-in at OS level; product must feel complete with zero transitions.
4. WCAG 1.4.3 contrast is a shipping gate. Accent verified 5.8:1 / 4.6:1. New tokens must carry measured ratios in their definition comment. Live generator fully keyboard- & screen-reader-operable: `role=form`, `aria-label`, `aria-live=polite` on preview, full Tab sequence input→download, no modal traps.
