"use client";

// The XRP staking calculator on /report/xrp-yield-ranking.
//
// The page is titled "XRP Staking: 10+ Ways to Earn & Calculator", so the tool
// has to exist before the title ships: a title that promises something the
// page does not have sends the visitor back to the results, and that signal
// costs more than the extra click was worth.
//
// Three rules carried over from the rich-list calculator, for the same
// reasons.
//
// It never asks for a wallet address. A form requesting an address on a page
// about XRP yield reads as phishing to this community, and there is nothing an
// address would add: the arithmetic needs an amount and a rate.
//
// It computes in the browser against build-time constants. No request per
// lookup, so no amount a visitor types is transmitted or logged.
//
// It says the rate moves in the same breath as it projects it. A calculator
// that annualises one day's rate without that line is making a forecast, which
// this site does not do. The line under the result is not conditional on the
// number being large or small.
//
// The result panel carries the snapshot date exactly once, in the sentence
// that attributes the rate. An earlier version printed it in the headline, the
// detail line and both bullets, which reads as templated filler rather than as
// four separate attributions.

import { useMemo, useRef, useState } from "react";
import { AssetIcon } from "@/components/token-icons";
import { trackCalculator } from "@/lib/richlist-tracking";
import { ProductPicker } from "@/components/report/product-picker";

export interface CalcProduct {
  slug: string;
  /** Product name as the ranking table shows it, e.g. "FXRP · MXRPY". */
  label: string;
  /** Asset head and product detail, kept apart for the picker's two lines. */
  asset: string;
  detail: string | null;
  venue: string;
  chain: string;
  /** Short product type, as the ranking's Type column shows it. */
  type: string;
  /** Published rate, percent. The same figure the ranking row shows. */
  rate: number;
  /** Rate range over the trailing 30 days, percent, when history supports it. */
  min30: number | null;
  max30: number | null;
  /** Fixed-rate Principal Tokens do not float, so they are worded differently. */
  fixed: boolean;
  /**
   * Which third of the rated field this product's rate falls in.
   *
   * A rate on its own tells a reader nothing about whether it is good: 4.20%
   * is either the best on the page or the middle of it, and only the ranking
   * says which. Thirds rather than a rank position, because "3rd of 12" reads
   * as a leaderboard and invites the reader to chase the top row.
   */
  band: "top" | "mid" | "low" | null;
}

