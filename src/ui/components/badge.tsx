import type { FC, PropsWithChildren, Child } from "hono/jsx";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export interface BadgeProps {
  tone?: BadgeTone;
  /** small dot before the label (status indicator) */
  dot?: boolean;
  /** optional leading icon */
  icon?: Child;
  class?: string;
}

/**
 * Badge — compact status/label pill.
 * Per the single-accent rule, success/warning/danger are expressed as
 * lightness/opacity shifts of the accent (no second hue) via tokens, never
 * raw color. `accent` is the full-strength accent fill.
 */
export const Badge: FC<PropsWithChildren<BadgeProps>> = ({
  tone = "neutral",
  dot,
  icon,
  class: cls,
  children,
}) => {
  const classes = ["badge", `badge-${tone}`, cls].filter(Boolean).join(" ");
  return (
    <span class={classes}>
      {dot ? <span class="badge-dot" aria-hidden="true" /> : null}
      {icon ? <span class="badge-icon">{icon}</span> : null}
      {children}
    </span>
  );
};
