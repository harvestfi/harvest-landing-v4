import Link from "next/link";
import { YieldVault } from "@/lib/types";
import { formatAPY, formatTVL } from "@/lib/format";
import { depositRef, apyToMonthly, fmtEarnings } from "@/lib/contextualize";
import { chainToSlug } from "@/lib/networks";
import { isLpPairVault, getCanonicalDisplayName } from "@/lib/lp-pair";
import { AssetIcon, ChainIcon } from "./token-icons";
import { LpBadge } from "./lp-badge";

interface Props {
  vault: YieldVault;
  allVaults: YieldVault[];
}

export function MarketBenchmark({ vault, allVaults }: Props) {
  const sameAsset = allVaults
    .filter((v) => v.asset === vault.asset && v.apy24h > 0)
    .sort((a, b) => b.apy24h - a.apy24h);

  if (sameAsset.length < 2) return null;

  const rank = sameAsset.findIndex((v) => v.id === vault.id) + 1;
  const avgApy = sameAsset.reduce((s, v) => s + v.apy24h, 0) / sameAsset.length;
  const vsAvg = avgApy > 0 ? ((vault.apy24h - avgApy) / avgApy) * 100 : 0;

  // Row layout per the editorial spec.
  //
  // Case A: current product is in ranks 1-5. Show ranks 1..5 (or
  // the whole cohort if smaller) as a contiguous block. No
  // separator, no tail row - the top-5 block is more informative
  // than a top-3-plus-tail layout when the product is already in
  // the top, and the previous "top 3 + sep + tail" version
  // produced a visually empty middle on top-ranked pages.
  //
  // Case B: current product is in ranks 6+. Anchor ranks are
  // {1, 2, 3, rank-1, rank, rank+1, total}. Walk them in order
  // and insert a separator only when there's a gap larger than
  // one rank between anchors; when the gap is exactly one rank,
  // fill the missing row so adjacent visible rows stay contiguous
  // (handles the rank-6 case where 4 and 5 sit between top 3 and
  // neighbourhood [5,6,7]).
  const total = sameAsset.length;
  type BenchRow =
    | { kind: "row"; vault: YieldVault; rank: number }
    | { kind: "sep" };
  const seen = new Set<number>();
  const layout: BenchRow[] = [];
  const pushRow = (r: number) => {
    if (r < 1 || r > total) return;
    if (seen.has(r)) return;
    seen.add(r);
    layout.push({ kind: "row", vault: sameAsset[r - 1], rank: r });
  };

  if (rank <= 5) {
    // Case A: contiguous top 5.
    for (let r = 1; r <= Math.min(5, total); r++) pushRow(r);
  } else {
    // Case B: top 3 + (gap or fill) + neighbourhood + (gap) + tail.
    const anchors = [
      ...new Set([1, 2, 3, rank - 1, rank, rank + 1, total]),
    ]
      .filter((r) => r >= 1 && r <= total)
      .sort((a, b) => a - b);
    let prev: number | null = null;
    for (const r of anchors) {
      if (prev !== null) {
        const gap = r - prev - 1;
        if (gap === 1) {
          pushRow(prev + 1);
        } else if (gap > 1) {
          layout.push({ kind: "sep" });
        }
      }
      pushRow(r);
      prev = r;
    }
  }

  return (
    <section className="pp-section" id="benchmark">
      <h2>Market benchmarking</h2>

      <div className="bench-stats">
        <div>
          <div
            className="bs-l"
            data-tooltip={`Mean 24-hour APY across every ${vault.asset} strategy currently in our index. Stale and broken vaults are excluded.`}
          >
            Asset average APY
          </div>
          <div className="bs-v mono">{formatAPY(avgApy)}</div>
        </div>
        <div>
          <div
            className="bs-l"
            data-tooltip="The latest 24-hour annualized yield reported by our hosted indexer for this strategy."
          >
            This product APY
          </div>
          <div className="bs-v mono up">{formatAPY(vault.apy24h)}</div>
        </div>
        <div>
          <div
            className="bs-l"
            data-tooltip={`Where this strategy sits when the ${sameAsset.length} indexed ${vault.asset} vaults are sorted from highest to lowest 24h APY.`}
          >
            Market rank
          </div>
          <div className="bs-v mono">#{rank} / {sameAsset.length}</div>
        </div>
        <div>
          <div
            className="bs-l"
            data-tooltip="How much higher (+) or lower (-) this product's 24h APY runs compared to the asset-cohort average."
          >
            vs. Average
          </div>
          <div className="bs-v mono up">{vsAvg >= 0 ? "+" : ""}{vsAvg.toFixed(1)}%</div>
        </div>
      </div>

      <div className="bench-table">
        <div className="bt-head">
          <span>#</span><span>Product</span><span>Chain</span><span className="r">APY</span><span className="r">TVL</span>
        </div>
        {layout.map((row, i) => {
          if (row.kind === "sep") {
            // Slim single-cell separator row. The previous five-span
            // layout left four cells empty in the grid, which read
            // visually as a half-collapsed broken row. Now the dot
            // glyph spans the full table width and sits muted in the
            // middle, so the row reads as a deliberate condensation
            // marker rather than missing data.
            return (
              <div key={`sep-${i}`} className="bt-row bt-row-sep" aria-hidden="true">
                <span className="bt-row-sep-glyph">…</span>
              </div>
            );
          }
          const v = row.vault;
          const isYou = v.id === vault.id;
          const cells = (
            <>
              <span className="mono dim">#{row.rank}</span>
              <span className="bt-product-cell">
                <span className="bt-product">
                  <AssetIcon asset={v.asset} size={22} />
                  <strong>
                    {getCanonicalDisplayName(v)}
                    {isLpPairVault(v) && <LpBadge />}
                  </strong>
                </span>
                {isYou && <span className="here-pill">You are here</span>}
              </span>
              <span>
                <span className="chip">
                  <ChainIcon chain={v.chain} size={12} />
                  {v.chain}
                </span>
              </span>
              <span className="r mono"><strong className="up">{formatAPY(v.apy24h)}</strong></span>
              <span className="r mono">{formatTVL(v.tvl)}</span>
            </>
          );
          // The current vault stays a static row (no point linking to
          // self); every other row becomes a Link so users can pivot
          // straight into the comparison vault.
          if (isYou) {
            return <div key={v.id} className="bt-row you">{cells}</div>;
          }
          return (
            <Link key={v.id} href={`/${v.slug}`} className="bt-row bt-row-link">
              {cells}
            </Link>
          );
        })}
        <div className="bt-row avg">
          <span></span>
          <span className="dim">Tracked {vault.asset} market average</span>
          <span></span>
          <span className="r mono dim">{formatAPY(avgApy)}</span>
          <span></span>
        </div>
      </div>

      <ClosingBenchmark
        vault={vault}
        sameAsset={sameAsset}
        rank={rank}
        avgApy={avgApy}
        vsAvg={vsAvg}
      />
    </section>
  );
}

