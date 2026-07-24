"use client";

import { type ReactNode, useEffect, useState } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  confirmLabel?: ReactNode;
  submittingLabel?: ReactNode;
  danger?: boolean;
  className?: string;
  backdropClassName?: string;

  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  submittingLabel = "Working...",
  danger = false,
  className,
  backdropClassName,
  onClose,
  onConfirm
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setSubmitting(false);
    setError("");

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  async function handleConfirm() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onConfirm();
      onClose();
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "Unable to complete the operation."
      );

      setSubmitting(false);
    }
  }

  return (
    <div
      className={
        backdropClassName
          ? `action-dialog-backdrop app-blur-backdrop ${backdropClassName}`
          : "action-dialog-backdrop app-blur-backdrop"
      }
    >
      <div
        className={className ? `action-dialog ${className}` : "action-dialog"}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="action-dialog-content">
          <h2
            id="confirm-dialog-title"
            className="action-dialog-title"
          >
            {title}
          </h2>

          <div className="action-dialog-description">
            {children}
          </div>

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
            type="button"
            className={danger ? "action-dialog-submit danger" : "action-dialog-submit"}
            disabled={submitting}
            onClick={handleConfirm}
          >
            {submitting ? submittingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}