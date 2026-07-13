"use client";

import {
  Check,
  ChevronDown,
  ChevronUp
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState
} from "react";

import type { ThemePreference } from "@/lib/theme";

interface ThemeSelectProps {
  value: ThemePreference;

  onChange: (value: ThemePreference) => void;
}

const themeOptions: Array<{value: ThemePreference; label: string;}> = [
  {value: "system", label: "System preference"},
  {value: "dark", label: "Dark"},
  {value: "light", label: "Light"}
];

export function ThemeSelect({value, onChange}: ThemeSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = themeOptions.find((option) => option.value === value) ?? themeOptions[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const container = containerRef.current;

      if (container && !container.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="theme-select"
    >
      <button
        type="button"
        className={open ? "theme-select-trigger open" : "theme-select-trigger"}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedOption.label}</span>

        {open ? (<ChevronUp size={17} />) : (<ChevronDown size={17} />)}
      </button>

      {open ? (
        <div
          className="theme-select-menu"
          role="listbox"
          aria-label="Interface theme"
        >
          {themeOptions.map(
            (option) => {
              const selected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? "theme-select-option selected" : "theme-select-option"}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span>{option.label}</span>

                  {selected ? (
                    <Check size={16} />
                  ) : (
                    <span className="theme-select-check-placeholder" />
                  )}
                </button>
              );
            }
          )}
        </div>
      ) : null}
    </div>
  );
}