import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import {
  logScan,
  getTotals,
  getDaily,
  getBreakdown,
  deviceFromUA,
} from "../src/lib/analytics";

const day = new Date().toISOString().slice(0, 10);

async function seedQr(): Promise<string> {
  const userId = crypto.randomUUID();
  const qrId = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO users (id, email, plan_id, created_at) VALUES (?,?,?,?)",
  )
    .bind(userId, `an-${userId}@example.com`, "free", now)
    .run();
  await env.DB.prepare(
    `INSERT INTO qr_codes (id, user_id, type, title, is_dynamic, short_code, destination, content_json, design_json, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(qrId, userId, "url", "Analytics QR", 1, null, "https://example.com", "{}", "{}", now, now)
    .run();
  return qrId;
}

function mobileRequest(country = "US", city = "NYC"): Request {
  const req = new Request("https://q.test/r/abc", {
    headers: {
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      referer: "https://twitter.com/",
    },
  });
  // request.cf is read-only on the Request prototype; attach for the test.
  Object.defineProperty(req, "cf", {
    value: { country, city },
    configurable: true,
  });
  return req;
}

describe("deviceFromUA", () => {
  it("classifies mobile, tablet, desktop and null", () => {
    expect(deviceFromUA("iPhone Mobile Safari")).toBe("mobile");
    expect(deviceFromUA("Mozilla/5.0 (iPad; CPU OS 17_0) Safari")).toBe("tablet");
    expect(deviceFromUA("Mozilla/5.0 (Macintosh) Chrome Safari")).toBe("desktop");
    expect(deviceFromUA(null)).toBe("desktop");
  });
});

// Each test is self-contained because the worker test pool uses isolated
// storage per test (DB + KV writes do not leak across `it` blocks).

describe("logScan", () => {
  it("increments KV total + day counters", async () => {
    const qrId = await seedQr();
    await logScan(env, { id: qrId }, mobileRequest());
    await logScan(env, { id: qrId }, mobileRequest());

    const total = await env.SCAN_COUNTERS.get(`qr:${qrId}:total`);
    const dayCount = await env.SCAN_COUNTERS.get(`qr:${qrId}:${day}`);
    expect(Number(total)).toBe(2);
    expect(Number(dayCount)).toBe(2);

    expect(await getTotals(env, qrId)).toBe(2);
  });

  it("inserts scans rows with derived fields", async () => {
    const qrId = await seedQr();
    await logScan(env, { id: qrId }, mobileRequest());
    await logScan(env, { id: qrId }, mobileRequest());

    const row = await env.DB.prepare(
      "SELECT * FROM scans WHERE qr_id = ? ORDER BY ts DESC LIMIT 1",
    )
      .bind(qrId)
      .first<{ country: string; city: string; device: string; referer: string; ts: number }>();
    expect(row?.country).toBe("US");
    expect(row?.city).toBe("NYC");
    expect(row?.device).toBe("mobile");
    expect(row?.referer).toBe("https://twitter.com/");
    expect(row?.ts).toBeGreaterThan(0);

    const countRow = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM scans WHERE qr_id = ?",
    )
      .bind(qrId)
      .first<{ n: number }>();
    expect(countRow?.n).toBe(2);
  });

  it("upserts scan_daily aggregate (count accumulates)", async () => {
    const qrId = await seedQr();
    await logScan(env, { id: qrId }, mobileRequest());
    await logScan(env, { id: qrId }, mobileRequest());

    const row = await env.DB.prepare(
      "SELECT count FROM scan_daily WHERE qr_id = ? AND day = ? AND country = ? AND device = ?",
    )
      .bind(qrId, day, "US", "mobile")
      .first<{ count: number }>();
    expect(row?.count).toBe(2);
  });

  it("getDaily returns aggregated rows", async () => {
    const qrId = await seedQr();
    await logScan(env, { id: qrId }, mobileRequest());
    await logScan(env, { id: qrId }, mobileRequest());

    const daily = await getDaily(env, qrId, 30);
    const found = daily.find((d) => d.day === day);
    expect(found?.count).toBe(2);
  });

  it("getBreakdown returns country + device maps", async () => {
    const qrId = await seedQr();
    await logScan(env, { id: qrId }, mobileRequest());
    await logScan(env, { id: qrId }, mobileRequest());

    const b = await getBreakdown(env, qrId);
    expect(b.country.US).toBe(2);
    expect(b.device.mobile).toBe(2);
  });
});

describe("logScan device + cf fallbacks", () => {
  it("falls back to null country/city when cf absent and detects desktop", async () => {
    const qrId = await seedQr();
    const req = new Request("https://q.test/r/xyz", {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });
    await logScan(env, { id: qrId }, req);

    const row = await env.DB.prepare(
      "SELECT country, city, device, referer FROM scans WHERE qr_id = ? LIMIT 1",
    )
      .bind(qrId)
      .first<{ country: string | null; city: string | null; device: string; referer: string | null }>();
    expect(row?.country).toBeNull();
    expect(row?.city).toBeNull();
    expect(row?.device).toBe("desktop");
    expect(row?.referer).toBeNull();
  });

  it("detects tablet from an iPad user-agent", async () => {
    const qrId = await seedQr();
    const req = new Request("https://q.test/r/tab", {
      headers: {
        "user-agent":
          "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
      },
    });
    await logScan(env, { id: qrId }, req);
    const row = await env.DB.prepare(
      "SELECT device FROM scans WHERE qr_id = ? LIMIT 1",
    )
      .bind(qrId)
      .first<{ device: string }>();
    expect(row?.device).toBe("tablet");
  });
});
