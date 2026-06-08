import { describe, it, expect } from "vitest";
import { normalizeUrl, extractBrandSignals } from "../src/lib/ai/brand";

describe("normalizeUrl", () => {
  it("adds https to a bare host", () => {
    expect(normalizeUrl("github.com")?.toString()).toBe("https://github.com/");
  });
  it("keeps an explicit scheme", () => {
    expect(normalizeUrl("http://x.test/path")?.toString()).toBe("http://x.test/path");
  });
  it("rejects empty and non-http schemes", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("ftp://x.test")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("extractBrandSignals", () => {
  const base = new URL("https://brand.test/");
  const html = `
    <html><head>
      <title>Brand · The Tagline</title>
      <meta name="theme-color" content="#0A7EA4">
      <link rel="icon" href="/favicon-32.png">
      <link rel="apple-touch-icon" href="/apple-touch-icon.png">
      <link rel="shortcut icon" href="/old.ico">
      <meta property="og:image" content="https://cdn.brand.test/og.png">
    </head><body></body></html>`;

  it("extracts title, theme-color and og:image", () => {
    const s = extractBrandSignals(html, base);
    expect(s.title).toBe("Brand · The Tagline");
    expect(s.themeColor).toBe("#0A7EA4");
    expect(s.ogImage).toBe("https://cdn.brand.test/og.png");
  });

  it("ranks apple-touch-icon first, .ico last, and resolves to absolute URLs", () => {
    const s = extractBrandSignals(html, base);
    expect(s.iconUrls[0]).toBe("https://brand.test/apple-touch-icon.png");
    expect(s.iconUrls).toContain("https://brand.test/favicon-32.png");
    // conventional favicon.ico is always appended as a last resort
    expect(s.iconUrls).toContain("https://brand.test/favicon.ico");
    const icoIndex = s.iconUrls.indexOf("https://brand.test/old.ico");
    const pngIndex = s.iconUrls.indexOf("https://brand.test/favicon-32.png");
    expect(pngIndex).toBeLessThan(icoIndex);
  });

  it("ignores an invalid theme-color and falls back to hostname title", () => {
    const s = extractBrandSignals(
      `<head><meta name="theme-color" content="not-a-color"></head>`,
      base,
    );
    expect(s.themeColor).toBeUndefined();
    expect(s.title).toBe("brand.test");
  });
});
