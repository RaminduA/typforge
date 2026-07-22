"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export interface PopupMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

interface PopupMenuProps {
  open: boolean;
  x: number;
  y: number;
  items: PopupMenuItem[];
  onClose: () => void;
}

export function PopupMenu({ open, x, y, items, onClose }: PopupMenuProps) {
  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      <div
        className="small-popup-interaction-shield"
        aria-hidden="true"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      />

      <div
        className="popup-menu is-positioned"
        role="menu"
        style={{left: x, top: y}}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >
        {items.map((item) => (
          <div key={item.id}>
            {item.separatorBefore ? (
              <div className="popup-menu-separator" />
            ) : null}

            <button
              type="button"
              role="menuitem"
              className={item.danger ? "popup-menu-item danger" : "popup-menu-item"}
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                onClose();
              }}
            >
              {item.icon ? (
                <span className="popup-menu-icon">
                  {item.icon}
                </span>
              ) : null}

              <span>{item.label}</span>
            </button>
          </div>
        ))}
      </div>
    </>,
    document.body
  );
}