const BAND_LABEL: Record<"top" | "mid" | "low", string> = {
  top: "top third",
  mid: "middle third",
  low: "bottom third",
};

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const xrpAmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 2 : 0 });

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,\s_]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function XrpStakingCalculator({
  products,
  asOf,
  xrpUsd,
  total,
  sourcePage,
  ctaHref = "#ranking",
  ctaLabel = "See every product in the ranking",
}: {
  products: CalcProduct[];
  asOf: string;
  /** XRP price in dollars. The dollar line is dropped when it is absent. */
  xrpUsd: number | null;
  /** How many rated products the ranking holds, for the band sentence. */
  total: number;
  /** Set when the calculator is embedded on a page that is not its own, so
   *  its events do not land in the host page's funnel. */
  sourcePage?: string;
  /** Where the button under a result goes. On the ranking page that is the
   *  table below; embedded elsewhere it has to be the report itself. */
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const [raw, setRaw] = useState("");
  const [slug, setSlug] = useState(products[0]?.slug ?? "");
  const [shown, setShown] = useState<{ amount: number; product: CalcProduct } | null>(
    null,
  );

  const product = useMemo(
    () => products.find((p) => p.slug === slug) ?? products[0],
    [products, slug],
  );
  const amount = parseAmount(raw);
  const outRef = useRef<HTMLDivElement | null>(null);

  /**
   * Scroll to the answer after a Calculate press on a phone, where the result
   * renders below the form and off screen. Centred when the panel fits, so
   * the headline and the CTA are both visible; top-aligned when it does not.
   */
  function revealResult() {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 900px)").matches) return;
    // Two frames: commit, then layout, before measuring.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = outRef.current;
        if (!el) return;
        const box = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const HEADROOM = 76; // clears the sticky header
        
        const fits = box.height + HEADROOM + 16 <= vh;
        const top = fits
          ? window.scrollY + box.top - (vh - box.height) / 2
          : window.scrollY + box.top - HEADROOM;
        window.scrollTo({
          top: Math.max(0, top),
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
      }),
    );
  }

  function calculate() {
    // Never gated on a parsed amount. The button is always live, so pressing
    // it with an empty field has to do something other than nothing: it falls
    // back to 10,000, which is also the amount the FAQ answers against.
    const a = amount ?? 10_000;
    if (!raw.trim()) setRaw("10,000");
    if (!product) return;
    trackCalculator({ event: "start", sourcePage });
    setShown({ amount: a, product });
    trackCalculator({ event: "result", tier: product.slug, sourcePage });
    revealResult();
  }

  if (!products.length) return null;

  const earned = shown ? shown.amount * (shown.product.rate / 100) : 0;

  return (
    <div className="rp-calc" data-nosnippet="">
      <div className="rp-calc-panes">
        <div className="rp-calc-in">
          <p className="rp-calc-h">
            Enter an XRP amount, pick a product, then calculate.
          </p>

          <label className="rp-calc-label" htmlFor="rp-amount">
            Amount in XRP
          </label>
          <div className="rp-calc-field">
            <input
              id="rp-amount"
              className="rp-calc-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="10,000"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") calculate();
              }}
              aria-describedby="rp-calc-privacy"
            />
            <span className="rp-calc-unit" aria-hidden="true">
              <AssetIcon asset="XRP" size={16} decorative />
              XRP
            </span>
          </div>

          <span className="rp-calc-label" id="rp-product-label">
            Product
          </span>
          <ProductPicker
            label="Product"
            options={products}
            value={slug}
            onChange={setSlug}
          />

          <button type="button" className="rp-calc-go" onClick={calculate}>
            Calculate
          </button>

          <p className="rp-calc-privacy" id="rp-calc-privacy">
            No wallet connection and no address. The calculation runs in your
            browser against the rates on this page. Educational only, not
            advice, an offer or a forecast.
          </p>
        </div>

        <div className="rp-calc-res">
          {!shown ? (
            <p className="rp-calc-rest">Results appear here once you calculate.</p>
          ) : null}

          <div className="rp-calc-out" role="status" aria-live="polite" ref={outRef}>
            {shown ? (
              <>
                {/* The date appears once in this panel, in the sentence that
                    attributes the rate. It used to run four times across a
                    headline, a detail line and two bullets, which is the
                    stutter the /usdc hub was rebuilt to get rid of: the reader
                    is looking at one reading of one rate, so it is dated once
                    and the rest of the panel gets on with the answer. */}
                <p className="rp-calc-headline">
                  You might earn about <strong>{xrpAmt(earned)} XRP</strong> a
                  year
                </p>
                <p className="rp-calc-detail">
                  {xrpAmt(shown.amount)} XRP supplied into the{" "}
                  {shown.product.label} on {shown.product.venue} would earn
                  about {xrpAmt(earned)} XRP over a year at the prevailing{" "}
                  {shown.product.rate.toFixed(2)}% recorded as of {asOf}.
                </p>
                <ul className="rp-calc-facts">
                  {xrpUsd != null ? (
                    <li>
                      At the current XRP price, that comes to about{" "}
                      <strong>${money(earned * xrpUsd)}</strong> over the year.
                    </li>
                  ) : null}
                  {shown.product.band ? (
                    <li>
                      Among the {total} XRP products tracked here, this one
                      sits in the{" "}
                      <strong>{BAND_LABEL[shown.product.band]}</strong> by rate.
                    </li>
                  ) : null}
                </ul>
                {/* Kept, and kept small. Annualising a single reading without
                    saying the rate moves is a forecast, and this site does not
                    make those; it is a line rather than a third bullet because
                    it qualifies the whole panel rather than adding a finding. */}
                <p className="rp-calc-foot">
                  {shown.product.fixed
                    ? "That rate is fixed to the product's maturity rather than floating, but its market price moves, so this is one reading annualised rather than a forecast."
                    : "Rates here move with borrower demand and with reward programs that start and stop, so this is one reading annualised rather than a forecast."}
                </p>
                {/* Same-page anchor, so the insert is never racing an
                    unload. Without it the result -> ranking half of this
                    tool's funnel would record nothing, which is the number
                    that says whether the calculator feeds the report or ends
                    the visit. */}
                <a
                  className="rp-calc-cta"
                  href={ctaHref}
                  onClick={() =>
                    trackCalculator({
                      event: "cta",
                      cta: "see-ranking",
                      targetUrl: ctaHref,
                      sourcePage,
                    })
                  }
                >
                  {ctaLabel}
                  {/* Down when the target is further down this page, right
                      when it is another page. An arrow that points the wrong
                      way is a small promise the click does not keep. */}
                  <span aria-hidden="true">
                    {ctaHref.startsWith("#") ? "↓" : "→"}
                  </span>
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
