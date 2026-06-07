import type { Ecc, QrType } from "../../types";

/** Convenience re-exports so consumers can import QR domain types from one place. */
export type { Ecc, QrType };

/**
 * A fully-resolved visual design for a rendered QR code.
 * Colors are literal hex strings because the rendered SVG is an exported image
 * asset, not UI chrome (UI chrome must use design tokens).
 */
export interface QrDesign {
  /** Foreground (module) color as a hex string, e.g. "#0D0D0F". */
  fg: string;
  /** Background color as a hex string, e.g. "#FFFFFF". */
  bg: string;
  /** Shape of each data module. */
  moduleShape: "square" | "dots" | "rounded";
  /** Style of the three finder ("eye") patterns. */
  eyeStyle: "square" | "rounded" | "circle";
  /** Optional centered logo (URL or data URI). */
  logo?: string;
  /** Optional banner label rendered under the code. */
  frameLabel?: string;
  /** Error-correction level used to encode the matrix. */
  ecc: Ecc;
  /** Rendered pixel size of the square SVG (the width/height attribute). */
  size?: number;
  /** Quiet-zone margin in modules. Defaults to 4. */
  margin?: number;
}

/** Raw key/value content fields supplied for a given QR type. */
export type QrFields = Record<string, string>;
