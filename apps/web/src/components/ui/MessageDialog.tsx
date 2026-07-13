"use client";

import {
  useEffect
} from "react";

interface MessageDialogProps {
  open: boolean;
  title: string;
  message: string;
  buttonLabel?: string;

  onClose: () => void;
}

export function MessageDialog({
  open,
  title,
  message,
  buttonLabel = "Done",
  onClose
}: MessageDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.key === "Escape" ||
        event.key === "Enter"
      ) {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    open,
    onClose
  ]);

  if (!open) {
    return null;
  }

  return (
    <div className="action-dialog-backdrop">
      <div
        className="action-dialog"
        role="dialog"
        aria-modal="true"
      >
        <div className="action-dialog-content">
          <h2 className="action-dialog-title">
            {title}
          </h2>

          <p className="action-dialog-description">
            {message}
          </p>
        </div>

        <div className="action-dialog-actions">
          <button
            type="button"
            className="action-dialog-submit"
            autoFocus
            onClick={
              onClose
            }
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}