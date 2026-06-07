import { Hono } from "hono";
import type { FC } from "hono/jsx";
import type { AppEnv } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { getQrById, type QrRow } from "../db/queries";
import type { QrDesign, QrFields } from "../lib/qr/types";
import { getTotals, getBreakdown } from "../lib/analytics";
import { encodeMatrix } from "../lib/qr/encoder";
import { renderSvg } from "../lib/qr/render-svg";
import { safePalette } from "../lib/qr/scannability";
import { buildPayload } from "../lib/qr/content";
import { AppShell } from "../ui/app-shell";
import { Button } from "../ui/components/button";
import { Badge } from "../ui/components/badge";
import { Stat } from "../ui/components/stat";
import { QrPreview } from "../ui/components/qr-preview";
import { Icon, type IconName } from "../ui/icons";

export const qrDetail = new Hono<AppEnv>();
qrDetail.use("/app/*", requireAuth);

const DEFAULT_DESIGN: QrDesign = {
  fg: "#0D0D0F",
  bg: "#FFFFFF",
  moduleShape: "square",
  eyeStyle: "square",
  ecc: "M",
};

const TYPE_ICON: Record<QrRow["type"], IconName> = {
  url: "url", text: "text", wifi: "wifi", email: "email", tel: "tel", sms: "sms",
  vcard: "vcard", pdf: "pdf", menu: "menu", business: "business", appstore: "appstore", social: "social",
};

const TYPE_LABEL: Record<QrRow["type"], string> = {
  url: "Website", text: "Text", wifi: "Wi-Fi", email: "Email", tel: "Phone", sms: "SMS",
  vcard: "Contact", pdf: "PDF", menu: "Menu", business: "Business", appstore: "App", social: "Social",
};

function safeJson<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function renderQrImage(qr: QrRow, design: QrDesign, appUrl: string): string {
  try {
    if (qr.is_dynamic === 1 && qr.short_code) {
      const matrix = encodeMatrix(`${appUrl}/r/${qr.short_code}`, design.ecc);
      return renderSvg(matrix, safePalette(design));
    }
    const fields = safeJson<QrFields>(qr.content_json, {});
    const matrix = encodeMatrix(buildPayload(qr.type, fields), design.ecc);
    return renderSvg(matrix, safePalette(design));
  } catch {
    return "";
  }
}

interface DetailViewProps {
  qr: QrRow;
  total: number;
  topCountry: { name: string; count: number } | null;
  topDevice: { name: string; count: number } | null;
  qrSvg: string;
  printedUrl: string | null;
}

