import Link from "next/link";
import { YieldVault } from "@/lib/types";
import { formatAPY, formatTVL } from "@/lib/format";
import { depositRef, apyToMonthly, fmtEarnings, tvlPercentileLabel, benchmarkQualifier } from "@/lib/contextualize";
import { chainToSlug } from "@/lib/networks";

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

  const top6 = sameAsset.slice(0, 6);
  const currentInTop = top6.some((v) => v.id === vault.id);
  if (!currentInTop && rank > 0) {
    top6[top6.length - 1] = vault;
  }

  return (
    <section className="pp-section" id="benchmark">
      <h2>Market benchmarking</h2>
      <BenchmarkIntro vault={vault} rank={rank} sameAssetCount={sameAsset.length} avgApy={avgApy} vsAvg={vsAvg} />

      <div className="bench-stats">
        <div><div className="bs-l">Asset average APY</div><div className="bs-v mono">{formatAPY(avgApy)}</div></div>
        <div><div className="bs-l">This product APY</div><div className="bs-v mono up">{formatAPY(vault.apy24h)}</div></div>
        <div><div className="bs-l">Market rank</div><div className="bs-v mono">#{rank} / {sameAsset.length}</div></div>
        <div><div className="bs-l">vs. Average</div><div className="bs-v mono up">{vsAvg >= 0 ? "+" : ""}{vsAvg.toFixed(1)}%</div></div>
      </div>

      <div className="bench-table">
        <div className="bt-head">
          <span>#</span><span>Product</span><span>Chain</span><span className="r">APY</span><span className="r">TVL</span>
        </div>
        {top6.map((v, i) => {
          const isYou = v.id === vault.id;
          const displayRank = sameAsset.findIndex((s) => s.id === v.id) + 1;
          return (
            <div key={v.id} className={`bt-row${isYou ? " you" : ""}`}>
              <span className="mono dim">#{displayRank}</span>
              <span>
                <strong>{v.productName}</strong>
                {isYou && <span className="here-pill">You are here</span>}
              </span>
              <span><span className="chip">{v.chain}</span></span>
              <span className="r mono"><strong className="up">{formatAPY(v.apy24h)}</strong></span>
              <span className="r mono">{formatTVL(v.tvl)}</span>
            </div>
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

      <ClosingBenchmark vault={vault} sameAsset={sameAsset} rank={rank} />
    </section>
  );
}

function BenchmarkIntro({
  vault,
  rank,
  sameAssetCount,
  avgApy,
  vsAvg,
}: {
  vault: YieldVault;
  rank: number;
  sameAssetCount: number;
  avgApy: number;
  vsAvg: number;
}) {
  const ref = depositRef(vault.asset);
  const vaultMonthly = apyToMonthly(vault.apy24h, ref.amount);
  const avgMonthly = apyToMonthly(avgApy, ref.amount);
  const monthlyDiff = Math.abs(vaultMonthly - avgMonthly);
  const diffDir = vsAvg >= 0 ? "more" : "less";

  // Contextualization (#5): omit if diff < $0.50/mo; use $/year if < $1/mo
  let ctx = "";
  if (monthlyDiff >= 0.5) {
    if (monthlyDiff < 1) {
      const yearlyDiff = monthlyDiff * 12;
      ctx = ` On a ${ref.label} deposit, that's ${fmtEarnings(yearlyDiff, vault.asset)} per year ${diffDir} than the cohort average.`;
    } else {
      ctx = ` On a ${ref.label} deposit, that's ${fmtEarnings(monthlyDiff, vault.asset)} per month ${diffDir} than the cohort average.`;
    }
  }

  return (
    <p>
      Among the {sameAssetCount} {vault.asset} strategies we currently monitor, this product ranks <strong>#{rank}</strong>.
      Its {formatAPY(vault.apy24h)} yield runs{" "}
      <strong>{Math.abs(vsAvg).toFixed(1)}% {vsAvg >= 0 ? "higher" : "lower"}</strong> than
      the cohort average of {formatAPY(avgApy)}.{ctx}
    </p>
  );
}

function ClosingBenchmark({
  vault,
  sameAsset,
  rank,
}: {
  vault: YieldVault;
  sameAsset: YieldVault[];
  rank: number;
}) {
  const outperformPct = Math.round(
    ((sameAsset.length - rank) / sameAsset.length) * 100,
  );

  const tvlSorted = [...sameAsset].sort((a, b) => b.tvl - a.tvl);
  const tvlRank = tvlSorted.findIndex((v) => v.id === vault.id) + 1;
  const topTvl = tvlSorted[0];

  // TVL context (#6)
  let tvlComparison = "";
  if (vault.tvl < 1000) {
    // Under $1k: replace closing sentence's TVL part with small-vault note
    tvlComparison = ` This vault is currently small, holding under $1,000 in deposits. It is not representative of strategy capacity at scale.`;
  } else if (tvlRank <= 5) {
    tvlComparison = ` By TVL it ranks #${tvlRank}, putting it among the most established ${vault.asset} vaults in our index. That makes it one of the largest ${vault.asset} strategies in the index by capital deployed.`;
  } else if (tvlRank <= 3) {
    tvlComparison = ` By TVL it ranks #${tvlRank}, putting it among the most established ${vault.asset} vaults in our index.`;
  } else if (topTvl && topTvl.id !== vault.id && topTvl.tvl > vault.tvl * 2) {
    const percentileLabel = tvlPercentileLabel(tvlRank, sameAsset.length);
    tvlComparison = ` However, with ${formatTVL(vault.tvl)} TVL it holds significantly less capital than ${topTvl.productName} (${formatTVL(topTvl.tvl)}). That places it in the ${percentileLabel} of ${vault.asset} strategies by capital deployed.`;
  }

  return (
    <p style={{ marginTop: 14 }}>
      {vault.productName} currently ranks #{rank} among the{" "}
      {sameAsset.length} {vault.asset} strategies we follow, outperforming{" "}
      {outperformPct}% of them by APY.
      {tvlComparison}
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

  const top6 = sameChain.slice(0, 6);
  const currentInTop = top6.some((v) => v.id === vault.id);
  if (!currentInTop && rank > 0) {
    top6[top6.length - 1] = vault;
  }

  return (
    <section className="pp-section" id="ecosystem">
      <h2>Ecosystem context</h2>
      <EcosystemIntro vault={vault} rank={rank} sameChainCount={sameChain.length} networkAvg={networkAvg} vsNetAvg={vsNetAvg} />

      <EcosystemChart
        vault={vault}
        rows={top6}
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
  rows,
  sameChainAll,
  networkAvg,
  maxApy,
}: {
  vault: YieldVault;
  rows: YieldVault[];
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
          {rows.map((v, i) => {
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
          {rows.map((v) => {
            const displayRank = sameChainAll.findIndex((s) => s.id === v.id) + 1;
            return (
              <span key={v.id} className="mono">#{displayRank}</span>
            );
          })}
        </div>
      </div>

      <div className="eco-legend">
        <div className="eco-legend-head">
          <span>{vault.asset} on {vault.chain}</span>
          <span className="mono dim">#{sameChainAll.findIndex((s) => s.id === vault.id) + 1} of {sameChainAll.length}</span>
        </div>
        {rows.map((v, i) => {
          const isYou = v.id === vault.id;
          const displayRank = sameChainAll.findIndex((s) => s.id === v.id) + 1;
          return (
            <div key={v.id} className={`eco-legend-row${isYou ? " you" : ""}`}>
              <span
                className="eco-legend-swatch"
                style={{ background: ECO_PALETTE[i % ECO_PALETTE.length] }}
                aria-hidden="true"
              />
              <span className="eco-legend-rank mono">#{displayRank}</span>
              <span className="eco-legend-name">
                {v.productName}
                {isYou && <span className="here-pill">You</span>}
              </span>
              <span className="eco-legend-apy mono">{formatAPY(v.apy24h)}</span>
            </div>
          );
        })}
        <div className="eco-legend-row baseline">
          <span className="eco-legend-swatch baseline" aria-hidden="true" />
          <span></span>
          <span className="eco-legend-name">Network average</span>
          <span className="eco-legend-apy mono">{formatAPY(networkAvg)}</span>
        </div>
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
  // Contextualization (#7): qualify position relative to network avg
  const qualifier = benchmarkQualifier(vsNetAvg);
  const ctx = ` Yields on ${vault.chain} for ${vault.asset} have averaged ${networkAvg.toFixed(2)}% in our index - this strategy is delivering ${qualifier} that benchmark.`;

  return (
    <p>
      On <Link href={`/${chainToSlug(vault.chain)}`}>{vault.chain}</Link>, this
      product{"'"}s yield runs{" "}
      <strong>{Math.abs(vsNetAvg).toFixed(1)}% {vsNetAvg >= 0 ? "higher" : "lower"}</strong> than
      the network average across the {vault.asset} strategies we monitor. By APY it ranks{" "}
      <strong>#{rank} of {sameChainCount}</strong> in that set.{ctx}
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

  return (
    <p style={{ marginTop: 14 }}>
      {topLabel} This strategy is operated by {vault.protocol.name} and
      competes against {sameChain.length - 1} other {vault.asset} strategies
      we follow on the {vault.chain} network.
    </p>
  );
}