function ClosingBenchmark({
  vault,
  sameAsset,
  rank,
  avgApy,
  vsAvg,
}: {
  vault: YieldVault;
  sameAsset: YieldVault[];
  rank: number;
  avgApy: number;
  vsAvg: number;
}) {
  const total = sameAsset.length;
  const ratio = rank / total;
  const above = rank - 1;
  const below = total - rank;
  // APY-rank phrase: three variants per the editorial spec - no
  // "outperforming X%" or "% beaten" framing.
  const apySummary =
    ratio <= 0.25
      ? "This product sits in the top quarter of the cohort by APY."
      : ratio <= 0.75
        ? `${above} ${above === 1 ? "strategy" : "strategies"} in the cohort are currently delivering higher APY; ${below} are delivering lower.`
        : `${above} ${above === 1 ? "strategy" : "strategies"} in the cohort are currently delivering higher APY.`;

  // Cohort-average vs vault delta in monthly earnings per reference
  // deposit. For USD-denominated assets the reference is $1,000; for
  // ETH / BTC it's 1 unit of the underlying (translating to USD here
  // would require a historical price feed we don't have and would
  // imply the asset price is flat).
  const direction = vsAvg >= 0 ? "higher" : "lower";
  const ref = depositRef(vault.asset);
  const monthlyDelta = Math.abs(apyToMonthly(vault.apy24h - avgApy, ref.amount));
  const deltaPhrase = fmtEarnings(monthlyDelta, vault.asset);

  // TVL rank within the same-asset cohort, sorted by TVL desc.
  const tvlSorted = [...sameAsset].sort((a, b) => b.tvl - a.tvl);
  const tvlRank = tvlSorted.findIndex((v) => v.id === vault.id) + 1;

  return (
    <p style={{ marginTop: 14 }}>
      Among the {total} {vault.asset} strategies we currently monitor,
      this product ranks <strong>#{rank}</strong>. Its{" "}
      {formatAPY(vault.apy24h)} yield runs{" "}
      <strong>
        {Math.abs(vsAvg).toFixed(1)}% {direction}
      </strong>{" "}
      than the cohort average of {formatAPY(avgApy)}. On a {ref.label}{" "}
      position, that&apos;s {deltaPhrase} per month {direction} than the
      cohort average. {apySummary} It currently holds{" "}
      {formatTVL(vault.tvl)} in TVL, ranking #{tvlRank} of {total} by
      TVL.
    </p>
  );
}

