import { Hono } from "hono";
import { raw } from "hono/html";
import type { Bindings } from "./types";
import { Layout } from "./ui/layout";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/healthz", (c) => c.json({ ok: true, service: "quoda" }));

// Temporary Phase-1 home — replaced by the marketing page in Phase 4.
// Demonstrates the token system is wired (accent, type scale, surfaces).
app.get("/", (c) =>
  c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <Layout>
        <main
          style="min-height:100dvh;display:grid;place-items:center;padding:var(--space-24);"
        >
          <div style="max-width:560px;text-align:center;">
            <h1
              style="font-size:var(--fs-display-hero);font-weight:var(--fw-display-hero);line-height:var(--lh-display-hero);letter-spacing:var(--ls-display-hero);color:var(--color-text-primary);margin:0 0 var(--space-16);"
            >
              The QR code that never breaks.
            </h1>
            <p
              style="font-size:var(--fs-body-lg);line-height:var(--lh-body-lg);color:var(--color-text-secondary);margin:0 0 var(--space-32);"
            >
              Quoda is booting. Tokens are wired and the engine is on its way.
            </p>
            <button
              type="button"
              data-theme-toggle
              style="appearance:none;border:none;cursor:pointer;border-radius:var(--radius-md);background:var(--color-accent);color:var(--color-accent-text);font-size:var(--fs-ui-label);font-weight:var(--fw-ui-label);letter-spacing:var(--ls-ui-label);padding:var(--space-12) var(--space-24);min-height:44px;"
            >
              Toggle theme
            </button>
          </div>
        </main>
      </Layout>
    </>,
  ),
);

export default app;
