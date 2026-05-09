// Jump-to nav for /test. Anchors to the major sections below the
// hero in a White Smoke pill rail. Hover lifts the icon, tints it
// Sunflower Gold and applies a per-icon micro-transform.

import Link from "next/link";

interface Item {
  href: string;
  label: string;
  icon: React.ReactNode;
  key: string;
}

const ITEMS: Item[] = [
  {
    href: "#about",
    label: "Overview",
    key: "about",
    icon: (
      <svg
        className="uni-jump-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 4h7a3 3 0 013 3v13" />
        <path d="M20 4h-7a3 3 0 00-3 3" />
        <path d="M4 4v16h7" />
        <path d="M20 4v16h-7" />
      </svg>
    ),
  },
  {
    href: "#performance",
    label: "Performance",
    key: "performance",
    icon: (
      <svg
        className="uni-jump-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M21 7v0M21 7h-5" />
      </svg>
    ),
  },
  {
    href: "#benchmark",
    label: "Benchmarks",
    key: "benchmark",
    icon: (
      <svg
        className="uni-jump-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="6" y1="20" x2="6" y2="13" />
        <line x1="12" y1="20" x2="12" y2="9" />
        <line x1="18" y1="20" x2="18" y2="16" />
      </svg>
    ),
  },
  {
    href: "#ecosystem",
    label: "Ecosystem",
    key: "ecosystem",
    icon: (
      <svg
        className="uni-jump-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
      </svg>
    ),
  },
  {
    href: "#history",
    label: "History",
    key: "history",
    icon: (
      <svg
        className="uni-jump-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    href: "#details",
    label: "Details",
    key: "details",
    icon: (
      <svg
        className="uni-jump-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 9h16M4 15h16M9 4l-2 16M17 4l-2 16" />
      </svg>
    ),
  },
  {
    href: "#faq",
    label: "FAQ",
    key: "faq",
    icon: (
      <svg
        className="uni-jump-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 4" />
        <path d="M12 17.5v.01" />
      </svg>
    ),
  },
];

export function TestJumpNav() {
  return (
    <nav className="uni-jump" aria-label="Jump to section">
      {ITEMS.map((it) => (
        <Link key={it.key} href={it.href} className="uni-jump-item">
          <span className={`uni-jump-icon-wrap uni-jump-${it.key}`}>
            {it.icon}
          </span>
          <span className="uni-jump-label">{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
