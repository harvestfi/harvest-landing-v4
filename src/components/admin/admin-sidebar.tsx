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
      </aside>
    </>
  );
}
