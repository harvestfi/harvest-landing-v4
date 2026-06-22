"use client";

// Acquisition funnel — step 01: Traffic.
// Anonymous visits captured from the public site, surfaced as
// summary tiles + a 30-day daily-bar chart + a recent-visits table.
// The .uni-hub-test shell + the funnel sub-nav are rendered by the
// parent layout (src/app/admin/acquisition/layout.tsx) so this page
// only contributes its own content area.

import { useEffect, useMemo, useState } from "react";
import { supabaseSelectAll } from "@/lib/supabase";
import {
  classifyChannel,
  channelGroup,
  type SourceGroup,
} from "@/lib/channels";
import { isBotRow } from "@/lib/bots";
import { FilterHint } from "@/components/admin/filter-hint";
import {
  TimeframeSelector,
  resolveDays,
  type Timeframe,
} from "@/components/admin/timeframe-selector";
import { CountryFlag } from "@/components/admin/country-flag";

interface Visit {
  id: string;
  created_at: string;
  session_id: string;
  page_path: string;
  source: string | null;
  country: string | null;
  city: string | null;
  device_type: string | null;
  is_bot: boolean | null;
  user_agent: string | null;
  screen_width: number | null;
  screen_height: number | null;
  viewport_width: number | null;
  viewport_height: number | null;
}

const ROWS_DISPLAY_LIMIT = 200;

// Source-filter options for the chart. Mirrors the Live Feed buckets so
// "Direct / SEO / AI / Wallet / ..." mean the same thing across the
// control room.
const SOURCE_GROUPS: ReadonlyArray<{ value: SourceGroup; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "SEO", label: "SEO" },
  { value: "AI", label: "AI" },
  { value: "Social", label: "Social" },
  { value: "Wallet", label: "Wallet" },
  { value: "App", label: "App" },
  { value: "Email", label: "Email" },
  { value: "Referral", label: "Referral" },
  { value: "Direct", label: "Direct" },
];

// 7-column track for the visits table. Same shape as the hub-table
// grid on /eth (6 cols) plus one extra for Session. Source / Country
// / Device are fixed-width so they stop crowding the wider Page +
// City columns; ellipsis on every free-text cell keeps overflow
// from bleeding across column edges.
const TABLE_COLS =
  "140px minmax(200px, 1.8fr) 130px 110px minmax(120px, 1fr) 100px 110px";

