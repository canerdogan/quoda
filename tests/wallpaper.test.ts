import { describe, it, expect } from "vitest";
import {
  hexToName,
  buildWallpaperPrompt,
  placementLayout,
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

describe("placementLayout", () => {
  it("returns a usable qr fraction", () => {
    const l = placementLayout("center");
    expect(l.placement).toBe("center");
    expect(l.qrFraction).toBeGreaterThan(0.3);
    expect(l.qrFraction).toBeLessThan(0.6);
  });
});
