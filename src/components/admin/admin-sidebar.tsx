"use client";

// Sidebar nav for /admin/*. Replaces the previous horizontal admin
// top bar. Sections + standalone Studio item + Back-to-site link.
// Active item detected by pathname (exact match for index routes,
// startsWith for nested sub-trees so each Acquisition sub-page
// highlights its own row).

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Item {
  label: string;
  href: string;
  // When true, the row is considered active only when pathname is
  // exactly equal to href (used for index routes like /admin and
  // /admin/acquisition, which would otherwise swallow their nested
  // children's active state).
  exact?: boolean;
}

interface Section {
  label: string | null; // null = standalone item, no group header
  items: Item[];
}

const SECTIONS: Section[] = [
  {
    label: "User Journey",
    items: [
      { label: "Traffic", href: "/admin/acquisition", exact: true },
      { label: "App Clicks", href: "/admin/acquisition/clicks-into-app" },
      { label: "User Networth", href: "/admin/acquisition/app-net-worth" },
      { label: "Deposits (TVL)", href: "/admin/acquisition/deposits" },
    ],
  },
  {
    label: "Products",
    items: [
      { label: "View All", href: "/admin/products" },
      { label: "SEO Overview", href: "/admin", exact: true },
    ],
  },
  {
    label: null,
    items: [{ label: "Studio", href: "/admin/studio" }],
  },
  {
    label: "Settings",
    items: [
      { label: "Master Rules", href: "/admin/master-rules" },
      { label: "Ranking Rules", href: "/admin/ranking-rules" },
      { label: "Changelog", href: "/admin/changelog" },
    ],
  },
];

function isActive(pathname: string, item: Item): boolean {
  if (item.exact) {
    return pathname === item.href || pathname === item.href + "/";
  }
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function AdminSidebar() {
  const pathname = usePathname() ?? "";
  return (
    <aside className="admin-sidebar" aria-label="Admin navigation">
      <Link
        href="/"
        className="admin-sidebar-brand"
        aria-label="Harvest, back to site"
      >
        <span className="brand-name">Harvest</span>
        <span className="brand-dot" aria-hidden="true" />
        <span className="admin-sidebar-tag">Admin</span>
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
  );
}
