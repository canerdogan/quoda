import { describe, it, expect } from "vitest";
import {
  hexToName,
  displayHost,
  buildWallpaperPrompt,
  placementLayout,
  shadeHex,
  gradientFromPalette,
  WALLPAPER_STYLES,
  WALLPAPER_PLACEMENTS,
  WALLPAPER_NEGATIVE,
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

describe("displayHost", () => {
  it("returns a clean host for the QR-destination caption", () => {
    expect(displayHost("https://www.linkedin.com/in/you")).toBe("linkedin.com");
    expect(displayHost("gamebyte.ai")).toBe("gamebyte.ai");
    expect(displayHost("HTTPS://Stripe.com/")).toBe("stripe.com");
  });
  it("falls back to the trimmed input when unparseable", () => {
    expect(displayHost("  not a url  ")).toBe("not a url");
    expect(displayHost("")).toBe("");
  });
});

describe("buildWallpaperPrompt", () => {
  it("includes brand color, style, region, premium cues — and no phone-frame instruction", () => {
    const p = buildWallpaperPrompt("#0A7EA4", "mesh", "bottom");
    expect(p).toContain("teal");
    expect(p).toMatch(/gradient mesh/);
    expect(p).toContain("lower area");
    expect(p).toMatch(/8k|award-winning|cinematic/); // premium quality cues
    // must NOT instruct the model to draw a phone/frame (that leaked a device bezel)
    expect(p).not.toMatch(/phone wallpaper/i);
  });
  it("injects the brand vibe when provided", () => {
    const p = buildWallpaperPrompt("#0A7EA4", "waves", "center", "sleek, futuristic, neon");
    expect(p).toContain("sleek, futuristic, neon");
  });
  it("weaves the subject motif into the 'scene' style", () => {
    const p = buildWallpaperPrompt("#0A7EA4", "scene", "bottom", undefined, "neon game worlds, arcade energy");
    expect(p).toContain("neon game worlds, arcade energy");
    expect(p).toMatch(/scene/i);
  });
  it("ignores the motif for abstract styles", () => {
    const p = buildWallpaperPrompt("#0A7EA4", "mesh", "center", undefined, "neon game worlds");
    expect(p).not.toContain("neon game worlds");
    expect(p).toMatch(/abstract background/);
  });
  it("covers every style + placement without throwing", () => {
    for (const s of WALLPAPER_STYLES)
      for (const pl of WALLPAPER_PLACEMENTS) expect(buildWallpaperPrompt("#123456", s, pl).length).toBeGreaterThan(20);
  });
});

describe("WALLPAPER_NEGATIVE", () => {
  it("forbids text, qr, phone and frame artifacts", () => {
    expect(WALLPAPER_NEGATIVE).toMatch(/text/);
    expect(WALLPAPER_NEGATIVE).toMatch(/qr code/);
    expect(WALLPAPER_NEGATIVE).toMatch(/phone/);
    expect(WALLPAPER_NEGATIVE).toMatch(/frame/);
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
