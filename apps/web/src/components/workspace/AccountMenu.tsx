"use client";

import {
  ChevronsUpDown,
  CircleHelp,
  Keyboard,
  LogOut,
  MessageCircle,
  MessageSquare,
  Settings
} from "lucide-react";

import {
  type ReactNode,
  useEffect,
  useRef,
  useState
} from "react";

import { createPortal } from "react-dom";

interface AccountMenuProps {
  onOpenSettings: () => void;
}

interface MenuPosition {
  left: number;
  bottom: number;
  width: number;
}

const PROFILE_NAME =
  "Ramindu Abeygunawardane";

const PROFILE_EMAIL =
  "raminduanjana22171@gmail.com";

function AccountMenuRow({icon,label,mutedText,danger,onClick}: {icon: ReactNode; label: string; mutedText?: string; danger?: boolean; onClick: () => void;}) {
  return (
    <button
      type="button"
      className={danger ? "account-menu-row danger" : "account-menu-row"}
      role="menuitem"
      onClick={onClick}
    >
      <span className="account-menu-row-icon">
        {icon}
      </span>

      <span className="account-menu-row-label">
        {label}
      </span>

      {mutedText ? (
        <span className="account-menu-row-muted">
          {mutedText}
        </span>
      ) : null}
    </button>
  );
}

export function AccountMenu({onOpenSettings}: AccountMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const [menuPosition, setMenuPosition] = useState<MenuPosition>({left: 20,bottom: 72,width: 376});

  function updateMenuPosition() {
    const trigger =triggerRef.current;
    if (!trigger) return;

    const bounds = trigger.getBoundingClientRect();
    const width = Math.min(376, Math.max(305,window.innerWidth - 40));
    const left = Math.min(Math.max(20,bounds.left),window.innerWidth - width - 12);

    setMenuPosition({left,bottom:window.innerHeight - bounds.top + 8,width});
  }

  function toggleMenu() {
    updateMenuPosition();

    setOpen((current) => !current);
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
      if (event.key === "Escape") setOpen(false);
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
    <>
      <button
        ref={triggerRef}
        type="button"
        className={open ? "account-profile-trigger open" : "account-profile-trigger"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleMenu}
      >
        <span className="account-profile-avatar">
          R
        </span>

        <span className="account-profile-name">
          {PROFILE_NAME}
        </span>

        <ChevronsUpDown
          className="account-profile-chevron"
          size={16}
        />
      </button>

      {open && typeof document !== "undefined"? createPortal(
            <>
              <div
                className="account-menu-shield"
                aria-hidden="true"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpen(false);
                }}
              />

              <div
                className="account-menu-panel"
                role="menu"
                style={{left: menuPosition.left,bottom: menuPosition.bottom,width: menuPosition.width}}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <AccountMenuRow
                  icon={<Settings size={17} />}
                  label="Settings"
                  onClick={() => {
                    setOpen(false);
                    onOpenSettings();
                  }}
                />

                <AccountMenuRow
                  icon={<Keyboard size={17} />}
                  label="Keyboard shortcuts"
                  onClick={() => setOpen(false)}
                />

                <AccountMenuRow
                  icon={<MessageSquare size={17} />}
                  label="Give feedback"
                  onClick={() => setOpen(false)}
                />

                <AccountMenuRow
                  icon={<CircleHelp size={17} />}
                  label="support@typforge.dev"
                  onClick={() => setOpen(false)}
                />

                <AccountMenuRow
                  icon={<MessageCircle size={17} />}
                  label="Join the Typforge Discord"
                  onClick={() => setOpen(false)}
                />

                <div className="account-menu-divider" />

                <AccountMenuRow
                  icon={<LogOut size={17} />}
                  label="Sign Out"
                  mutedText={PROFILE_EMAIL}
                  onClick={() => setOpen(false)}
                />
              </div>
            </>, document.body
          )
        : null}
    </>
  );
}