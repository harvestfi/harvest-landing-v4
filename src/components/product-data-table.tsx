"use client";

// Data-quality table for the control room (DATA > Product Data). One row
// per product, showing how many indexed points we hold for each of the
// three key series (TVL, APY, share price) versus the vault's age, so the
// data team can see at a glance which products need a backfill / daily
// snapshot. Status rolls the three series up into a single badge; each
// point-count cell is tinted by that series' own coverage. Sits on the
// shared hub-table rails so it matches Products / SEO inventory.

import { useMemo, useState } from "react";
import { ChainIcon } from "./token-icons";

export type SeriesHealth = "missing" | "sparse" | "partial" | "good" | "dense";
export type DataStatus = "critical" | "minor" | "good" | "perfect";

// Per-series ingestion intel, surfaced in the expandable row so the data
// team (and Ruby) can see at a glance how a product's data is pulled and
// which series is off: counts returned, the indexed date span, density, and
// a short human verdict.
export interface SeriesDiag {
  key: "TVL" | "APY" | "Share";
  entity: string; // subgraph entity we query for this series
  points: number;
  firstTs: number | null;
  lastTs: number | null;
  perDay: number;
  off: boolean;
  note: string;
}

export interface ProductDataRow {
  slug: string;
  network: string;
  productName: string;
  deploymentTs: number | null;
  ageDays: number;
  tvlPoints: number;
  apyPoints: number;
  spPoints: number;
  tvlHealth: SeriesHealth;
  apyHealth: SeriesHealth;
  spHealth: SeriesHealth;
  status: DataStatus;
  // ingestion intel for the expandable row
  chainId: string;
  endpoint: string;
  latestTs: number | null;
  diag: SeriesDiag[];
}

export const STATUS_META: Record<
  DataStatus,
  { label: string; cls: string; rank: number }
> = {
  critical: { label: "Needs fix", cls: "is-critical", rank: 0 },
  minor: { label: "Non-urgent fix", cls: "is-minor", rank: 1 },
  good: { label: "Good standing", cls: "is-good", rank: 2 },
  perfect: { label: "Perfect", cls: "is-perfect", rank: 3 },
};

// missing/sparse -> red, partial -> amber, good -> neutral, dense -> green.
const HEALTH_CLS: Record<SeriesHealth, string> = {
  missing: "is-sparse",
  sparse: "is-sparse",
  partial: "is-partial",
  good: "",
  dense: "is-dense",
};

const COLS =
  "minmax(110px, 0.9fr) minmax(200px, 2fr) 140px 76px 76px 88px 144px 34px";

type SortKey =
  | "status"
  | "network"
  | "productName"
  | "deploymentTs"
  | "tvlPoints"
  | "apyPoints"
  | "spPoints";
type SortDir = "asc" | "desc";
type Filter = "all" | DataStatus;

const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "critical", label: "Needs fix" },
  { value: "minor", label: "Non-urgent" },
  { value: "good", label: "Good standing" },
  { value: "perfect", label: "Perfect" },
];

function fmtDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  onClick: (k: SortKey) => void;
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

