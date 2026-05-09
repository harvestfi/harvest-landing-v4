// Jump-to nav for /test. Anchors to the major sections below the
// hero with small inline icons that get a subtle lift + scale on
// hover. Static (not sticky) since /test sits inside the global
// shell; if pinning is wanted later, swap the wrapper for a sticky
// container with `top: 60px`.

import Link from "next/link";

interface Item {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const ITEMS: Item[] = [
  {
    href: "#hero",
    label: "Performance",
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
    href: "#history",
    label: "History",
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
    href: "#benchmark",
    label: "Benchmarks",
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
];

export function TestJumpNav() {
  return (
    <nav className="uni-jump" aria-label="Jump to section">
      {ITEMS.map((it) => (
        <Link key={it.href} href={it.href} className="uni-jump-item">
          <span className={`uni-jump-icon-wrap uni-jump-${it.href.slice(1)}`}>
            {it.icon}
          </span>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
