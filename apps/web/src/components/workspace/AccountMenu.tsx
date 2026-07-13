"use client";

import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface AccountMenuProps {
  onOpenSettings: () => void;
  onSignOut?: () => void;
  userName?: string;
  userEmail?: string;
}

export function AccountMenu({ onOpenSettings, onSignOut, userName = "Typforge User", userEmail }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const avatarLetter = userName.trim().charAt(0).toUpperCase() || "T";

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
      className="account-menu-container"
    >
      {open ? (
        <div
          className="account-popover"
          role="menu"
        >
          <button
            type="button"
            className="account-popover-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
          >
            <Settings size={18} />

            <span>
              Settings
            </span>
          </button>

          <div className="account-popover-separator" />

          <button
            type="button"
            className="account-popover-item account-sign-out-item"
            role="menuitem"
            disabled={!onSignOut}
            title={onSignOut ? "Sign out" : "Authentication is not enabled yet"}
            onClick={() => {
              if (!onSignOut) {
                return;
              }

              setOpen(false);
              onSignOut();
            }}
          >
            <LogOut size={18} />

            <span className="account-sign-out-content">
              <span>
                Sign Out
              </span>

              {userEmail ? (
                <span className="account-email">
                  {userEmail}
                </span>
              ) : null}
            </span>
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className={open ? "account-trigger open" : "account-trigger"}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="account-avatar">
          {avatarLetter}
        </span>

        <span className="account-trigger-name">
          {userName}
        </span>

        <ChevronsUpDown
          className="account-trigger-chevron"
          size={16}
        />
      </button>
    </div>
  );
}