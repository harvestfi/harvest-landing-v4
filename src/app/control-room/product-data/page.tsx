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
  type SeriesHealth,
  type DataStatus,
} from "@/components/product-data-table";
import "../../_styles/asset-hub.css";

// Coverage = indexed points / vault age in days. A daily-snapshotted
// series sits near 1.0; a series that only spans part of the vault's life
// (or is event-driven and sparse) drops well below it. Thresholds are
// deliberately forgiving so only genuinely thin series flag red.
function healthFor(points: number, ageDays: number): SeriesHealth {
  if (points <= 0) return "missing";
  const coverage = points / Math.max(ageDays, 1);
  if (coverage < 0.3) return "sparse";
  if (coverage < 0.8) return "partial";
  if (coverage < 0.95) return "good";
  return "dense";
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
    const tvlHealth = healthFor(tvlPoints, ageDays);
    const apyHealth = healthFor(apyPoints, ageDays);
    const spHealth = healthFor(spPoints, ageDays);

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