const DetailView: FC<DetailViewProps> = ({ qr, total, topCountry, topDevice, qrSvg, printedUrl }) => {
  const dynamic = qr.is_dynamic === 1;
  return (
    <div class="qr-detail" data-qr-id={qr.id} data-dynamic={dynamic ? "true" : "false"}>
      <nav class="qr-detail-breadcrumb">
        <a href="/app" class="qr-detail-back">
          <Icon name="chevron" size={16} class="qr-detail-back-icon" /> Dashboard
        </a>
      </nav>

      <header class="qr-detail-head">
        <div class="qr-detail-title-wrap">
          <span class="qr-detail-type-icon" aria-hidden="true"><Icon name={TYPE_ICON[qr.type]} size={22} /></span>
          <div>
            <h1 class="t-display-md">{qr.title}</h1>
            <div class="qr-detail-meta">
              <span class="t-body-sm text-secondary">{TYPE_LABEL[qr.type]}</span>
              {dynamic
                ? <Badge tone="accent" dot>Dynamic</Badge>
                : <Badge tone="neutral">Static</Badge>}
            </div>
          </div>
        </div>
        <div class="qr-detail-actions">
          <Button href={`/app/${qr.id}/edit`} variant="secondary" iconLeft={<Icon name="settings" size={16} />}>Edit</Button>
          <Button variant="ghost" iconLeft={<Icon name="close" size={16} />} class="qr-detail-delete" data-delete aria-label="Delete this QR code">Delete</Button>
        </div>
      </header>

      <div class="qr-detail-grid">
        {/* Left: the code + destination */}
        <aside class="qr-detail-aside stack">
          <div class="card qr-detail-code-card">
            <QrPreview svg={qrSvg} label={`QR code for ${qr.title}`} />
            <div class="qr-detail-downloads">
              <Button href={`/api/qr/${qr.id}.svg`} variant="secondary" iconLeft={<Icon name="download" size={16} />}>Download SVG</Button>
            </div>
          </div>

          <div class="card qr-detail-dest">
            <h2 class="t-heading-sm">{dynamic ? "Destination" : "Encoded content"}</h2>
            {dynamic ? (
              <>
                {printedUrl ? (
                  <p class="qr-detail-printed t-body-sm text-secondary">
                    Printed code points to <span class="qr-detail-mono">{printedUrl}</span> — editing the destination never reprints it.
                  </p>
                ) : null}
                {qr.type === "pdf" || ["menu", "business", "appstore", "social"].includes(qr.type) ? (
                  <p class="t-body text-secondary">
                    This is a hosted page. <a href={`/app/${qr.id}/edit`}>Edit its content</a> — the destination is managed for you.
                  </p>
                ) : (
                  <form class="qr-detail-dest-form" data-dest-form>
                    <label class="field-label" for="dest-input">Current target</label>
                    <div class="qr-detail-dest-row">
                      <input class="input" id="dest-input" type="url" data-dest-input value={qr.destination ?? ""} />
                      <Button variant="primary" class="qr-detail-dest-save" data-dest-save>Update</Button>
                    </div>
                    <p class="field-hint" data-dest-status hidden role="status"></p>
                  </form>
                )}
              </>
            ) : (
              <p class="t-body text-secondary">Static codes embed their data directly and can't be re-targeted. Create a new code to change the content.</p>
            )}
          </div>
        </aside>

        {/* Right: analytics */}
        <section class="qr-detail-analytics stack" aria-labelledby="qd-analytics">
          <h2 class="t-heading-sm visually-hidden" id="qd-analytics">Analytics</h2>

          <div class="qr-detail-stats">
            <Stat label="Total scans" value={String(total)} icon={<Icon name="chart" size={18} />} />
            <Stat label="Top country" value={topCountry ? topCountry.name : "—"} unit={topCountry ? `${topCountry.count}` : undefined} />
            <Stat label="Top device" value={topDevice ? capitalize(topDevice.name) : "—"} unit={topDevice ? `${topDevice.count}` : undefined} />
          </div>

          <div class="card qr-detail-chart-card">
            <div class="qr-detail-chart-head">
              <h3 class="t-heading-sm">Scans over time</h3>
              <span class="t-body-sm text-secondary">Last 30 days</span>
            </div>
            <div class="qr-chart" data-chart="daily" aria-label="Daily scans chart">
              <p class="qr-chart-empty t-body-sm text-secondary" data-chart-empty>Loading…</p>
            </div>
          </div>

          <div class="qr-detail-breakdowns">
            <div class="card">
              <h3 class="t-heading-sm">By country</h3>
              <div class="qr-bars" data-chart="country">
                <p class="qr-chart-empty t-body-sm text-secondary" data-chart-empty>No scans yet.</p>
              </div>
            </div>
            <div class="card">
              <h3 class="t-heading-sm">By device</h3>
              <div class="qr-bars" data-chart="device">
                <p class="qr-chart-empty t-body-sm text-secondary" data-chart-empty>No scans yet.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="toast-stack" data-toast-stack aria-live="polite" aria-atomic="false"></div>
    </div>
  );
};

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function topEntry(map: Record<string, number>): { name: string; count: number } | null {
  let best: { name: string; count: number } | null = null;
  for (const [name, count] of Object.entries(map)) {
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

qrDetail.get("/app/:id", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const qr = await getQrById(c.env.DB, id);
  if (!qr || qr.user_id !== user.id) {
    return c.html(
      <AppShell user={user} title="Not found">
        <div class="empty-state">
          <h1 class="t-display-md">QR code not found</h1>
          <p class="t-body text-secondary">It may have been deleted, or it isn't yours.</p>
          <Button href="/app" variant="primary">Back to dashboard</Button>
        </div>
      </AppShell>,
      404,
    );
  }

  const design = { ...DEFAULT_DESIGN, ...safeJson<Partial<QrDesign>>(qr.design_json, {}) } as QrDesign;
  const [total, breakdown] = await Promise.all([
    getTotals(c.env, id),
    getBreakdown(c.env, id),
  ]);

  const topCountry = topEntry(breakdown.country);
  const topDevice = topEntry(breakdown.device);
  const qrSvg = renderQrImage(qr, design, c.env.APP_URL);
  const printedUrl = qr.is_dynamic === 1 && qr.short_code ? `${c.env.APP_URL}/r/${qr.short_code}` : null;

  return c.html(
    <AppShell user={user} title={qr.title}>
      <DetailView
        qr={qr}
        total={total}
        topCountry={topCountry && topCountry.name !== "unknown" ? topCountry : topCountry}
        topDevice={topDevice}
        qrSvg={qrSvg}
        printedUrl={printedUrl}
      />
      <script src="/js/charts.js" defer></script>
    </AppShell>,
  );
});
