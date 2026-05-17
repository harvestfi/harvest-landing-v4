"use client";

// Admin > Acquisition. Reads the last N visits from Supabase
// frontpage_visits at request time using the anon key + a permissive
// SELECT policy. Visual language matches the public site:
//   - <div className="uni-shell"> wrapper for the product-page chrome
//   - Top stats use the same side-card surface as the product page
//     sidebar (Sunflower Gold accent, White Smoke tile background).
//   - Chart reuses the eco-chart bar idiom: dotted background grid,
//     gold bars rooted at the baseline, dashed axes.
//   - Table reuses the hub-table grid + typography so the rows read
//     identical to the asset-hub ranking surface.

import { useEffect, useMemo, useState } from "react";
import { supabaseSelect } from "@/lib/supabase";

interface Visit {
  id: string;
  created_at: string;
  session_id: string;
  page_path: string;
  source: string | null;
  country: string | null;
  city: string | null;
  device_type: string | null;
}

const ROWS_FETCH_LIMIT = 1000;
const ROWS_DISPLAY_LIMIT = 200;
const CHART_DAYS = 30;

export default function AcquisitionPage() {
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = `select=id,created_at,session_id,page_path,source,country,city,device_type&order=created_at.desc&limit=${ROWS_FETCH_LIMIT}`;
        const data = await supabaseSelect<Visit>("frontpage_visits", params);
        if (!cancelled) setVisits(data);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    if (!visits) return null;
    const now = Date.now();
    const dayMs = 86_400_000;
    const count = (days: number) =>
      visits.filter((v) => now - new Date(v.created_at).getTime() < days * dayMs)
        .length;
    return {
      last24: count(1),
      last7: count(7),
      last30: count(30),
      uniqueSessions: new Set(visits.map((v) => v.session_id)).size,
    };
  }, [visits]);

  return (
    <div className="uni-shell">
      <main className="aq-main">
        <header className="uni-title-row aq-title-row">
          <h1 className="uni-title">Acquisition</h1>
          <div className="uni-title-meta">
            <p className="aq-sub">
              Anonymous page visits captured from the public site. No cookies,
              no third-party trackers, no personal data. Operator pages
              (<code>/admin/*</code>) are excluded from tracking.
            </p>
          </div>
        </header>

        <div className="uni-divider" aria-hidden="true" />

        {error && (
          <div className="aq-error" role="alert">
            Could not load visits: {error}
          </div>
        )}

        {visits === null && !error && (
          <div className="aq-empty">Loading visits…</div>
        )}

        {visits && (
          <>
            <SummaryGrid stats={stats} />
            <AcquisitionChart visits={visits} days={CHART_DAYS} />
            <AcquisitionTable visits={visits.slice(0, ROWS_DISPLAY_LIMIT)} />
          </>
        )}
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Top stats — same surface as the product-page side card.
// Renders four tiles in a horizontal grid.
// ──────────────────────────────────────────────────────────────────

function SummaryGrid({
  stats,
}: {
  stats: {
    last24: number;
    last7: number;
    last30: number;
    uniqueSessions: number;
  } | null;
}) {
  if (!stats) return null;
  return (
    <section className="aq-summary uni-side-card aq-summary-card">
      <StatTile label="Last 24h" value={stats.last24} />
      <StatTile label="Last 7d" value={stats.last7} />
      <StatTile label="Last 30d" value={stats.last30} />
      <StatTile label="Unique sessions" value={stats.uniqueSessions} />
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="aq-stat">
      <div className="uni-side-label aq-stat-label">{label}</div>
      <div className="uni-side-headline aq-stat-value">
        {value.toLocaleString("en-US")}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Chart — gold bars on dotted background, mirrors eco-chart idiom.
// All bars use the .you modifier so they paint gold; baseline shows
// the per-day mean for context.
// ──────────────────────────────────────────────────────────────────

function AcquisitionChart({
  visits,
  days,
}: {
  visits: Visit[];
  days: number;
}) {
  const { bins, max, mean } = useMemo(() => {
    const now = Date.now();
    const dayMs = 86_400_000;
    const out = new Array(days).fill(0);
    for (const v of visits) {
      const daysAgo = Math.floor(
        (now - new Date(v.created_at).getTime()) / dayMs,
      );
      if (daysAgo >= 0 && daysAgo < days) {
        out[days - 1 - daysAgo]++;
      }
    }
    const m = Math.max(1, ...out);
    const avg = out.reduce((s, n) => s + n, 0) / days;
    return { bins: out, max: m, mean: avg };
  }, [visits, days]);

  // Anchor the chart ceiling slightly above the max bar so the
  // tallest column doesn't kiss the top edge (matches eco-chart).
  const ceil = Math.max(max * 1.08, mean * 1.5, 1);
  const meanPct = (mean / ceil) * 100;

  return (
    <section className="aq-chart-section">
      <header className="aq-section-head">
        <h2 className="aq-section-title">Visits — last {days} days</h2>
        <span className="aq-section-meta">
          Peak {max.toLocaleString("en-US")} / day · Avg{" "}
          {Math.round(mean).toLocaleString("en-US")} / day
        </span>
      </header>
      <div className="eco-chart-wrap aq-chart-wrap">
        <div className="eco-chart-col">
          <div
            className="eco-chart aq-chart"
            role="img"
            aria-label={`Daily visits, last ${days} days`}
          >
            <span
              className="eco-chart-baseline"
              style={{ bottom: `${meanPct}%` }}
            >
              <span className="eco-chart-baseline-label mono">
                Daily avg {Math.round(mean).toLocaleString("en-US")}
              </span>
            </span>
            {bins.map((v, i) => {
              const heightPct = (v / ceil) * 100;
              const daysAgo = days - 1 - i;
              return (
                <div
                  key={i}
                  className="eco-bar-col you"
                  title={`${v} visit${v === 1 ? "" : "s"} (${labelForDaysAgo(daysAgo)})`}
                >
                  <span
                    className="eco-bar"
                    style={{ height: `${Math.max(heightPct, 1)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="eco-chart-axis aq-chart-axis">
            <span className="mono">{days}d</span>
            <span className="mono">15d</span>
            <span className="mono">today</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function labelForDaysAgo(d: number): string {
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

// ──────────────────────────────────────────────────────────────────
// Table — matches the asset-hub ranking surface. Grid template is
// custom (7 columns for acquisition vs 6 on hubs) but every other
// class is the same as hub-table.tsx so typography, hover, and
// row dividers read identical to the public ranking pages.
// ──────────────────────────────────────────────────────────────────

function AcquisitionTable({ visits }: { visits: Visit[] }) {
  if (visits.length === 0) {
    return (
      <section className="aq-table-section">
        <header className="aq-section-head">
          <h2 className="aq-section-title">Recent visits</h2>
        </header>
        <div className="aq-empty">
          No visits indexed yet. Once visitors accept the consent banner the
          table will populate.
        </div>
      </section>
    );
  }
  return (
    <section className="aq-table-section">
      <header className="aq-section-head">
        <h2 className="aq-section-title">
          Recent visits — showing latest {visits.length}
        </h2>
      </header>
      <div className="hub-table-wrap aq-table-wrap">
        <div className="hub-table aq-table">
          <div className="hub-thead aq-thead">
            <span className="hub-th hub-th-rank">Time</span>
            <span className="hub-th">Page</span>
            <span className="hub-th">Source</span>
            <span className="hub-th">Country</span>
            <span className="hub-th">City</span>
            <span className="hub-th">Device</span>
            <span className="hub-th">Session</span>
          </div>
          {visits.map((v) => (
            <div key={v.id} className="hub-row aq-row">
              <span className="hub-cell aq-cell-time">
                {formatTime(v.created_at)}
              </span>
              <span className="hub-cell aq-cell-page mono">{v.page_path}</span>
              <span className="hub-cell">{v.source ?? "—"}</span>
              <span className="hub-cell">{v.country ?? "—"}</span>
              <span className="hub-cell">{v.city ?? "—"}</span>
              <span className="hub-cell">{v.device_type ?? "—"}</span>
              <span className="hub-cell aq-cell-session mono">
                {(v.session_id || "").slice(0, 8)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}
