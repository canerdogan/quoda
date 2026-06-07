import type { FC, Child } from "hono/jsx";

export type StatTrend = "up" | "down" | "flat";

export interface StatProps {
  /** the metric name (e.g. "Total scans") */
  label: string;
  /** the figure — rendered with tabular-nums (tnum) for aligned digits */
  value: string;
  /** optional unit/suffix shown after the value (e.g. "scans", "%") */
  unit?: string;
  /** optional delta string (e.g. "+12%") with a trend direction */
  delta?: string;
  trend?: StatTrend;
  /** optional leading icon */
  icon?: Child;
  class?: string;
}

/**
 * Stat — a single analytics figure. All numerics use tabular-nums (`tnum`) so
 * columns of figures align, per the typography spec. Trend is communicated via
 * accent-derived tone + a glyph, never a second hue.
 */
export const Stat: FC<StatProps> = ({
  label,
  value,
  unit,
  delta,
  trend = "flat",
  icon,
  class: cls,
}) => (
  <div class={["stat", cls].filter(Boolean).join(" ")}>
    <div class="stat-head">
      {icon ? <span class="stat-icon">{icon}</span> : null}
      <span class="stat-label t-body-sm text-secondary">{label}</span>
    </div>
    <div class="stat-value-row">
      <span class="stat-value tnum">{value}</span>
      {unit ? <span class="stat-unit t-body-sm text-secondary">{unit}</span> : null}
    </div>
    {delta ? (
      <span class={`stat-delta stat-delta-${trend} tnum`}>
        <span class="stat-delta-arrow" aria-hidden="true">
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
        </span>
        {delta}
      </span>
    ) : null}
  </div>
);
