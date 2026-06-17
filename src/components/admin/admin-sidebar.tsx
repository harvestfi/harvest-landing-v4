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
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

interface Item {
  label: string;
  href: string;
  icon: IconName;
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
      { label: "Live Feed", href: "/control-room/live-feed", icon: "activity" },
      { label: "SEO Summary", href: "/control-room/seo", icon: "globe" },
    ],
  },
  {
    label: "Acquisition",
    items: [
      { label: "Traffic", href: "/control-room/acquisition", icon: "users", exact: true },
      { label: "App Clicks", href: "/control-room/acquisition/clicks-into-app", icon: "click" },
      { label: "User Networth", href: "/control-room/acquisition/app-net-worth", icon: "dollar" },
      { label: "Deposits (TVL)", href: "/control-room/acquisition/deposits", icon: "trending" },
    ],
  },
  {
    label: "Products",
    items: [
      { label: "View All", href: "/control-room/products", icon: "grid" },
      { label: "Hide", href: "/control-room/hide", icon: "eye-off" },
      { label: "SEO Overview", href: "/control-room", icon: "bar-chart", exact: true },
    ],
  },
  {
    label: "Marketing",
    items: [{ label: "Studio", href: "/control-room/studio", icon: "image" }],
  },
  {
    label: "Settings",
    items: [
      { label: "Master Rules", href: "/control-room/master-rules", icon: "book" },
      // Master Config (/control-room/master-config) is intentionally not
      // listed here - the route stays in the repo, just hidden from the nav.
      { label: "Ranking Rules", href: "/control-room/ranking-rules", icon: "sliders" },
      { label: "Design System", href: "/control-room/design-system", icon: "layout" },
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

// Feather-style stroke icons for the nav. Each value is the inner SVG
// content; NavIcon wraps it in a standard 15x15 stroked <svg> (same
// treatment as the reference dropdown's item icons).
const NAV_ICONS = {
  activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  click: (
    <>
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="M13 13l6 6" />
    </>
  ),
  dollar: (
    <>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  trending: (
    <>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </>
  ),
  "bar-chart": (
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </>
  ),
  book: (
    <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),
  sliders: (
    <>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </>
  ),
  layout: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </>
  ),
} as const;

type IconName = keyof typeof NAV_ICONS;

function NavIcon({ name }: { name: IconName }) {
  return (
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
      {NAV_ICONS[name]}
    </svg>
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
                        <NavIcon name={item.icon} />
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
          <Link href="/" className="admin-sidebar-back">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to site
          </Link>
          <span className="admin-sidebar-toggle">
            <ThemeToggle />
          </span>
        </div>
      </aside>
    </>
  );
}
