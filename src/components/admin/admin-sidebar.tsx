"use client";

// Sidebar nav for /control-room/*. Sections + standalone items + a
// Back-to-site link. Active item detected by pathname (exact match for
// index routes, startsWith for nested sub-trees).
//
// Desktop: a fixed 240px left rail (styled in globals.css).
// Mobile (<=900px): the rail collapses off-canvas and is opened by the
// hamburger in a sticky top bar; a backdrop closes it, and any
// navigation auto-closes it so the drawer never covers the page it
// just opened.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

interface Item {
  label: string;
  href: string;
  // When true, the row is considered active only when pathname is
  // exactly equal to href (used for index routes like /control-room and
  // /control-room/acquisition, which would otherwise swallow their
  // nested children's active state).
  exact?: boolean;
}

interface Section {
  label: string | null; // null = standalone item, no group header
  items: Item[];
}

const SECTIONS: Section[] = [
  {
    label: null,
    items: [
      { label: "Live Feed", href: "/control-room/live-feed" },
      { label: "SEO Summary", href: "/control-room/seo" },
    ],
  },
  {
    label: "Acquisition",
    items: [
      { label: "Traffic", href: "/control-room/acquisition", exact: true },
      { label: "App Clicks", href: "/control-room/acquisition/clicks-into-app" },
      { label: "User Networth", href: "/control-room/acquisition/app-net-worth" },
      { label: "Deposits (TVL)", href: "/control-room/acquisition/deposits" },
    ],
  },
  {
    label: "Products",
    items: [
      { label: "View All", href: "/control-room/products" },
      { label: "Hide", href: "/control-room/hide" },
      { label: "SEO Overview", href: "/control-room", exact: true },
    ],
  },
  {
    label: "Marketing",
    items: [{ label: "Studio", href: "/control-room/studio" }],
  },
  {
    label: "Settings",
    items: [
      { label: "Master Rules", href: "/control-room/master-rules" },
      // Master Config (/control-room/master-config) is intentionally not
      // listed here - the route stays in the repo, just hidden from the nav.
      { label: "Ranking Rules", href: "/control-room/ranking-rules" },
      { label: "Design System", href: "/control-room/design-system" },
    ],
  },
];

function isActive(pathname: string, item: Item): boolean {
  if (item.exact) {
    return pathname === item.href || pathname === item.href + "/";
  }
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function BrandMark() {
  return (
    <>
      <span className="brand-name">Harvest</span>
      <span className="brand-dot" aria-hidden="true" />
      <span className="admin-sidebar-tag">Admin</span>
    </>
  );
}

// Session menu: a small popover dropping (upward) from the sidebar footer.
// Adapts a wallet-dropdown pattern to the control room - "Copy my address"
// becomes "Copy panel link", and "Disconnect" becomes "Lock panel", which
// clears the remembered passphrase (ControlRoomGate, key "cr_auth") and
// reloads so the gate re-locks. Toggled via the boolean `hidden` attribute;
// closes on outside-click, Escape, or after an item runs.
function SessionMenu() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  };

  const copyLink = () => {
    setOpen(false);
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => flash("Panel link copied"), () => flash("Copy failed"));
    } else {
      flash("Copy unavailable");
    }
  };

  const lockPanel = () => {
    setOpen(false);
    try {
      localStorage.removeItem("cr_auth");
      sessionStorage.removeItem("cr_auth");
    } catch {
      /* ignore storage access errors */
    }
    window.location.reload();
  };

  return (
    <div className="admin-menu" ref={ref}>
      <button
        type="button"
        className="admin-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          // stopPropagation so this same click doesn't hit the outside-click
          // closer registered on document.
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>Session</span>
        <svg
          className="admin-menu-caret"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <div className="admin-menu-pop" role="menu" hidden={!open}>
        <button
          type="button"
          role="menuitem"
          className="admin-menu-item"
          onClick={copyLink}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy panel link
        </button>
        <Link
          href="/"
          role="menuitem"
          className="admin-menu-item"
          onClick={() => setOpen(false)}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Back to site
        </Link>
        <button
          type="button"
          role="menuitem"
          className="admin-menu-item"
          onClick={lockPanel}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Lock panel
        </button>
      </div>
      {toast && (
        <div className="admin-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}

export function AdminSidebar() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes so a tapped link never
  // leaves the overlay sitting on top of the page it opened.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes the drawer; lock body scroll while it's open so the
  // page behind doesn't scroll under the overlay.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Mobile-only top bar with the hamburger (hidden on desktop). */}
      <div className="admin-mobilebar">
        <button
          type="button"
          className="admin-hamburger"
          aria-label="Open admin menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <Link href="/control-room/live-feed" className="admin-mobilebar-brand">
          <BrandMark />
        </Link>
        <span className="admin-mobilebar-toggle">
          <ThemeToggle />
        </span>
      </div>

      {open && (
        <div
          className="admin-backdrop"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`admin-sidebar${open ? " open" : ""}`}
        aria-label="Admin navigation"
      >
        <button
          type="button"
          className="admin-sidebar-close"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <Link
          href="/"
          className="admin-sidebar-brand"
          aria-label="Harvest, back to site"
        >
          <BrandMark />
        </Link>

        <nav className="admin-sidebar-nav">
          {SECTIONS.map((section, sIdx) => (
            <div key={sIdx} className="admin-sidebar-section">
              {section.label && (
                <p className="admin-sidebar-section-label">{section.label}</p>
              )}
              <ul className="admin-sidebar-items">
                {section.items.map((item) => {
                  const active = isActive(pathname, item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`admin-sidebar-link${active ? " active" : ""}`}
                        aria-current={active ? "page" : undefined}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <SessionMenu />
          <span className="admin-sidebar-toggle">
            <ThemeToggle />
          </span>
        </div>
      </aside>
    </>
  );
}
