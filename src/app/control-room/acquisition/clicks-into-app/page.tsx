"use client";

// Acquisition funnel - step 02: App Clicks.
// Mirror of the Traffic page (stats grid + 30-day daily-bar chart
// + recent-clicks table) but sourced from outbound_clicks instead
// of frontpage_visits. Each row is one click on a [View Strategy]
// / [View] / [Open in Harvest app] CTA leaving the index for
// app.harvest.finance. session_id ties back to the visit row so
// the operator can join click ↔ visit and follow individuals
// through the funnel.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseSelect } from "@/lib/supabase";
import {
  TimeframeSelector,
  resolveDays,
  type Timeframe,
} from "@/components/admin/timeframe-selector";
import { CountryFlag } from "@/components/admin/country-flag";

interface Click {
  id: string;
  created_at: string;
  session_id: string;
  source_page: string;
  source_cta: string | null;
  vault_slug: string | null;
  target_url: string;
  source: string | null;
  country: string | null;
  city: string | null;
  device_type: string | null;
}

const ROWS_FETCH_LIMIT = 1000;
const ROWS_DISPLAY_LIMIT = 200;

// 8-column track. Matches the Traffic table's column rhythm so the
// two feel like siblings: 140px time anchor + flexible primary
// content (Vault) + fixed CTA chip + flexible secondary content
// (From page) + tight Source / Country / Device chips + 110px
// session anchor.
const TABLE_COLS =
  "140px minmax(160px, 1.4fr) 150px minmax(180px, 1.5fr) 110px 110px 100px 110px";

