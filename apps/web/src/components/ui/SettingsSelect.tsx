"use client";

import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { useEffect, useRef, useState } from "react";

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

const MENU_WIDTH = 220;

const VIEWPORT_PADDING = 8;

export function SettingsSelect<T extends string>({ value, options, ariaLabel, onChange }: SettingsSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  function calculateMenuPosition() {
    const trigger = containerRef.current;

    if (!trigger) {
      return;
    }

    const bounds = trigger.getBoundingClientRect();

    const preferredLeft = bounds.right - MENU_WIDTH;

    setMenuPosition({
      top: bounds.bottom + 7,

      left: Math.max(
        VIEWPORT_PADDING,
        Math.min(preferredLeft, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING)
      )
    });
  }

  function handleTriggerClick() {
    if (open) {
      setOpen(false);

      return;
    }

    /*
     * Calculate the final position
     * before rendering the menu.
     * This avoids visible jumping.
     */
    calculateMenuPosition();

    setOpen(true);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      const clickedTrigger = containerRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);

      if (!clickedTrigger && !clickedMenu) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function handleViewportChange() {
      calculateMenuPosition();
    }

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);

    /*
     * Capture scroll events from
     * the Settings content container.
     */
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  const menu = open && typeof document !== "undefined" ? createPortal(
          <div
            ref={menuRef}
            className="settings-select-menu settings-select-menu-portal"
            role="listbox"
            aria-label={ariaLabel}
            style={{
              top: menuPosition.top,
              left: menuPosition.left
            }}
          >
            {options.map(
              (option) => {
                const selected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={selected ? "settings-select-option selected" : "settings-select-option"}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <span>{option.label}</span>

                    {selected ? <Check size={16} /> : <span className="settings-select-check-placeholder" />}
                  </button>
                );
              }
            )}
          </div>, document.body) : null;

  return (
    <>
      <div
        ref={containerRef}
        className={open ? "settings-select-control open" : "settings-select-control"}
      >
        <button
          type="button"
          className={open ? "settings-select-trigger open" : "settings-select-trigger"}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={handleTriggerClick}
        >
          <span>
            {selectedOption.label}
          </span>

          {open ? (<ChevronUp size={17} />) : (<ChevronDown size={17} />)}
        </button>
      </div>

      {menu}
    </>
  );
}