"use client";

// Compact pager for the control-room feed tables. Row counts can run to
// tens of thousands (full history, 25/page), so numbered page buttons
// aren't practical - this is first / prev / "Page X of Y" / next / last
// plus the total row count. Renders nothing when there's a single page.

export function TablePager({
  page,
  totalPages,
  totalRows,
  onPage,
  unit = "rows",
}: {
  page: number;
  totalPages: number;
  totalRows: number;
  onPage: (p: number) => void;
  unit?: string;
}) {
  if (totalPages <= 1) return null;
  const go = (p: number) => onPage(Math.max(0, Math.min(totalPages - 1, p)));
  const atStart = page <= 0;
  const atEnd = page >= totalPages - 1;
  return (
    <nav className="lf-pager" aria-label="Pagination">
      <span className="lf-pager-meta">
        {totalRows.toLocaleString("en-US")} {unit}
      </span>
      <div className="lf-pager-controls">
        <button
          type="button"
          className="lf-pager-btn"
          onClick={() => go(0)}
          disabled={atStart}
          aria-label="First page"
        >
          «
        </button>
        <button
          type="button"
          className="lf-pager-btn"
          onClick={() => go(page - 1)}
          disabled={atStart}
          aria-label="Previous page"
        >
          ‹
        </button>
        <span className="lf-pager-label">
          Page {(page + 1).toLocaleString("en-US")} / {totalPages.toLocaleString("en-US")}
        </span>
        <button
          type="button"
          className="lf-pager-btn"
          onClick={() => go(page + 1)}
          disabled={atEnd}
          aria-label="Next page"
        >
          ›
        </button>
        <button
          type="button"
          className="lf-pager-btn"
          onClick={() => go(totalPages - 1)}
          disabled={atEnd}
          aria-label="Last page"
        >
          »
        </button>
      </div>
    </nav>
  );
}