export default function AppClicksPage() {
  const [clicks, setClicks] = useState<Click[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = `select=id,created_at,session_id,source_page,source_cta,vault_slug,target_url,source,country,city,device_type&order=created_at.desc&limit=${ROWS_FETCH_LIMIT}`;
        const data = await supabaseSelect<Click>("outbound_clicks", params);
        if (!cancelled) setClicks(data);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    if (!clicks) return null;
    const now = Date.now();
    const dayMs = 86_400_000;
    const count = (days: number) =>
      clicks.filter((c) => now - new Date(c.created_at).getTime() < days * dayMs)
        .length;
    return {
      last24: count(1),
      last7: count(7),
      last30: count(30),
      uniqueSessions: new Set(clicks.map((c) => c.session_id)).size,
    };
  }, [clicks]);

  return (
    <>
      <section className="aq-step-header">
        <h2 className="aq-step-title">App Clicks</h2>
        <p className="aq-step-sub">
          Outbound clicks on the [View Strategy] / [View] / [Open in Harvest
          app] CTAs leaving the index for app.harvest.finance. Tracked with
          the same session ID, source, country and device fields as the
          Traffic step, so a single visitor can be followed from index
          landing through to the CTA they clicked.
        </p>
      </section>

      <div
        className="uni-hub-stats"
        role="group"
        aria-label="Click summary"
        style={{
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          marginBottom: 32,
        }}
      >
        <Stat label="Last 24h" value={stats?.last24} />
        <Stat label="Last 7d" value={stats?.last7} />
        <Stat label="Last 30d" value={stats?.last30} />
        <Stat label="Unique sessions" value={stats?.uniqueSessions} />
      </div>

      {error && (
        <div className="uni-hub-empty" style={{ color: "#b91c1c" }}>
          Could not load clicks: {error}
        </div>
      )}

      {clicks === null && !error && (
        <div className="uni-hub-empty">Loading clicks…</div>
      )}

      {clicks && (
        <>
          <ChartSection
            clicks={clicks}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />
          <TableSection clicks={clicks.slice(0, ROWS_DISPLAY_LIMIT)} />
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="uni-hub-stat">
      <div className="uni-hub-stat-label">{label}</div>
      <div className="uni-hub-stat-value">
        {value === undefined ? "—" : value.toLocaleString("en-US")}
      </div>
    </div>
  );
}

function ChartSection({
  clicks,
  timeframe,
  onTimeframeChange,
}: {
  clicks: Click[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}) {
  const [hovered, setHovered] = useState<{ v: number; daysAgo: number } | null>(
    null,
  );

  const oldestMs = useMemo(() => {
    if (clicks.length === 0) return null;
    let oldest = Infinity;
    for (const c of clicks) {
      const t = new Date(c.created_at).getTime();
      if (t < oldest) oldest = t;
    }
    return Number.isFinite(oldest) ? oldest : null;
  }, [clicks]);
  const days = resolveDays(timeframe, oldestMs);

  const { bins, max, total, latest, peak } = useMemo(() => {
    const now = Date.now();
    const dayMs = 86_400_000;
    const out: { v: number; daysAgo: number }[] = [];
    for (let i = 0; i < days; i++) {
      out.push({ v: 0, daysAgo: days - 1 - i });
    }
    let inWindow = 0;
    for (const c of clicks) {
      const daysAgo = Math.floor(
        (now - new Date(c.created_at).getTime()) / dayMs,
      );
      if (daysAgo >= 0 && daysAgo < days) {
        out[days - 1 - daysAgo].v++;
        inWindow++;
      }
    }
    const m = Math.max(1, ...out.map((b) => b.v));
    return {
      bins: out,
      max: m,
      total: inWindow,
      latest: out[out.length - 1]?.v ?? 0,
      peak: m,
    };
  }, [clicks, days]);

  const displayValue = hovered ? hovered.v : total;
  const displayLabel = hovered
    ? `outbound clicks ${labelForDaysAgo(hovered.daysAgo)}`
    : `outbound clicks indexed across the trailing ${days} days`;

  return (
    <section className="uni-hub-section" style={{ marginTop: 0 }}>
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">
            App Clicks, last {days} days
          </h2>
          <span className="uni-hub-section-meta">
            today {latest.toLocaleString("en-US")} · peak{" "}
            {peak.toLocaleString("en-US")}/day
          </span>
        </div>
        <TimeframeSelector value={timeframe} onChange={onTimeframeChange} />
      </header>
      <div className="aq-chart-card">
        <div className="aq-chart-bignum">{displayValue.toLocaleString("en-US")}</div>
        <div className="aq-chart-bignum-label">{displayLabel}</div>

        <div className="aq-chart">
          <div className="aq-chart-bars">
            {bins.map((b, i) => {
              const heightPct = Math.max((b.v / max) * 100, b.v > 0 ? 4 : 0);
              return (
                <div
                  key={i}
                  className="aq-bar-col"
                  title={`${b.v} click${b.v === 1 ? "" : "s"} (${labelForDaysAgo(b.daysAgo)})`}
                  onMouseEnter={() => setHovered(b)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="aq-bar" style={{ height: `${heightPct}%` }} />
                </div>
              );
            })}
          </div>
          <div className="aq-chart-axis">
            <span>{days}d ago</span>
            <span>{Math.floor(days / 2)}d ago</span>
            <span>today</span>
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

function TableSection({ clicks }: { clicks: Click[] }) {
  return (
    <section className="uni-hub-section">
      <header className="uni-hub-section-head">
        <h2 className="uni-hub-section-title">Recent clicks</h2>
        <span className="uni-hub-section-meta">
          showing latest {clicks.length.toLocaleString("en-US")}
        </span>
      </header>

      {clicks.length === 0 ? (
        <div className="uni-hub-empty">
          No clicks captured yet. Once a visitor accepts the cookie banner
          and clicks one of the [View Strategy] / [View] / [Open in Harvest
          app] CTAs on a product page, rows will land here.
        </div>
      ) : (
        <div className="hub-table-wrap aq-recent-wrap">
          <div className="hub-table aq-clicks-table aq-recent-table">
            <div
              className="hub-thead"
              style={{ gridTemplateColumns: TABLE_COLS }}
            >
              <span className="hub-th">Time</span>
              <span className="hub-th">Vault</span>
              <span className="hub-th">CTA</span>
              <span className="hub-th">From page</span>
              <span className="hub-th">Source</span>
              <span className="hub-th">Country</span>
              <span className="hub-th">Device</span>
              <span className="hub-th">Session</span>
            </div>
            {clicks.map((c) => (
              <div
                key={c.id}
                className="hub-row"
                style={{ gridTemplateColumns: TABLE_COLS }}
              >
                <span className="hub-cell aq-cell-time">
                  {formatTime(c.created_at)}
                </span>
                <span className="hub-cell aq-cell-vault">
                  {c.vault_slug ? (
                    <Link href={`/${c.vault_slug}`} className="aq-vault-link">
                      {c.vault_slug}
                    </Link>
                  ) : (
                    <span className="aq-muted">—</span>
                  )}
                </span>
                <span className="hub-cell aq-cell-text">{labelForCta(c.source_cta)}</span>
                <span className="hub-cell aq-cell-page">{c.source_page}</span>
                <span className="hub-cell aq-cell-text">{c.source ?? "—"}</span>
                <span className="hub-cell">
                  <CountryFlag country={c.country} />
                </span>
                <span className="hub-cell aq-cell-text">{c.device_type ?? "—"}</span>
                <span className="hub-cell aq-cell-session">
                  {(c.session_id || "").slice(0, 8)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function labelForCta(cta: string | null): string {
  if (!cta) return "—";
  // Map internal CTA identifiers to display labels. Drop the
  // location prefix (Sidebar/Sticky/Bottom) for compactness - the
  // identifier is still in the row data for analytics.
  if (cta === "sidebar-view-strategy") return "CTA - View Strategy";
  if (cta === "sticky-view") return "CTA - View";
  if (cta === "bottom-open-in-app") return "CTA - Open in app";
  return cta;
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
