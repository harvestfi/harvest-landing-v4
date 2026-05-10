// One row of the Uniswap-style hub ranking table. Renders as a CSS
// grid (cells live as direct children of .uni-hub-row so the parent
// can declare column widths once and the cells just sit in place).

import Link from "next/link";
import { YieldVault } from "@/lib/types";
import { formatAPY, formatTVL, stripChainSuffix } from "@/lib/format";
import { AssetIcon, ChainIcon } from "./token-icons";

interface Props {
  rank: number;
  vault: YieldVault;
  sparkline: number[] | undefined;
}

function buildSparklinePath(values: number[]): string {
  if (!values || values.length === 0) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * 100;
      const y = 100 - ((v - min) / span) * 100;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function TestHubRow({ rank, vault, sparkline }: Props) {
  const protocolName = stripChainSuffix(vault.category, vault.chain);
  const sparkPath = sparkline && sparkline.length > 1
    ? buildSparklinePath(sparkline)
    : "";

  // Trend direction over the sparkline window: rising = gold, falling
  // = ink-3 so the eye doesn't read every row as positive.
  const trendUp =
    sparkline && sparkline.length > 1
      ? sparkline[sparkline.length - 1] >= sparkline[0]
      : true;

  return (
    <Link href={`/${vault.slug}`} className="uni-hub-row">
      <span className="uni-hub-cell uni-hub-rank">{rank}</span>
      <span className="uni-hub-cell uni-hub-vault">
        <AssetIcon asset={vault.asset} size={28} />
        <span className="uni-hub-vault-name">{vault.productName}</span>
      </span>
      <span className="uni-hub-cell uni-hub-network">
        <ChainIcon chain={vault.chain} size={14} />
        <span>{vault.chain}</span>
      </span>
      <span className="uni-hub-cell uni-hub-strategy">{protocolName}</span>
      <span className="uni-hub-cell uni-hub-num">{formatTVL(vault.tvl)}</span>
      <span className="uni-hub-cell uni-hub-num uni-hub-apy">
        {formatAPY(vault.apy24h)}
      </span>
      <span className="uni-hub-cell uni-hub-num uni-hub-num-secondary">
        {formatAPY(vault.apy30d)}
      </span>
      <span
        className={`uni-hub-cell uni-hub-spark${trendUp ? " up" : " down"}`}
        aria-hidden="true"
      >
        {sparkPath ? (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            width="100"
            height="32"
          >
            <path
              d={sparkPath}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <span className="uni-hub-spark-empty">—</span>
        )}
      </span>
    </Link>
  );
}
