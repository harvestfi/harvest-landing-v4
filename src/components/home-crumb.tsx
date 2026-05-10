// Tiny breadcrumb root: a Next.js Link wrapping a house glyph.
// Replaces the literal "Home" text on every breadcrumb across the
// site. The aria-label keeps the link accessible; the SVG carries
// the visual.

import Link from "next/link";

export function HomeCrumb() {
  return (
    <Link href="/" className="crumb-home" aria-label="Home">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
      </svg>
    </Link>
  );
}
