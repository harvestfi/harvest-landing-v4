"use client";

// Animated figure for the leveraged-looping paragraph on /eth.
//
// A loop is the one ETH strategy whose mechanism does not survive being
// written down, so the figure draws a real one: WETH Looping on Base, which
// routes WETH into cbETH, supplies it on Aave V3 in E-mode, borrows WETH
// against it and folds the loop to a 92% target LTV. The frames follow the
// vault's own page: the route, the leverage climbing fold by fold, the
// position (collateral, debt, equity), the LTV against its liquidation line,
// and the carry that is left once the borrow cost is paid.
//
// The figures are a dated snapshot of the vault's details page, labelled as
// such, not a live feed: they explain the mechanism and are not quoted
// anywhere else on the page.
//
// Drawn in the social-card style: an orange dotted canvas holding a header,
// one dark brown panel and a footer note. Inside the panel the chart is one
// series in brand orange, what has not grown at reduced strength, and a faint
// "Harvest" watermark sits top-left over empty space, clear of every mark.
//
// SVG and CSS rather than video: sharp at any width, a few KB, and it starts
// only when scrolled into view. With reduced motion it renders the finished
// state and does not move.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AssetIcon } from "@/components/token-icons";

// Snapshot of the vault's details page.
const SNAPSHOT = "Oct 22, 2026";
const LEVERAGE = 12.6;
const TARGET_LTV = 92;
const LIQ_LTV = 95;
const STAKE = 2.28; // cbETH staking yield, %
const BORROW = 2.02; // WETH borrow APR, %
const LIVE_APY = 5.43;
const COLL = 344_077; // $ of cbETH collateral
const DEBT = 316_700; // $ of WETH debt
const EQUITY = 27_378;
const COLL_CBETH = 125.55;
const DEBT_WETH = 131.99;

// Leverage after each fold at 92% LTV: 1, 1.92, 3.53, 6.69, 9.02, 11.6, then
// the target the vault rebalances to.
const FOLDS = [1, 1.92, 3.53, 6.69, 9.02, 11.6, LEVERAGE];

const k = (usd: number) => `$${(usd / 1000).toFixed(1)}K`;
const EARNED = (COLL * STAKE) / 100;
const PAID = (DEBT * BORROW) / 100;
const KEPT = EARNED - PAID;

// Beats, in ms from the start: the route, six folds, the position, the LTV,
// then the carry.
const BEATS = [300, 1000, 1450, 1900, 2350, 2800, 3250, 3700, 4500, 5300, 6100];
const HOLD = 6000;
const LAST = BEATS.length - 1;
const POS = 7;
const GAUGE = 8;
const CARRY = 9;

// Left column bars: px per dollar of collateral.
const W = 430;
const px = (usd: number) => (usd / COLL) * W;
// LTV track: 80% to 96% across the right column.
const tx = (ltv: number) => 520 + ((ltv - 80) / 16) * 440;