export function EcosystemContext({ vault, allVaults }: Props) {
  const sameChain = allVaults
    .filter((v) => v.asset === vault.asset && v.chain === vault.chain && v.apy24h > 0)
    .sort((a, b) => b.apy24h - a.apy24h);

  if (sameChain.length < 2) return null;

  const networkAvg = sameChain.reduce((s, v) => s + v.apy24h, 0) / sameChain.length;
  const rank = sameChain.findIndex((v) => v.id === vault.id) + 1;
  const maxApy = sameChain[0]?.apy24h || 1;
  const vsNetAvg = networkAvg > 0 ? ((vault.apy24h - networkAvg) / networkAvg) * 100 : 0;

  // The chart shows the top 10 strategies so users can see deeper
  // into the cohort; the legend stays at the top 6 so the right
  // column doesn't sprawl. If the user's vault isn't already in the
  // visible slice, it gets force-included as the last entry.
  const top10 = sameChain.slice(0, 10);
  const currentInChart = top10.some((v) => v.id === vault.id);
  if (!currentInChart && rank > 0) {
    top10[top10.length - 1] = vault;
  }
  const top6 = sameChain.slice(0, 6);
  const currentInLegend = top6.some((v) => v.id === vault.id);
  if (!currentInLegend && rank > 0) {
    top6[top6.length - 1] = vault;
  }

  return (
    <section className="pp-section" id="ecosystem">
      <h2>Ecosystem context</h2>
      <EcosystemIntro vault={vault} rank={rank} sameChainCount={sameChain.length} networkAvg={networkAvg} vsNetAvg={vsNetAvg} />

      <EcosystemChart
        vault={vault}
        chartRows={top10}
        legendRows={top6}
        sameChainAll={sameChain}
        networkAvg={networkAvg}
        maxApy={maxApy}
      />

      <ClosingEcosystem vault={vault} sameChain={sameChain} rank={rank} />
    </section>
  );
}

// Distinct, balanced palette for the per-strategy bars + legend swatches.
// Index N in the legend always maps to bar N in the chart, so the user
// can read color → strategy unambiguously. Hues spread around the wheel
// at constant lightness/chroma so no single bar visually dominates.
const ECO_PALETTE = [
  "oklch(0.62 0.16 150)",
  "oklch(0.62 0.16 245)",
  "oklch(0.66 0.17 55)",
  "oklch(0.58 0.20 320)",
  "oklch(0.66 0.14 195)",
  "oklch(0.58 0.18 285)",
];

