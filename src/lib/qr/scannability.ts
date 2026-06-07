import type { QrDesign } from "./types";

/** Brand-invariant safe fallbacks (from the QR preview-card design rule). */
const SAFE_FG = "#0D0D0F";
const SAFE_BG = "#FFFFFF";

/** Minimum WCAG contrast ratio for a reliably scannable code. */
const MIN_RATIO = 3;
/** Below this ratio we surface a soft warning even though it still scans. */
const WARN_RATIO = 7;

/**
 * Parse a hex color (#rgb, #rrggbb, with/without leading #, any case) into
 * 0–255 RGB channels. Throws on malformed input.
 */
function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "").toLowerCase();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-f]{6}$/.test(h)) {
    throw new Error(`scannability: invalid hex color "${hex}"`);
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance of an sRGB color. */
function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Compute the WCAG contrast ratio between two hex colors.
 * Symmetric: argument order does not matter. Range is 1..21.
 */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(parseHex(fg));
  const l2 = relativeLuminance(parseHex(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Assess whether a foreground/background pair will scan reliably.
 * - `ok`   : ratio >= 3 (the practical floor for camera decoding).
 * - `warn` : ratio < 7 (still scans, but worth flagging to the user).
 */
export function isScannable(design: Pick<QrDesign, "fg" | "bg">): {
  ok: boolean;
  ratio: number;
  warn: boolean;
} {
  const ratio = contrastRatio(design.fg, design.bg);
  return {
    ratio,
    ok: ratio >= MIN_RATIO,
    warn: ratio < WARN_RATIO,
  };
}

/**
 * Return a guaranteed-scannable design. If the supplied fg/bg pair fails the
 * minimum contrast test, force the brand-safe dark-on-white palette while
 * preserving every other property of the design object.
 */
export function safePalette<T extends { fg: string; bg: string }>(design: T): T {
  if (isScannable(design).ok) return design;
  return { ...design, fg: SAFE_FG, bg: SAFE_BG };
}
