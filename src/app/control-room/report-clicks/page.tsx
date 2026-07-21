"use client";

// Control Room > Reports > Outbound Clicks.
//
// A SEPARATE tracking surface from the into-app Acquisition funnel: rows here
// come from report_outbound_clicks (see lib/report-tracking.ts), which records
// clicks on the Discover / Visit buttons and the "I understand" confirmations
// on /report/* pages. Every target is a third-party venue, so keeping this
// apart from outbound_clicks means the into-app conversion numbers stay clean.
//
// Two events per venue: "open" (opened the leave modal) and "confirm" (clicked
// through). The gap between them is the confirm rate.

import { useEffect, useMemo, useState } from "react";
import { supabaseSelect } from "@/lib/supabase";
import {
  TimeframeSelector,
  resolveDays,
  type Timeframe,
} from "@/components/admin/timeframe-selector";
import { CountryFlag } from "@/components/admin/country-flag";
import "../../_styles/asset-hub.css";

interface ReportClick {
  id: string;
  created_at: string;
  session_id: string;
  event: string | null;
  source_page: string | null;
  platform: string | null;
  product: string | null;
  chain: string | null;
  venue_ref: string | null;
  rank: number | null;
  target_url: string | null;
  source: string | null;
  country: string | null;
  city: string | null;
  device_type: string | null;
}

const ROWS_FETCH_LIMIT = 1000;
const ROWS_DISPLAY_LIMIT = 200;

// Time | Venue | Event | Pos | Chain | Source | Country | Device | Session
const TABLE_COLS =
  "140px minmax(170px, 1.5fr) 110px 60px 110px 110px 100px 100px 110px";

