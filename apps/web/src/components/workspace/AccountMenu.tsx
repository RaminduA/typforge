"use client";

import { useState } from "react";

interface AccountMenuProps {
  onOpenSettings: () => void;
}

export function AccountMenu({ onOpenSettings }: AccountMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="account-wrap">
      <button className="profile-button" onClick={() => setOpen((value) => !value)}>
        <span className="avatar">T</span>
        <span>Typforge User</span>
      </button>

      {open ? (
        <div className="account-menu">
          <button
            className="menu-item"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
          >
            Settings
          </button>
          <button className="menu-item" disabled title="Auth is skipped for MVP">
            Sign Out
          </button>
        </div>
      ) : null}
    </div>
  );
}