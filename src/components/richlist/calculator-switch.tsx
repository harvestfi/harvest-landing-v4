"use client";

// The switch above the calculator on /xrp-rich-list.
//
// Two questions arrive on this page and only one of them had a tool. "Where
// does my balance rank" is what the page is for and what it ranks for; "what
// would that balance earn" is the question a rank raises, and answering it
// meant sending the reader to another page. The switch keeps both here.
//
// THE RICH LIST CALCULATOR IS THE DEFAULT AND STAYS THE DEFAULT. It holds the
// best click-through on the page, the H2 above it is what "xrp rich list
// calculator" matches, and the staking tool is the second answer rather than
// a replacement. The switch renders after it in the DOM for the same reason:
// what a crawler reads first should be what the page is about.
//
// Only one calculator is mounted at a time. Rendering both and hiding one
// would put a second set of form controls and a second product list into the
// page for every visitor who never touches the switch, and would give the
// document two elements with the same ids.

import { useState } from "react";
import {
  PercentileCalculator,
  type LadderPoint,
  type TopYield,
} from "@/components/richlist/percentile-calculator";
import {
  XrpStakingCalculator,
  type CalcProduct,
} from "@/components/report/xrp-staking-calculator";

/**
 * What the staking calculator reports as `source_page` from this page.
 *
 * Still this page, so it is clear where the interaction happened, but
 * distinguishable, so the embedded tool's presses do not land in the rich
 * list calculator's completion rate — the one number that page exists to
 * measure. No new table and no new column: `source_page` already exists on
 * every row richlist_calculator_events holds.
 */
export const EMBEDDED_STAKING_SOURCE = "/xrp-rich-list#staking-calculator";

export function CalculatorSwitch({
  ladder,
  accounts,
  snapshotDate,
  topYield,
  staking,
}: {
  ladder: LadderPoint[];
  accounts: number;
  snapshotDate: string;
  topYield?: TopYield | null;
  /** Absent when the yield feed is unreadable, and then there is no switch. */
  staking: {
    products: CalcProduct[];
    asOf: string;
    xrpUsd: number | null;
  } | null;
}) {
  const [mode, setMode] = useState<"rank" | "earn">("rank");

  // The flip itself is not recorded here.
  //
  // On the deployment this came from, a press sends a "switch" event so the
  // question "of the people who reach for the staking calculator, how many
  // use it" can be answered. That is a reporting question, and answering it
  // needs a control-room page to read the rows, which this deployment does
  // not have. Rather than write events nothing reads, the flip is silent and
  // the embedded calculator's own start/result/cta events carry the usage —
  // filed under EMBEDDED_STAKING_SOURCE, so they stay out of the rich list
  // calculator's numbers either way.
  const flip = (next: "rank" | "earn") => {
    if (next === mode) return;
    setMode(next);
  };

  const rank = (
    <PercentileCalculator
      ladder={ladder}
      accounts={accounts}
      snapshotDate={snapshotDate}
      topYield={topYield}
    />
  );

  // No products, no switch. A control offering one option is a label that
  // looks clickable. The anchor still has to be here either way.
  if (!staking || staking.products.length === 0) {
    return <div id="calculator">{rank}</div>;
  }

  return (
    <div id="calculator">
      <div className="rl-calcswitch" role="tablist" aria-label="Calculator">
        <button
          type="button"
          role="tab"
          id="rl-tab-rank"
          aria-selected={mode === "rank"}
          aria-controls="rl-calc-panel"
          className={`rl-calcswitch-tab${mode === "rank" ? " is-on" : ""}`}
          onClick={() => flip("rank")}
        >
          Rich List Calculator
        </button>
        <button
          type="button"
          role="tab"
          id="rl-tab-earn"
          aria-selected={mode === "earn"}
          aria-controls="rl-calc-panel"
          className={`rl-calcswitch-tab${mode === "earn" ? " is-on" : ""}`}
          onClick={() => flip("earn")}
        >
          XRP Staking Calculator
          {/* The badge is the only thing telling a reader the second tab is
              worth pressing, on a control whose default tab is what the page
              is named after. aria-hidden because a screen reader announcing
              "popular" between the tab name and its selected state reads as
              part of the label. */}
          <span className="rl-calcswitch-badge" aria-hidden="true">
            popular
          </span>
        </button>
      </div>

      <div
        id="rl-calc-panel"
        role="tabpanel"
        aria-labelledby={mode === "rank" ? "rl-tab-rank" : "rl-tab-earn"}
      >
        {mode === "rank" ? (
          rank
        ) : (
          <div className="rl-calc-embed">
            {/* No standfirst above the card. The tab that was just pressed
                already says what the tool is, and the card's own first line
                says what to do with it; a paragraph between the two pushed
                the input below the fold on a phone to explain something
                nobody had asked. */}
            <XrpStakingCalculator
              products={staking.products}
              asOf={staking.asOf}
              xrpUsd={staking.xrpUsd}
              total={staking.products.length}
              sourcePage={EMBEDDED_STAKING_SOURCE}
              ctaHref="/report/xrp-yield-ranking"
              ctaLabel="Open the XRP staking report"
            />
          </div>
        )}
      </div>
    </div>
  );
}