export default function ReportClicksPage() {
  const [clicks, setClicks] = useState<ReportClick[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params =
          "select=id,created_at,session_id,event,source_page,platform,product,chain,venue_ref,rank,target_url,source,country,city,device_type&order=created_at.desc&limit=" +
          ROWS_FETCH_LIMIT;
        const data = await supabaseSelect<ReportClick>(
          "report_outbound_clicks",
          params,
        );
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
    const opens = clicks.filter((c) => c.event === "open").length;
    const confirms = clicks.filter((c) => c.event === "confirm").length;
    return {
      opens,
      confirms,
      confirmRate: opens > 0 ? Math.round((confirms / opens) * 100) : null,
      uniqueSessions: new Set(clicks.map((c) => c.session_id)).size,
    };
  }, [clicks]);

  return (
    <div className="uni-hub-test">
      <header className="uni-hub-hero aq-hero-slim aq-hero-fullwidth">
        <div className="uni-hub-hero-headline">
          <div style={{ width: "100%" }}>
            <h1 className="uni-hub-h1">Report Outbound Clicks</h1>
            <p className="uni-hub-sub aq-sub-full">
              Clicks leaving the /report pages for third-party venues. Tracked
              separately from the into-app funnel: an &ldquo;Opened&rdquo; is an
              Open-button click that opened the leave-site prompt; a
              &ldquo;Qualified lead&rdquo; is an &ldquo;I understand&rdquo;
              confirmation that followed through. Only qualified leads count as
              leads. Same session, source and geo fields as the rest of the
              control room.
            </p>
          </div>
        </div>
      </header>

      <div
        className="uni-hub-stats"
        role="group"
        aria-label="Report click summary"
        style={{
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          marginBottom: 32,
        }}
      >
        <Stat label="Opened" value={stats?.opens} />
        <Stat label="Qualified leads" value={stats?.confirms} />
        <Stat
          label="Qualification rate"
          value={stats?.confirmRate ?? undefined}
          suffix="%"
        />
        <Stat label="Unique sessions" value={stats?.uniqueSessions} />
      </div>

      {error && (
        <div className="uni-hub-empty" style={{ color: "#b91c1c" }}>
          Could not load report clicks: {error}
        </div>
      )}

      {clicks === null && !error && (
        <div className="uni-hub-empty">Loading report clicks…</div>
      )}

      {clicks && (
        <>
          <ChartSection
            clicks={clicks}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />
          <ProductBreakdownSection clicks={clicks} />
          <RankBreakdownSection clicks={clicks} />
          <TableSection clicks={clicks.slice(0, ROWS_DISPLAY_LIMIT)} />
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number | undefined;
  suffix?: string;
}) {
  return (
    <div className="uni-hub-stat">
      <div className="uni-hub-stat-label">{label}</div>
      <div className="uni-hub-stat-value">
        {value === undefined ? "—" : `${value.toLocaleString("en-US")}${suffix}`}
      </div>
    </div>
  );
}

function ChartSection({
  clicks,
  timeframe,
  onTimeframeChange,
}: {
  clicks: ReportClick[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}) {
  const [hovered, setHovered] = useState<{ v: number; daysAgo: number } | null>(
    null,
  );

  // Chart the "confirm" events - the clicks that actually left the site.
  const confirms = useMemo(
    () => clicks.filter((c) => c.event === "confirm"),
    [clicks],
  );

  const oldestMs = useMemo(() => {
    if (confirms.length === 0) return null;
    let oldest = Infinity;
    for (const c of confirms) {
      const t = new Date(c.created_at).getTime();
      if (t < oldest) oldest = t;
    }
    return Number.isFinite(oldest) ? oldest : null;
  }, [confirms]);
  const days = resolveDays(timeframe, oldestMs);

  const { bins, max, total, latest, peak } = useMemo(() => {
    const now = Date.now();
    const dayMs = 86_400_000;
    const out: { v: number; daysAgo: number }[] = [];
    for (let i = 0; i < days; i++) {
      out.push({ v: 0, daysAgo: days - 1 - i });
    }
    let inWindow = 0;
    for (const c of confirms) {
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
  }, [confirms, days]);

  const displayValue = hovered ? hovered.v : total;
  const displayLabel = hovered
    ? `venue click-throughs ${labelForDaysAgo(hovered.daysAgo)}`
    : `venue click-throughs across the trailing ${days} days`;

  return (
    <section className="uni-hub-section" style={{ marginTop: 0 }}>
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">
            Click-throughs, last {days} days
          </h2>
          <span className="uni-hub-section-meta">
            today {latest.toLocaleString("en-US")} · peak{" "}
            {peak.toLocaleString("en-US")}/day
          </span>
        </div>
        <TimeframeSelector value={timeframe} onChange={onTimeframeChange} />
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

interface BreakdownRow {
  key: string;
  label: string;
  opens: number;
  confirms: number;
  total: number;
}

// Ranked horizontal-bar list, in the same visual spirit as the aq-chart bars
// but laid out as rows. Each row: label, a proportional bar, and Opens /
// Qualified-leads counts.
function BreakdownBars({ rows }: { rows: BreakdownRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r) => {
        const widthPct = Math.max((r.total / max) * 100, r.total > 0 ? 4 : 0);
        return (
          <div key={r.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 600, color: "#2b2a26" }}>{r.label}</span>
              <span style={{ fontSize: 12, color: "#6e6c66", whiteSpace: "nowrap" }}>
                {r.opens.toLocaleString("en-US")} opened ·{" "}
                <span style={{ color: "#1c7d47", fontWeight: 600 }}>
                  {r.confirms.toLocaleString("en-US")} qualified
                </span>
              </span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: "rgba(0,0,0,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${widthPct}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "rgba(34,160,90,0.55)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProductBreakdownSection({ clicks }: { clicks: ReportClick[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, BreakdownRow>();
    for (const c of clicks) {
      // Full product identity: the tracked product now carries the row detail
      // (e.g. "stXRP · Aug 2026", "cbXRP · Lending market"). Append the platform
      // when it isn't already implied so two same-named products on different
      // venues stay distinct and legacy rows that stored only the bare ticker
      // still resolve to something specific.
      const productName = c.product ?? c.platform ?? "Unknown";
      const label =
        c.platform && c.product && !c.product.includes(c.platform)
          ? `${c.product} · ${c.platform}`
          : productName;
      const key = label;
      const existing = map.get(key) ?? {
        key,
        label,
        opens: 0,
        confirms: 0,
        total: 0,
      };
      if (c.event === "open") existing.opens++;
      else if (c.event === "confirm") existing.confirms++;
      existing.total++;
      map.set(key, existing);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [clicks]);

  return (
    <section className="uni-hub-section">
      <header className="uni-hub-section-head">
        <h2 className="uni-hub-section-title">Top products by clicks</h2>
        <span className="uni-hub-section-meta">which products people click to</span>
      </header>
      {rows.length === 0 ? (
        <div className="uni-hub-empty">No product clicks captured yet.</div>
      ) : (
        <div className="aq-chart-card">
          <BreakdownBars rows={rows} />
        </div>
      )}
    </section>
  );
}

function RankBreakdownSection({ clicks }: { clicks: ReportClick[] }) {
  const rows = useMemo(() => {
    const map = new Map<number, BreakdownRow>();
    for (const c of clicks) {
      if (c.rank == null) continue;
      const existing = map.get(c.rank) ?? {
        key: String(c.rank),
        label: `#${c.rank}`,
        opens: 0,
        confirms: 0,
        total: 0,
      };
      if (c.event === "open") existing.opens++;
      else if (c.event === "confirm") existing.confirms++;
      existing.total++;
      map.set(c.rank, existing);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, row]) => row);
  }, [clicks]);

  return (
    <section className="uni-hub-section">
      <header className="uni-hub-section-head">
        <h2 className="uni-hub-section-title">Ranking position by clicks</h2>
        <span className="uni-hub-section-meta">
          which position on the ranking gets most clicks
        </span>
      </header>
      {rows.length === 0 ? (
        <div className="uni-hub-empty">No ranked-position clicks captured yet.</div>
      ) : (
        <div className="aq-chart-card">
          <BreakdownBars rows={rows} />
        </div>
      )}
    </section>
  );
}

function TableSection({ clicks }: { clicks: ReportClick[] }) {
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
          No report clicks captured yet. Once a visitor accepts the cookie
          banner and clicks Discover / Visit (or &ldquo;I understand&rdquo;) on
          a /report page, rows will land here. If this stays empty after real
          clicks, confirm the report_outbound_clicks table exists in Supabase.
        </div>
      ) : (
        <div className="hub-table-wrap aq-recent-wrap">
          <div className="hub-table aq-clicks-table aq-recent-table">
            <div className="hub-thead" style={{ gridTemplateColumns: TABLE_COLS }}>
              <span className="hub-th">Time</span>
              <span className="hub-th">Venue</span>
              <span className="hub-th">Event</span>
              <span className="hub-th">Pos</span>
              <span className="hub-th">Network</span>
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
                  {c.target_url ? (
                    <a
                      href={c.target_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="aq-vault-link"
                      title={c.target_url}
                    >
                      {venueLabel(c)}
                    </a>
                  ) : (
                    venueLabel(c)
                  )}
                </span>
                <span className="hub-cell">
                  <EventChip event={c.event} />
                </span>
                <span className="hub-cell aq-cell-text">
                  {c.rank != null ? `#${c.rank}` : "—"}
                </span>
                <span className="hub-cell aq-cell-text">{c.chain ?? "—"}</span>
                <span className="hub-cell aq-cell-text">{c.source ?? "—"}</span>
                <span className="hub-cell">
                  <CountryFlag country={c.country} />
                </span>
                <span className="hub-cell aq-cell-text">
                  {c.device_type ?? "—"}
                </span>
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

function venueLabel(c: ReportClick): string {
  const platform = c.platform ?? "Unknown";
  return c.product ? `${platform} · ${c.product}` : platform;
}

function EventChip({ event }: { event: string | null }) {
  const isConfirm = event === "confirm";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 9px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        background: isConfirm ? "rgba(34,160,90,0.14)" : "rgba(0,0,0,0.06)",
        color: isConfirm ? "#1c7d47" : "#6e6c66",
      }}
    >
      {event === "confirm"
        ? "Qualified lead"
        : event === "open"
          ? "Opened"
          : (event ?? "—")}
    </span>
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
