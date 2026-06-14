"use client";

// Compact "(?)" info tooltip shown next to a page title on mobile, where
// the full descriptive paragraph is hidden to keep the top tight. The
// popover opens on hover (desktop, if ever shown) and on tap via
// :focus-within (the trigger is a real button), and closes on blur.
// Visibility is gated in CSS (.lf-infotip) so it only appears on the
// mobile control-room layout.

export function InfoTip({
  children,
  label = "About this page",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <span className="lf-infotip">
      <button type="button" className="lf-infotip-btn" aria-label={label}>
        ?
      </button>
      <span className="lf-infotip-pop" role="tooltip">
        {children}
      </span>
    </span>
  );
}
