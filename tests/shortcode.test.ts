import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { genShortCode, ensureUniqueShortCode } from "../src/lib/shortcode";

const BASE62 = /^[0-9A-Za-z]+$/;

describe("genShortCode", () => {
  it("defaults to length 7", () => {
    expect(genShortCode().length).toBe(7);
  });

  it("respects a custom length", () => {
    expect(genShortCode(10).length).toBe(10);
    expect(genShortCode(4).length).toBe(4);
  });

  it("only uses base62 characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(genShortCode(12)).toMatch(BASE62);
    }
  });

  it("produces distinct values (no obvious collisions)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(genShortCode());
    // With 62^7 space, 200 draws should be unique.
    expect(seen.size).toBe(200);
  });
});

describe("ensureUniqueShortCode", () => {
  it("returns a base62 code of the requested length", async () => {
    const code = await ensureUniqueShortCode(env.DB, 7);
    expect(code).toMatch(BASE62);
    expect(code.length).toBe(7);
  });

  it("avoids codes already present in qr_codes", async () => {
    // Pre-seed a user + a qr row whose short_code we control.
    const userId = crypto.randomUUID();
    const now = Date.now();
    await env.DB.prepare(
      "INSERT INTO users (id, email, plan_id, created_at) VALUES (?,?,?,?)",
    )
      .bind(userId, `unique-${userId}@example.com`, "free", now)
      .run();

    // Insert many short codes of len 1 so the 1-char space (62) is mostly full,
    // forcing collisions and verifying the helper retries to find a free code.
    const taken = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXY".split("");
    for (const code of taken) {
      await env.DB.prepare(
        `INSERT INTO qr_codes (id, user_id, type, title, is_dynamic, short_code, content_json, design_json, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
        .bind(crypto.randomUUID(), userId, "url", "t", 1, code, "{}", "{}", now, now)
        .run();
    }

    // Only "Z" and "z" remain free in the 1-char space.
    const fresh = await ensureUniqueShortCode(env.DB, 1);
    expect(["Z", "z"]).toContain(fresh);
  });
});
