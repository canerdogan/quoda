import type { QrDesign } from "./types";

/**
 * Render a QR module matrix to a deterministic, standalone SVG string.
 *
 * Colors are emitted as literal hex here because this output is an exported
 * image asset (downloadable PNG/SVG/etc.), not UI chrome.
 *
 * Coordinate system: 1 SVG user unit == 1 QR module. The viewBox is
 * `0 0 (n + 2*margin) (n + 2*margin)` so the renderer is resolution
 * independent and the `size` attribute simply scales it.
 */
export function renderSvg(matrix: boolean[][], design: QrDesign): string {
  const n = matrix.length;
  const margin = design.margin ?? 4;
  const moduleArea = n;
  const total = moduleArea + margin * 2;

  // Frame label adds a banner band below the code.
  const hasLabel = !!design.frameLabel && design.frameLabel.length > 0;
  const bannerHeight = hasLabel ? 6 : 0; // modules
  const viewH = total + bannerHeight;

  const fg = design.fg;
  const bg = design.bg;
  const off = margin; // pixel(module) offset for the matrix origin

  const eyes = finderOrigins(n); // top-left, top-right, bottom-left
  const inEye = (row: number, col: number): boolean =>
    eyes.some(
      ([er, ec]) => row >= er && row < er + 7 && col >= ec && col < ec + 7
    );

  const parts: string[] = [];

  // --- Background ----------------------------------------------------------
  parts.push(
    `<rect x="0" y="0" width="${total}" height="${viewH}" fill="${esc(bg)}"/>`
  );

  // --- Data modules (skip finder-eye cells; eyes drawn separately) ---------
  const shape = design.moduleShape;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!matrix[row][col]) continue;
      if (inEye(row, col)) continue;
      parts.push(moduleGlyph(shape, off + col, off + row, fg));
    }
  }

  // --- Finder eyes ---------------------------------------------------------
  for (const [er, ec] of eyes) {
    parts.push(eyeGlyph(design.eyeStyle, off + ec, off + er, fg, bg));
  }

  // --- Logo (centered, knocked-out white pad) ------------------------------
  if (design.logo) {
    const logoSize = Math.max(4, Math.round(n * 0.22));
    const padSize = logoSize + 2;
    const cx = off + n / 2;
    const cy = off + n / 2;
    const padX = cx - padSize / 2;
    const padY = cy - padSize / 2;
    const logoX = cx - logoSize / 2;
    const logoY = cy - logoSize / 2;
    parts.push(
      `<rect x="${fmt(padX)}" y="${fmt(padY)}" width="${padSize}" height="${padSize}" rx="1" fill="#FFFFFF"/>`
    );
    parts.push(
      `<image href="${esc(design.logo)}" x="${fmt(logoX)}" y="${fmt(logoY)}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`
    );
  }

  // --- Frame label banner --------------------------------------------------
  if (hasLabel) {
    const bandY = total;
    const padX = margin;
    const bandW = total - margin * 2;
    parts.push(
      `<rect x="${padX}" y="${fmt(bandY)}" width="${bandW}" height="${bannerHeight - 1}" rx="1.5" fill="${esc(fg)}"/>`
    );
    parts.push(
      `<text x="${fmt(total / 2)}" y="${fmt(bandY + (bannerHeight - 1) / 2)}" font-family="Inter, system-ui, sans-serif" font-size="3" font-weight="600" letter-spacing="0.1" text-anchor="middle" dominant-baseline="central" fill="${esc(bg)}">${esc(
        design.frameLabel as string
      )}</text>`
    );
  }

  const sizeAttr =
    design.size != null
      ? ` width="${design.size}" height="${Math.round((design.size * viewH) / total)}"`
      : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg"${sizeAttr} viewBox="0 0 ${total} ${viewH}" shape-rendering="crispEdges">` +
    parts.join("") +
    `</svg>`
  );
}

// --- Helpers ----------------------------------------------------------------

/** Origins (row, col) of the three finder patterns for an NxN matrix. */
function finderOrigins(n: number): Array<[number, number]> {
  return [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ];
}

/** A single data module glyph at module-space (x, y). */
function moduleGlyph(
  shape: QrDesign["moduleShape"],
  x: number,
  y: number,
  fg: string
): string {
  switch (shape) {
    case "dots":
      // r=0.5 keeps adjacent modules tangent so timing/data runs stay continuous
      // enough to decode reliably, while preserving the dotted aesthetic.
      return `<circle cx="${fmt(x + 0.5)}" cy="${fmt(y + 0.5)}" r="0.5" fill="${esc(fg)}"/>`;
    case "rounded":
      return `<rect x="${x}" y="${y}" width="1" height="1" rx="0.3" fill="${esc(fg)}"/>`;
    case "square":
    default:
      return `<rect x="${x}" y="${y}" width="1" height="1" fill="${esc(fg)}"/>`;
  }
}

/**
 * A finder ("eye") pattern at module-space origin (x, y) spanning 7x7 modules.
 * A real finder is: 7x7 dark ring, 5x5 light gap, 3x3 dark center. We honor
 * `eyeStyle` for the corner radius / circularity of the outer ring & center.
 */
function eyeGlyph(
  style: QrDesign["eyeStyle"],
  x: number,
  y: number,
  fg: string,
  bg: string
): string {
  const out: string[] = [];
  if (style === "circle") {
    const cx = x + 3.5;
    const cy = y + 3.5;
    out.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="3.5" fill="${esc(fg)}"/>`);
    out.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="2.5" fill="${esc(bg)}"/>`);
    out.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="1.5" fill="${esc(fg)}"/>`);
    return out.join("");
  }

  const rx = style === "rounded" ? `2` : `0`;
  const rxInner = style === "rounded" ? `1` : `0`;
  const rxCenter = style === "rounded" ? `0.8` : `0`;
  // Outer 7x7 dark
  out.push(
    `<rect x="${x}" y="${y}" width="7" height="7" rx="${rx}" fill="${esc(fg)}"/>`
  );
  // Inner 5x5 light gap
  out.push(
    `<rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="${rxInner}" fill="${esc(bg)}"/>`
  );
  // Center 3x3 dark
  out.push(
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${rxCenter}" fill="${esc(fg)}"/>`
  );
  return out.join("");
}

/** Format a number compactly and deterministically (trim trailing zeros). */
function fmt(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 1000) / 1000);
}

/** Escape a string for safe inclusion in XML text/attributes. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
