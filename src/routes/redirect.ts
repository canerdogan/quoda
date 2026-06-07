import { Hono } from "hono";
import type { Bindings } from "../types";
import { getQrByShortCode } from "../db/queries";
import { logScan } from "../lib/analytics";

export const redirect = new Hono<{ Bindings: Bindings }>();

// Dynamic QR endpoint: resolve the short code, log the scan out-of-band, then
// 302 to the current destination. Kept tiny — the index orchestrator mounts it.
redirect.get("/r/:code", async (c) => {
  const code = c.req.param("code");

  let qr;
  try {
    qr = await getQrByShortCode(c.env.DB, code);
  } catch (err) {
    console.error(`[redirect] lookup failed for ${code}:`, err);
    return c.text("Temporarily unavailable", 503);
  }

  if (!qr || !qr.destination) {
    return c.text("Not Found", 404);
  }

  // Log scan without blocking the redirect. logScan never throws, but guard the
  // waitUntil too so a rejected promise can't surface.
  c.executionCtx.waitUntil(
    logScan(c.env, { id: qr.id }, c.req.raw).catch((err) =>
      console.error("[redirect] scan log error:", err),
    ),
  );

  return c.redirect(qr.destination, 302);
});
