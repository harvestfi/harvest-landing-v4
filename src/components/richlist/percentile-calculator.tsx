"use client";

// The percentile calculator on /xrp-rich-list.
//
// Three rules from the build spec drive every decision here.
//
// It never asks for a wallet address. A form requesting an address on a page
// about the largest holders looks exactly like phishing, in a community that
// is unusually alert to it, and the notice under the field says so explicitly
// rather than leaving the user to infer it.
//
// It computes client-side against a build-time ladder. No request per lookup,
// so no balance a visitor types is ever transmitted or logged.
//
// Its output is positive at every balance. The page title promises a rank, so
// the result is framed as a position rather than as a verdict: "you are in the
// top 23%, larger than 6.2 million accounts", never "you are not in the top
// 10%". Most XRPL accounts hold very little, so most people place higher than
// they expect, and that surprise is what gets shared.

import { useEffect, useMemo, useRef, useState } from "react";
import { AssetIcon } from "@/components/token-icons";
import { trackCalculator, calculatorTier } from "@/lib/richlist-tracking";

/** Top XRP rate and where it is paid, for the box under a result. */
export interface TopYield {
  apy: number;
  platform: string;
}

export interface LadderPoint {
  xrp: number;
  atOrAbove: number;
}

// Mirrors accountsAtOrAbove in src/lib/xrp-richlist.ts. The two must agree,
// because the prose above the calculator is rendered from the server copy and
// the result inside it from this one.
function accountsAtOrAbove(ladder: LadderPoint[], xrp: number): number {
  if (!ladder.length) return 0;
  if (xrp <= ladder[0].xrp) return ladder[0].atOrAbove;
  const last = ladder[ladder.length - 1];
  if (xrp >= last.xrp) return last.atOrAbove;
  let lo = 0;
  let hi = ladder.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ladder[mid].xrp <= xrp) lo = mid;
    else hi = mid;
  }
  const a = ladder[lo];
  const b = ladder[hi];
  const span = Math.log10(b.xrp) - Math.log10(a.xrp);
  const t = span > 0 ? (Math.log10(xrp) - Math.log10(a.xrp)) / span : 0;
  return a.atOrAbove + t * (b.atOrAbove - a.atOrAbove);
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} million` : fmt(n);

/**
 * Top-percentage label. Rounded so the number reads as a position rather than
 * as a measurement: "top 23%" is shareable, "top 22.8371%" is not, and the
 * ladder's resolution does not support the extra digits anyway.
 */
function topPctLabel(topPct: number): string {
  if (topPct < 0.01) return "top 0.01%";
  if (topPct < 1) return `top ${topPct.toFixed(2)}%`;
  if (topPct < 10) return `top ${topPct.toFixed(1)}%`;
  return `top ${Math.round(topPct)}%`;
}

// The lookup itself is a binary search over a few hundred points and returns
// in well under a millisecond. The check is paced anyway, because a rank that
// appears the instant a digit is typed reads as a guess, and because the page
// is competing on being a tool rather than a table. The stages below name what
// the ladder actually represents at each step, so the wait describes real work
// rather than inventing some.
const CHECK_MS = 3000;
const STAGES = [
  "Reading the ledger snapshot",
  "Placing your balance in the distribution",
  "Counting accounts above and below",
];

export function PercentileCalculator({
  ladder,
  accounts,
  snapshotDate,
  topYield,
}: {
  ladder: LadderPoint[];
  accounts: number;
  snapshotDate: string;
  /** Highest rate across the yield picks below, and where it is paid. The
   *  box under a result does not render without it. */
  topYield?: TopYield | null;
}) {
  const [raw, setRaw] = useState("");
  const [phase, setPhase] = useState<"idle" | "checking" | "done">("idle");
  const [stage, setStage] = useState(0);
  // Held so an unmount or a restart cannot leave a timer writing into a
  // component that is no longer on the page.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // The button is never disabled, so it needs somewhere to send a visitor who
  // presses it before typing anything.
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("idle");
    setStage(0);
  };

  const parsed = useMemo(() => {
    // Accept "12,500", "12 500" and "12500.5". Rejecting a thousands separator
    // would fail the most natural way to type a balance.
    const n = Number(raw.replace(/[,\s_]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [raw]);

  const result = useMemo(() => {
    if (parsed == null) return null;
    const above = Math.min(accounts, Math.max(0, accountsAtOrAbove(ladder, parsed)));
    // "Larger than" counts accounts strictly below, which is the number that
    // makes the result feel like a position in a crowd.
    const below = Math.max(0, accounts - above);
    const topPct = (above / accounts) * 100;
    return { above, below, topPct };
  }, [parsed, ladder, accounts]);

  const startCheck = () => {
    // `disabled` is gone from the button, so the mid-check guard that attribute
    // used to provide has to live here: a second press while the bar is
    // running would restart it from zero.
    if (phase === "checking") return;
    // A greyed-out primary action on the one control this page exists for
    // reads as broken, so the button always looks live. When there is nothing
    // to check it puts the cursor in the field rather than doing nothing.
    if (parsed == null) {
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }
    timers.current.forEach(clearTimeout);
    timers.current = [];
    trackCalculator({ event: "start" });
    setPhase("checking");
    setStage(0);
    const step = CHECK_MS / STAGES.length;
    for (let i = 1; i < STAGES.length; i++) {
      timers.current.push(setTimeout(() => setStage(i), step * i));
    }
    // Fired with the result rather than on a timer of its own, so
    // start -> result is a real completion rate and not two clocks that can
    // disagree. `result` here is the value the panel is about to render.
    timers.current.push(
      setTimeout(() => {
        setPhase("done");
        trackCalculator({
          event: "result",
          tier: result ? calculatorTier(result.topPct) : null,
        });
      }, CHECK_MS),
    );
  };

  return (
    <div className="rl-calc" id="calculator">
      <div className="rl-calc-panes">
      <div className="rl-calc-in">
      {/* Framed as the instruction rather than as a name. The card is already
          inside a section headed "The XRP Rich List Calculator", so repeating
          the name here spent the most-read line saying nothing. The sub that
          used to sit under it said the same thing a third time and is gone. */}
      <p className="rl-calc-h">
        Enter XRP, then click &ldquo;Start check&rdquo; to run the calculator.
      </p>

      <label className="rl-calc-label" htmlFor="rl-balance">
        Your XRP balance
      </label>
      <div className="rl-calc-field">
        <input
          ref={inputRef}
          id="rl-balance"
          className="rl-calc-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="e.g. 5,000"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            reset();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && parsed != null && phase !== "checking") startCheck();
          }}
          aria-describedby="rl-calc-privacy"
        />
        {/* The mark sits with the unit rather than replacing it: "XRP" is
            what tells a first-time visitor what the field wants, and a logo
            alone would make them guess. */}
        <span className="rl-calc-unit" aria-hidden="true">
          <AssetIcon asset="XRP" size={16} decorative />
          XRP
        </span>
      </div>
      <button
        type="button"
        className="rl-calc-go"
        onClick={startCheck}
        // Only while a check is running, which is the one moment pressing it
        // genuinely does nothing. It is NOT set for an empty field: assistive
        // tech and automation both treat aria-disabled as non-interactive, and
        // with no balance typed the press has a job to do, so marking it
        // disabled then would be a lie that also blocks the behaviour.
        aria-disabled={phase === "checking"}
      >
        {phase === "checking" ? "Checking" : phase === "done" ? "Check again" : "Start check"}
      </button>

      <p className="rl-calc-privacy" id="rl-calc-privacy">
        <svg
          className="rl-lock"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M4.5 7V5a3.5 3.5 0 1 1 7 0v2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <rect x="3" y="7" width="10" height="7" rx="1.6" fill="currentColor" />
        </svg>
        {/* The last clause used to read "and nothing you type is sent
            anywhere". It is gone because the page now records that a check
            ran and which percentile band it landed in. What is left is still
            exactly true: the lookup is a binary search over a build-time
            ladder and runs entirely in the browser, and the balance itself is
            never part of any payload. */}
        <span>
          No wallet connection. No address. Just a number, and an approximation
          is fine. The calculation runs in your browser against XRP Ledger
          data.
        </span>
      </p>

      </div>

      <div className="rl-calc-res">
      {/* A resting line rather than an empty half. Desktop only: stacked, the
          right pane sits under the button and a placeholder there is a gap
          with words in it. */}
      {phase === "idle" ? (
        <p className="rl-calc-rest">
          Your position on the rich list appears here once the check runs.
        </p>
      ) : null}

      {/* The live region stays mounted so a result is announced when it lands,
          but it renders nothing at idle and collapses to zero height, so there
          is no empty panel and no divider under the button until the check has
          something to say. */}
      <div className="rl-calc-out" role="status" aria-live="polite">
        {phase === "idle" ? null : phase === "checking" ? (
          <div className="rl-check">
            <div className="rl-check-bar" aria-hidden="true">
              <span style={{ animationDuration: `${CHECK_MS}ms` }} />
            </div>
            <ol className="rl-check-stages">
              {STAGES.map((label, i) => (
                <li key={label} className={i <= stage ? "is-on" : undefined}>
                  {label}
                </li>
              ))}
            </ol>
          </div>
        ) : phase === "done" && result ? (
          <>
            <p className="rl-calc-rank">
              You are in the <strong>{topPctLabel(result.topPct)}</strong>.
            </p>
            <p className="rl-calc-detail">
              A balance of {fmt(parsed ?? 0)} XRP, measured against all{" "}
              {compact(accounts)} funded XRP Ledger accounts as of {snapshotDate}.
            </p>
            <ul className="rl-calc-facts">
              <li>
                There are about <strong>{compact(result.above)}</strong> XRP
                accounts holding more XRP than that.
              </li>
              <li>
                There are about <strong>{compact(result.below)}</strong> XRP
                accounts holding less.
              </li>
            </ul>
            {/* One way on from a result rather than two.
                A rank is a "so what" moment, and the two buttons split it: one
                sent the reader back up the same page to the table they had
                already scrolled past, the other was a bare verb. A single box
                the width of the panel asks the question the rank raises and
                answers it with the best rate on the page. */}
            {topYield ? (
              <a
                className="rl-calc-earn"
                href="#bridge"
                // Same event and same destination as the button it replaced,
                // deliberately. The two buttons carried "earn-on-xrp" and
                // "top-accounts"; only the first one survives, and it still
                // goes to #bridge, so the result -> onward-click series in the
                // control room continues across this change rather than
                // restarting under a new name. The retired button simply stops
                // appearing, which is the honest way to read one box beating
                // two. Same-page anchor, so the insert is never racing an
                // unload.
                onClick={() =>
                  trackCalculator({
                    event: "cta",
                    cta: "earn-on-xrp",
                    targetUrl: "#bridge",
                  })
                }
              >
                <span className="rl-calc-earn-q">Where people earn on XRP?</span>
                <span className="rl-calc-earn-a">
                  Up to {topYield.apy.toFixed(2)}% on {topYield.platform}
                  <span className="rl-calc-earn-arrow" aria-hidden="true">&rarr;</span>
                </span>
              </a>
            ) : null}
          </>
        ) : null}
      </div>
      </div>
      </div>
    </div>
  );
}
