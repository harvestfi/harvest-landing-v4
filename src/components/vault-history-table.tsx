"use client";

import { useState, useMemo } from "react";
import type { FullVaultHistory } from "@/lib/history-api";

interface VaultHistoryTableProps {
  history: FullVaultHistory;
}

type TabMode = "apy" | "tvl" | "sharePrice";

const ROWS_PER_PAGE = 7;

// Always format in UTC so the displayed date matches the
// dedupeLatestPerDay key (also UTC). The previous local-time
// formatting could render two snapshots on adjacent UTC days as the
// same local calendar date - the dedupe kept both records (correct,
// they're distinct days), but the rendered table showed "May 15"
// twice, which read as a deduplication regression. Locking both
// keying and display to UTC keeps them in lockstep.
function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Real zero is a real reading, not a missing value. The previous
// `if (value === 0) return "-"` substitution hid legitimate "Low:
// 0.00%" entries (Autopilot pages with a single zero-APY day in
// history) behind a placeholder dash. Render 0 as a real number;
// the parent component already skips rendering when summary itself
// is null (zero data points).
function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
}

function formatDollar(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatSharePrice(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1) return value.toFixed(4);
  return value.toFixed(6);
}

function computeSummary(values: number[]) {
  if (values.length === 0) return null;
  const sum = values.reduce((s, v) => s + v, 0);
  const avg = sum / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const high = sorted[sorted.length - 1];
  const low = sorted[0];
  return { avg, high, low, count: values.length };
}

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 365) return `${Math.floor(diff / (86400 * 30))}mo ago`;
  return `${(diff / (86400 * 365)).toFixed(1)}y ago`;
}

const TAB_CONFIG: Record<
  TabMode,
  { label: string; header: string }
> = {
  apy: { label: "APY", header: "APY" },
  tvl: { label: "TVL", header: "TVL" },
  sharePrice: { label: "Share Price", header: "Share Price" },
};

export function VaultHistoryTable({ history }: VaultHistoryTableProps) {
  const [tab, setTab] = useState<TabMode>("apy");
  const [page, setPage] = useState(0);

  // One row per calendar day, using the LATEST intraday snapshot
  // (end-of-day reading) as the canonical value for that date. The
  // chart above this table can still use the full granularity; the
  // table is presented as a daily log, so duplicated dates would be
  // confusing. Applies to all three tabs.
  const apyData = useMemo(
    () =>
      dedupeLatestPerDay(history.apyHistory.filter((p) => p.apy >= 0)).sort(
        (a, b) => b.timestamp - a.timestamp,
      ),
    [history.apyHistory],
  );
  const tvlData = useMemo(
    () =>
      dedupeLatestPerDay(history.tvlHistory.filter((p) => p.value > 0)).sort(
        (a, b) => b.timestamp - a.timestamp,
      ),
    [history.tvlHistory],
  );
  const spData = useMemo(
    () =>
      dedupeLatestPerDay(
        history.sharePriceHistory.filter((p) => p.sharePrice > 0),
      ).sort((a, b) => b.timestamp - a.timestamp),
    [history.sharePriceHistory],
  );

  const dataMap = { apy: apyData, tvl: tvlData, sharePrice: spData };
  const currentData =
    tab === "apy"
      ? apyData.map((p) => ({ ts: p.timestamp, v: p.apy }))
      : tab === "tvl"
        ? tvlData.map((p) => ({ ts: p.timestamp, v: p.value }))
        : spData.map((p) => ({ ts: p.timestamp, v: p.sharePrice }));

  const totalPages = Math.max(1, Math.ceil(currentData.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = currentData.slice(
    safePage * ROWS_PER_PAGE,
    (safePage + 1) * ROWS_PER_PAGE,
  );

  const summary = computeSummary(currentData.map((p) => p.v));
  const formatFn =
    tab === "apy"
      ? formatPercent
      : tab === "tvl"
        ? formatDollar
        : formatSharePrice;

  // Data freshness: latest timestamp across all series
  const latestTs = Math.max(
    apyData[0]?.timestamp ?? 0,
    tvlData[0]?.timestamp ?? 0,
    spData[0]?.timestamp ?? 0,
  );
  const isStale =
    latestTs > 0 && Math.floor(Date.now() / 1000) - latestTs > 7 * 86400;

  // Available tabs (only show tabs with data)
  const tabs = (["apy", "tvl", "sharePrice"] as TabMode[]).filter(
    (t) => dataMap[t].length > 0,
  );

  if (tabs.length === 0) return null;

  return (
    <div className="pp-section" id="history">
      <h2>Historical Data</h2>

      {isStale && latestTs > 0 && (
        <p
          style={{
            fontSize: 12,
            color: "var(--ink-4)",
            margin: "0 0 10px",
            fontStyle: "italic",
          }}
        >
          Last data point: {formatDate(latestTs)} ({relativeTime(latestTs)}).
          Some on-chain data feeds update at different intervals.
        </p>
      )}

      <div className="vh-table-wrap">
        {/* Header: metric tabs on the left, lifetime summary inline
            on the right of the same row. */}
        <div className="vh-table-header">
          <div className="chart-data-tabs">
            {tabs.map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => {
                  setTab(t);
                  setPage(0);
                }}
              >
                {TAB_CONFIG[t].label}
              </button>
            ))}
          </div>
          {summary && (
            <div className="vh-summary">
              <span className="vh-summary-item">
                <span className="vh-summary-label">Lifetime avg</span>
                <strong>{formatFn(summary.avg)}</strong>
              </span>
              <span className="vh-summary-item">
                <span className="vh-summary-label">High</span>
                <strong>{formatFn(summary.high)}</strong>
              </span>
              <span className="vh-summary-item">
                <span className="vh-summary-label">Low</span>
                <strong>{formatFn(summary.low)}</strong>
              </span>
              <span className="vh-summary-item">
                <span className="vh-summary-label">Data points</span>
                <strong>{summary.count}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Table */}
        {pageItems.length > 0 ? (
          <table className="chart-datatable">
            <thead>
              <tr>
                <th>Date</th>
                <th className="r">{TAB_CONFIG[tab].header}</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item) => (
                <tr key={item.ts}>
                  <td>{formatDate(item.ts)}</td>
                  <td className="r">{formatFn(item.v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div
            style={{
              padding: "32px 14px",
              textAlign: "center",
              color: "var(--ink-4)",
              fontSize: 13,
            }}
          >
            No {TAB_CONFIG[tab].label} history available for this vault.
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="chart-datatable-foot">
            <span className="mono dim">
              Page {safePage + 1} of {totalPages}
            </span>
            <div className="pager">
              <button
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Prev
              </button>
              <button
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Keep one record per UTC calendar day, picking the snapshot with
// the latest timestamp for that day (end-of-day reading). Preserves
// the original record shape so the caller's downstream mapping
// (p.apy / p.value / p.sharePrice) still works.
function dedupeLatestPerDay<T extends { timestamp: number }>(
  points: T[],
): T[] {
  const byDay = new Map<string, T>();
  for (const p of points) {
    const day = new Date(p.timestamp * 1000).toISOString().slice(0, 10);
    const existing = byDay.get(day);
    if (!existing || p.timestamp > existing.timestamp) {
      byDay.set(day, p);
    }
  }
  return Array.from(byDay.values());
}