export default function AcquisitionPage() {
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  // Human-first: crawler / scanner / asset-path hits are excluded from the
  // tiles and chart by default so Last 7d / 30d are real human traffic.
  const [showBots, setShowBots] = useState(false);

  // Bot-filtered view feeds both the summary tiles and the chart.
  const visibleVisits = useMemo(() => {
    if (visits == null) return null;
    if (showBots) return visits;
    return visits.filter(
      (v) =>
        !isBotRow(v),
    );
  }, [visits, showBots]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Full history (paginated past PostgREST's 1000-row cap) so the
        // window counts and chart reflect every visit, not a capped page.
        const params = `select=id,created_at,session_id,page_path,source,country,city,device_type,is_bot,user_agent,screen_width,screen_height,viewport_width,viewport_height&order=created_at.desc`;
        const data = await supabaseSelectAll<Visit>("frontpage_visits", params);
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
    if (!visibleVisits) return null;
    const now = Date.now();
    const dayMs = 86_400_000;
    const count = (days: number) =>
      visibleVisits.filter(
        (v) => now - new Date(v.created_at).getTime() < days * dayMs,
      ).length;
    return {
      last24: count(1),
      last7: count(7),
      last30: count(30),
      uniqueSessions: new Set(visibleVisits.map((v) => v.session_id)).size,
    };
  }, [visibleVisits]);

  return (
    <>
      <section className="aq-step-header">
        <h2 className="aq-step-title">Traffic</h2>
        <p className="aq-step-sub">
          Anonymous page visits captured from the public site. No cookies, no
          third-party trackers, no personal data. Operator pages
          (<code>/admin/*</code>) are excluded from tracking.
        </p>
      </section>

      <div
        className="uni-hub-stats"
        role="group"
        aria-label="Visit summary"
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
          Could not load visits: {error}
        </div>
      )}

      {visits === null && !error && (
        <div className="uni-hub-empty">Loading visits…</div>
      )}

      {visibleVisits && (
        <>
          <ChartSection
            visits={visibleVisits}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            showBots={showBots}
            onShowBotsChange={setShowBots}
          />
          <TableSection visits={visibleVisits.slice(0, ROWS_DISPLAY_LIMIT)} />
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

// ──────────────────────────────────────────────────────────────────
// Chart - matches the bar mode of OverviewChart from product pages:
// white card, bignum headline, dotted plot background, gold bars
// rooted at the baseline.
// ──────────────────────────────────────────────────────────────────

function ChartSection({
  visits,
  timeframe,
  onTimeframeChange,
  showBots,
  onShowBotsChange,
}: {
  visits: Visit[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  showBots: boolean;
  onShowBotsChange: (b: boolean) => void;
}) {
  const [hovered, setHovered] = useState<{ v: number; daysAgo: number } | null>(
    null,
  );
  const [sourceFilter, setSourceFilter] = useState<SourceGroup>("all");

  // Oldest visit timestamp drives the "All" window. memo'd so we don't
  // recompute on every render.
  const oldestMs = useMemo(() => {
    if (visits.length === 0) return null;
    let oldest = Infinity;
    for (const v of visits) {
      const t = new Date(v.created_at).getTime();
      if (t < oldest) oldest = t;
    }
    return Number.isFinite(oldest) ? oldest : null;
  }, [visits]);
  const days = resolveDays(timeframe, oldestMs);

  // Keep only the selected source group; the window (days) stays based on
  // all visits so the time axis doesn't shift as you switch sources.
  const filtered = useMemo(
    () =>
      sourceFilter === "all"
        ? visits
        : visits.filter(
            (v) => channelGroup(classifyChannel(v.source)) === sourceFilter,
          ),
    [visits, sourceFilter],
  );

  const { bins, max, total, latest, peak } = useMemo(() => {
    const now = Date.now();
    const dayMs = 86_400_000;
    const out: { v: number; daysAgo: number }[] = [];
    for (let i = 0; i < days; i++) {
      out.push({ v: 0, daysAgo: days - 1 - i });
    }
    let inWindow = 0;
    for (const v of filtered) {
      const daysAgo = Math.floor(
        (now - new Date(v.created_at).getTime()) / dayMs,
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
  }, [filtered, days]);

  const displayValue = hovered ? hovered.v : total;
  const srcLabel = sourceFilter === "all" ? "" : `${sourceFilter} `;
  const displayLabel = hovered
    ? `${srcLabel}visits ${labelForDaysAgo(hovered.daysAgo)}`
    : `${srcLabel}visits indexed across the trailing ${days} days`;

  return (
    <section className="uni-hub-section" style={{ marginTop: 0 }}>
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">Visits, last {days} days</h2>
          <span className="uni-hub-section-meta">
            today {latest.toLocaleString("en-US")} · peak{" "}
            {peak.toLocaleString("en-US")}/day
          </span>
        </div>
        <div className="aq-head-controls">
          <label
            className="lf-bot-toggle"
            title="Bots (crawlers, scanners, asset-path hits) are excluded from the tiles and chart by default. Toggle to include non-human traffic."
          >
            <input
              type="checkbox"
              checked={showBots}
              onChange={(e) => onShowBotsChange(e.target.checked)}
            />
            Show bots
          </label>
          <span className="lf-filter-grp">
            <select
              className="lf-select"
              aria-label="Filter visits by source"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceGroup)}
            >
              {SOURCE_GROUPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <FilterHint label="About the source filter">
              How the visit was acquired: SEO (search engines), AI assistants,
              Social, Wallet (in-wallet dapp browsers), App (other in-app
              webviews), Email (webmail), a named Referral site, or Direct (no
              referrer, a typed URL, or an app share).
            </FilterHint>
          </span>
          <TimeframeSelector value={timeframe} onChange={onTimeframeChange} />
        </div>
      </header>
      <div className="aq-chart-card">
        <div className="aq-chart-bignum">
          {displayValue.toLocaleString("en-US")}
        </div>
        <div className="aq-chart-bignum-label">{displayLabel}</div>

        <div className="aq-chart">
          <div className="aq-chart-bars">
            {bins.map((b, i) => {
              const heightPct = Math.max((b.v / max) * 100, b.v > 0 ? 4 : 0);
              return (
                <div
                  key={i}
                  className="aq-bar-col"
                  title={`${b.v} visit${b.v === 1 ? "" : "s"} (${labelForDaysAgo(b.daysAgo)})`}
                  onMouseEnter={() => setHovered(b)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className="aq-bar"
                    style={{ height: `${heightPct}%` }}
                  />
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

// ──────────────────────────────────────────────────────────────────
// Table - identical scaffold to HubTable on /eth /usdc /usdt /btc.
// Global classes hub-table-wrap / hub-table / hub-thead / hub-row /
// hub-cell / hub-th carry all the visual chrome; only override is
// the 7-column grid-template-columns inline style.
// ──────────────────────────────────────────────────────────────────

function TableSection({ visits }: { visits: Visit[] }) {
  return (
    <section className="uni-hub-section">
      <header className="uni-hub-section-head">
        <h2 className="uni-hub-section-title">Recent visits</h2>
        <span className="uni-hub-section-meta">
          showing latest {visits.length.toLocaleString("en-US")}
        </span>
      </header>

      {visits.length === 0 ? (
        <div className="uni-hub-empty">
          No visits indexed yet. Once visitors accept the consent banner the
          table will populate.
        </div>
      ) : (
        <div className="hub-table-wrap aq-recent-wrap">
          <div className="hub-table aq-recent-table">
            <div
              className="hub-thead"
              style={{ gridTemplateColumns: TABLE_COLS }}
            >
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
                style={{ gridTemplateColumns: TABLE_COLS }}
              >
                <span className="hub-cell hub-rank">
                  {formatTime(v.created_at)}
                </span>
                <span className="hub-cell hub-vault">
                  <span
                    className="hub-vault-name"
                    style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 400 }}
                  >
                    {v.page_path}
                  </span>
                </span>
                <span className="hub-cell aq-cell-text">{v.source ?? "—"}</span>
                <span className="hub-cell">
                  <CountryFlag country={v.country} />
                </span>
                <span className="hub-cell aq-cell-text">{v.city ?? "—"}</span>
                <span className="hub-cell aq-cell-text">
                  {v.device_type ?? "—"}
                </span>
                <span
                  className="hub-cell"
                  style={{
                    fontFamily: "var(--sans)",
                    fontSize: 12.5,
                    color: "var(--hub-ink-3)",
                  }}
                >
                  {(v.session_id || "").slice(0, 8)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
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
