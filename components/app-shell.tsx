"use client";

import { useEffect, useState, type ReactNode } from "react";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "grounds-compliance-sidebar-collapsed";

type AppShellProps = {
  children: ReactNode;
  sidebar: ReactNode;
};

export function AppShell({ children, sidebar }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true");
    } catch {
      // The default expanded view remains available when browser storage is blocked.
    }
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // The current page still responds even when browser storage is unavailable.
      }
      return next;
    });
  }

  return (
    <div className={`shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        {!collapsed ? <div className="sidebar-content">{sidebar}</div> : null}
        <button
          aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
          className="sidebar-toggle"
          onClick={toggleSidebar}
          title={collapsed ? "Show sidebar" : "Hide sidebar"}
          type="button"
        >
          {collapsed ? ">" : "<"}
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}