export function EthLoopFigure({ vaultHref }: { vaultHref?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(-1);
  const [run, setRun] = useState(0);
  const [reduced, setReduced] = useState(false);
  // On a phone the two columns stack, so the drawing fits without scrolling.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      setStep(LAST);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let timers: number[] = [];
    // The observer fires again whenever layout shifts (sparklines and fonts
    // load below the figure), so it starts a run only when none is going, and
    // a run keeps looping once started.
    let playing = false;
    const play = () => {
      timers.forEach(clearTimeout);
      timers = [];
      playing = true;
      setStep(-1);
      BEATS.forEach((t, i) => timers.push(window.setTimeout(() => setStep(i), t)));
      timers.push(window.setTimeout(play, BEATS[LAST] + HOLD));
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !playing) play();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [run]);

  const fold = Math.max(0, Math.min(step, FOLDS.length - 1));
  const lev = step >= 1 ? FOLDS[fold] : 1;
  const on = (beat: number) => (step >= beat ? " is-in" : "");
  const chips = [
    { t: "WETH", w: 74 },
    { t: "cbETH", w: 84 },
    { t: "Supply", w: 86 },
    { t: "Borrow ↻", w: 104 },
  ];
  let cx = 0;

  return (
    <figure
      ref={ref}
      className={`eh-fig${step >= LAST ? " is-done" : ""}${reduced ? " is-static" : ""}`}
      aria-labelledby="loop-fig-title"
      // The animated labels are frames of a drawing, not claims; keep them out
      // of search snippets. The <desc> carries the one-sentence summary.
      data-nosnippet=""
    >
      <header className="eh-fig-head">
        <div className="eh-fig-title">
          <p className="eh-fig-eyebrow">Leveraged looping · Aave V3 E-mode</p>
          <div className="eh-fig-titlerow">
            <AssetIcon asset="ETH" size={44} />
            <h3 id="loop-fig-title">{`How a ${LEVERAGE}× loop earns ${LIVE_APY}%`}</h3>
          </div>
        </div>
        <p className="eh-fig-meta">
          <span>WETH Looping · Base</span>
          <strong>{SNAPSHOT}</strong>
        </p>
      </header>

      <div className="eh-fig-panel">
        <p className="eh-fig-label">cbETH / ETH loop · vault snapshot</p>
        <svg
          viewBox={narrow ? "0 0 480 1010" : "0 0 960 540"}
          className="eh-fig-svg"
          role="img"
          aria-labelledby="loop-fig-desc"
        >
          <desc id="loop-fig-desc">
            {`WETH Looping on Base routes WETH into cbETH, supplies it on Aave V3 in E-mode, ` +
              `borrows WETH against it and folds to ${LEVERAGE}x leverage at a ${TARGET_LTV}% ` +
              `target LTV, below a ${LIQ_LTV}% liquidation LTV. With a ${STAKE}% cbETH staking ` +
              `yield and a ${BORROW}% WETH borrow rate, about ${k(COLL)} of collateral against ` +
              `${k(DEBT)} of debt leaves ${k(EQUITY)} of equity earning a live ${LIVE_APY}% APY, ` +
              `as of ${SNAPSHOT}.`}
          </desc>

          {/* Watermark: top-left, over the empty band above the drawing. */}
          <text x="0" y="92" className="lf-mark" aria-hidden="true">
            Harvest
          </text>

          {/* ---- left: route, leverage, position ---- */}
          <g transform={narrow ? "translate(25 0)" : undefined}>
            <g className={`lf-route${on(0)}`}>
              {chips.map((c, i) => {
                const x = cx;
                cx += c.w + 22;
                return (
                  <g key={c.t} style={{ transitionDelay: `${i * 0.12}s` }} className="lf-chip">
                    <rect x={x} y="128" width={c.w} height="36" rx="18" />
                    <text x={x + c.w / 2} y="151" textAnchor="middle" className="lf-chip-t">
                      {c.t}
                    </text>
                    {i < chips.length - 1 ? (
                      <text x={x + c.w + 11} y="151" textAnchor="middle" className="lf-arrow">
                        →
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>

            <text x="0" y="222" className="lf-lab">
              Live leverage
            </text>
            <text x="0" y="296" className="lf-lev-big">{`${lev.toFixed(lev < 10 ? 2 : 1)}×`}</text>
            <text x={W} y="296" textAnchor="end" className="lf-lab">
              {step >= FOLDS.length - 1 ? `Target LTV ${TARGET_LTV}%` : "Folding"}
            </text>

            <text x="0" y="350" className="lf-lab">
              Position on Aave V3
            </text>
            {[
              { y: 376, t: `Collateral · ${COLL_CBETH} cbETH`, v: COLL, c: "lf-bar-coll" },
              { y: 424, t: `Debt · ${DEBT_WETH} WETH`, v: DEBT, c: "lf-bar-debt" },
              { y: 472, t: "Net equity", v: EQUITY, c: "lf-bar-eq" },
            ].map((r, i) => (
              <g key={r.t} className={`lf-pos${on(POS)}`} style={{ transitionDelay: `${i * 0.15}s` }}>
                <text x="0" y={r.y} className="lf-row-t">
                  {r.t}
                </text>
                <text x={W} y={r.y} textAnchor="end" className="lf-row-v">
                  {k(r.v)}
                </text>
                <rect x="0" y={r.y + 10} width={Math.max(px(r.v), 6)} height="14" rx="7" className={r.c} />
              </g>
            ))}
          </g>

          {/* ---- right: live APY, LTV, carry ---- */}
          <g transform={narrow ? "translate(-495 470)" : undefined}>
            <text x="520" y="150" className="lf-lab">
              Live APY
            </text>
            <text x="520" y="226" className={`lf-apy${on(CARRY)}`}>{`${LIVE_APY}%`}</text>

            <g className={`lf-gauge${on(GAUGE)}`}>
              <text x="520" y="282" className="lf-lab">
                LTV
              </text>
              <rect x="520" y="300" width="440" height="10" rx="5" className="lf-track" />
              <rect x="520" y="300" width={tx(TARGET_LTV) - 520} height="10" rx="5" className="lf-fill" />
              <line x1={tx(LIQ_LTV)} x2={tx(LIQ_LTV)} y1="292" y2="318" className="lf-liq" />
              <text x="520" y="340" className="lf-tick-t">
                80%
              </text>
              <text x={tx(TARGET_LTV)} y="340" textAnchor="end" className="lf-tick-t lf-tick-hi">
                {`Target ${TARGET_LTV}%`}
              </text>
              <text x="960" y="340" textAnchor="end" className="lf-tick-t">
                {`Liq. ${LIQ_LTV}%`}
              </text>
            </g>

            <g className={`lf-carry${on(CARRY)}`}>
              <text x="520" y="392" className="lf-lab">
                Carry at these rates, a year
              </text>
              <text x="520" y="426" className="lf-row-t">{`cbETH staking ${STAKE}% on ${k(COLL)}`}</text>
              <text x="960" y="426" textAnchor="end" className="lf-row-v">{`+${k(EARNED)}`}</text>
              <text x="520" y="462" className="lf-row-t">{`WETH borrow ${BORROW}% on ${k(DEBT)}`}</text>
              <text x="960" y="462" textAnchor="end" className="lf-row-v lf-dim">{`−${k(PAID)}`}</text>
              <line x1="520" x2="960" y1="480" y2="480" className="lf-rule" />
              <text x="520" y="512" className="lf-row-t lf-strong">{`Kept on ${k(EQUITY)} of equity`}</text>
              <text x="960" y="512" textAnchor="end" className="lf-row-v lf-hi">{`+${k(KEPT)}`}</text>
            </g>
          </g>
        </svg>
      </div>

      <footer className="eh-fig-foot">
        <p className="eh-fig-note">
          {`Snapshot of the vault page on ${SNAPSHOT}. The fold multiplies the spread between ` +
            `staking yield and borrow cost, and the liquidation risk by the same leverage; the vault ` +
            `deleverages when its health factor nears 1.001.`}
          {vaultHref ? (
            <>
              {" "}
              <Link href={vaultHref}>See the vault</Link>.
            </>
          ) : null}
        </p>
        {!reduced ? (
          <button type="button" className="eh-fig-replay" onClick={() => setRun((r) => r + 1)}>
            Replay
          </button>
        ) : null}
      </footer>
    </figure>
  );
}
