import type { Bindings } from "../types";

export type Device = "mobile" | "tablet" | "desktop";

/** Current UTC date as YYYY-MM-DD. */
function utcDay(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Classify a user-agent into a coarse device bucket. */
export function deviceFromUA(ua: string | null | undefined): Device {
  if (!ua) return "desktop";
  const s = ua.toLowerCase();
  // Tablets first — iPads/Android tablets often also match "mobile" heuristics.
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(s)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(s))
    return "mobile";
  return "desktop";
}

interface CfLike {
  country?: string | null;
  city?: string | null;
}

/**
 * Log a single scan: bump KV counters, write a raw scans row, and upsert the
 * daily aggregate. Designed to run inside ctx.waitUntil so it never blocks the
 * redirect response.
 */
export async function logScan(
  env: Bindings,
  qr: { id: string },
  request: Request,
): Promise<void> {
  const cf = (request as Request & { cf?: CfLike }).cf;
  const country = cf?.country ?? null;
  const city = cf?.city ?? null;
  const device = deviceFromUA(request.headers.get("user-agent"));
  const referer =
    request.headers.get("referer") ?? request.headers.get("referrer") ?? null;
  const ts = Date.now();
  const day = utcDay(ts);

  const totalKey = `qr:${qr.id}:total`;
  const dayKey = `qr:${qr.id}:${day}`;

  // KV counters: read-modify-write (KV has no atomic increment).
  const [curTotal, curDay] = await Promise.all([
    env.SCAN_COUNTERS.get(totalKey),
    env.SCAN_COUNTERS.get(dayKey),
  ]);
  await Promise.all([
    env.SCAN_COUNTERS.put(totalKey, String((Number(curTotal) || 0) + 1)),
    env.SCAN_COUNTERS.put(dayKey, String((Number(curDay) || 0) + 1)),
  ]);

  // Raw scan row.
  await env.DB.prepare(
    "INSERT INTO scans (id, qr_id, ts, country, city, device, referer) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), qr.id, ts, country, city, device, referer)
    .run();

  // Daily aggregate. country is part of the PK and can be NULL; SQLite treats
  // NULL as distinct in UNIQUE/PK, so we coalesce to '' for stable upserts.
  await env.DB.prepare(
    `INSERT INTO scan_daily (qr_id, day, country, device, count)
       VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(qr_id, day, country, device)
       DO UPDATE SET count = count + 1`,
  )
    .bind(qr.id, day, country ?? "", device)
    .run();
}

/** Total scans for a QR (from the KV fast counter). */
export async function getTotals(env: Bindings, qrId: string): Promise<number> {
  const v = await env.SCAN_COUNTERS.get(`qr:${qrId}:total`);
  return Number(v) || 0;
}

/** Daily scan counts for the last `days` days, oldest-first. */
export async function getDaily(
  env: Bindings,
  qrId: string,
  days = 30,
): Promise<Array<{ day: string; count: number }>> {
  const since = utcDay(Date.now() - days * 86_400_000);
  const { results } = await env.DB.prepare(
    `SELECT day, SUM(count) AS count
       FROM scan_daily
      WHERE qr_id = ? AND day >= ?
      GROUP BY day
      ORDER BY day ASC`,
  )
    .bind(qrId, since)
    .all<{ day: string; count: number }>();
  return (results ?? []).map((r) => ({ day: r.day, count: Number(r.count) }));
}

/** Country + device breakdown maps aggregated across all time. */
export async function getBreakdown(
  env: Bindings,
  qrId: string,
): Promise<{
  country: Record<string, number>;
  device: Record<string, number>;
}> {
  const [byCountry, byDevice] = await Promise.all([
    env.DB.prepare(
      `SELECT country, SUM(count) AS count
         FROM scan_daily WHERE qr_id = ?
         GROUP BY country`,
    )
      .bind(qrId)
      .all<{ country: string | null; count: number }>(),
    env.DB.prepare(
      `SELECT device, SUM(count) AS count
         FROM scan_daily WHERE qr_id = ?
         GROUP BY device`,
    )
      .bind(qrId)
      .all<{ device: string | null; count: number }>(),
  ]);

  const country: Record<string, number> = {};
  for (const r of byCountry.results ?? []) {
    const key = r.country && r.country !== "" ? r.country : "unknown";
    country[key] = (country[key] ?? 0) + Number(r.count);
  }
  const device: Record<string, number> = {};
  for (const r of byDevice.results ?? []) {
    const key = r.device && r.device !== "" ? r.device : "unknown";
    device[key] = (device[key] ?? 0) + Number(r.count);
  }
  return { country, device };
}
