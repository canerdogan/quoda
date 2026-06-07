import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { getLimits, canCreateDynamic } from "../src/lib/plans";
import { createUser, createQr } from "../src/db/queries";

describe("getLimits", () => {
  it("returns the seeded free-plan limits", () => {
    const free = getLimits("free");
    expect(free.dynamicCodes).toBe(3);
    expect(free.analyticsRetentionDays).toBe(30);
    expect(free.logoUpload).toBe(true);
  });

  it("returns unlimited (-1) dynamic codes for pro", () => {
    const pro = getLimits("pro");
    expect(pro.dynamicCodes).toBe(-1);
    expect(pro.analyticsRetentionDays).toBe(365);
  });

  it("falls back to free limits for an unknown plan id", () => {
    const unknown = getLimits("does-not-exist");
    expect(unknown.dynamicCodes).toBe(3);
  });
});

describe("canCreateDynamic", () => {
  async function freeUserWithDynamics(n: number) {
    const user = await createUser(env.DB, `plan-${crypto.randomUUID()}@example.com`);
    for (let i = 0; i < n; i++) {
      await createQr(env.DB, {
        user_id: user.id,
        type: "url",
        title: `dyn ${i}`,
        is_dynamic: true,
        short_code: `pc${crypto.randomUUID().slice(0, 8)}`,
        destination: "https://example.com",
        content_json: "{}",
        design_json: "{}",
      });
    }
    return user;
  }

  it("allows a free user with 0 dynamic codes", async () => {
    const user = await freeUserWithDynamics(0);
    expect(await canCreateDynamic(env, user)).toBe(true);
  });

  it("allows the 3rd dynamic but blocks the 4th on free", async () => {
    const user = await freeUserWithDynamics(2);
    // Has 2, limit 3 -> can create the 3rd.
    expect(await canCreateDynamic(env, user)).toBe(true);

    const user3 = await freeUserWithDynamics(3);
    // Has 3, limit 3 -> cannot create the 4th.
    expect(await canCreateDynamic(env, user3)).toBe(false);
  });

  it("always allows a pro (unlimited) user", async () => {
    const user = await freeUserWithDynamics(10);
    const proUser = { ...user, plan_id: "pro" };
    expect(await canCreateDynamic(env, proUser)).toBe(true);
  });
});
