// "Other {asset} opportunities" cross-sell rail. Filters the global
// list down to vaults that are proximate to the current product
// (same network OR same strategy type, same asset), then orders by
// TVL descending so the most comparable products lead by scale
// rather than by yield. APY-based ranking is already covered in
// Market benchmarking; this section is about proximity, not
// performance.

import Link from "next/link";
import { YieldVault } from "@/lib/types";
import { formatAPY, formatTVL, stripChainSuffix } from "@/lib/format";
import { isLpPairVault } from "@/lib/lp-pair";
import { AssetIcon, ChainIcon } from "./token-icons";

interface Props {
  vault: YieldVault;
  allVaults: YieldVault[];
}

export function TestSimilar({ vault, allVaults }: Props) {
  // Eligible: same asset, live numbers, not the current product.
  const eligible = allVaults.filter(
    (v) =>
      v.asset === vault.asset &&
      v.id !== vault.id &&
      v.tvl > 0 &&
      v.apy24h > 0,
  );

  // Bucket by relationship to the current product. Priority
  // depends on whether the current product is LP-pair: an LP-pair
  // page surfaces other LP-pair products first (more comparable
  // risk profile - dual-asset exposure + impermanent loss), then
  // same-network single-asset, then off-network LP-pair. For
  // non-LP-pair (Autopilot, single-asset Autocompounder) we keep
  // the original ordering.
  const sameNet = (v: YieldVault) => v.chain === vault.chain;
  const sameType = (v: YieldVault) => v.vaultType === vault.vaultType;
  const byTvlDesc = (a: YieldVault, b: YieldVault) => b.tvl - a.tvl;
  const currentIsLp = isLpPairVault(vault);
  let similar: YieldVault[];
  if (currentIsLp) {
    const sameNetLp = eligible.filter(
      (v) => sameNet(v) && isLpPairVault(v),
    );
    const sameNetSingle = eligible.filter(
      (v) => sameNet(v) && !isLpPairVault(v),
    );
    const otherNetLp = eligible.filter(
      (v) => !sameNet(v) && isLpPairVault(v),
    );
    similar = [
      ...sameNetLp.sort(byTvlDesc),
      ...sameNetSingle.sort(byTvlDesc),
      ...otherNetLp.sort(byTvlDesc),
    ].slice(0, 6);
  } else {
    const bucketA = eligible.filter((v) => sameNet(v) && sameType(v));
    const bucketB = eligible.filter((v) => sameNet(v) && !sameType(v));
    const bucketC = eligible.filter((v) => !sameNet(v) && sameType(v));
    similar = [
      ...bucketA.sort(byTvlDesc),
      ...bucketB.sort(byTvlDesc),
      ...bucketC.sort(byTvlDesc),
    ].slice(0, 6);
  }

  if (similar.length === 0) return null;

  return (
    <section className="pp-section uni-similar" id="similar">
      <header className="uni-similar-head">
        <h2>Other {vault.asset} opportunities</h2>
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
