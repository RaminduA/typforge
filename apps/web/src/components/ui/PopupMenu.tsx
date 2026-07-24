"use client";

import {
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState
} from "react";
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
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      const menu = menuRef.current;

      if (!menu) {
        return;
      }

      const viewportGap = 12;
      const anchorGap = 8;
      const bounds = menu.getBoundingClientRect();
      const maxLeft = Math.max(viewportGap, window.innerWidth - bounds.width - viewportGap);
      const maxTop = Math.max(viewportGap, window.innerHeight - bounds.height - viewportGap);
      const left = Math.min(Math.max(viewportGap, x), maxLeft);
      const preferredTop = y;
      const top = preferredTop + bounds.height <= window.innerHeight - viewportGap
        ? preferredTop
        : Math.max(viewportGap, y - bounds.height - anchorGap);

      setPosition({
        left,
        top: Math.min(Math.max(viewportGap, top), maxTop)
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
    };
  }, [items.length, open, x, y]);

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
        ref={menuRef}
        className="popup-menu is-positioned"
        role="menu"
        style={{left: position.left, top: position.top}}
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
