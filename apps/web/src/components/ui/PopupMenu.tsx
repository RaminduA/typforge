"use client";

import {
  type ReactNode,
  useEffect,
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

export function PopupMenu({
  open,
  x,
  y,
  items,
  onClose
}: PopupMenuProps) {
  const menuRef =
    useRef<HTMLDivElement>(null);

  const [
    position,
    setPosition
  ] = useState({ x, y });

  useEffect(() => {
    setPosition({ x, y });
  }, [x, y]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame =
      window.requestAnimationFrame(
        () => {
          const menu =
            menuRef.current;

          if (!menu) {
            return;
          }

          const bounds =
            menu.getBoundingClientRect();

          const padding = 8;

          setPosition({
            x: Math.min(
              x,
              window.innerWidth -
                bounds.width -
                padding
            ),
            y: Math.min(
              y,
              window.innerHeight -
                bounds.height -
                padding
            )
          });
        }
      );

    function handlePointerDown(
      event: PointerEvent
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node
        )
      ) {
        onClose();
      }
    }

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener(
      "pointerdown",
      handlePointerDown,
      true
    );

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.cancelAnimationFrame(
        frame
      );

      window.removeEventListener(
        "pointerdown",
        handlePointerDown,
        true
      );

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    open,
    x,
    y,
    onClose
  ]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="popup-menu"
      style={{
        left: position.x,
        top: position.y
      }}
      role="menu"
    >
      {items.map((item) => (
        <div
          key={item.id}
        >
          {item.separatorBefore ? (
            <div className="popup-menu-separator" />
          ) : null}

          <button
            type="button"
            role="menuitem"
            className={
              item.danger
                ? "popup-menu-item danger"
                : "popup-menu-item"
            }
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