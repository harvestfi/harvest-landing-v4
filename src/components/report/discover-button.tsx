"use client";

// "Discover" button used on /report/* venue rankings. Because every target is
// an external platform Harvest doesn't operate, the click opens a leaving-site
// confirmation instead of navigating straight out: a small modal with a yellow
// "I understand" (proceeds, opens the destination in a new tab) and a Cancel.

import { useEffect, useState } from "react";

export function DiscoverButton({
  href,
  platform,
  label = "Discover",
}: {
  href: string;
  platform: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button type="button" className="rp-discover" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div
          className="rp-modal-backdrop"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="rp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rp-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="rp-modal-title" className="rp-modal-title">
              You&rsquo;re leaving Harvest
            </h3>
            <p className="rp-modal-body">
              You&rsquo;re heading to an external platform
              {platform ? ` (${platform})` : ""}. It isn&rsquo;t operated by
              Harvest, and we don&rsquo;t control its contracts, rates or
              security. Do your own research before using it.
            </p>
            <div className="rp-modal-actions">
              <button
                type="button"
                className="rp-modal-cancel"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <a
                className="rp-modal-confirm"
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                onClick={() => setOpen(false)}
              >
                I understand
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
