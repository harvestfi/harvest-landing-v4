"use client";

// "Discover" / "Visit" button used on /report/* pages. Because every target is
// an external, third-party platform, the click opens a short leave-site
// confirmation instead of navigating straight out.
//
// Three things happen here beyond the modal:
//   1. ref=harvest.finance is appended to the outbound URL so destination
//      platforms can attribute the traffic to us.
//   2. The open (Discover/Visit) and the confirm ("I understand") are each
//      tracked into the separate report_outbound_clicks channel.
//   3. The confirm opens the destination in a new tab.

import { useEffect, useState } from "react";
import { trackReportOutbound } from "@/lib/report-tracking";

const OUTBOUND_REF = "harvest.finance";

// Append ref=harvest.finance as a query param. String-based (not a URL
// re-parse) so we never re-encode already-encoded deep-links such as
// Aerodrome's /connect?to=%2Fdeposit... URL. Idempotent, and inserts the
// param before any #hash fragment.
function withRef(url: string): string {
  if (!url) return url;
  if (/[?&]ref=/.test(url)) return url;
  const hashAt = url.indexOf("#");
  const base = hashAt === -1 ? url : url.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : url.slice(hashAt);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}ref=${OUTBOUND_REF}${hash}`;
}

export function DiscoverButton({
  href,
  platform,
  label = "Discover",
  source,
  product,
  chain,
}: {
  href: string;
  platform: string;
  label?: string;
  source?: string;
  product?: string;
  chain?: string;
}) {
  const [open, setOpen] = useState(false);
  const outHref = withRef(href);

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

  function track(event: "open" | "confirm") {
    trackReportOutbound({
      event,
      platform,
      product,
      chain,
      venueRef: source,
      targetUrl: outHref,
    });
  }

  const where = platform || "an external site";

  return (
    <>
      <button
        type="button"
        className="rp-discover"
        onClick={() => {
          track("open");
          setOpen(true);
        }}
      >
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
              Heading to {where}
            </h3>
            <p className="rp-modal-body">
              This takes you to {platform ? platform : "an external platform"},
              an independent platform we track for research but don&rsquo;t run
              ourselves. Harvest doesn&rsquo;t control its contracts, rates or
              security, so it&rsquo;s worth a quick look of your own before you
              use it.
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
                href={outHref}
                target="_blank"
                rel="noopener noreferrer nofollow"
                onClick={() => {
                  track("confirm");
                  setOpen(false);
                }}
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
