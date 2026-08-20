// The product list behind the XRP staking calculator, built once.
//
// The calculator now appears on two pages: /report/xrp-yield-ranking, where it
// belongs to the ranking, and /xrp-rich-list, where a switch above the rich
// list calculator flips to it. Both must offer the same products at the same
// rates, because a reader who sees 4.20% on one page and 3.89% on the other
// has caught the site contradicting itself, and there is no way to tell from
// the outside which one is wrong.
//
// So the list is assembled here, from data/xrp-yield.json, and both pages ask
// for it rather than deriving it. The rate is histRate, the same figure every
// ranking row renders, which is what keeps the tool from quoting a number the
// table beneath it does not show.
//
// The small helpers below (histRate, productTypeOf, typeLabel) are duplicated
// from the report page, which uses them for a dozen other things and cannot
// hand them over without a much larger refactor. They are stable one-liners
// over the same feed; the thing that would actually drift, the product list
// itself, is defined only here.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { CalcProduct } from "@/components/report/xrp-staking-calculator";

/** Only the fields the calculator needs; the feed carries many more. */
interface Pool {
  id: string;
  chain: string;
  project: string | null;
  platform: string;
  category: string | null;
  symbol: string;
  asset?: string | null;
  displayName?: string | null;
  detail?: string | null;
  exposure: string | null;
  productType?: string | null;
  venueSlug?: string | null;
  apy: number | null;
  apyMean30d: number | null;
  rateNa?: boolean | null;
  history?: { d: string; apy: number | null }[] | null;
}

const histRate = (p: Pool) => p.apyMean30d ?? p.apy;

const nice = (s: string) =>
  s
    .replace(/STXRP/gi, "stXRP")
    .replace(/CBXRP/gi, "cbXRP")
    .replace(/\bWXRP\b/gi, "wXRP")
    .replace(/CSXRP/gi, "csXRP")
    .replace(/SXRP/gi, "sXRP");

const assetHead = (p: Pool) => p.asset ?? nice(p.displayName ?? p.symbol);

function productTypeOf(p: Pool): string {
  const t = (p.productType || "").toLowerCase();
  if (t.includes("fixed-rate") || t.includes("principal")) return "Fixed-rate";
  if (t.includes("lending")) return "Lending market";
  if (t.includes("fixed")) return "Fixed-term pool";
  if (t.includes("vault")) return "Vault";
  if (t.includes("pool")) return "Liquidity pool";
  const c = (p.category || "").toLowerCase();
  const proj = (p.project || "").toLowerCase();
  if (c.includes("fixed-rate") || c.includes("principal")) return "Fixed-rate";
  if (c.includes("lending")) return "Lending market";
  if (proj.startsWith("spectra-v2") || (c === "yield" && p.exposure === "single"))
    return "Fixed-term pool";
  if (
    c.includes("aggregator") ||
    c.includes("allocator") ||
    c.includes("curator") ||
    c.includes("metavault") ||
    c === "yield"
  )
    return "Vault";
  if (c.includes("dex")) return "Liquidity pool";
  return p.exposure === "single" ? "Vault" : "Liquidity pool";
}

function typeLabel(p: Pool): string {
  const k = productTypeOf(p);
  if (k === "Lending market") return "Lending";
  if (k === "Fixed-rate") return "Fixed-Rate PT";
  if (k === "Fixed-term pool") return "Fixed-Term";
  if (k === "Vault") return "Vault";
  return "Pool";
}

/**
 * XRP price in dollars, for the calculator's dollar line only.
 *
 * Defensive rather than required: a missing file, a missing field or a
 * nonsense value drops the dollar line and the calculator still works in XRP,
 * which is the unit the reader typed.
 */
function loadXrpPrice(): number | null {
  try {
    const f = join(process.cwd(), "data", "xrp-richlist.json");
    if (!existsSync(f)) return null;
    const d = JSON.parse(readFileSync(f, "utf-8")) as { xrpUsd?: number };
    return typeof d.xrpUsd === "number" && d.xrpUsd > 0 ? d.xrpUsd : null;
  } catch {
    return null;
  }
}

export interface StakingCalcData {
  products: CalcProduct[];
  /** Snapshot date, already formatted for prose. */
  asOf: string;
  xrpUsd: number | null;
}

export function loadStakingCalcData(): StakingCalcData | null {
  try {
    const f = join(process.cwd(), "data", "xrp-yield.json");
    if (!existsSync(f)) return null;
    const d = JSON.parse(readFileSync(f, "utf-8")) as {
      generatedAt: string;
      pools: Pool[];
    };
    if (!Array.isArray(d.pools) || !d.pools.length) return null;

    const stamp = new Date(d.generatedAt).getTime();
    const rated = d.pools.filter((p) => !p.rateNa && histRate(p) != null);
    if (!rated.length) return null;

    // The 30-day range comes from each product's own rate history rather than
    // from range90d, because the sentence beside the result says "30 days" and
    // a 90-day window under a 30-day label is a wider range than the words
    // claim. Too little history carries nulls and the calculator says so.
    const range30 = (p: Pool): { min: number | null; max: number | null } => {
      const cut = stamp - 30 * 86_400_000;
      const vals = (p.history ?? [])
        .filter(
          (h) =>
            Number.isFinite(h.apy) && new Date(`${h.d}T00:00:00Z`).getTime() >= cut,
        )
        .map((h) => h.apy as number);
      if (vals.length < 2) return { min: null, max: null };
      return { min: Math.min(...vals), max: Math.max(...vals) };
    };

    // Which third of the field a rate falls in, taken on rate alone rather
    // than on the display order below, which puts single-asset products first
    // regardless of rate. A reader asking "is 4.20% good" is asking about the
    // rate, not about the sort.
    const byRate = [...rated].sort((a, b) => (histRate(b) ?? 0) - (histRate(a) ?? 0));
    const bandOf = (p: Pool): "top" | "mid" | "low" | null => {
      const i = byRate.indexOf(p);
      if (i < 0 || byRate.length < 3) return null;
      return i < byRate.length / 3 ? "top" : i < (byRate.length * 2) / 3 ? "mid" : "low";
    };

    // Highest-rate single-asset product first, so the default selection is a
    // position a reader could take with XRP alone. Everything else follows by
    // rate, two-asset pools included but never defaulted to.
    const rank = (p: Pool) =>
      (p.exposure === "single" ? 1_000_000 : 0) + (histRate(p) ?? 0);

    const products: CalcProduct[] = [...rated]
      .sort((a, b) => rank(b) - rank(a))
      .map((p) => {
        const r = range30(p);
        return {
          slug: p.venueSlug ?? p.id,
          asset: assetHead(p),
          detail: p.detail ?? null,
          label: p.detail ? `${assetHead(p)} · ${p.detail}` : assetHead(p),
          venue: p.platform,
          chain: p.chain,
          type: typeLabel(p),
          rate: histRate(p) as number,
          min30: r.min,
          max30: r.max,
          fixed: productTypeOf(p) === "Fixed-rate",
          band: bandOf(p),
        };
      });

    return {
      products,
      asOf: new Date(stamp).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }),
      xrpUsd: loadXrpPrice(),
    };
  } catch {
    return null;
  }
}
