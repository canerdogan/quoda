import { describe, it, expect } from "vitest";
import {
  hexToName,
  displayHost,
  brandName,
  subtitleFrom,
  glowColor,
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
  it("is a dark luxe brand backdrop with style + premium cues — no phone-frame instruction", () => {
    const p = buildWallpaperPrompt("#0A7EA4", "mesh", "center");
    expect(p).toContain("teal");
    expect(p).toMatch(/gradient mesh/);
    expect(p).toMatch(/dark luxe|near-black/); // dark poster backdrop
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
    expect(p).toMatch(/dark luxe/);
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
  it("builds a dark luxe 3-stop gradient (near-black, never white)", () => {
    const g = gradientFromPalette({ fg: "#0D0D0F", accent: "#FFFFFF" });
    expect(g.from).toMatch(/^#[0-9a-f]{6}$/i);
    expect(g.via.toLowerCase()).not.toBe("#ffffff");
    // base ('from') stays a near-black canvas
    expect(parseInt(g.from.slice(1), 16)).toBeLessThan(0x303030);
  });
});

describe("brandName", () => {
  it("extracts the brand name from a title before separators", () => {
    expect(brandName("onGame — AI-Powered Game Creation", "ongame.ai")).toBe("onGame");
    expect(brandName("Stripe | Financial Infrastructure", "stripe.com")).toBe("Stripe");
    expect(brandName("GameByte: build games", "gamebyte.ai")).toBe("GameByte");
  });
  it("falls back to the host label when the title is missing or too long", () => {
    expect(brandName("", "linkedin.com")).toBe("Linkedin");
    expect(brandName("A very long marketing sentence with no separators here", "acme.io")).toBe("Acme");
  });
});

describe("subtitleFrom", () => {
  it("takes the first clause and caps length", () => {
    expect(subtitleFrom("AI-Powered Game Creation Platform. Build fast.")).toBe("AI-Powered Game Creation Platform");
    expect(subtitleFrom("")).toBe("");
    expect(subtitleFrom("A".repeat(60)).length).toBeLessThanOrEqual(42);
  });
});

describe("glowColor", () => {
  it("keeps a vivid accent, boosts a dark one, defaults a greyscale brand", () => {
    expect(glowColor("#0A7EA4")).toMatch(/^#[0-9a-f]{6}$/i);
    // greyscale brand → cool default glow
    expect(glowColor("#0D0D0F").toLowerCase()).toBe("#5b8cff");
    // a dark saturated accent is lifted brighter than it started
    expect(parseInt(glowColor("#220a00").slice(1), 16)).toBeGreaterThan(0x220a00);
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
