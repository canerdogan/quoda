import { describe, it, expect } from "vitest";
import {
  contrastRatio,
  isScannable,
  safePalette,
} from "../src/lib/qr/scannability";

describe("contrastRatio", () => {
  it("returns ~1 for identical colors", () => {
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("returns ~21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("returns >= 15 for the brand dark module on white", () => {
    expect(contrastRatio("#0D0D0F", "#ffffff")).toBeGreaterThanOrEqual(15);
  });

  it("is symmetric (order of arguments does not matter)", () => {
    expect(contrastRatio("#0A7EA4", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#0A7EA4"),
      5
    );
  });

  it("accepts 3-digit hex shorthand", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#fff", "#fff")).toBeCloseTo(1, 5);
  });

  it("accepts hex without leading #", () => {
    expect(contrastRatio("000000", "ffffff")).toBeCloseTo(21, 1);
  });

  it("is case-insensitive", () => {
    expect(contrastRatio("#0d0d0f", "#FFFFFF")).toBeCloseTo(
      contrastRatio("#0D0D0F", "#ffffff"),
      5
    );
  });
});

describe("isScannable", () => {
  it("fails a same-color pair (ratio ~1)", () => {
    const r = isScannable({ fg: "#ffffff", bg: "#ffffff" });
    expect(r.ok).toBe(false);
    expect(r.ratio).toBeCloseTo(1, 5);
  });

  it("passes brand dark module on white with no warning", () => {
    const r = isScannable({ fg: "#0D0D0F", bg: "#ffffff" });
    expect(r.ok).toBe(true);
    expect(r.warn).toBe(false);
    expect(r.ratio).toBeGreaterThanOrEqual(7);
  });

  it("ok=true but warn=true for a mid-contrast pair (3 <= ratio < 7)", () => {
    // accent teal on white ~5.8:1 -> scannable but below the AAA-ish 7 threshold
    const r = isScannable({ fg: "#0A7EA4", bg: "#ffffff" });
    expect(r.ok).toBe(true);
    expect(r.warn).toBe(true);
    expect(r.ratio).toBeGreaterThanOrEqual(3);
    expect(r.ratio).toBeLessThan(7);
  });

  it("ok is exactly the ratio>=3 boundary", () => {
    // a light grey on white sits below the 3:1 floor -> not ok
    const low = isScannable({ fg: "#aaaaaa", bg: "#ffffff" });
    expect(low.ratio).toBeLessThan(3);
    expect(low.ok).toBe(false);
  });
});

describe("safePalette", () => {
  it("forces a safe black-on-white palette when the pair fails", () => {
    const fixed = safePalette({ fg: "#ffffff", bg: "#ffffff" });
    expect(fixed.fg).toBe("#0D0D0F");
    expect(fixed.bg).toBe("#FFFFFF");
  });

  it("leaves a scannable palette untouched", () => {
    const ok = { fg: "#0D0D0F", bg: "#FFFFFF" };
    expect(safePalette(ok)).toEqual(ok);
  });

  it("preserves extra properties on the design object", () => {
    const design = { fg: "#fff", bg: "#fff", moduleShape: "dots" as const };
    const fixed = safePalette(design);
    expect(fixed.moduleShape).toBe("dots");
    expect(fixed.fg).toBe("#0D0D0F");
    expect(fixed.bg).toBe("#FFFFFF");
  });

  it("keeps a low-but-scannable palette (ratio>=3) untouched", () => {
    const accent = { fg: "#0A7EA4", bg: "#FFFFFF" };
    expect(safePalette(accent)).toEqual(accent);
  });
});
