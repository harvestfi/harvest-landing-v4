// Jump-to nav for product pages. Anchors to the major sections below
// the hero in a clean horizontal rail. Icons are a single visual
// language: 24x24 viewBox, 1.75 stroke, rounded joins, no fill
// accents - pure monoline glyphs in the spirit of Lucide / Phosphor
// so the rail reads as a modern navigation strip rather than a
// decorated tile bar.

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
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ITEMS: Item[] = [
  {
    href: "#about",
    label: "Overview",
    key: "about",
    icon: (
      // Info circle: clean ring with an i-stroke
      <svg viewBox="0 0 24 24" className="uni-jump-icon" aria-hidden="true">
        <circle cx="12" cy="12" r="9" {...stroke} />
        <path d="M12 11v5" {...stroke} />
        <circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "#benchmark",
    label: "Benchmarks",
    key: "benchmark",
    icon: (
      // Ascending bar chart on a baseline - pure stroke
      <svg viewBox="0 0 24 24" className="uni-jump-icon" aria-hidden="true">
        <path d="M4 20h16" {...stroke} />
        <path d="M7 17v-4" {...stroke} />
        <path d="M12 17v-7" {...stroke} />
        <path d="M17 17V7" {...stroke} />
      </svg>
    ),
  },
  {
    href: "#ecosystem",
    label: "Ecosystem",
    key: "ecosystem",
    icon: (
      // Share / network glyph: three nodes connected from a central pivot
      <svg viewBox="0 0 24 24" className="uni-jump-icon" aria-hidden="true">
        <circle cx="6" cy="12" r="2.25" {...stroke} />
        <circle cx="18" cy="6" r="2.25" {...stroke} />
        <circle cx="18" cy="18" r="2.25" {...stroke} />
        <path d="M8 11l8-4" {...stroke} />
        <path d="M8 13l8 4" {...stroke} />
      </svg>
    ),
  },
  {
    href: "#history",
    label: "History",
    key: "history",
    icon: (
      // Clock face with hour + minute hands
      <svg viewBox="0 0 24 24" className="uni-jump-icon" aria-hidden="true">
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
      // Document with folded corner and text lines
      <svg viewBox="0 0 24 24" className="uni-jump-icon" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...stroke} />
        <path d="M14 3v5h5" {...stroke} />
        <path d="M9 13h6" {...stroke} />
        <path d="M9 17h4" {...stroke} />
      </svg>
    ),
  },
  {
    href: "#faq",
    label: "FAQ",
    key: "faq",
    icon: (
      // Help circle: ring with a question stem and dot
      <svg viewBox="0 0 24 24" className="uni-jump-icon" aria-hidden="true">
        <circle cx="12" cy="12" r="9" {...stroke} />
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
