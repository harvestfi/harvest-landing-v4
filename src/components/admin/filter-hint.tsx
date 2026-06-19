"use client";

// Small always-visible "(?)" hint shown next to a filter control, on every
// viewport (hover or keyboard focus reveals the popover). Distinct from
// InfoTip, which only surfaces on the mobile page title. The trigger is a
// real button so it's keyboard-reachable; visibility is driven by
// :hover / :focus-within in CSS (.lf-hint).

export function FilterHint({
  children,
  label = "What is this filter?",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <span className="lf-hint">
      <button type="button" className="lf-hint-btn" aria-label={label}>
        ?
      </button>
      <span className="lf-hint-pop" role="tooltip">
        {children}
      </span>
    </span>
  );
}
