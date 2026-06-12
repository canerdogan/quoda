import { Hono } from "hono";
import type { Bindings } from "../../types";
import { generateWallpaper } from "../../lib/ai/wallpaper";
import type { WallpaperStyle, WallpaperPlacement } from "../../lib/ai/wallpaper";

export const wallpaperApi = new Hono<{ Bindings: Bindings }>();

// Image generation is the heaviest AI call — keep a tight public cap.
const RATE_MAX = 8;
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
  const key = `wp:rl:${ip}:${windowId}`;
  const current = Number(await env.RATE_LIMIT.get(key)) || 0;
  if (current >= RATE_MAX) return false;
  await env.RATE_LIMIT.put(key, String(current + 1), { expirationTtl: RATE_WINDOW_S * 2 });
  return true;
}

/**
 * POST /api/wallpaper { url, style?, placement? } → an AI brand background plus
 * the scannable QR SVG + layout. The client composites them onto a phone canvas.
 */
wallpaperApi.post("/api/wallpaper", async (c) => {
  if (!(await withinRateLimit(c.env, clientIp(c.req.raw)))) {
    return c.json({ ok: false, error: "rate_limited" }, 429);
  }

  let body: { url?: string; style?: string; placement?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  const url = (body.url ?? "").trim();
  if (!url) return c.json({ ok: false, error: "url_required" }, 400);

  let result;
  try {
    result = await generateWallpaper(c.env, url, {
      style: body.style as WallpaperStyle | undefined,
      placement: body.placement as WallpaperPlacement | undefined,
    });
  } catch (err) {
    console.error("[wallpaper] failed:", err);
    return c.json({ ok: false, error: "wallpaper_failed" }, 500);
  }
  if (!result) return c.json({ ok: false, error: "could_not_generate" }, 502);

  return c.json({ ok: true, ...result });
});
