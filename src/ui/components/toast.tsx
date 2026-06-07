import type { FC, PropsWithChildren } from "hono/jsx";
import { Icon } from "../icons";
import type { IconName } from "../icons";

export type ToastTone = "neutral" | "success" | "danger";

export interface ToastProps {
  tone?: ToastTone;
  /** optional title (bold line above the message) */
  title?: string;
  /** dismissible: renders a close button wired with [data-toast-close] */
  dismissible?: boolean;
  class?: string;
}

const TONE_ICON: Record<ToastTone, IconName> = {
  neutral: "qr",
  success: "check",
  danger: "close",
};

/**
 * Toast — a transient status message. Single toast surface; a stack container
 * (`.toast-stack[aria-live]`) is provided in the styleguide / app shell.
 *
 * Per the single-accent rule, success/danger are conveyed through accent
 * lightness shifts + an icon, never a second hue. The toast itself carries
 * `role="status"` so it is announced politely when inserted by the island.
 */
export const Toast: FC<PropsWithChildren<ToastProps>> = ({
  tone = "neutral",
  title,
  dismissible = true,
  class: cls,
  children,
}) => {
  return (
    <div
      class={["toast", `toast-${tone}`, cls].filter(Boolean).join(" ")}
      role="status"
      data-toast
    >
      <span class="toast-icon" aria-hidden="true">
        <Icon name={TONE_ICON[tone]} size={18} />
      </span>
      <div class="toast-content">
        {title ? <p class="toast-title t-ui-label">{title}</p> : null}
        <div class="toast-message t-body-sm">{children}</div>
      </div>
      {dismissible ? (
        <button type="button" class="toast-close" data-toast-close aria-label="Dismiss">
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
};
