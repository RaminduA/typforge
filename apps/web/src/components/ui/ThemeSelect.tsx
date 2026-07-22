"use client";

import {
  Check,
  ChevronDown
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState
} from "react";

import { createPortal } from "react-dom";

import type { ThemePreference } from "@/lib/theme";

interface ThemeSelectProps {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}

interface MenuPosition {
  top: number;
  left: number;
}

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
}> = [
  {value: "system", label: "System preference"},
  {value: "dark", label: "Dark"},
  {value: "light", label: "Light"}
];

export function ThemeSelect({value, onChange}: ThemeSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);

  const [menuPosition, setMenuPosition] = useState<MenuPosition>({top: 0, left: 0});

  const selectedOption = themeOptions.find((option) => option.value === value) ?? themeOptions[0];

  function updateMenuPosition() {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const bounds = trigger.getBoundingClientRect();

    setMenuPosition({top: bounds.bottom + 7, left: bounds.right - 216});
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    updateMenuPosition();

    function handleResizeOrScroll() {
      updateMenuPosition();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("resize", handleResizeOrScroll);
    window.addEventListener("scroll", handleResizeOrScroll, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={open ? "theme-select open" : "theme-select"}>
      <button
        ref={triggerRef}
        type="button"
        className={open ? "theme-select-trigger open" : "theme-select-trigger"}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          updateMenuPosition();
          setOpen((current) => !current);
        }}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown size={17} />
      </button>

      {open && typeof document !== "undefined" ? createPortal(
            <>
              <div
                className="theme-select-interaction-shield"
                aria-hidden="true"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpen(false);
                }}
              />

              <div
                className="theme-select-menu-portal"
                style={{top: menuPosition.top, left: menuPosition.left}}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
              >
                <div
                  className="theme-select-menu"
                  role="listbox"
                  aria-label="Interface theme"
                >
                  {themeOptions.map((option) => {
                    const selected =
                      option.value === value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={
                          selected
                            ? "theme-select-option selected"
                            : "theme-select-option"
                        }
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
                  })}
                </div>
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
}