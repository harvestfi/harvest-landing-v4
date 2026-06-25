// Control room > DATA > Product Data. A data-quality dashboard for the
// data team: one row per product showing how many indexed points we hold
// for each key series (TVL, APY, share price) against the vault's age, so
// it's obvious which products need a backfill / daily snapshot at the
// subgraph level. All figures come from the same data/history.json we
// build from the clownfish indexer - no live fetch.

import { getVaults, loadHistoryFile } from "@/lib/data";
import {
  ProductDataTable,
  type ProductDataRow,
  type SeriesDiag,
  type SeriesHealth,
  type DataStatus,
} from "@/components/product-data-table";
import "../../_styles/asset-hub.css";

// Where each chain's history is pulled from (clownfish, keyed by chain id).
// Mirrors CHAIN_IDS in scripts/fetch-data.mjs so the intel row tells the data
// team exactly which endpoint served (or failed to serve) a product.
const HISTORY_BASE = "https://clownfish-app-2dsdk.ondigitalocean.app";
const CHAIN_ID: Record<string, string> = {
  Ethereum: "1",
  Polygon: "137",
  Arbitrum: "42161",
  Base: "8453",
  zkSync: "324",
  HyperEVM: "999",
};
const SERIES_ENTITY: Record<SeriesDiag["key"], string> = {
  TVL: "tvls",
  APY: "apyAutoCompounds",
  Share: "vaultHistories",
};

// Build the per-series ingestion verdict: how many points came back, the
// indexed span, density vs the vault's age, and a short note flagging what's
// off (sparse, starts after deploy, or stops before the freshest series).
function buildDiag(
  key: SeriesDiag["key"],
  points: { timestamp: number }[],
  deploymentTs: number | null,
  latestTs: number | null,
  ageDays: number,
): SeriesDiag {
  const ts = points
    .map((p) => p.timestamp)
    .filter((t) => Number.isFinite(t) && t > 0)
    .sort((a, b) => a - b);
  const count = ts.length;
  const firstTs = count ? ts[0] : null;
  const lastTs = count ? ts[count - 1] : null;
  const perDay = count / Math.max(ageDays, 1);
  const DAY = 86400;
  const startsLate =
    firstTs !== null && deploymentTs !== null && firstTs > deploymentTs + 14 * DAY;
  const stale =
    lastTs !== null && latestTs !== null && lastTs < latestTs - 14 * DAY;
  const sparse = count > 0 && perDay < 0.8;
  const missing = count === 0;
  const off = missing || sparse || startsLate || stale;

  let note: string;
  if (missing) {
    note = "no data returned from endpoint";
  } else {
    const parts: string[] = [];
    if (sparse) parts.push(`sparse (~${perDay.toFixed(2)}/day)`);
    if (startsLate && firstTs !== null && deploymentTs !== null)
      parts.push(`starts ${Math.round((firstTs - deploymentTs) / DAY)}d after deploy`);
    if (stale && lastTs !== null && latestTs !== null)
      parts.push(`ends ${Math.round((latestTs - lastTs) / DAY)}d before latest`);
    note = parts.length ? parts.join(" · ") : "daily, full span";
  }
  return {
    key,
    entity: SERIES_ENTITY[key],
    points: count,
    firstTs,
    lastTs,
    perDay,
    off,
    note,
  };
}

// Coverage = indexed points / vault age in days. A daily-snapshotted
// series sits near 1.0; a series that only spans part of the vault's life
// (or is event-driven and sparse) drops well below it. Thresholds are
// deliberately forgiving so only genuinely thin series flag red.
// Health is judged on continuity + freshness, not strict daily density.
// The subgraph is event-driven, so a healthy series can run ~every other
// day rather than exactly once a day; what actually matters is that it's
// fresh (a recent point) and continuous (covers the vault's life without
// big holes). So: a stale series (no point in 3 weeks) is always "needs
// fix" however dense its old data; otherwise we grade on coverage with
// forgiving thresholds — ~every-other-day, fresh and full-span reads as
// "good", near-daily as "dense", and only genuinely holey series flag red.
function healthFor(
  points: number,
  ageDays: number,
  lastTs: number | null,
  now: number,
): SeriesHealth {
  if (points <= 0) return "missing";
  const freshDays = lastTs ? (now - lastTs) / 86400 : Infinity;
  if (freshDays > 21) return "sparse"; // stale: no recent data
  const coverage = points / Math.max(ageDays, 1);
  if (coverage < 0.2) return "sparse"; // fresh but holey
  if (coverage < 0.45) return "partial"; // ~every 3+ days
  if (coverage < 0.85) return "good"; // ~every other day, continuous
  return "dense"; // near-daily
}

