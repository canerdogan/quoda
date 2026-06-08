import { test, expect, type Page } from "@playwright/test";

// Brand Match end-to-end: the AI-branded code (brand colors + centre logo) must
// still decode. Hits the live /api/brand (real network + Workers AI) against a
// stable public site. Resilient: if the brand service is unavailable in the
// environment (offline CI / rate limit), the test skips rather than failing.

const SIZE = 512;

async function decodeSvg(page: Page, svg: string): Promise<string | null> {
  return page.evaluate(
    async ({ svg, size }) => {
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.width = size;
      img.height = size;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("svg load failed"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const data = ctx.getImageData(0, 0, size, size);
      const r = (window as unknown as { jsQR: typeof import("jsqr").default }).jsQR(
        data.data,
        size,
        size,
      );
      return r ? r.data : null;
    },
    { svg, size: SIZE },
  );
}

test("Brand Match produces a scannable, on-brand code", async ({ page }) => {
  await page.goto("/");
  await page.addScriptTag({ path: "node_modules/jsqr/dist/jsQR.js" });

  const target = "https://github.com";
  const res = await page.request.post("/api/brand", { data: { url: target } });
  if (!res.ok()) {
    test.skip(true, `brand service unavailable (${res.status()})`);
    return;
  }
  const json = (await res.json()) as { ok?: boolean; svg?: string; source?: string };
  if (!json.ok || !json.svg) {
    test.skip(true, "brand service returned no svg");
    return;
  }

  // Branded code (custom color + embedded logo) still decodes to the URL.
  expect(await decodeSvg(page, json.svg)).toBe(target);
  expect(json.source).toBe("github.com");
});
