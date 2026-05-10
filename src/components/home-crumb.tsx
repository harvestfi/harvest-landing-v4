// Breadcrumb root that adapts to viewport: shows the literal "Home"
// text on desktop where horizontal space is plentiful, and switches
// to a compact house glyph on mobile where a small icon reads
// better than a text crumb. Both variants live in the markup; CSS
// (.crumb-home-text vs .crumb-home-icon) toggles which one shows.

import Link from "next/link";

export function HomeCrumb() {
  return (
    <Link href="/" className="crumb-home" aria-label="Home">
      <span className="crumb-home-text">Home</span>
      <span className="crumb-home-icon" aria-hidden="true">
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
        </svg>
      </span>
    </Link>
  );
}
