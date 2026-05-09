// Jump-to nav for /test. Anchors to the major sections below the
// hero in a soft pill rail with refined Lucide-style icons. Hover
// flips the icon to Sunflower Gold and the label to Onyx; nothing
// else (no bg flip, no shadow, no transform).

import Link from "next/link";

interface Item {
  href: string;
  label: string;
  key: string;
  icon: React.ReactNode;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.75",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ITEMS: Item[] = [
  {
    href: "#about",
    label: "Overview",
    key: "about",
    icon: (
      // Activity / pulse line
      <svg viewBox="0 0 24 24" {...stroke} className="uni-jump-icon" aria-hidden="true">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    href: "#performance",
    label: "Performance",
    key: "performance",
    icon: (
      // Trending-up arrow with corner mark
      <svg viewBox="0 0 24 24" {...stroke} className="uni-jump-icon" aria-hidden="true">
        <path d="M22 7l-8.5 8.5-5-5L2 17" />
        <path d="M16 7h6v6" />
      </svg>
    ),
  },
  {
    href: "#benchmark",
    label: "Benchmarks",
    key: "benchmark",
    icon: (
      // Sorted bars (rounded rectangles)
      <svg viewBox="0 0 24 24" {...stroke} className="uni-jump-icon" aria-hidden="true">
        <rect x="3" y="13" width="4" height="8" rx="1" />
        <rect x="10" y="8" width="4" height="13" rx="1" />
        <rect x="17" y="11" width="4" height="10" rx="1" />
      </svg>
    ),
  },
  {
    href: "#ecosystem",
    label: "Ecosystem",
    key: "ecosystem",
    icon: (
      // Three connected nodes (network graph)
      <svg viewBox="0 0 24 24" {...stroke} className="uni-jump-icon" aria-hidden="true">
        <circle cx="18" cy="5" r="2.5" />
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="19" r="2.5" />
        <line x1="8.3" y1="13.4" x2="15.7" y2="17.6" />
        <line x1="15.7" y1="6.4" x2="8.3" y2="10.6" />
      </svg>
    ),
  },
  {
    href: "#history",
    label: "History",
    key: "history",
    icon: (
      // Counter-clockwise rotate (history / undo motion)
      <svg viewBox="0 0 24 24" {...stroke} className="uni-jump-icon" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    href: "#details",
    label: "Details",
    key: "details",
    icon: (
      // Document with text lines (file-text)
      <svg viewBox="0 0 24 24" {...stroke} className="uni-jump-icon" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="15" y2="17" />
      </svg>
    ),
  },
  {
    href: "#faq",
    label: "FAQ",
    key: "faq",
    icon: (
      // Chat bubble (message-square)
      <svg viewBox="0 0 24 24" {...stroke} className="uni-jump-icon" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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
