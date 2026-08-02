"use client";

// The USDC earnings calculator on /usdc.
//
// Layout mirrors the /xrp-rich-list calculator: inputs on the left, results on
// the right, stacking on a phone. What it computes is different, and the
// arithmetic is the part worth reading.
//
// COMPOUNDING. The rate this page publishes is an APY, which already encodes
// the strategy's own harvesting and reinvestment. Multiplying it by an amount
// and calling the result "compounded", then showing the same number again as
// "not compounded", would be two labels on one figure. The honest split runs
// the other way: the APY is the compounded outcome, and the simple figure is
// the nominal rate underneath it, which is what the position earns if the
// yield is taken out as it accrues rather than left to grow.
//
//   nominal = 365 * ((1 + APY) ^ (1/365) - 1)
//
// At 11.23% APY that is 10.64% nominal, so 10,000 USDC earns $1,123 left to
// compound and $1,064 taken out. Both figures are real and they differ for a
// reason a reader can act on.
//
// The whole card carries data-nosnippet. It is a tool, not prose, and the
// product list would otherwise put 54 undated rate figures into the page's
// extractable text, which is the problem the stat tiles were removed for.

import { useMemo, useState } from "react";
import { AssetIcon } from "@/components/token-icons";

export interface CalcProduct {
  slug: string;
  name: string;
  apy: number;
  chain: string;
  appUrl: string;
}

const money = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

const money2 = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Nominal annual rate implied by a quoted APY, compounded daily. */
function nominalFromApy(apyPct: number): number {
  const apy = apyPct / 100;
  if (!(apy > -1)) return 0;
  return 365 * (Math.pow(1 + apy, 1 / 365) - 1) * 100;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,\s_]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function UsdcCalculator({
  products,
  asOf,
}: {
  products: CalcProduct[];
  asOf: string;
}) {
  const [raw, setRaw] = useState("");
  const [slug, setSlug] = useState(products[0]?.slug ?? "");
  const [shown, setShown] = useState<{ amount: number; product: CalcProduct } | null>(null);

  const product = useMemo(
    () => products.find((p) => p.slug === slug) ?? products[0],
    [products, slug],
  );
  const amount = parseAmount(raw);

  const result = useMemo(() => {
    if (!shown) return null;
    const { amount: a, product: p } = shown;
    const compounded = a * (p.apy / 100);
    const simple = a * (nominalFromApy(p.apy) / 100);
    return {
      compounded,
      simple,
      balance: a + compounded,
      nominal: nominalFromApy(p.apy),
      monthly: compounded / 12,
    };
  }, [shown]);

  function calculate() {
    // Never gated on a parsed amount. The button is always live, so pressing
    // it with an empty field has to do something other than nothing: it falls
    // back to 10,000, which is also the figure the FAQ answers against.
    const a = amount ?? 10_000;
    if (!raw.trim()) setRaw("10,000");
    if (product) setShown({ amount: a, product });
  }

  if (!products.length) return null;

  return (
    <div className="uh-calc" data-nosnippet="">
      <div className="uh-calc-panes">
        <div className="uh-calc-in">
          <p className="uh-calc-h">
            Enter an amount, pick a strategy, then calculate.
          </p>

          <label className="uh-calc-label" htmlFor="uh-amount">
            Amount in USDC
          </label>
          <div className="uh-calc-field">
            <input
              id="uh-amount"
              className="uh-calc-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="10,000"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") calculate();
              }}
            />
            <span className="uh-calc-unit" aria-hidden="true">
              <AssetIcon asset="USDC" size={16} decorative />
              USDC
            </span>
          </div>

          <label className="uh-calc-label" htmlFor="uh-product">
            Strategy
          </label>
          <div className="uh-calc-field uh-calc-field--select">
            <select
              id="uh-product"
              className="uh-calc-select"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name} · {p.apy.toFixed(2)}% APY
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="uh-calc-go" onClick={calculate}>
            Calculate earnings
          </button>

          <p className="uh-calc-note">
            Educational only. The figures extrapolate one day&rsquo;s rate across a
            full year and assume it holds, which no onchain rate does. Rates move
            with borrower demand, with reward programs that start and stop, and
            with how much liquidity sits in a strategy at the time. A large
            enough amount can move the rate it earns. Nothing here is advice, an
            offer, or a forecast.
          </p>
          {/* Fees. The card quantifies a year of earnings, so leaving the
              deduction unquantified is the weakest disclosure on the page. No
              fee figure is published anywhere on the site, so this names that a
              performance fee applies and which vaults it covers rather than
              inventing a rate, and points at where the model is described. */}
          <p className="uh-calc-note">
            Every figure here is gross of fees. Harvest charges a performance fee
            on the vaults it operates, which is every strategy in this index, so
            a realised amount is lower than the one shown. How that model works
            is set out on the{" "}
            <a href="/about#how-we-operate">about page</a>.
          </p>
        </div>

        <div className="uh-calc-res">
          {!result ? (
            <p className="uh-calc-rest">
              Results appear here once you calculate.
            </p>
          ) : null}

          <div className="uh-calc-out" role="status" aria-live="polite">
            {result && shown ? (
              <>
                <p className="uh-calc-headline">
                  Projected balance in a year:{" "}
                  <strong>${money2(result.balance)}</strong>
                </p>
                <p className="uh-calc-detail">
                  {money(shown.amount)} USDC in {shown.product.name} at{" "}
                  {shown.product.apy.toFixed(2)}% APY, the rate recorded as of {asOf}.
                </p>
                <ul className="uh-calc-facts">
                  <li>
                    Left to compound, the position earns{" "}
                    <strong>${money2(result.compounded)}</strong> over a year. The
                    quoted APY already assumes the strategy harvests and reinvests
                    on its own schedule.
                  </li>
                  <li>
                    Taken out as it accrues, it earns{" "}
                    <strong>${money2(result.simple)}</strong> over the same year,
                    which is the {result.nominal.toFixed(2)}% nominal rate
                    underneath that APY.
                  </li>
                  <li>
                    Compounding is worth{" "}
                    <strong>${money2(result.compounded - result.simple)}</strong> of
                    the difference on this amount.
                  </li>
                  <li>
                    Averaged across twelve months that is about{" "}
                    <strong>${money2(result.monthly)}</strong> a month, before any
                    rate change.
                  </li>
                </ul>
                <a
                  className="uh-calc-cta"
                  href={shown.product.appUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open {shown.product.name} in the app
                  <span aria-hidden="true">↗</span>
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
