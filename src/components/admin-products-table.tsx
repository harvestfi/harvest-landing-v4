"use client";

import { useMemo, useState } from "react";
import { ChainIcon } from "./token-icons";
import { formatAPY, formatTVL } from "@/lib/format";
import { SITE_URL } from "@/lib/constants";

export interface AdminRow {
  slug: string;
  productName: string;
  chain: string;
  asset: string;
  apy24h: number;
  tvl: number;
  indexed: boolean;
  groupKey: string;
  groupSize: number;
}

type Filter = "all" | "indexed" | "noindex";

interface Props {
  rows: AdminRow[];
}

// Grid track for the products ranking. Mirrors the column rhythm
// used by HubTable on the public ranking surfaces so this admin
// view sits on the same visual rails as /eth, /usdc, the SEO
// inventory, and Acquisition's recent-visits table.
const COLS =
  "44px minmax(220px, 2fr) 1fr 70px 90px 100px 90px minmax(180px, 1.4fr)";

export function AdminProductsTable({ rows }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

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
          {filtered.length} of {rows.length} products
        </span>
      </div>

      <div className="hub-table-wrap">
        <div className="hub-table" role="table" aria-label="Products">
          <div className="hub-thead" role="row" style={{ gridTemplateColumns: COLS }}>
            <span className="hub-th hub-th-rank">#</span>
            <span className="hub-th">Product</span>
            <span className="hub-th">Network</span>
            <span className="hub-th">Asset</span>
            <span className="hub-th hub-th-right">24h APY</span>
            <span className="hub-th hub-th-right">TVL</span>
            <span className="hub-th">Index</span>
            <span className="hub-th">URL</span>
          </div>
          {filtered.length === 0 ? (
            <div className="hub-empty">No products match those filters.</div>
          ) : (
            filtered.map((r, i) => (
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
                <span className="hub-cell hub-num hub-th-right">{formatAPY(r.apy24h)}</span>
                <span className="hub-cell hub-num hub-th-right">{formatTVL(r.tvl)}</span>
                <span className="hub-cell">
                  <span className={`seo-index-pill${r.indexed ? " ok" : " no"}`}>
                    {r.indexed ? "index" : "noindex"}
                  </span>
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
