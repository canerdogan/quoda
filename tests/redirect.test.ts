import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { redirect } from "../src/routes/redirect";
import { createUser, createQr, updateQr } from "../src/db/queries";

// Minimal ExecutionContext: waitUntil runs the promise synchronously enough for
// the test to observe its side effects after the response resolves.
function makeCtx() {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil(p: Promise<unknown>) {
      pending.push(Promise.resolve(p));
    },
    passThroughOnException() {},
    async _drain() {
      await Promise.all(pending);
    },
  };
  return ctx;
}

async function seedDynamicQr(code: string, destination: string): Promise<string> {
  const user = await createUser(env.DB, `rd-${crypto.randomUUID()}@example.com`);
  const qr = await createQr(env.DB, {
    user_id: user.id,
    type: "url",
    title: "Redirect QR",
    is_dynamic: true,
    short_code: code,
    destination,
    content_json: "{}",
    design_json: "{}",
  });
  return qr.id;
}

describe("GET /r/:code", () => {
  it("returns 404 for an unknown short code", async () => {
    const ctx = makeCtx();
    const res = await redirect.fetch(
      new Request("https://q.test/r/unknown123"),
      env,
      ctx as unknown as ExecutionContext,
    );
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
  });

  it("302-redirects a known code to its destination and increments the counter", async () => {
    const code = "rdir" + crypto.randomUUID().slice(0, 6);
    const dest = "https://example.com/landing";
    const qrId = await seedDynamicQr(code, dest);

    const ctx = makeCtx();
    const res = await redirect.fetch(
      new Request(`https://q.test/r/${code}`, {
        headers: { "user-agent": "Mozilla/5.0 (iPhone) Mobile Safari" },
      }),
      env,
      ctx as unknown as ExecutionContext,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(dest);

    // Allow the waitUntil scan log to finish, then assert the counter moved.
    await ctx._drain();
    const total = await env.SCAN_COUNTERS.get(`qr:${qrId}:total`);
    expect(Number(total)).toBe(1);

    const scanRow = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM scans WHERE qr_id = ?",
    )
      .bind(qrId)
      .first<{ n: number }>();
    expect(scanRow?.n).toBe(1);
  });

  it("returns 404 when the code exists but has no destination", async () => {
    const code = "nodst" + crypto.randomUUID().slice(0, 6);
    const qrId = await seedDynamicQr(code, "https://temp");
    await updateQr(env.DB, qrId, { destination: null });

    const ctx = makeCtx();
    const res = await redirect.fetch(
      new Request(`https://q.test/r/${code}`),
      env,
      ctx as unknown as ExecutionContext,
    );
    expect(res.status).toBe(404);
  });

  it("editing the destination changes the redirect target (same short code)", async () => {
    const code = "edit" + crypto.randomUUID().slice(0, 6);
    const qrId = await seedDynamicQr(code, "https://old.example.com");
    await updateQr(env.DB, qrId, { destination: "https://new.example.com" });

    const ctx = makeCtx();
    const res = await redirect.fetch(
      new Request(`https://q.test/r/${code}`),
      env,
      ctx as unknown as ExecutionContext,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://new.example.com");

    // Drain the waitUntil scan log so storage writes complete inside the
    // isolated-storage frame for this test.
    await ctx._drain();
  });
});
