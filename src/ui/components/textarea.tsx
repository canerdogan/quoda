import type { FC } from "hono/jsx";

export interface TextareaProps {
  id: string;
  name?: string;
  label: string;
  value?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  maxlength?: number;
  hideLabel?: boolean;
  class?: string;
}

/**
 * Textarea — a labeled multi-line field sharing the input visual language.
 * Min-height meets the 44px touch target; resizes vertically only.
 */
export const Textarea: FC<TextareaProps> = ({
  id,
  name,
  label,
  value,
  placeholder,
  hint,
  error,
  rows = 4,
  required,
  disabled,
  maxlength,
  hideLabel,
  class: cls,
}) => {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div class={cls ? `field ${cls}` : "field"}>
      <label class={hideLabel ? "field-label visually-hidden" : "field-label"} for={id}>
        {label}
        {required ? (
          <span class="field-required" aria-hidden="true">
            {" *"}
          </span>
        ) : null}
      </label>
      <textarea
        class={error ? "textarea textarea-error" : "textarea"}
        id={id}
        name={name ?? id}
        rows={rows}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        maxlength={maxlength}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
      >
        {value}
      </textarea>
      {hint && !error ? (
        <p class="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p class="field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};
