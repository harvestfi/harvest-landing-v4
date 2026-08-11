"use client";

// "Discover" / "Visit" button used on /report/* pages. Because every target is
// an external, third-party platform, the click opens a short leave-site
// confirmation instead of navigating straight out.
//
// The anchor, the leave prompt, the ref= parameter and the two tracking events
// all live in OutboundLink; this file is only the button's own label and arrow.
// They were one component until the yield cards on /xrp-rich-list needed the
// same behaviour on a trigger that is a whole card rather than a button.

import { type ReactNode } from "react";
import { OutboundLink } from "@/components/report/outbound-link";

export function DiscoverButton({
  href,
  platform,
  label = "Discover",
  source,
  product,
  chain,
  rank,
  icon,
}: {
  href: string;
  platform: string;
  label?: string;
  source?: string;
  product?: string;
  chain?: string;
  rank?: number | null;
  icon?: ReactNode;
}) {
  return (
    <OutboundLink
      className="rp-discover"
      href={href}
      platform={platform}
      source={source}
      product={product}
      chain={chain}
      rank={rank}
      icon={icon}
      ariaLabel={label}
    >
      <span className="rp-discover-label">{label}</span>
      <span className="rp-discover-arrow" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path
            d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </OutboundLink>
  );
}
