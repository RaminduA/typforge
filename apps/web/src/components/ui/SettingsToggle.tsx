"use client";

interface SettingsToggleProps {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

export function SettingsToggle({ checked, label, onChange }: SettingsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      className={checked ? "settings-toggle is-on" : "settings-toggle"}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-toggle-thumb" />
    </button>
  );
}