import { Hono } from "hono";
import type { AppEnv } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth";
import { getQrById } from "../../db/queries";
import { getTotals, getDaily, getBreakdown } from "../../lib/analytics";

export const analyticsApi = new Hono<AppEnv>();
analyticsApi.use("/api/qr/*", requireAuth);

// GET /api/qr/:id/analytics -> { ok, total, daily, breakdown } (ownership enforced).
analyticsApi.get("/api/qr/:id/analytics", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const qr = await getQrById(c.env.DB, id);
  if (!qr || qr.user_id !== user.id) {
    return c.json({ ok: false, error: "Not found." }, 404);
  }

  const daysParam = Number(c.req.query("days"));
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 30;

  const [total, daily, breakdown] = await Promise.all([
    getTotals(c.env, id),
    getDaily(c.env, id, days),
    getBreakdown(c.env, id),
  ]);

  return c.json({ ok: true, total, daily, breakdown });
});
