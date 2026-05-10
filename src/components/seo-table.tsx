"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface VaultSeoRow {
  slug: string;
  title: string;
  description: string;
  chain: string;
  apy: string;
  tvl: string;
  indexed: boolean;
}

type SortKey =
  | "slug"
  | "title"
  | "description"
  | "chain"
  | "apy"
  | "tvl"
  | "indexed";
type SortDir = "asc" | "desc";

// Memo limits: 580px / ~58 chars on title, 130-155 on description.
const TITLE_LIMIT = 58;
const DESC_LIMIT = 155;

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
    <th
      className={`adm-th adm-th-sort${active ? " active" : ""} ${className ?? ""}`.trim()}
      onClick={() => onClick(sortKey)}
    >
      <span>{label}</span>
      <span className="adm-sort-ind" aria-hidden="true">
        {active ? (currentDir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </th>
  );
}

export function SeoTable({
  rows,
  vaultCount,
  lastUpdated,
}: {
  rows: VaultSeoRow[];
  vaultCount: number;
  lastUpdated: string;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("slug");
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
        r.chain.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortKey === "indexed") {
        const an = a.indexed ? 1 : 0;
        const bn = b.indexed ? 1 : 0;
        return sortDir === "asc" ? an - bn : bn - an;
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
    <div className="adm-seo">
      <header className="adm-seo-head">
        <h1>SEO Overview</h1>
        <p className="adm-seo-meta">
          {vaultCount} vaults · last updated {lastUpdated}
        </p>
      </header>

      <div className="adm-seo-controls">
        <input
          type="text"
          className="adm-input"
          placeholder="Filter by slug, title, or chain"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="adm-seo-count">
          Showing {sorted.length} of {rows.length}
        </span>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th className="adm-th adm-th-rank">#</th>
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
                className="adm-col-desc"
              />
              <SortHeader
                label="Chain"
                sortKey="chain"
                currentKey={sortKey}
                currentDir={sortDir}
                onClick={handleSort}
                className="adm-col-md"
              />
              <SortHeader
                label="APY"
                sortKey="apy"
                currentKey={sortKey}
                currentDir={sortDir}
                onClick={handleSort}
                className="adm-col-md adm-th-right"
              />
              <SortHeader
                label="TVL"
                sortKey="tvl"
                currentKey={sortKey}
                currentDir={sortDir}
                onClick={handleSort}
                className="adm-col-md adm-th-right"
              />
              <SortHeader
                label="Index"
                sortKey="indexed"
                currentKey={sortKey}
                currentDir={sortDir}
                onClick={handleSort}
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const titleLen = row.title.length;
              const descLen = row.description.length;
              const truncatedDesc =
                row.description.length > 200
                  ? row.description.slice(0, 200) + "…"
                  : row.description;
              return (
                <tr key={row.slug} className="adm-row">
                  <td className="adm-cell adm-rank">{i + 1}</td>
                  <td className="adm-cell adm-slug">
                    <Link href={`/${row.slug}`} className="adm-link">
                      {row.slug}
                    </Link>
                  </td>
                  <td className="adm-cell">
                    <span className="adm-title">{row.title}</span>
                    <CharCount count={titleLen} limit={TITLE_LIMIT} />
                  </td>
                  <td className="adm-cell adm-col-desc">
                    <span className="adm-desc">{truncatedDesc}</span>
                    <CharCount count={descLen} limit={DESC_LIMIT} />
                  </td>
                  <td className="adm-cell adm-col-md">{row.chain}</td>
                  <td className="adm-cell adm-col-md adm-cell-right adm-num">
                    {row.apy}
                  </td>
                  <td className="adm-cell adm-col-md adm-cell-right adm-num">
                    {row.tvl}
                  </td>
                  <td className="adm-cell">
                    <span
                      className={`adm-pill${row.indexed ? " ok" : " no"}`}
                    >
                      {row.indexed ? "index" : "noindex"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