function EcosystemChart({
  vault,
  chartRows,
  legendRows,
  sameChainAll,
  networkAvg,
  maxApy,
}: {
  vault: YieldVault;
  chartRows: YieldVault[];
  legendRows: YieldVault[];
  sameChainAll: YieldVault[];
  networkAvg: number;
  maxApy: number;
}) {
  // Anchor the y-axis slightly above maxApy so the tallest bar doesn't
  // touch the ceiling and the avg line stays visible inside the plot.
  const ceil = Math.max(maxApy * 1.08, networkAvg * 1.2, 0.0001);
  const avgPct = (networkAvg / ceil) * 100;

  return (
    <div className="eco-chart-wrap">
      <div className="eco-chart-col">
        <div className="eco-chart" role="img" aria-label="APY comparison chart">
          <span
            className="eco-chart-baseline"
            style={{ bottom: `${avgPct}%` }}
          >
            <span className="eco-chart-baseline-label mono">
              Network avg {formatAPY(networkAvg)}
            </span>
          </span>
          {chartRows.map((v, i) => {
            const isYou = v.id === vault.id;
            const heightPct = (v.apy24h / ceil) * 100;
            return (
              <div key={v.id} className={`eco-bar-col${isYou ? " you" : ""}`}>
                <span
                  className="eco-bar"
                  style={{ height: `${heightPct}%`, background: ECO_PALETTE[i % ECO_PALETTE.length] }}
                  title={`${v.productName}: ${formatAPY(v.apy24h)}`}
                />
              </div>
            );
          })}
        </div>
        <div className="eco-chart-axis">
          {chartRows.map((v) => {
            const displayRank = sameChainAll.findIndex((s) => s.id === v.id) + 1;
            return (
              <span key={v.id} className="mono">#{displayRank}</span>
            );
          })}
        </div>
      </div>

      <div className="eco-legend">
        <div className="eco-legend-head">
          <span className="eco-legend-head-title">
            <ChainIcon chain={vault.chain} size={14} />
            {vault.asset} on {vault.chain}
          </span>
          <span className="mono dim">#{sameChainAll.findIndex((s) => s.id === vault.id) + 1} of {sameChainAll.length}</span>
        </div>
        {legendRows.map((v, i) => {
          const isYou = v.id === vault.id;
          const displayRank = sameChainAll.findIndex((s) => s.id === v.id) + 1;
          const cells = (
            <>
              <span
                className="eco-legend-swatch"
                style={{ background: ECO_PALETTE[i % ECO_PALETTE.length] }}
                aria-hidden="true"
              />
              <span className="eco-legend-rank mono">#{displayRank}</span>
              <span className="eco-legend-name">
                <span className="eco-legend-asset" aria-hidden="true">
                  <AssetIcon asset={v.asset} size={18} />
                </span>
                <span className="eco-legend-name-text">
                  {getCanonicalDisplayName(v)}
                  {isLpPairVault(v) && <LpBadge />}
                </span>
                {isYou && <span className="here-pill">You</span>}
              </span>
              <span className="eco-legend-apy mono">{formatAPY(v.apy24h)}</span>
            </>
          );
          if (isYou) {
            return <div key={v.id} className="eco-legend-row you">{cells}</div>;
          }
          return (
            <Link
              key={v.id}
              href={`/${v.slug}`}
              className="eco-legend-row eco-legend-row-link"
            >
              {cells}
            </Link>
          );
        })}
        <div className="eco-legend-row baseline">
          <span className="eco-legend-swatch baseline" aria-hidden="true" />
          <span></span>
          <span className="eco-legend-name">Network average</span>
          <span className="eco-legend-apy mono">{formatAPY(networkAvg)}</span>
        </div>
        <Link href={`/${chainToSlug(vault.chain)}`} className="eco-network-cta">
          <span className="eco-network-cta-label">
            <ChainIcon chain={vault.chain} size={14} />
            See all {sameChainAll.length} {vault.asset} strategies on {vault.chain}
          </span>
          <span className="eco-network-cta-arrow" aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

function EcosystemIntro({
  vault,
  rank,
  sameChainCount,
  networkAvg,
  vsNetAvg,
}: {
  vault: YieldVault;
  rank: number;
  sameChainCount: number;
  networkAvg: number;
  vsNetAvg: number;
}) {
  // No editorial trailing clause. The two factual sentences above
  // (relative-to-average + rank in set) plus the bare cohort
  // average below already cover the comparison; the previous
  // "delivering well above that benchmark" was an intensifier
  // comparison violating the universal hard rule.
  return (
    <p>
      On <Link href={`/${chainToSlug(vault.chain)}`}>{vault.chain}</Link>, this
      product{"'"}s yield runs{" "}
      <strong>{Math.abs(vsNetAvg).toFixed(1)}% {vsNetAvg >= 0 ? "higher" : "lower"}</strong> than
      the network average across the {vault.asset} strategies we monitor. By APY it ranks{" "}
      <strong>#{rank} of {sameChainCount}</strong> in that set. Yields on {vault.chain} for {vault.asset} have averaged {networkAvg.toFixed(2)}% in our index.
    </p>
  );
}

function ClosingEcosystem({
  vault,
  sameChain,
  rank,
}: {
  vault: YieldVault;
  sameChain: YieldVault[];
  rank: number;
}) {
  const tvlSorted = [...sameChain].sort((a, b) => b.tvl - a.tvl);
  const tvlRank = tvlSorted.findIndex((v) => v.id === vault.id) + 1;

  const isTop = rank === 1;
  const topLabel = isTop
    ? `Currently the top-yielding ${vault.asset} opportunity on ${vault.chain} across the ${sameChain.length} products we monitor.`
    : `By TVL, this product ranks #${tvlRank} of ${sameChain.length} ${vault.asset} strategies on ${vault.chain} in our index.`;

  // Single-sentence closer. The previous trailing sentence
  // ("This strategy is operated by X and competes against N other...")
  // was deleted because:
  // (a) operator attribution is a no-op fact since every product on
  //     the site is operated by Harvest, and
  // (b) `competes against` is now blacklisted phrasing, and the
  //     cohort context is already covered by the topLabel sentence.
  return (
    <p style={{ marginTop: 14 }}>{topLabel}</p>
  );
}
