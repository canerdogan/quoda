import type { FC } from "hono/jsx";
import { raw } from "hono/html";

export interface QrPreviewProps {
  /** pre-rendered QR SVG markup (from the QR engine) injected verbatim */
  svg: string;
  /** accessible label describing what the QR encodes */
  label?: string;
  /** caption shown under the preview (e.g. the destination) */
  caption?: string;
  /** elevate to the hover-able hero treatment */
  hero?: boolean;
  class?: string;
}

/**
 * QrPreview — renders an injected QR SVG inside a forced-light, white surface.
 *
 * The preview region is `aria-live="polite"` so live regeneration (typing in
 * the generator) is announced. The SVG string is trusted markup produced by
 * the QR engine and injected via `raw`.
 *
 * Scannability is non-negotiable: the surface forces light color-scheme + a
 * white background + dark modules regardless of the app theme. The mandatory
 * comment and the forced styles live below — do not remove them.
 */
export const QrPreview: FC<QrPreviewProps> = ({
  svg,
  label = "QR code preview",
  caption,
  hero,
  class: cls,
}) => (
  <figure class={["qr-preview", hero ? "qr-preview-hero" : null, cls].filter(Boolean).join(" ")}>
    {/* QR scannability absolute: dark modules on white always — do not remove for theme consistency. See design-system docs. */}
    <div
      class="qr-preview-surface"
      style="color-scheme: light;"
      role="img"
      aria-label={label}
      aria-live="polite"
    >
      {raw(svg)}
    </div>
    {caption ? <figcaption class="qr-preview-caption t-body-sm text-secondary">{caption}</figcaption> : null}
  </figure>
);
