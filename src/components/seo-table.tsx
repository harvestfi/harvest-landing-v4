"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type RowType = "Home" | "Asset hub" | "Network hub" | "Product";

interface SeoRow {
  type: RowType;
  slug: string;
  title: string;
  description: string;
  chain: string;
  apy: string;
  tvl: string;
  indexed: boolean;
}

type SortKey =
  | "natural"
  | "type"
  | "slug"
  | "title"
  | "description"
  | "chain"
  | "apy"
  | "tvl"
  | "indexed";
type SortDir = "asc" | "desc";

const TITLE_LIMIT = 58;
const DESC_LIMIT = 155;

const TYPE_ORDER: Record<RowType, number> = {
  Home: 0,
  "Asset hub": 1,
  "Network hub": 2,
  Product: 3,
};

// Single ranking grid track. Matches the columnar look of the public
// hub tables (/eth, /usdc, /admin/acquisition) so the SEO page sits
// inside the same visual language as the rest of the admin.
const COLS =
  "48px 110px minmax(170px, 1.4fr) minmax(260px, 2fr) minmax(280px, 2.4fr) 90px 70px 80px 70px";

function CharCount({ count, limit }: { count: number; limit: number }) {
  const over = count > limit;
  return (
    <span className={`adm-char-count${over ? " over" : ""}`}>({count})</span>
  );
}

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

export function SeoTable({
  rows,
}: {
  rows: SeoRow[];
  siteOrigin?: string;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("natural");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.slug.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.chain.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const sorted = useMemo(() => {
    if (sortKey === "natural") return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortKey === "indexed") {
        const an = a.indexed ? 1 : 0;
        const bn = b.indexed ? 1 : 0;
        return sortDir === "asc" ? an - bn : bn - an;
      }
      if (sortKey === "type") {
        const an = TYPE_ORDER[a.type];
        const bn = TYPE_ORDER[b.type];
        const cmp = an - bn;
        return sortDir === "asc" ? cmp : -cmp;
      }
      let av = a[sortKey] as string;
      let bv = b[sortKey] as string;
      if (sortKey === "apy" || sortKey === "tvl") {
        const an = parseFloat(av.replace(/[^0-9.\-]/g, "")) || 0;
        const bn = parseFloat(bv.replace(/[^0-9.\-]/g, "")) || 0;
        return sortDir === "asc" ? an - bn : bn - an;
      }
      av = av.toLowerCase();
      bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  return (
    <>
      <div className="hub-filterbar" role="group" aria-label="Filter pages">
        <input
          type="search"
          className="seo-filter-input"
          placeholder="Filter by slug, title, type, or chain"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Filter pages"
        />
        <span className="hub-filter-meta">
          {sorted.length} of {rows.length} pages
        </span>
      </div>

      <div className="hub-table-wrap">
        <div className="hub-table" role="table" aria-label="SEO inventory">
          <div
            className="hub-thead"
            role="row"
            style={{ gridTemplateColumns: COLS }}
          >
            <span className="hub-th hub-th-rank">#</span>
            <SortHeader
              label="Type"
              sortKey="type"
              currentKey={sortKey}
              currentDir={sortDir}
              onClick={handleSort}
            />
            <SortHeader
              label="Slug"
              sortKey="slug"
              currentKey={sortKey}
              currentDir={sortDir}
              onClick={handleSort}
            />
            <SortHeader
              label="Meta title"
              sortKey="title"
              currentKey={sortKey}
              currentDir={sortDir}
              onClick={handleSort}
            />
            <SortHeader
              label="Meta description"
              sortKey="description"
              currentKey={sortKey}
              currentDir={sortDir}
              onClick={handleSort}
            />
            <SortHeader
              label="Chain"
              sortKey="chain"
              currentKey={sortKey}
              currentDir={sortDir}
              onClick={handleSort}
            />
            <SortHeader
              label="APY"
              sortKey="apy"
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
          </div>
          {sorted.length === 0 ? (
            <div className="hub-empty">No pages match those filters.</div>
          ) : (
            sorted.map((row, i) => {
              const titleLen = row.title.length;
              const descLen = row.description.length;
              const truncatedDesc =
                row.description.length > 220
                  ? row.description.slice(0, 220) + "…"
                  : row.description;
              const typeClass = row.type.toLowerCase().replace(/\s+/g, "-");
              return (
                <div
                  key={`${row.type}-${row.slug}`}
                  className="hub-row seo-row"
                  role="row"
                  style={{ gridTemplateColumns: COLS }}
                >
                  <span className="hub-cell hub-rank">{i + 1}</span>
                  <span className="hub-cell">
                    <span className={`seo-type-pill seo-type-${typeClass}`}>
                      {row.type}
                    </span>
                  </span>
                  <span className="hub-cell seo-slug-cell">
                    <Link href={row.slug} className="seo-slug-link mono">
                      {row.slug}
                    </Link>
                  </span>
                  <span className="hub-cell seo-text-cell">
                    <span className="seo-title">{row.title}</span>
                    <CharCount count={titleLen} limit={TITLE_LIMIT} />
                  </span>
                  <span className="hub-cell seo-text-cell">
                    <span className="seo-desc">{truncatedDesc}</span>
                    <CharCount count={descLen} limit={DESC_LIMIT} />
                  </span>
                  <span className="hub-cell hub-strategy">{row.chain}</span>
                  <span className="hub-cell hub-num hub-th-right">
                    {row.apy}
                  </span>
                  <span className="hub-cell hub-num hub-th-right">
                    {row.tvl}
                  </span>
                  <span className="hub-cell">
                    <span
                      className={`seo-index-pill${row.indexed ? " ok" : " no"}`}
                    >
                      {row.indexed ? "index" : "noindex"}
                    </span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
