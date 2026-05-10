"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { YieldVault } from "@/lib/types";
import { formatAPY, formatTVL, stripChainSuffix } from "@/lib/format";
import { AssetIcon, ChainIcon } from "./token-icons";

type SortKey = "apy24h" | "tvl";
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
            <FilterDropdown
              label="Asset"
              value={asset}
              onChange={(v) => {
                setAsset(v);
                setPage(0);
              }}
              options={[
                { value: "all", label: "All assets" },
                ...allAssets.map((a) => ({
                  value: a,
                  label: a,
                  icon: <AssetIcon asset={a} size={16} />,
                })),
              ]}
            />
          )}
          <FilterDropdown
            label="Network"
            value={chain}
            onChange={(v) => {
              setChain(v);
              setPage(0);
            }}
            options={[
              { value: "all", label: "All networks" },
              ...allChains.map((c) => ({
                value: c,
                label: c,
                icon: <ChainIcon chain={c} size={16} />,
              })),
            ]}
          />
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
          <SortHeader
            label="24h APY"
            active={sortKey === "apy24h"}
            dir={sortDir}
            onClick={() => clickSort("apy24h")}
          />
          <SortHeader
            label="TVL"
            active={sortKey === "tvl"}
            dir={sortDir}
            onClick={() => clickSort("tvl")}
          />
          <span className="hub-th">Network</span>
          <span className="hub-th">Strategy</span>
          <span className="hub-th hub-th-num">30d APY trend</span>
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
  // If upstream history is missing for this vault but we have a live
  // 24h APY, fall back to a flat sparkline at that value rather than
  // hiding the column. Reads as "live snapshot, no history yet"
  // instead of leaving an empty cell.
  const effectiveSpark =
    sparkline && sparkline.length > 1
      ? sparkline
      : vault.apy24h > 0
      ? [vault.apy24h, vault.apy24h]
      : null;
  const sparkPath = effectiveSpark ? buildSparklinePath(effectiveSpark) : "";
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
      <span className="hub-cell hub-num hub-apy">{formatAPY(vault.apy24h)}</span>
      <span className="hub-cell hub-num">{formatTVL(vault.tvl)}</span>
      <span className="hub-cell hub-network">
        <ChainIcon chain={vault.chain} size={14} />
        <span>{vault.chain}</span>
      </span>
      <span className="hub-cell hub-strategy">{protocolName}</span>
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

interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onPointer(e: Event) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="hub-dropdown" ref={wrapRef}>
      <button
        type="button"
        className="hub-dropdown-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="hub-dropdown-btn-label">{label}</span>
        <span className="hub-dropdown-btn-value">
          {current?.icon}
          <span>{current?.label}</span>
        </span>
        <span className="hub-dropdown-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="hub-dropdown-panel" role="listbox" aria-label={label}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`hub-dropdown-option${opt.value === value ? " active" : ""}`}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.icon}
              <span className="hub-dropdown-option-text">{opt.label}</span>
              <span className="hub-dropdown-option-check" aria-hidden="true">
                ✓
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