export function ProductDataTable({ rows }: { rows: ProductDataRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (slug: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: rows.length,
      critical: 0,
      minor: 0,
      good: 0,
      perfect: 0,
    };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const filtered =
      filter === "all" ? rows : rows.filter((r) => r.status === filter);
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (r: ProductDataRow): number | string => {
      switch (sortKey) {
        case "status":
          return STATUS_META[r.status].rank;
        case "network":
          return r.network;
        case "productName":
          return r.productName;
        case "deploymentTs":
          return r.deploymentTs ?? 0;
        case "tvlPoints":
          return r.tvlPoints;
        case "apyPoints":
          return r.apyPoints;
        case "spPoints":
          return r.spPoints;
      }
    };
    return [...filtered].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      let cmp =
        typeof av === "string"
          ? av.localeCompare(bv as string)
          : (av as number) - (bv as number);
      // Tiebreak: fewest total points first (most in need), then name.
      if (cmp === 0) {
        cmp =
          a.tvlPoints + a.apyPoints + a.spPoints -
          (b.tvlPoints + b.apyPoints + b.spPoints);
      }
      if (cmp === 0) cmp = a.productName.localeCompare(b.productName);
      return cmp * dir;
    });
  }, [rows, filter, sortKey, sortDir]);

  const onSort = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      // Text columns read best ascending; status worst-first (asc);
      // numeric/date columns most-first (desc).
      setSortDir(k === "network" || k === "productName" || k === "status" ? "asc" : "desc");
    }
  };

  return (
    <>
      <div
        className="seo-status-tabs"
        role="tablist"
        aria-label="Filter by data status"
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            className={`seo-status-tab${filter === f.value ? " active" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label} ({counts[f.value]})
          </button>
        ))}
      </div>

      <div className="hub-table-wrap">
        <div className="hub-table" role="table" aria-label="Product data coverage">
          <div className="hub-thead" role="row" style={{ gridTemplateColumns: COLS }}>
            <SortHeader label="Network" sortKey="network" currentKey={sortKey} currentDir={sortDir} onClick={onSort} />
            <SortHeader label="Product" sortKey="productName" currentKey={sortKey} currentDir={sortDir} onClick={onSort} />
            <SortHeader label="Deployed" sortKey="deploymentTs" currentKey={sortKey} currentDir={sortDir} onClick={onSort} />
            <SortHeader label="TVL" sortKey="tvlPoints" currentKey={sortKey} currentDir={sortDir} onClick={onSort} className="hub-th-right" />
            <SortHeader label="APY" sortKey="apyPoints" currentKey={sortKey} currentDir={sortDir} onClick={onSort} className="hub-th-right" />
            <SortHeader label="Share" sortKey="spPoints" currentKey={sortKey} currentDir={sortDir} onClick={onSort} className="hub-th-right" />
            <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onClick={onSort} />
            <span className="hub-th" aria-hidden="true" />
          </div>

          {visible.length === 0 ? (
            <div className="hub-empty">No products match this filter.</div>
          ) : (
            visible.map((r) => {
              const isOpen = expanded.has(r.slug);
              return (
                <div key={r.slug} className="pd-rowgroup">
                  <div
                    className="hub-row pd-row-clickable"
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => toggle(r.slug)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(r.slug);
                      }
                    }}
                    style={{ gridTemplateColumns: COLS }}
                  >
                    <span className="hub-cell hub-strategy" role="cell">
                      <span className="adm-chain">
                        <ChainIcon chain={r.network} size={16} />
                        <span>{r.network}</span>
                      </span>
                    </span>
                    <span className="hub-cell pd-name" role="cell">
                      <a
                        href={`/${r.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.productName}
                      </a>
                    </span>
                    <span className="hub-cell pd-deployed" role="cell">
                      {fmtDate(r.deploymentTs)}
                      <span className="pd-age">{r.ageDays > 0 ? `${r.ageDays}d` : "—"}</span>
                    </span>
                    <span className={`hub-cell hub-num hub-th-right pd-pts ${HEALTH_CLS[r.tvlHealth]}`} role="cell">
                      {r.tvlPoints}
                    </span>
                    <span className={`hub-cell hub-num hub-th-right pd-pts ${HEALTH_CLS[r.apyHealth]}`} role="cell">
                      {r.apyPoints}
                    </span>
                    <span className={`hub-cell hub-num hub-th-right pd-pts ${HEALTH_CLS[r.spHealth]}`} role="cell">
                      {r.spPoints}
                    </span>
                    <span className="hub-cell" role="cell">
                      <span className={`pd-badge ${STATUS_META[r.status].cls}`}>
                        {STATUS_META[r.status].label}
                      </span>
                    </span>
                    <span className="hub-cell pd-chev-cell" role="cell">
                      <Chevron open={isOpen} />
                    </span>
                  </div>
                  {isOpen && <RowIntel row={r} />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`pd-chev${open ? " open" : ""}`}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// Expanded ingestion intel for one product: how its data is pulled (endpoint,
// query shape), what each series returned, and which series is off — a quick
// brief for the data team / Ruby on what's wrong at the source.
function RowIntel({ row }: { row: ProductDataRow }) {
  return (
    <div className="pd-intel" role="row">
      <div className="pd-intel-inner">
        <div className="pd-intel-head">How this product&apos;s data is pulled</div>
        <div className="pd-intel-method">
          <div>
            <span className="pd-intel-label">Source</span>
            <code>POST {row.endpoint}</code> · {row.network} (chainId {row.chainId})
          </div>
          <div>
            <span className="pd-intel-label">Query</span>
            GraphQL over <code>tvls</code>, <code>vaultHistories</code> (share
            price), <code>apyAutoCompounds</code> — paginated by timestamp
            (recent-first), kept to one point per UTC day.
          </div>
          <div>
            <span className="pd-intel-label">Span</span>
            first indexed point {fmtDate(row.deploymentTs)}
            {row.ageDays > 0 ? ` (${row.ageDays}d ago)` : ""} · latest{" "}
            {fmtDate(row.latestTs)}
          </div>
        </div>
        <div className="pd-intel-series">
          {row.diag.map((s) => (
            <div
              key={s.key}
              className={`pd-intel-srow${s.off ? " is-off" : ""}`}
            >
              <span className="pd-intel-key">{s.key}</span>
              <span className="pd-intel-entity">
                <code>{s.entity}</code>
              </span>
              <span className="pd-intel-count">
                {s.points.toLocaleString("en-US")} pts
              </span>
              <span className="pd-intel-rng">
                {fmtDate(s.firstTs)} → {fmtDate(s.lastTs)}
              </span>
              <span className="pd-intel-rate">~{s.perDay.toFixed(2)}/day</span>
              <span className="pd-intel-note">
                {s.off ? "⚠ " : "✓ "}
                {s.note}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
