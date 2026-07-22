"use client";

import {
  type FormEvent,
  useEffect,
  useRef,
  useState
} from "react";

export type InputSelectionMode =
  | "select-all"
  | "before-extension"
  | "end";

interface TextInputDialogProps {
  open: boolean;
  title: string;
  placeholder: string;
  initialValue: string;
  selectionMode?: InputSelectionMode;

  validateValue?: (
    value: string
  ) => boolean;

  submitLabel?: string;

  onClose: () => void;

  onSubmit: (
    value: string
  ) => Promise<void>;
}

export function TextInputDialog({
  open,
  title,
  placeholder,
  initialValue,
  selectionMode = "end",
  validateValue,
  submitLabel = "Save",
  onClose,
  onSubmit
}: TextInputDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    let secondFrame = 0;

    const firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
            const input = inputRef.current;

            if (!input) {
                return;
            }

            input.focus({ preventScroll: true });

            if (selectionMode === "select-all") {
                input.setSelectionRange(0, input.value.length);
                return;
            }

            if (selectionMode === "before-extension") {
                const lowerValue = input.value.toLowerCase();
                const caretPosition = lowerValue.endsWith(".typ") ? input.value.length - 4 : input.value.length;
                input.setSelectionRange(caretPosition, caretPosition);
                return;
            }

            const end = input.value.length;
            input.setSelectionRange(end, end);
        });
    });

    return () => {
        window.cancelAnimationFrame(firstFrame);
        window.cancelAnimationFrame(secondFrame);
    };
  }, [open, selectionMode]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, submitting, onClose]);

  if (!open) {
    return null;
  }

  const normalizedValue = value.trim();

  const valid = normalizedValue.length > 0 && (validateValue ? validateValue(normalizedValue) : true);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!valid || submitting) {
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await onSubmit(normalizedValue);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to complete the operation.");

      setSubmitting(false);
    }
  }

  return (
    <div
      className="action-dialog-backdrop app-blur-backdrop"
      role="presentation"
    >
      <form
        className="action-dialog"
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="text-dialog-title"
      >
        <div className="action-dialog-content">
          <h2
            id="text-dialog-title"
            className="action-dialog-title"
          >
            {title}
          </h2>

          <input
            ref={inputRef}
            className="action-dialog-input"
            value={value}
            placeholder={placeholder}
            disabled={submitting}
            onChange={(event) => {
                setValue(event.target.value);
                setError("");
              }}
          />

          {error ? (
            <p className="action-dialog-error">
              {error}
            </p>
          ) : null}
        </div>

        <div className="action-dialog-actions">
          <button
            type="button"
            className="action-dialog-cancel"
            disabled={submitting}
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="action-dialog-submit"
            disabled={!valid || submitting}
          >
            {submitting ? "Saving..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}