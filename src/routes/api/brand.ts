import { Hono } from "hono";
import type { Bindings } from "../../types";
import { brandMatch } from "../../lib/ai/brand";
import { buildPayload } from "../../lib/qr/content";
import { encodeMatrix } from "../../lib/qr/encoder";
import { renderSvg } from "../../lib/qr/render-svg";

export const brandApi = new Hono<{ Bindings: Bindings }>();

// AI calls are costlier than a plain preview — keep a tighter public cap.
const RATE_MAX = 20;
const RATE_WINDOW_S = 60;

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

async function withinRateLimit(env: Bindings, ip: string): Promise<boolean> {
  const windowId = Math.floor(Date.now() / 1000 / RATE_WINDOW_S);
  const key = `brand:rl:${ip}:${windowId}`;
  const current = Number(await env.RATE_LIMIT.get(key)) || 0;
  if (current >= RATE_MAX) return false;
  await env.RATE_LIMIT.put(key, String(current + 1), { expirationTtl: RATE_WINDOW_S * 2 });
  return true;
}

/**
 * POST /api/brand { url } → an on-brand, scannable QR design for that URL,
 * plus a ready-to-render SVG. Public + rate-limited (also used from the studio).
 */
brandApi.post("/api/brand", async (c) => {
  if (!(await withinRateLimit(c.env, clientIp(c.req.raw)))) {
    return c.json({ ok: false, error: "rate_limited" }, 429);
  }

  let body: { url?: string };
  try {
    body = await c.req.json<{ url?: string }>();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  const url = (body.url ?? "").trim();
  if (!url) return c.json({ ok: false, error: "url_required" }, 400);

  let kit;
  try {
    kit = await brandMatch(c.env, url);
  } catch (err) {
    console.error("[brand] match failed:", err);
    return c.json({ ok: false, error: "brand_failed" }, 500);
  }
  if (!kit) return c.json({ ok: false, error: "invalid_url" }, 400);

  // Render the branded SVG so the client can drop it straight into the preview.
  let svg: string | undefined;
  try {
    const matrix = encodeMatrix(buildPayload("url", { url }), kit.design.ecc);
    svg = renderSvg(matrix, kit.design);
  } catch {
    /* design is still returned even if this render fails */
  }

  return c.json({
    ok: true,
    design: kit.design,
    logoDataUrl: kit.logoDataUrl ?? null,
    palette: kit.palette,
    title: kit.title,
    source: kit.source,
    ai: kit.ai,
    svg,
  });
});
