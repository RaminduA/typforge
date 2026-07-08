"use client";

import type { ThemePreference } from "@/lib/theme";

interface SettingsModalProps {
  theme: ThemePreference;
  onChangeTheme: (theme: ThemePreference) => void;
  onClose: () => void;
}

export function SettingsModal({ theme, onChangeTheme, onClose }: SettingsModalProps) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <strong>Settings</strong>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="theme">Appearance</label>
            <select
              id="theme"
              value={theme}
              onChange={(event) => onChangeTheme(event.target.value as ThemePreference)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <button className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}