// Compiles docs/design/design-guideline.json -> public/styles/tokens.css
// This is the ONLY place hardcoded color/spacing/motion values are allowed.
// Components must reference var(--token) exclusively.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const g = JSON.parse(readFileSync(resolve(root, "docs/design/design-guideline.json"), "utf8"));
const t = g.design_tokens;
const m = g.motion_system;

const isTokenKey = (k) => k.startsWith("--");
const emit = (obj) =>
  Object.entries(obj)
    .filter(([k]) => isTokenKey(k))
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

// Typography: family + per-style scale custom props
const slug = (s) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
const typeVars = [`  --font-sans: ${t.typography["font-family"]};`];
for (const [name, s] of Object.entries(t.typography.scale)) {
  const id = slug(name);
  if (s.size) typeVars.push(`  --fs-${id}: ${s.size};`);
  if (s.weight) typeVars.push(`  --fw-${id}: ${s.weight};`);
  if (s["line-height"]) typeVars.push(`  --lh-${id}: ${s["line-height"]};`);
  if (s.tracking) typeVars.push(`  --ls-${id}: ${s.tracking};`);
}

// Spacing scale -> --space-N (parse the numbers out of the prose token)
const spaceVals = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128];
const spaceVars = spaceVals.map((n) => `  --space-${n}: ${n}px;`).join("\n");

// Motion
const motionVars = [
  `  --ease-enter: ${m.enter_easing};`,
  `  --ease-exit: ${m.exit_easing};`,
  `  --dur-micro-in: 200ms;`,
  `  --dur-micro-out: 140ms;`,
  `  --dur-reveal-in: 350ms;`,
  `  --dur-reveal-out: 140ms;`,
  `  --dur-layout: 300ms;`,
  `  --dur-opacity-exception: 80ms;`,
].join("\n");

const css = `/* AUTO-GENERATED from docs/design/design-guideline.json by scripts/build-tokens.mjs.
   Do NOT edit by hand. North star: every token earns the word "reliable". */

:root {
  color-scheme: light dark;

  /* color — light (default) */
${emit(t.color.light)}

  /* radius */
${emit(t.radius)}

  /* shadow */
${emit(t.shadow)}

  /* typography */
${typeVars.join("\n")}

  /* spacing (8pt grid) */
${spaceVars}

  /* motion */
${motionVars}
}

/* Dark via system preference (unless explicitly set to light) */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${emit(t.color.dark)}
  }
}

/* Dark via explicit toggle */
:root[data-theme="dark"] {
${emit(t.color.dark)}
}

/* Light via explicit toggle (override system) */
:root[data-theme="light"] {
${emit(t.color.light)}
}

/* Motion is opt-in at the OS level. Under reduced-motion everything is instant,
   except the single named opacity exception. */
@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-micro-in: 0ms;
    --dur-micro-out: 0ms;
    --dur-reveal-in: 0ms;
    --dur-reveal-out: 0ms;
    --dur-layout: 0ms;
    /* --dur-opacity-exception stays 80ms (named exception) */
  }
}
`;

const out = resolve(root, "public/styles/tokens.css");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, css);
console.log(`tokens.css written (${css.length} bytes) -> public/styles/tokens.css`);
