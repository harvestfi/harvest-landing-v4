"use client";

import { useMemo, useState } from "react";
import { ChainIcon } from "./token-icons";
import { formatAPY, formatTVL } from "@/lib/format";
import { SITE_URL } from "@/lib/constants";

export type NoindexReason = "duplicate" | "broken" | "stale" | "no-data";

export interface AdminRow {
  slug: string;
  productName: string;
  chain: string;
  asset: string;
  apy24h: number;
  tvl: number;
  indexed: boolean;
  noindexReasons: NoindexReason[];
  groupKey: string;
  groupSize: number;
}

type Filter = "all" | "indexed" | "noindex";

type SortKey =
  | "natural"
  | "productName"
  | "chain"
  | "asset"
  | "apy24h"
  | "tvl"
  | "indexed";
type SortDir = "asc" | "desc";

interface Props {
  rows: AdminRow[];
}

// Grid track mirrors HubTable on the public ranking surfaces so this
// admin view sits on the same visual rails as /eth, /usdc, the SEO
// inventory, and Acquisition's recent-visits table. Adds a Reason
// column at the end so the operator can see why a product was
// dropped from the live index without a tooltip hunt.
const COLS =
  "44px minmax(220px, 2fr) 1fr 70px 90px 100px 90px minmax(160px, 1.2fr) minmax(180px, 1.4fr)";

const REASON_LABEL: Record<NoindexReason, string> = {
  duplicate: "duplicate",
  broken: "broken",
  stale: "stale",
  "no-data": "no data",
};

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onClick,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onClick: (key: SortKey) => void;
  className?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <button
      type="button"
      className={`hub-th hub-th-sort${active ? " active" : ""} ${className ?? ""}`.trim()}
      onClick={() => onClick(sortKey)}
    >
      <span>{label}</span>
      <span className="hub-sort-ind" aria-hidden="true">
        {active ? (currentDir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}

export function AdminProductsTable({ rows }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("natural");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "apy24h" || key === "tvl" ? "desc" : "asc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "indexed" && !r.indexed) return false;
      if (filter === "noindex" && r.indexed) return false;
      if (q) {
        const hay = `${r.productName} ${r.slug} ${r.chain} ${r.asset}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  const sorted = useMemo(() => {
    if (sortKey === "natural") return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortKey === "indexed") {
        const an = a.indexed ? 1 : 0;
        const bn = b.indexed ? 1 : 0;
        return sortDir === "asc" ? an - bn : bn - an;
      }
      if (sortKey === "apy24h" || sortKey === "tvl") {
        const an = a[sortKey];
        const bn = b[sortKey];
        return sortDir === "asc" ? an - bn : bn - an;
      }
      const av = (a[sortKey] as string).toLowerCase();
      const bv = (b[sortKey] as string).toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      indexed: rows.filter((r) => r.indexed).length,
      noindex: rows.filter((r) => !r.indexed).length,
    }),
    [rows],
  );

  return (
    <>
      <div className="hub-filterbar" role="group" aria-label="Filter products">
        <div className="seo-status-toggle" role="tablist" aria-label="Filter by index status">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={`seo-status-tab${filter === "all" ? " active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "indexed"}
            className={`seo-status-tab${filter === "indexed" ? " active" : ""}`}
            onClick={() => setFilter("indexed")}
          >
            Indexed ({counts.indexed})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "noindex"}
            className={`seo-status-tab${filter === "noindex" ? " active" : ""}`}
            onClick={() => setFilter("noindex")}
          >
            Noindex ({counts.noindex})
          </button>
        </div>
        <input
          type="search"
          className="seo-filter-input"
          placeholder="Search name, slug, chain, asset"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search products"
        />
        <span className="hub-filter-meta">
          {sorted.length} of {rows.length} products
        </span>
      </div>

      <div className="hub-table-wrap">
        <div className="hub-table" role="table" aria-label="Products">
          <div className="hub-thead" role="row" style={{ gridTemplateColumns: COLS }}>
            <span className="hub-th hub-th-rank">#</span>
            <SortHeader
              label="Product"
              sortKey="productName"
              currentKey={sortKey}
              currentDir={sortDir}
              onClick={handleSort}
            />
            <SortHeader
              label="Network"
              sortKey="chain"
              currentKey={sortKey}
              currentDir={sortDir}
              onClick={handleSort}
            />
            <SortHeader
              label="Asset"
              sortKey="asset"
              currentKey={sortKey}
              currentDir={sortDir}
              onClick={handleSort}
            />
            <SortHeader
              label="24h APY"
              sortKey="apy24h"
              currentKey={sortKey}
              currentDir={sortDir}
              onClick={handleSort}
              className="hub-th-right"
            />
            <SortHeader
              label="TVL"
              sortKey="tvl"
              currentKey={sortKey}
              currentDir={sortDir}
              onClick={handleSort}
              className="hub-th-right"
            />
            <SortHeader
              label="Index"
              sortKey="indexed"
              currentKey={sortKey}
              currentDir={sortDir}
              onClick={handleSort}
            />
            <span className="hub-th">Reason</span>
            <span className="hub-th">URL</span>
          </div>
          {sorted.length === 0 ? (
            <div className="hub-empty">No products match those filters.</div>
          ) : (
            sorted.map((r, i) => (
              <div
                key={r.slug}
                className="hub-row"
                role="row"
                style={{ gridTemplateColumns: COLS }}
              >
                <span className="hub-cell hub-rank">{i + 1}</span>
                <span className="hub-cell">
                  <span className="adm-product-name">{r.productName}</span>
                  {r.groupSize > 1 && (
                    <span className="adm-product-group">
                      duplicate group: {r.groupKey} ({r.groupSize})
                    </span>
                  )}
                </span>
                <span className="hub-cell hub-strategy">
                  <span className="adm-chain">
                    <ChainIcon chain={r.chain} size={16} />
                    <span>{r.chain}</span>
                  </span>
                </span>
                <span className="hub-cell hub-strategy">{r.asset}</span>
                <span className="hub-cell hub-num hub-th-right">
                  {r.apy24h > 0 ? formatAPY(r.apy24h) : <span className="adm-empty">—</span>}
                </span>
                <span className="hub-cell hub-num hub-th-right">
                  {r.tvl > 0 ? formatTVL(r.tvl) : <span className="adm-empty">—</span>}
                </span>
                <span className="hub-cell">
                  <span className={`seo-index-pill${r.indexed ? " ok" : " no"}`}>
                    {r.indexed ? "index" : "noindex"}
                  </span>
                </span>
                <span className="hub-cell adm-reasons">
                  {r.noindexReasons.length === 0 ? (
                    <span className="adm-empty">—</span>
                  ) : (
                    r.noindexReasons.map((rsn) => (
                      <span key={rsn} className={`adm-reason adm-reason-${rsn}`}>
                        {REASON_LABEL[rsn]}
                      </span>
                    ))
                  )}
                </span>
                <span className="hub-cell adm-url-cell">
                  <a
                    href={`/${r.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="seo-slug-link mono"
                  >
                    {SITE_URL.replace(/^https?:\/\//, "")}/{r.slug}
                  </a>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
