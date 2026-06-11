"use client";

// Refresh control for the live admin dashboards (Live Feed, SEO
// Summary). Both pages pull their Supabase sources once on mount; this
// re-runs that fetch on demand without a full page reload. The icon
// spins while a refresh is in flight and the button is disabled so a
// double-tap can't fire two overlapping fetches.

export function RefreshButton({
  onClick,
  refreshing,
  label = "Refresh",
}: {
  onClick: () => void;
  refreshing: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="lf-refresh"
      onClick={onClick}
      disabled={refreshing}
      aria-label={refreshing ? "Refreshing…" : label}
      aria-busy={refreshing}
    >
      <svg
        className={`lf-refresh-icon${refreshing ? " spinning" : ""}`}
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-2.6-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
      {refreshing ? "Refreshing…" : label}
    </button>
  );
}
