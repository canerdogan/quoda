import { Hono } from "hono";
import type { Bindings } from "../types";
import { getQrByShortCode } from "../db/queries";
import { logScan } from "../lib/analytics";

export const redirect = new Hono<{ Bindings: Bindings }>();

// Dynamic QR endpoint: resolve the short code, log the scan out-of-band, then
// 302 to the current destination. Kept tiny — the index orchestrator mounts it.
redirect.get("/r/:code", async (c) => {
  const code = c.req.param("code");
  const qr = await getQrByShortCode(c.env.DB, code);

  if (!qr || !qr.destination) {
    return c.text("Not Found", 404);
  }

  // Log scan without blocking the redirect.
  c.executionCtx.waitUntil(logScan(c.env, { id: qr.id }, c.req.raw));

  return c.redirect(qr.destination, 302);
});
