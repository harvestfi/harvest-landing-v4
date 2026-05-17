"use client";

// Admin > Acquisition. Reads the last N visits from Supabase
// frontpage_visits at request time using the anon key + a permissive
// SELECT policy. Renders a 30-day visits chart at top + a recent-
// visits table below.
//
// Privacy posture: visits contain no PII - random session UUIDs,
// country-level location, page paths, browser/device strings.
// Surfacing only the columns the operator audit asked for; the
// extra fields (UTM, screen size, browser version, etc.) are stored
// in Supabase and available for future reports.

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
    const last24 = visits.filter(
      (v) => now - new Date(v.created_at).getTime() < dayMs,
    );
    const last7 = visits.filter(
      (v) => now - new Date(v.created_at).getTime() < 7 * dayMs,
    );
    const last30 = visits.filter(
      (v) => now - new Date(v.created_at).getTime() < 30 * dayMs,
    );
    const uniqueSessions = new Set(visits.map((v) => v.session_id)).size;
    return {
      last24: last24.length,
      last7: last7.length,
      last30: last30.length,
      uniqueSessions,
    };
  }, [visits]);

  return (
    <main className="aq-page">
      <header className="aq-header">
        <h1 className="aq-h1">Acquisition</h1>
        <p className="aq-sub">
          Anonymous page visits captured from the public site. No cookies, no
          third-party trackers, no personal data. Operator pages
          (<code>/admin/*</code>) are excluded from tracking.
        </p>
      </header>

      {error && <div className="aq-error">Could not load visits: {error}</div>}

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
  );
}

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
    <section className="aq-summary">
      <Card label="Last 24h" value={stats.last24} />
      <Card label="Last 7d" value={stats.last7} />
      <Card label="Last 30d" value={stats.last30} />
      <Card label="Unique sessions" value={stats.uniqueSessions} />
    </section>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="aq-summary-card">
      <div className="aq-summary-label">{label}</div>
      <div className="aq-summary-value">{value.toLocaleString("en-US")}</div>
    </div>
  );
}

function AcquisitionChart({
  visits,
  days,
}: {
  visits: Visit[];
  days: number;
}) {
  const { bins, max } = useMemo(() => {
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
    return { bins: out, max: Math.max(1, ...out) };
  }, [visits, days]);

  // Build SVG paths in a 1000x260 viewBox so the chart scales to the
  // card width while keeping the dotted grid aligned.
  const W = 1000;
  const H = 240;
  const PADDING_Y = 20;
  const dx = bins.length > 1 ? W / (bins.length - 1) : W;
  const points = bins.map((v, i) => {
    const x = i * dx;
    const y = H - PADDING_Y - (v / max) * (H - 2 * PADDING_Y);
    return { x, y, v };
  });
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x.toFixed(1)} ${H} L 0 ${H} Z`;

  return (
    <section className="aq-chart-card">
      <h2 className="aq-chart-title">Visits — last {days} days</h2>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="aq-chart"
        role="img"
        aria-label={`Visits per day, last ${days} days`}
      >
        <defs>
          <linearGradient id="aq-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--uni-gold)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--uni-gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#aq-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--uni-gold)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2.5"
            fill="var(--uni-gold)"
          >
            <title>{`${p.v} visit${p.v === 1 ? "" : "s"} (${labelForDaysAgo(days - 1 - i)})`}</title>
          </circle>
        ))}
      </svg>
      <div className="aq-chart-axis">
        <span>{days} days ago</span>
        <span>Peak: {max.toLocaleString("en-US")} / day</span>
        <span>today</span>
      </div>
    </section>
  );
}

function labelForDaysAgo(d: number): string {
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

function AcquisitionTable({ visits }: { visits: Visit[] }) {
  if (visits.length === 0) {
    return (
      <section className="aq-table-card">
        <div className="aq-empty">
          No visits indexed yet. Once visitors accept the consent banner the
          table will populate.
        </div>
      </section>
    );
  }
  return (
    <section className="aq-table-card">
      <header className="aq-table-header">
        <h2 className="aq-table-title">
          Recent visits — showing latest {visits.length}
        </h2>
      </header>
      <div className="aq-table-wrap">
        <table className="aq-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Page</th>
              <th>Source</th>
              <th>Country</th>
              <th>City</th>
              <th>Device</th>
              <th>Session</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((v) => (
              <tr key={v.id}>
                <td>{formatTime(v.created_at)}</td>
                <td className="aq-table-page">{v.page_path}</td>
                <td>{v.source ?? "—"}</td>
                <td>{v.country ?? "—"}</td>
                <td>{v.city ?? "—"}</td>
                <td>{v.device_type ?? "—"}</td>
                <td className="aq-table-session">
                  {(v.session_id || "").slice(0, 8)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}
