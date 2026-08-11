"use client";

// The leave-site link used anywhere we point a reader at a third-party venue.
//
// This is the whole of what DiscoverButton used to be, minus its own markup.
// It was extracted when the yield cards on /xrp-rich-list became clickable:
// those cards are the trigger themselves, so wrapping a DiscoverButton in a
// card-sized anchor would have nested one <a> inside another. Rather than copy
// the modal and the tracking calls into a second file and let the two drift,
// the behaviour lives here and the trigger is whatever the caller passes as
// children.
//
// Three things happen beyond the modal:
//   1. ref=harvest.finance is appended to the outbound URL so destination
//      platforms can attribute the traffic to us.
//   2. The open and the confirm ("I understand") are each tracked into the
//      separate report_outbound_clicks channel.
//   3. The confirm opens the destination in a new tab.

import { useEffect, useState, type ReactNode } from "react";
import { trackReportOutbound } from "@/lib/report-tracking";

const OUTBOUND_REF = "harvest.finance";

// Append ref=harvest.finance as a query param. String-based (not a URL
// re-parse) so we never re-encode already-encoded deep-links such as
// Aerodrome's /connect?to=%2Fdeposit... URL. Idempotent, and inserts the
// param before any #hash fragment.
export function withRef(url: string): string {
  if (!url) return url;
  if (/[?&]ref=/.test(url)) return url;
  const hashAt = url.indexOf("#");
  const base = hashAt === -1 ? url : url.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : url.slice(hashAt);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}ref=${OUTBOUND_REF}${hash}`;
}

export function OutboundLink({
  href,
  platform,
  source,
  product,
  chain,
  rank,
  icon,
  className,
  ariaLabel,
  children,
}: {
  href: string;
  platform: string;
  /** Stable identifier for the row or card the click came from. */
  source?: string;
  product?: string;
  chain?: string;
  rank?: number | null;
  /** Shown beside the destination name inside the modal. */
  icon?: ReactNode;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
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
      rank,
      targetUrl: outHref,
    });
  }

  const where = platform || "an external site";

  return (
    <>
      {/* A real anchor, not a button.
          The visible control used to be a <button> so the click could be
          intercepted by the leave-site prompt. That worked for a visitor with
          JavaScript and for nobody else: the destination lived only in the
          component's props, so the built HTML carried 22 outbound
          destinations and zero links. Googlebot saw no link, Ahrefs' link
          graph saw no link, an LLM reading the HTML saw no link, and a
          visitor without JavaScript got a dead control. The page declared it
          pointed outward in its JSON-LD while the document did not.
          Now it is an <a href> that the click handler intercepts, so the
          prompt still appears for anyone with JavaScript and the link is real
          for everyone and everything else. Modified clicks are deliberately
          left alone so cmd-click and middle-click behave like a normal link.
          rel keeps nofollow per the site's outbound policy. */}
      <a
        className={className}
        href={outHref}
        target="_blank"
        rel="noopener noreferrer nofollow"
        aria-label={ariaLabel}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
            return;
          }
          e.preventDefault();
          track("open");
          setOpen(true);
        }}
      >
        {children}
      </a>
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
              You are about to open:
              <span className="rp-modal-target">
                {icon ? <span className="rp-modal-target-ico">{icon}</span> : null}
                <span className="rp-modal-target-name">
                  {product ? `${product} ` : ""}on {where}
                </span>
              </span>
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
