// Jump-to nav for product pages. Anchors to the major sections below
// the hero in a soft pill rail. Icons designed in a single visual
// language: 24x24 viewBox, 1.5 stroke, rounded joins, with a subtle
// filled accent shape so each glyph carries weight without feeling
// busy. Container is a 32x32 rounded square so each icon gets
// breathing room and stays readable at desktop and mobile sizes.

// Plain <a> for in-page hash anchors. Next.js <Link> on hash-only
// hrefs occasionally appended the new fragment to the existing one
// (#ecosystem + #faq → /test#ecosystem#faq), which is invalid URL
// shape and breaks back-forward history.

interface Item {
  href: string;
  label: string;
  key: string;
  icon: React.ReactNode;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const accent = {
  fill: "currentColor",
  fillOpacity: 0.12,
  stroke: "none",
};

const ITEMS: Item[] = [
  {
    href: "#about",
    label: "Overview",
    key: "about",
    icon: (
      // Compass: filled needle on a stroked dial
      <svg viewBox="0 0 24 24" className="uni-jump-icon" aria-hidden="true">
        <circle cx="12" cy="12" r="9" {...stroke} />
        <path d="M14.5 9.5 13 13l-3.5 1.5L11 11Z" {...accent} />
        <path d="M14.5 9.5 13 13l-3.5 1.5L11 11Z" {...stroke} />
      </svg>
    ),
  },
  {
    href: "#benchmark",
    label: "Benchmarks",
    key: "benchmark",
    icon: (
      // Three sorted bars with a baseline + arrow climbing right
      <svg viewBox="0 0 24 24" className="uni-jump-icon" aria-hidden="true">
        <rect x="4" y="14" width="4" height="6" rx="1.2" {...accent} />
        <rect x="10" y="10" width="4" height="10" rx="1.2" {...accent} />
        <rect x="16" y="6" width="4" height="14" rx="1.2" {...accent} />
        <rect x="4" y="14" width="4" height="6" rx="1.2" {...stroke} />
        <rect x="10" y="10" width="4" height="10" rx="1.2" {...stroke} />
        <rect x="16" y="6" width="4" height="14" rx="1.2" {...stroke} />
      </svg>
    ),
  },
  {
    href: "#ecosystem",
    label: "Ecosystem",
    key: "ecosystem",
    icon: (
      // Three connected nodes with filled centres
      <svg viewBox="0 0 24 24" className="uni-jump-icon" aria-hidden="true">
        <line x1="6" y1="12" x2="17" y2="6" {...stroke} />
        <line x1="6" y1="12" x2="17" y2="18" {...stroke} />
        <circle cx="6" cy="12" r="2.5" {...accent} />
        <circle cx="17" cy="6" r="2.5" {...accent} />
        <circle cx="17" cy="18" r="2.5" {...accent} />
        <circle cx="6" cy="12" r="2.5" {...stroke} />
        <circle cx="17" cy="6" r="2.5" {...stroke} />
        <circle cx="17" cy="18" r="2.5" {...stroke} />
      </svg>
    ),
  },
  {
    href: "#history",
    label: "History",
    key: "history",
    icon: (
      // Clock face with filled dial + hands
      <svg viewBox="0 0 24 24" className="uni-jump-icon" aria-hidden="true">
        <circle cx="12" cy="12" r="9" {...accent} />
        <circle cx="12" cy="12" r="9" {...stroke} />
        <path d="M12 7.5V12l3 2" {...stroke} />
      </svg>
    ),
  },
  {
    href: "#details",
    label: "Details",
    key: "details",
    icon: (
      // Document with folded corner + text rows
      <svg viewBox="0 0 24 24" className="uni-jump-icon" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...accent} />
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...stroke} />
        <path d="M14 3v5h5" {...stroke} />
        <line x1="9" y1="13" x2="15" y2="13" {...stroke} />
        <line x1="9" y1="17" x2="13" y2="17" {...stroke} />
      </svg>
    ),
  },
  {
    href: "#faq",
    label: "FAQ",
    key: "faq",
    icon: (
      // Question mark in a rounded square
      <svg viewBox="0 0 24 24" className="uni-jump-icon" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="4" {...accent} />
        <rect x="3" y="3" width="18" height="18" rx="4" {...stroke} />
        <path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" {...stroke} />
        <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

export function TestJumpNav() {
  return (
    <nav className="uni-jump" aria-label="Jump to section">
      {ITEMS.map((it) => (
        <a key={it.key} href={it.href} className="uni-jump-item">
          <span className={`uni-jump-icon-wrap uni-jump-${it.key}`}>
            {it.icon}
          </span>
          <span className="uni-jump-label">{it.label}</span>
        </a>
      ))}
    </nav>
  );
}
