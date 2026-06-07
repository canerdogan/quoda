import qrcodeImport from "qrcode-generator";
import type { Ecc } from "../../types";

// qrcode-generator is a CommonJS module exposed via `export =`. Under the
// bundler ESM interop this default import is the factory function directly.
// We normalise via `any` to be robust across interop modes (some toolchains
// surface the factory under `.default`).
const factory: any = (qrcodeImport as any).default ?? qrcodeImport;

/**
 * Encode arbitrary data into a row-major boolean QR module matrix.
 *
 * - Uses typeNumber 0 so the smallest fitting QR version is chosen automatically.
 * - Returns an NxN matrix where `matrix[row][col] === true` means a dark module.
 * - Throws on empty / whitespace-only data (a QR with no payload is meaningless).
 *
 * @param data The string payload to encode.
 * @param ecc  Error-correction level (default "M").
 */
export function encodeMatrix(data: string, ecc: Ecc = "M"): boolean[][] {
  if (typeof data !== "string" || data.trim().length === 0) {
    throw new Error("encodeMatrix: data must be a non-empty string");
  }

  const qr = factory(0, ecc);
  qr.addData(data);
  qr.make();

  const n: number = qr.getModuleCount();
  const matrix: boolean[][] = new Array(n);
  for (let row = 0; row < n; row++) {
    const line: boolean[] = new Array(n);
    for (let col = 0; col < n; col++) {
      line[col] = qr.isDark(row, col);
    }
    matrix[row] = line;
  }
  return matrix;
}
