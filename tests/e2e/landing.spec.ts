import { test, expect } from "@playwright/test";

test.describe("Landing — live generator", () => {
  test("hero generator updates the QR and reveals the permanent CTA after typing", async ({ page }) => {
    await page.goto("/");

    const cta = page.locator("#gen-cta");
    // CTA hidden before any input.
    await expect(cta).toBeHidden();

    await page.fill("#gen-url", "https://canerdogan.me");

    // QR preview renders an <svg> and the CTA appears, pointing at /login.
    await expect(page.locator("#gen-preview-surface svg")).toBeVisible({ timeout: 5000 });
    await expect(cta).toBeVisible();
    await expect(cta.locator("a")).toHaveAttribute("href", "/login");
  });

  test("public marketing pages all render", async ({ page }) => {
    for (const path of ["/", "/features", "/pricing", "/use-cases", "/docs", "/login"]) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} responds 200`).toBe(200);
    }
  });

  test("pricing shows the disabled Cloud upgrade", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText(/Coming in Cloud/i)).toBeVisible();
  });
});
