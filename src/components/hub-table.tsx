"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { YieldVault } from "@/lib/types";
import { formatAPY, formatTVL, stripChainSuffix } from "@/lib/format";
import { AssetIcon, ChainIcon } from "./token-icons";

type SortKey = "apy24h" | "apy30d" | "tvl";
type SortDir = "asc" | "desc";

interface Props {
  vaults: YieldVault[];
  sparklines: Record<string, number[]>;
  pageSize?: number;
  showAssetFilter?: boolean;
  scopeLabel?: string;
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

function sparklineFor(v: YieldVault, sparklines: Record<string, number[]>): number[] | undefined {
  return (
    sparklines[v.contractAddress.toLowerCase()] ??
    sparklines[v.contractAddress]
  );
}

export function HubTable({
  vaults,
  sparklines,
  pageSize,
  showAssetFilter = false,
  scopeLabel,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("apy24h");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [asset, setAsset] = useState<string>("all");
  const [chain, setChain] = useState<string>("all");
  const [page, setPage] = useState(0);

  const allAssets = useMemo(
    () => Array.from(new Set(vaults.map((v) => v.asset))).sort(),
    [vaults],
  );
  const allChains = useMemo(
    () => Array.from(new Set(vaults.map((v) => v.chain))).sort(),
    [vaults],
  );

  const filtered = useMemo(() => {
    return vaults.filter((v) => {
      if (showAssetFilter && asset !== "all" && v.asset !== asset) return false;
      if (chain !== "all" && v.chain !== chain) return false;
      return true;
    });
  }, [vaults, asset, chain, showAssetFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = av === bv ? 0 : av < bv ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const visible = pageSize
    ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)
    : sorted;

  function clickSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  function resetFilters() {
    setAsset("all");
    setChain("all");
    setPage(0);
  }

  const filtersActive = asset !== "all" || chain !== "all";

  return (
    <div className="hub-table-wrap">
      <div className="hub-filterbar" role="group" aria-label="Filter ranking">
        <div className="hub-filter-set">
          {showAssetFilter && (
            <label className="hub-filter">
              <span className="hub-filter-label">Asset</span>
              <select
                value={asset}
                onChange={(e) => {
                  setAsset(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All assets</option>
                {allAssets.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="hub-filter">
            <span className="hub-filter-label">Network</span>
            <select
              value={chain}
              onChange={(e) => {
                setChain(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All networks</option>
              {allChains.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          {filtersActive && (
            <button
              type="button"
              className="hub-filter-reset"
              onClick={resetFilters}
            >
              Reset
            </button>
          )}
        </div>
        <span className="hub-filter-meta">
          {scopeLabel
            ? `${sorted.length} of ${vaults.length} ${scopeLabel}`
            : `${sorted.length} ${sorted.length === 1 ? "result" : "results"}`}
        </span>
      </div>

      <div className="hub-table" role="table" aria-label="Ranking">
        <div className="hub-thead" role="row">
          <span className="hub-th hub-th-rank">#</span>
          <span className="hub-th">Vault</span>
          <span className="hub-th">Network</span>
          <span className="hub-th">Strategy</span>
          <SortHeader
            label="TVL"
            active={sortKey === "tvl"}
            dir={sortDir}
            onClick={() => clickSort("tvl")}
          />
          <SortHeader
            label="24h APY"
            active={sortKey === "apy24h"}
            dir={sortDir}
            onClick={() => clickSort("apy24h")}
          />
          <SortHeader
            label="30d APY"
            active={sortKey === "apy30d"}
            dir={sortDir}
            onClick={() => clickSort("apy30d")}
          />
          <span className="hub-th hub-th-num">30d trend</span>
        </div>
        <div className="hub-tbody" role="rowgroup">
          {visible.length === 0 ? (
            <div className="hub-empty">No strategies match those filters.</div>
          ) : (
            visible.map((v, i) => (
              <Row
                key={v.id}
                rank={pageSize ? safePage * pageSize + i + 1 : i + 1}
                vault={v}
                sparkline={sparklineFor(v, sparklines)}
              />
            ))
          )}
        </div>
      </div>

      {pageSize && totalPages > 1 && (
        <nav className="hub-pager" aria-label="Pagination">
          <button
            type="button"
            className="hub-pager-btn"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
          >
            <span aria-hidden="true">←</span> Prev
          </button>
          <span className="hub-pager-meta">
            Page {safePage + 1} of {totalPages}
          </span>
          <button
            type="button"
            className="hub-pager-btn"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
          >
            Next <span aria-hidden="true">→</span>
          </button>
        </nav>
      )}
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`hub-th hub-th-num hub-th-sort${active ? " active" : ""}`}
      onClick={onClick}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span>{label}</span>
      <span className="hub-sort-ind" aria-hidden="true">
        {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}

function Row({
  rank,
  vault,
  sparkline,
}: {
  rank: number;
  vault: YieldVault;
  sparkline: number[] | undefined;
}) {
  const protocolName = stripChainSuffix(vault.category, vault.chain);
  const sparkPath =
    sparkline && sparkline.length > 1 ? buildSparklinePath(sparkline) : "";
  const trendUp =
    sparkline && sparkline.length > 1
      ? sparkline[sparkline.length - 1] >= sparkline[0]
      : true;

  return (
    <Link href={`/${vault.slug}`} className="hub-row">
      <span className="hub-cell hub-rank">{rank}</span>
      <span className="hub-cell hub-vault">
        <AssetIcon asset={vault.asset} size={28} />
        <span className="hub-vault-name">{vault.productName}</span>
      </span>
      <span className="hub-cell hub-network">
        <ChainIcon chain={vault.chain} size={14} />
        <span>{vault.chain}</span>
      </span>
      <span className="hub-cell hub-strategy">{protocolName}</span>
      <span className="hub-cell hub-num">{formatTVL(vault.tvl)}</span>
      <span className="hub-cell hub-num hub-apy">{formatAPY(vault.apy24h)}</span>
      <span className="hub-cell hub-num hub-num-secondary">
        {formatAPY(vault.apy30d)}
      </span>
      <span className="hub-cell hub-spark" aria-hidden="true">
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
              stroke={trendUp ? "#ffb936" : "#6e6c66"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <span className="hub-spark-empty">—</span>
        )}
      </span>
    </Link>
  );
}
