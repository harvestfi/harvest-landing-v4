"use client";

// Admin > Acquisition. Uses the canonical product-page chart chrome
// (uni-shell / uni-chart-wrap / uni-chart / uni-chart-bars / etc.)
// for the visits chart, and the canonical hub-row grid for the
// visits table. No bespoke CSS - every class used here is defined
// in src/app/_styles/product.css or src/app/globals.css and already
// in use on the public site.

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
      {/* Title row matches the product-page header pattern. */}
      <header className="uni-title-row" style={{ marginTop: 8 }}>
        <h1 className="uni-title">Acquisition</h1>
      </header>
      <div className="uni-divider" aria-hidden="true" />

      {error && (
        <p
          className="uni-bignum-meta"
          style={{ marginTop: 16, color: "#b91c1c" }}
        >
          Could not load visits: {error}
        </p>
      )}

      {visits === null && !error && (
        <p
          className="uni-bignum-meta"
          style={{ marginTop: 24 }}
        >
          Loading visits…
        </p>
      )}

      {visits && (
        <>
          {/* Top stats sit on the same uni-side-card surface used by
              the product-page sidebar. Render four tiles in one row
              by replacing the side-card's column flow with a 4-column
              grid via inline style. Tile internals (uni-side-label +
              uni-side-value) match the sidebar 1:1. */}
          <section
            className="uni-side-card"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 0,
              marginTop: 24,
            }}
          >
            {stats && (
              <>
                <StatTile label="Last 24h" value={stats.last24} />
                <StatTile label="Last 7d" value={stats.last7} />
                <StatTile label="Last 30d" value={stats.last30} />
                <StatTile label="Unique sessions" value={stats.uniqueSessions} />
              </>
            )}
          </section>

          {/* Chart uses the canonical uni-chart-wrap / uni-chart /
              uni-chart-bars structure from TestChart - same gold
              bars on the dotted background. */}
          <VisitsChart visits={visits} days={CHART_DAYS} />

          {/* Recent visits table uses hub-row + hub-cell so it reads
              identical to the asset-hub ranking surface. */}
          <VisitsTable visits={visits.slice(0, ROWS_DISPLAY_LIMIT)} />
        </>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="uni-side-stat"
      style={{
        borderRight: "1px solid var(--uni-tint)",
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      <div className="uni-side-label">{label}</div>
      <div className="uni-side-value">{value.toLocaleString("en-US")}</div>
    </div>
  );
}

// Canonical chart from TestChart, simplified: single metric (visits),
// bar style only, no tabs, no time-range picker. All classes
// (uni-chart-wrap, uni-chart-header, uni-bignum, uni-chart,
// uni-chart-bars, uni-bar-col, uni-chart-bar, uni-chart-axis) are
// defined in src/app/_styles/product.css and inherited via the
// uni-shell wrapper.
function VisitsChart({ visits, days }: { visits: Visit[]; days: number }) {
  const { bins, max, total, latest } = useMemo(() => {
    const now = Date.now();
    const dayMs = 86_400_000;
    const out: { v: number; daysAgo: number }[] = [];
    for (let i = 0; i < days; i++) {
      out.push({ v: 0, daysAgo: days - 1 - i });
    }
    for (const v of visits) {
      const daysAgo = Math.floor(
        (now - new Date(v.created_at).getTime()) / dayMs,
      );
      if (daysAgo >= 0 && daysAgo < days) {
        out[days - 1 - daysAgo].v++;
      }
    }
    const m = Math.max(1, ...out.map((b) => b.v));
    const t = visits.length;
    return {
      bins: out,
      max: m,
      total: t,
      latest: out[out.length - 1]?.v ?? 0,
    };
  }, [visits, days]);

  return (
    <div
      className="uni-chart-wrap uni-chart--bars"
      style={{ marginTop: 20 }}
    >
      <div className="uni-chart-header">
        <div className="uni-bignum">
          <div className="uni-bignum-value">
            {total.toLocaleString("en-US")}
          </div>
          <div className="uni-bignum-meta">
            <span className="uni-bignum-label">visits in the last {days} days</span>
            <span className="uni-bignum-dot" aria-hidden="true">·</span>
            <span className="uni-bignum-date uni-bignum-date-long">
              today: {latest.toLocaleString("en-US")} · peak {max.toLocaleString("en-US")} / day
            </span>
          </div>
        </div>
      </div>

      <div className="uni-chart">
        <div className="uni-chart-bars">
          {bins.map((b, i) => {
            const heightPct = Math.max((b.v / max) * 100, b.v > 0 ? 4 : 0);
            return (
              <div
                key={i}
                className="uni-bar-col"
                title={`${b.v} visit${b.v === 1 ? "" : "s"} (${labelForDaysAgo(b.daysAgo)})`}
              >
                <div
                  className="uni-chart-bar"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="uni-chart-axis">
          <span>{days}d ago</span>
          <span>{Math.floor(days / 2)}d ago</span>
          <span>today</span>
        </div>
      </div>
    </div>
  );
}

function labelForDaysAgo(d: number): string {
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

// Recent visits table. Same hub-thead + hub-row + hub-cell scaffold
// the asset hub pages use. Only addition is the inline
// grid-template-columns override (7 cols here vs 6 on hubs).
function VisitsTable({ visits }: { visits: Visit[] }) {
  const cols =
    "160px minmax(220px, 2fr) 1fr 1fr 1fr 0.7fr 110px";

  if (visits.length === 0) {
    return (
      <div style={{ marginTop: 28 }}>
        <h2
          className="uni-bignum-label"
          style={{
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            margin: "0 0 12px",
          }}
        >
          Recent visits
        </h2>
        <p
          className="uni-bignum-meta"
          style={{
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          No visits indexed yet. Once visitors accept the consent banner the
          table will populate.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 28 }}>
      <h2
        className="uni-bignum-label"
        style={{
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          margin: "0 0 12px",
        }}
      >
        Recent visits — showing latest {visits.length}
      </h2>
      <div className="hub-table-wrap">
        <div className="hub-table">
          <div className="hub-thead" style={{ gridTemplateColumns: cols }}>
            <span className="hub-th hub-th-rank">Time</span>
            <span className="hub-th">Page</span>
            <span className="hub-th">Source</span>
            <span className="hub-th">Country</span>
            <span className="hub-th">City</span>
            <span className="hub-th">Device</span>
            <span className="hub-th">Session</span>
          </div>
          {visits.map((v) => (
            <div
              key={v.id}
              className="hub-row"
              style={{ gridTemplateColumns: cols }}
            >
              <span className="hub-cell hub-rank">{formatTime(v.created_at)}</span>
              <span className="hub-cell hub-vault">
                <span
                  className="hub-vault-name"
                  style={{ fontFamily: "var(--mono)" }}
                >
                  {v.page_path}
                </span>
              </span>
              <span className="hub-cell hub-strategy">{v.source ?? "—"}</span>
              <span className="hub-cell hub-strategy">{v.country ?? "—"}</span>
              <span className="hub-cell hub-strategy">{v.city ?? "—"}</span>
              <span className="hub-cell hub-strategy">
                {v.device_type ?? "—"}
              </span>
              <span
                className="hub-cell"
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--uni-ink-3)",
                }}
              >
                {(v.session_id || "").slice(0, 8)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
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
