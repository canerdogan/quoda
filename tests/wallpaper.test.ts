import { describe, it, expect } from "vitest";
import {
  hexToName,
  buildWallpaperPrompt,
  placementLayout,
  shadeHex,
  gradientFromPalette,
  WALLPAPER_STYLES,
  WALLPAPER_PLACEMENTS,
} from "../src/lib/ai/wallpaper";

describe("hexToName", () => {
  it("names hues and lightness", () => {
    expect(hexToName("#0A7EA4")).toContain("teal");
    expect(hexToName("#0D0D0F")).toBe("near-black");
    expect(hexToName("#FFFFFF")).toBe("off-white");
  });
  it("falls back for bad input", () => {
    expect(hexToName("nope")).toBe("neutral");
  });
});

describe("buildWallpaperPrompt", () => {
  it("includes the brand color, style and an empty region, and forbids text/qr", () => {
    const p = buildWallpaperPrompt("#0A7EA4", "mesh", "bottom");
    expect(p).toContain("teal");
    expect(p).toMatch(/gradient mesh/);
    expect(p).toContain("lower area");
    expect(p).toMatch(/no text/);
    expect(p).toMatch(/no qr/i);
  });
  it("covers every style + placement without throwing", () => {
    for (const s of WALLPAPER_STYLES)
      for (const pl of WALLPAPER_PLACEMENTS) expect(buildWallpaperPrompt("#123456", s, pl).length).toBeGreaterThan(20);
  });
});

describe("shadeHex / gradientFromPalette (no-AI fallback)", () => {
  it("darkens and lightens a hex", () => {
    expect(shadeHex("#0A7EA4", 0.5)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(shadeHex("#0A7EA4", 1.3)).toMatch(/^#[0-9a-f]{6}$/i);
    // darker should have a smaller numeric value than lighter
    expect(parseInt(shadeHex("#0A7EA4", 0.4).slice(1), 16)).toBeLessThan(
      parseInt(shadeHex("#0A7EA4", 1.3).slice(1), 16),
    );
  });
  it("builds a 3-stop gradient and avoids a near-white base", () => {
    const g = gradientFromPalette({ fg: "#0D0D0F", accent: "#FFFFFF" });
    expect(g.from).toMatch(/^#[0-9a-f]{6}$/i);
    // accent is white → base falls back to fg/teal, so 'via' isn't white
    expect(g.via.toLowerCase()).not.toBe("#ffffff");
  });
});

describe("placementLayout", () => {
  it("returns a usable qr fraction", () => {
    const l = placementLayout("center");
    expect(l.placement).toBe("center");
    expect(l.qrFraction).toBeGreaterThan(0.3);
    expect(l.qrFraction).toBeLessThan(0.6);
  });
});
