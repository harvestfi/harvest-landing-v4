"use client";

// The switch above the calculator on /xrp-rich-list.
//
// The rich list calculator is the default: it is what the page ranks for and
// what the H2 above it matches. Only one calculator is mounted at a time, so
// the page never carries two sets of form controls or duplicate ids.

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
 * `source_page` for the embedded staking calculator: this page, but
 * distinguishable, so its events stay out of the rich list calculator's
 * completion rate. No new column — `source_page` already exists.
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

  // The flip is not tracked: there is no control-room page here to read the
  // rows. Usage still shows up in the calculator's own start/result/cta
  // events, filed under EMBEDDED_STAKING_SOURCE.
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
          {/* aria-hidden: read aloud between the tab name and its selected
              state, "popular" sounds like part of the label. */}
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
