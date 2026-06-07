import { env } from "cloudflare:test";
import { it, expect } from "vitest";

it("D1 migrations applied — plans seeded", async () => {
  const row = await env.DB.prepare("SELECT count(*) AS n FROM plans").first<{ n: number }>();
  expect(row?.n).toBeGreaterThan(0);
});

it("KV bindings available", async () => {
  await env.SCAN_COUNTERS.put("smoke", "1");
  expect(await env.SCAN_COUNTERS.get("smoke")).toBe("1");
});
