"use client";

// The four yield cards under "XRP yield sources" on /xrp-rich-list.
//
// They were static divs. A reader who wanted the 5.09% had to notice the text
// link under the grid, open the ranking, find the same row again and click
// through from there, which is three steps to reach a destination the card was
// already naming. The whole card is now the link.
//
// Every destination is a third-party venue, so these go out through the same
// OutboundLink the ranking's own Open buttons use: the leave-site prompt, the
// ref=harvest.finance parameter, and both the open and the confirm landing in
// report_outbound_clicks. Nothing new is tracked and no new table is involved,
// so a click from this page shows up in Control Room > Reports > Outbound
// Clicks beside the ranking's clicks, told apart by source_page and by a
// venue_ref of "richlist-card:<venue>" rather than "ranking:<venue>".
//
// Cards without a destination stay as plain divs rather than rendering a dead
// link, which is why the element type is decided per card.

import { AssetIcon } from "@/components/token-icons";
import { OutboundLink } from "@/components/report/outbound-link";

export interface PickCard {
  category: string;
  platform: string;
  asset: string;
  chain: string;
  apy: number;
  tvl: string;
  holders: string;
  href: string | null;
  venueRef: string;
}

export function YieldPickCards({ picks }: { picks: PickCard[] }) {
  return (
    <div className="rl-picks">
      {picks.map((k) => {
        const head = (
          <>
            <div className="rl-pick-head">
              <span className="rl-pick-name">
                {/* The first asset in the pair, which is the token a
                    depositor actually brings. */}
                <AssetIcon
                  asset={k.asset.split(" / ")[0] as "FXRP" | "stXRP"}
                  size={22}
                  decorative
                />
                <span className="rl-pick-platform">{k.platform}</span>
              </span>
              <span className="rl-pick-badge">{k.category}</span>
            </div>
            <div className="rl-pick-rate">{k.apy.toFixed(2)}%</div>
            <dl className="rl-pick-meta" data-lint="chrome">
              <div>
                <dt>Deposits</dt>
                <dd>{k.tvl}</dd>
              </div>
              <div>
                <dt>Asset</dt>
                <dd>{k.asset}</dd>
              </div>
              <div>
                <dt>Holders</dt>
                <dd>{k.holders}</dd>
              </div>
            </dl>
          </>
        );

        if (!k.href) {
          return (
            <div className="rl-pick" key={k.category}>
              {head}
            </div>
          );
        }

        return (
          <OutboundLink
            key={k.category}
            className="rl-pick rl-pick--link"
            href={k.href}
            platform={k.platform}
            source={`richlist-card:${k.venueRef}`}
            product={k.asset}
            chain={k.chain}
            icon={
              <AssetIcon
                asset={k.asset.split(" / ")[0] as "FXRP" | "stXRP"}
                size={20}
                decorative
              />
            }
            ariaLabel={`Open ${k.asset} on ${k.platform}`}
          >
            {head}
            <span className="rl-pick-go" aria-hidden="true">
              Open on {k.platform}
              <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
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
      })}
    </div>
  );
}
