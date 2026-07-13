"use client";

import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";

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

  const [position, setPosition] = useState({ x, y });
  const [positioned, setPositioned] = useState(false);

  useEffect(() => {
    setPosition({ x, y });
  }, [x, y]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const menu = menuRef.current;

    if (!menu) {
      return;
    }

    const bounds = menu.getBoundingClientRect();

    const padding = 8;

    const maximumX = Math.max(padding, window.innerWidth - bounds.width - padding);
    const maximumY = Math.max(padding, window.innerHeight - bounds.height - padding);

    setPosition({
      x: Math.max(padding, Math.min(x, maximumX)),
      y: Math.max(padding, Math.min(y, maximumY))
    });

    setPositioned(true);
  }, [open, x, y, items.length]);

  useEffect(() => {
    if (!open) {
      setPositioned(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const menu = menuRef.current;

      if (menu && !menu.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className={positioned ? "popup-menu is-positioned" : "popup-menu"}
      style={{
        left: position.x,
        top: position.y,
        visibility: positioned ? "visible" : "hidden"
      }}
      role="menu"
    >
      {items.map((item) => (
        <div key={item.id}>
          {item.separatorBefore ? (<div className="popup-menu-separator" />) : null}

          <button
            type="button"
            role="menuitem"
            className={item.danger ? "popup-menu-item danger" : "popup-menu-item"}
            disabled={item.disabled}
            onClick={() => {
              onClose();

              if (!item.disabled) {
                item.onSelect();
              }
            }}
          >
            <span className="popup-menu-icon">
              {item.icon}
            </span>

            <span>
              {item.label}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}