const SEVERITY: Record<SeriesHealth, number> = {
  missing: 0,
  sparse: 1,
  partial: 2,
  good: 3,
  dense: 4,
};

// Roll the three series up to one status, driven by the weakest series:
// any missing/sparse series = the product needs a fix; a partial series =
// non-urgent; all good = good standing; all dense (near-daily) = perfect.
function statusFor(healths: SeriesHealth[]): DataStatus {
  const worst = Math.min(...healths.map((h) => SEVERITY[h]));
  if (worst <= SEVERITY.sparse) return "critical";
  if (worst === SEVERITY.partial) return "minor";
  if (worst === SEVERITY.good) return "good";
  return "perfect";
}

export default async function ProductDataPage() {
  const vaults = await getVaults();
  const history = loadHistoryFile() ?? {};
  const now = Math.floor(Date.now() / 1000); // freshness reference (build time)

  const rows: ProductDataRow[] = vaults.map((v) => {
    const h =
      history[v.contractAddress] ??
      history[v.contractAddress.toLowerCase()] ?? {
        apyHistory: [],
        tvlHistory: [],
        sharePriceHistory: [],
      };
    const allTs = [
      ...h.apyHistory,
      ...h.tvlHistory,
      ...h.sharePriceHistory,
    ]
      .map((p) => p.timestamp)
      .filter((t) => Number.isFinite(t) && t > 0);
    const deploymentTs = allTs.length ? Math.min(...allTs) : null;
    const lastTs = allTs.length ? Math.max(...allTs) : null;
    const ageDays =
      deploymentTs && lastTs
        ? Math.round((lastTs - deploymentTs) / 86400)
        : 0;

    const tvlPoints = h.tvlHistory.length;
    const apyPoints = h.apyHistory.length;
    const spPoints = h.sharePriceHistory.length;
    const lastOf = (pts: { timestamp: number }[]): number | null =>
      pts.length ? Math.max(...pts.map((p) => p.timestamp)) : null;
    const tvlHealth = healthFor(tvlPoints, ageDays, lastOf(h.tvlHistory), now);
    const apyHealth = healthFor(apyPoints, ageDays, lastOf(h.apyHistory), now);
    const spHealth = healthFor(spPoints, ageDays, lastOf(h.sharePriceHistory), now);

    const chainId = CHAIN_ID[v.chain] ?? "?";
    const diag: SeriesDiag[] = [
      buildDiag("TVL", h.tvlHistory, deploymentTs, lastTs, ageDays),
      buildDiag("APY", h.apyHistory, deploymentTs, lastTs, ageDays),
      buildDiag("Share", h.sharePriceHistory, deploymentTs, lastTs, ageDays),
    ];

    return {
      slug: v.slug,
      network: v.chain,
      productName: v.productName,
      deploymentTs,
      ageDays,
      tvlPoints,
      apyPoints,
      spPoints,
      tvlHealth,
      apyHealth,
      spHealth,
      status: statusFor([tvlHealth, apyHealth, spHealth]),
      chainId,
      endpoint: `${HISTORY_BASE}/${chainId}`,
      latestTs: lastTs,
      diag,
    };
  });

  const counts = { critical: 0, minor: 0, good: 0, perfect: 0 };
  for (const r of rows) counts[r.status] += 1;

  return (
    <div className="uni-hub-test">
      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <div>
            <h1 className="uni-hub-h1">Product Data</h1>
            <p className="uni-hub-sub">
              Indexed-point coverage per product, across the three key
              series we pull from the subgraph — TVL, APY and share price.
              Each count is measured against the vault&apos;s age, so a
              series that only covers part of its life (or is sparsely
              event-indexed) flags for a backfill. Goal: a daily snapshot
              of all three for every product, back to deployment.
            </p>
          </div>
        </div>

        <div
          className="uni-hub-stats"
          role="group"
          aria-label="Data coverage summary"
          style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
        >
          <Stat label="Needs fix" value={counts.critical} />
          <Stat label="Non-urgent" value={counts.minor} />
          <Stat label="Good standing" value={counts.good} />
          <Stat label="Perfect" value={counts.perfect} />
        </div>
      </header>

      <section className="uni-hub-section" style={{ marginTop: 0 }}>
        <header className="uni-hub-section-head">
          <h2 className="uni-hub-section-title">Coverage by product</h2>
          <span className="uni-hub-section-meta">
            {rows.length} products · counts are indexed data points per
            series
          </span>
        </header>
        <ProductDataTable rows={rows} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="uni-hub-stat">
      <div className="uni-hub-stat-label">{label}</div>
      <div className="uni-hub-stat-value">{value.toLocaleString("en-US")}</div>
    </div>
  );
}
