import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { pages } from "../src/routes/pages";
import { onboarding } from "../src/routes/onboarding";
import { createUser, createQr, upsertDynamicPage } from "../src/db/queries";
import { startSession, SESSION_COOKIE } from "../src/lib/auth/session";

// Minimal ExecutionContext stub — these routes don't use waitUntil but fetch()
// requires a third arg.
const ctx = {
  waitUntil() {},
  passThroughOnException() {},
} as unknown as ExecutionContext;

describe("GET /p/:slug (hosted dynamic landing pages)", () => {
  it("renders a social link-in-bio page with its links", async () => {
    const user = await createUser(env.DB, `p-${crypto.randomUUID()}@example.com`);
    const slug = "soc" + crypto.randomUUID().slice(0, 6);
    const data = {
      name: "Ada Lovelace",
      bio: "Mathematician & first programmer",
      links: [
        { label: "Instagram", url: "https://instagram.com/ada" },
        { label: "My website", url: "https://ada.example.com" },
      ],
    };
    const qr = await createQr(env.DB, {
      user_id: user.id,
      type: "social",
      title: "Ada's links",
      is_dynamic: true,
      short_code: slug,
      destination: `${env.APP_URL}/p/${slug}`,
      content_json: JSON.stringify(data),
      design_json: "{}",
    });
    await upsertDynamicPage(env.DB, {
      qr_id: qr.id,
      kind: "social",
      data_json: JSON.stringify(data),
    });

    const res = await pages.fetch(
      new Request(`https://q.test/p/${slug}`),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const html = await res.text();

    // The page renders the person's name and bio.
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Mathematician &amp; first programmer");
    // ...and each social link as a real anchor to its URL.
    expect(html).toContain("Instagram");
    expect(html).toContain('href="https://instagram.com/ada"');
    expect(html).toContain("My website");
    expect(html).toContain('href="https://ada.example.com"');
  });

  it("renders a menu page with sections and prices", async () => {
    const user = await createUser(env.DB, `pm-${crypto.randomUUID()}@example.com`);
    const slug = "menu" + crypto.randomUUID().slice(0, 6);
    const data = {
      title: "Sunrise Cafe",
      currency: "$",
      sections: [
        {
          title: "Coffee",
          items: [{ name: "Flat White", description: "Double shot", price: "4.50" }],
        },
      ],
    };
    const qr = await createQr(env.DB, {
      user_id: user.id,
      type: "menu",
      title: "Cafe menu",
      is_dynamic: true,
      short_code: slug,
      destination: `${env.APP_URL}/p/${slug}`,
      content_json: JSON.stringify(data),
      design_json: "{}",
    });
    await upsertDynamicPage(env.DB, { qr_id: qr.id, kind: "menu", data_json: JSON.stringify(data) });

    const res = await pages.fetch(new Request(`https://q.test/p/${slug}`), env, ctx);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Sunrise Cafe");
    expect(html).toContain("Flat White");
    expect(html).toContain("$4.50");
  });

  it("returns 404 for an unknown slug", async () => {
    const res = await pages.fetch(
      new Request("https://q.test/p/does-not-exist"),
      env,
      ctx,
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /onboarding (guarded first-run flow)", () => {
  it("redirects to /login without a session", async () => {
    const res = await onboarding.fetch(
      new Request("https://q.test/onboarding"),
      env,
      ctx,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("returns 200 for a seeded, un-onboarded session", async () => {
    const user = await createUser(env.DB, `ob-${crypto.randomUUID()}@example.com`);
    expect(user.onboarded_at).toBeNull();
    const setCookie = await startSession(env, user.id);
    const cookie = setCookie.split(";")[0];

    const res = await onboarding.fetch(
      new Request("https://q.test/onboarding", { headers: { Cookie: cookie } }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    // The 3-step flow + the locked CTA copy are present.
    expect(html).toContain("Make it permanent");
    expect(html).toContain("Pick a type");
    expect(html).toContain(SESSION_COOKIE.length > 0 ? "Skip for now" : "");
  });

  it("completes onboarding: creates a dynamic QR, marks onboarded, redirects to /app/:id", async () => {
    const user = await createUser(env.DB, `obc-${crypto.randomUUID()}@example.com`);
    const setCookie = await startSession(env, user.id);
    const cookie = setCookie.split(";")[0];

    const body = new URLSearchParams();
    body.set("type", "url");
    body.set("title", "My launch link");
    body.set("fields_json", JSON.stringify({ url: "acme.example.com" }));

    const res = await onboarding.fetch(
      new Request("https://q.test/onboarding/complete", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toMatch(/^\/app\/[0-9a-f-]+$/);

    // The user is now marked onboarded.
    const updated = await env.DB.prepare(
      "SELECT onboarded_at FROM users WHERE id = ?",
    )
      .bind(user.id)
      .first<{ onboarded_at: number | null }>();
    expect(updated?.onboarded_at).toBeTypeOf("number");

    // A dynamic URL QR was created with a short_code + normalized destination.
    const qrId = loc.split("/").pop()!;
    const qrRow = await env.DB.prepare("SELECT * FROM qr_codes WHERE id = ?")
      .bind(qrId)
      .first<{ is_dynamic: number; short_code: string | null; destination: string | null }>();
    expect(qrRow?.is_dynamic).toBe(1);
    expect(qrRow?.short_code).toBeTruthy();
    expect(qrRow?.destination).toBe("https://acme.example.com");
  });

  it("skips onboarding: marks onboarded and redirects to /app", async () => {
    const user = await createUser(env.DB, `obs-${crypto.randomUUID()}@example.com`);
    const setCookie = await startSession(env, user.id);
    const cookie = setCookie.split(";")[0];

    const res = await onboarding.fetch(
      new Request("https://q.test/onboarding/skip", { headers: { Cookie: cookie } }),
      env,
      ctx,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/app");

    const updated = await env.DB.prepare(
      "SELECT onboarded_at FROM users WHERE id = ?",
    )
      .bind(user.id)
      .first<{ onboarded_at: number | null }>();
    expect(updated?.onboarded_at).toBeTypeOf("number");
  });
});
