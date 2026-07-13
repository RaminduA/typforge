"use client";

import { Code2, FileText, FolderTree, X } from "lucide-react";
import { useEffect } from "react";
import type { ThemePreference } from "@/lib/theme";
import { ThemeSelect } from "@/components/ui/ThemeSelect";

interface SettingsModalProps {
  theme: ThemePreference;

  onChangeTheme: (theme: ThemePreference) => void;

  onClose: () => void;
}

export function SettingsModal({theme, onChangeTheme, onClose}: SettingsModalProps) {
  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="settings-backdrop app-blur-backdrop"
      onPointerDown={
        (event) => {
          /*
           * Close only when the actual
           * blurred background is clicked.
           *
           * Clicking inside the settings
           * window does not close it.
           */
          if (event.target === event.currentTarget) {
            onClose();
          }
        }
      }
    >
      <section
        className="settings-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onPointerDown={
          (event) =>
            event.stopPropagation()
        }
      >
        <aside className="settings-navigation">
          <button
            type="button"
            className="settings-navigation-item active"
          >
            <Code2 size={17} />

            <span>
              Editor
            </span>
          </button>

          <button
            type="button"
            className="settings-navigation-item"
            disabled
            title="PDF viewer settings will be added later"
          >
            <FileText size={17} />

            <span>
              PDF Viewer
            </span>
          </button>

          <button
            type="button"
            className="settings-navigation-item"
            disabled
            title="File management settings will be added later"
          >
            <FolderTree size={17} />

            <span>
              File Management
            </span>
          </button>
        </aside>

        <main className="settings-content">
          <header className="settings-content-header">
            <h2 id="settings-title">
              Editor
            </h2>

            <button
              type="button"
              className="settings-close-button"
              aria-label="Close settings"
              title="Close"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </header>

          <div className="settings-options">
            <div className="settings-option-row">
              <div>
                <h3>
                  Interface Theme
                </h3>

                <p>
                  Select your interface color scheme.
                </p>
              </div>

              <ThemeSelect value={theme} onChange={onChangeTheme} />
            </div>
          </div>
        </main>
      </section>
    </div>
  );
}