import type { FC, PropsWithChildren, Child } from "hono/jsx";
import { Icon } from "../icons";

export interface ModalProps {
  /** unique id; used to wire aria-labelledby/-describedby and the dialog root */
  id: string;
  title: string;
  /** optional descriptive line under the title (wired to aria-describedby) */
  description?: string;
  /** footer actions (buttons), rendered right-aligned */
  footer?: Child;
  /** render visible by default (SSR-open); islands toggle [hidden] otherwise */
  open?: boolean;
  /** size variant */
  size?: "sm" | "md" | "lg";
  class?: string;
}

/**
 * Modal — a token-only dialog with backdrop + accessible scaffolding.
 *
 * Markup contract for the focus-trap island (client JS, not this component):
 *  - root `[data-modal]` is the controller hook
 *  - `[data-modal-backdrop]` closes on click
 *  - `[data-modal-close]` closes on click (the X and any cancel button)
 *  - first/last `[data-focus-sentinel]` elements bound the focus trap so Tab
 *    from the last control cycles to the first and vice-versa
 *  - `role="dialog" aria-modal="true"` + labelled/described by title/description
 * SSR renders `[hidden]` unless `open`; no behavior is hardcoded here.
 */
export const Modal: FC<PropsWithChildren<ModalProps>> = ({
  id,
  title,
  description,
  footer,
  open,
  size = "md",
  class: cls,
  children,
}) => {
  const titleId = `${id}-title`;
  const descId = description ? `${id}-desc` : undefined;
  return (
    <div
      class="modal-root"
      data-modal
      id={id}
      hidden={!open}
    >
      <div class="modal-backdrop" data-modal-backdrop aria-hidden="true" />
      <div
        class={["modal", `modal-${size}`, cls].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        {/* focus trap entry sentinel */}
        <span tabindex={0} data-focus-sentinel="start" class="visually-hidden" />
        <div class="modal-header">
          <div class="modal-heading">
            <h2 class="modal-title t-display-md" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p class="modal-desc t-body text-secondary" id={descId}>
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            class="modal-close"
            data-modal-close
            aria-label="Close dialog"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div class="modal-body">{children}</div>
        {footer ? <div class="modal-footer">{footer}</div> : null}
        {/* focus trap exit sentinel */}
        <span tabindex={0} data-focus-sentinel="end" class="visually-hidden" />
      </div>
    </div>
  );
};
