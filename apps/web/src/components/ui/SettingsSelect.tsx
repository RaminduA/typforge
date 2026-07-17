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

export interface SettingsSelectOption<T extends string> {
  value: T;
  label: string;
}

interface SettingsSelectProps<T extends string> {
  value: T;
  options: ReadonlyArray<SettingsSelectOption<T>>;
  ariaLabel: string;
  onChange: (value: T) => void;
}

interface MenuPosition {
  top: number;
  left: number;
}

export function SettingsSelect<T extends string>({value, options, ariaLabel, onChange}: SettingsSelectProps<T>) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);

  const [menuPosition, setMenuPosition] = useState<MenuPosition>({top: 0, left: 0});

  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  function updateMenuPosition() {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const bounds = trigger.getBoundingClientRect();

    setMenuPosition({top: bounds.bottom + 7, left: bounds.right - 220});
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
    <div
      className={open ? "settings-select-control open" : "settings-select-control"}
    >
      <button
        ref={triggerRef}
        type="button"
        className={open ? "settings-select-trigger open" : "settings-select-trigger"}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
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
                className="settings-select-interaction-shield"
                aria-hidden="true"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpen(false);
                }}
              />

              <div
                className="settings-select-menu-portal"
                style={{top: menuPosition.top,left: menuPosition.left}}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
              >
                <div
                  className="settings-select-menu"
                  role="listbox"
                  aria-label={ariaLabel}
                >
                  {options.map((option) => {
                    const selected = option.value === value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={selected ? "settings-select-option selected" : "settings-select-option" }
                        onClick={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                      >
                        <span>{option.label}</span>

                        {selected ? (
                          <Check size={16} />
                        ) : (
                          <span className="settings-select-check-placeholder" />
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