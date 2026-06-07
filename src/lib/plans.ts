import type { Bindings } from "../types";
import { countDynamicByUser } from "../db/queries";

export interface PlanLimits {
  dynamicCodes: number; // -1 = unlimited
  analyticsRetentionDays: number;
  logoUpload: boolean;
}

// Mirrors migrations/0001_init.sql plan seed (limits_json). Kept as a constant
// so limit checks don't need a DB round-trip on the hot path.
const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: { dynamicCodes: 3, analyticsRetentionDays: 30, logoUpload: true },
  pro: { dynamicCodes: -1, analyticsRetentionDays: 365, logoUpload: true },
};

const DEFAULT_PLAN = "free";

/** Resolve a plan's limits, falling back to the free plan for unknown ids. */
export function getLimits(planId: string): PlanLimits {
  return PLAN_LIMITS[planId] ?? PLAN_LIMITS[DEFAULT_PLAN];
}

/**
 * Whether the user may create another dynamic QR code under their plan.
 * Unlimited (-1) plans always pass; otherwise compares the live count against
 * the plan limit.
 */
export async function canCreateDynamic(
  env: Bindings,
  user: { id: string; plan_id: string },
): Promise<boolean> {
  const limit = getLimits(user.plan_id).dynamicCodes;
  if (limit === -1) return true;
  const used = await countDynamicByUser(env.DB, user.id);
  return used < limit;
}
