// "Similar {asset} opportunities" cross-sell rail. Pulls every other
// vault for the same asset from the global list, sorts by 24h APY,
// renders the top 6 as a card grid. Links jump to the production
// product page for that vault.

import Link from "next/link";
import { YieldVault } from "@/lib/types";
import { formatAPY, formatTVL, stripChainSuffix } from "@/lib/format";
import { AssetIcon, ChainIcon } from "./token-icons";

interface Props {
  vault: YieldVault;
  allVaults: YieldVault[];
}

export function TestSimilar({ vault, allVaults }: Props) {
  // Filter out vaults with no live numbers — empty TVL or no APY makes
  // them dead links from a yield-comparison standpoint and they
  // pollute the cross-sell rail.
  const similar = allVaults
    .filter(
      (v) =>
        v.asset === vault.asset &&
        v.id !== vault.id &&
        v.tvl > 0 &&
        v.apy24h > 0,
    )
    .sort((a, b) => b.apy24h - a.apy24h)
    .slice(0, 6);

  if (similar.length === 0) return null;

  return (
    <section className="pp-section uni-similar" id="similar">
      <header className="uni-similar-head">
        <h2>Similar {vault.asset} opportunities</h2>
        <Link
          href={`/${vault.asset.toLowerCase()}`}
          className="uni-similar-all"
        >
          See all
          <span className="uni-similar-all-arrow" aria-hidden="true">→</span>
        </Link>
      </header>
      <div className="uni-similar-grid">
        {similar.map((v) => (
          <Link key={v.id} href={`/${v.slug}`} className="uni-similar-card">
            <div className="uni-similar-card-head">
              <span className="uni-similar-icon">
                <AssetIcon asset={v.asset} size={32} />
              </span>
              <div className="uni-similar-id">
                <div className="uni-similar-name">{v.productName}</div>
                <div className="uni-similar-meta">
                  <ChainIcon chain={v.chain} size={12} />
                  <span>{v.chain}</span>
                  <span className="uni-similar-meta-sep" aria-hidden="true">·</span>
                  <span>{stripChainSuffix(v.category, v.chain)}</span>
                </div>
              </div>
            </div>
            <div className="uni-similar-stats">
              <div className="uni-similar-stat">
                <div className="uni-similar-stat-label">24h APY</div>
                <div className="uni-similar-stat-value uni-similar-apy">
                  {formatAPY(v.apy24h)}
                </div>
              </div>
              <div className="uni-similar-stat uni-similar-stat-r">
                <div className="uni-similar-stat-label">TVL</div>
                <div className="uni-similar-stat-value">
                  {formatTVL(v.tvl)}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
