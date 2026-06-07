import type { FC, PropsWithChildren, Child } from "hono/jsx";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "lg";

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: "button" | "submit" | "reset";
  href?: string;
  /** full-width block button */
  block?: boolean;
  disabled?: boolean;
  /** rendered before the label, inherits currentColor */
  iconLeft?: Child;
  /** rendered after the label, inherits currentColor */
  iconRight?: Child;
  class?: string;
  id?: string;
  name?: string;
  value?: string;
  "aria-label"?: string;
  "data-theme-toggle"?: boolean | "";
}

/**
 * Button — the single accent-carrying control of a viewport (primary variant).
 * Variants: primary (accent), secondary (surface-2 + border), ghost (text-only).
 * All sizes meet the ≥44px touch target. Renders as <a> when `href` is given so
 * navigation links share the exact same affordance.
 */
export const Button: FC<PropsWithChildren<ButtonProps>> = ({
  variant = "primary",
  size = "md",
  type = "button",
  href,
  block,
  disabled,
  iconLeft,
  iconRight,
  class: cls,
  id,
  name,
  value,
  children,
  "aria-label": ariaLabel,
  "data-theme-toggle": themeToggle,
}) => {
  const classes = [
    "btn",
    `btn-${variant}`,
    size === "lg" ? "btn-lg" : null,
    block ? "btn-block" : null,
    cls,
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      {iconLeft ? <span class="btn-icon">{iconLeft}</span> : null}
      {children != null ? <span class="btn-label">{children}</span> : null}
      {iconRight ? <span class="btn-icon">{iconRight}</span> : null}
    </>
  );

  if (href) {
    return (
      <a
        class={classes}
        href={href}
        id={id}
        role="button"
        aria-label={ariaLabel}
        aria-disabled={disabled ? "true" : undefined}
        data-theme-toggle={themeToggle === true ? "" : themeToggle === "" ? "" : undefined}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      class={classes}
      type={type}
      id={id}
      name={name}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      data-theme-toggle={themeToggle === true ? "" : themeToggle === "" ? "" : undefined}
    >
      {inner}
    </button>
  );
};
