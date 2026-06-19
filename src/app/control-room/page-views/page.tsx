"use client";

// Page Views - exploration depth. How far visitors get into the index,
// regardless of where they came from. Each session is rolled up to its
// entry page and the count of distinct pages it viewed; "explored
// further" means more than one unique page. Isolate Homepage entries to
// see how many landers go on to explore the app. Full history
// (retroactive), bots excluded by default (human-first) with a
// Show-bots toggle - so the numbers are real people.

import { useEffect, useMemo, useState } from "react";
import { supabaseSelectAll } from "@/lib/supabase";
import { isBotRow } from "@/lib/bots";
import { InfoTip } from "@/components/admin/info-tip";
import { FilterHint } from "@/components/admin/filter-hint";
import {
  TimeframeSelector,
  resolveDays,
  type Timeframe,
} from "@/components/admin/timeframe-selector";
import "../../_styles/asset-hub.css";

interface VisitRow {
  created_at: string;
  session_id: string | null;
  page_path: string | null;
  is_bot: boolean | null;
  user_agent: string | null;
}

type EntryFilter = "all" | "home";
const ENTRY_OPTIONS: ReadonlyArray<{ value: EntryFilter; label: string }> = [
  { value: "all", label: "All entries" },
  { value: "home", label: "Homepage entries" },
];

type Metric = "explored" | "sessions";
const METRIC_OPTIONS: ReadonlyArray<{ value: Metric; label: string }> = [
  { value: "explored", label: "Explored further" },
  { value: "sessions", label: "Sessions" },
];

// One session rolled up: entry page, when it started, distinct page count,
// and whether any of its hits looked non-human.
interface Sess {
  entry: string;
  entryMs: number;
  pages: number;
  bot: boolean;
}

const DESCRIPTION =
  "How far visitors explore the index, regardless of where they came from. " +
  "Each session is rolled up to its entry page and the number of distinct " +
  'pages it viewed; "explored further" means more than one page. Isolate ' +
  "homepage entries to see how many landers go on to explore the app. Full " +
  "history; bots excluded by default.";

export default function PageViewsPage() {
  const [visits, setVisits] = useState<VisitRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [entry, setEntry] = useState<EntryFilter>("all");
  const [metric, setMetric] = useState<Metric>("explored");
  const [showBots, setShowBots] = useState(false);
  const [hovered, setHovered] = useState<{ v: number; daysAgo: number } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Full history (paginated past PostgREST's 1000-row cap) so the
        // exploration counts are retroactive over every visit.
        const params = `select=created_at,session_id,page_path,is_bot,user_agent&order=created_at.asc`;
        const data = await supabaseSelectAll<VisitRow>("frontpage_visits", params);
        if (!cancelled) setVisits(data);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Roll visits up to one record per session: entry page (earliest visit),
  // distinct page count, and a bot flag if any hit looked non-human.
  const sessions = useMemo<Sess[]>(() => {
    if (!visits) return [];
    const m = new Map<
      string,
      { entry: string; entryMs: number; pages: Set<string>; bot: boolean }
    >();
    for (const v of visits) {
      if (!v.session_id) continue;
      const t = new Date(v.created_at).getTime();
      if (!Number.isFinite(t)) continue;
      const path = v.page_path || "/";
      let s = m.get(v.session_id);
      if (!s) {
        s = { entry: path, entryMs: t, pages: new Set(), bot: false };
        m.set(v.session_id, s);
      }
      if (t < s.entryMs) {
        s.entryMs = t;
        s.entry = path;
      }
      s.pages.add(path);
      if (
        !s.bot &&
        isBotRow({ is_bot: v.is_bot, user_agent: v.user_agent, page_path: path })
      ) {
        s.bot = true;
      }
    }
    return Array.from(m.values()).map((s) => ({
      entry: s.entry,
      entryMs: s.entryMs,
      pages: s.pages.size,
      bot: s.bot,
    }));
  }, [visits]);

  // Human-first + the homepage-entry isolation. Source is intentionally
  // not a factor here - exploration is counted across all traffic.
  const filtered = useMemo(
    () =>
      sessions.filter((s) => {
        if (!showBots && s.bot) return false;
        if (entry === "home" && s.entry !== "/") return false;
        return true;
      }),
    [sessions, showBots, entry],
  );

  const oldestMs = useMemo(() => {
    let o = Infinity;
    for (const s of filtered) if (s.entryMs < o) o = s.entryMs;
    return Number.isFinite(o) ? o : null;
  }, [filtered]);
  const days = resolveDays(timeframe, oldestMs);

  const { bins, max, totalSessions, explored, exploreRate, avgPages, metricTotal } =
    useMemo(() => {
      const now = Date.now();
      const dayMs = 86_400_000;
      const out: { v: number; daysAgo: number }[] = [];
      for (let i = 0; i < days; i++) out.push({ v: 0, daysAgo: days - 1 - i });
      let sess = 0;
      let expl = 0;
      let pagesSum = 0;
      for (const s of filtered) {
        const daysAgo = Math.floor((now - s.entryMs) / dayMs);
        if (daysAgo < 0 || daysAgo >= days) continue;
        sess++;
        pagesSum += s.pages;
        const isExpl = s.pages > 1;
        if (isExpl) expl++;
        out[days - 1 - daysAgo].v += metric === "explored" ? (isExpl ? 1 : 0) : 1;
      }
      const m = Math.max(1, ...out.map((b) => b.v));
      return {
        bins: out,
        max: m,
        totalSessions: sess,
        explored: expl,
        exploreRate: sess ? Math.round((expl / sess) * 100) : 0,
        avgPages: sess ? pagesSum / sess : 0,
        metricTotal: metric === "explored" ? expl : sess,
      };
    }, [filtered, days, metric]);

  const metricWord = metric === "explored" ? "explored further" : "sessions";
  const entryWord = entry === "home" ? "homepage " : "";
  const displayValue = hovered ? hovered.v : metricTotal;
  const displayLabel = hovered
    ? `${entryWord}${metricWord} ${labelForDaysAgo(hovered.daysAgo)}`
    : `${entryWord}${metricWord} across the trailing ${days} days`;

  return (
    <div className="uni-hub-test lf-page">
      <header className="uni-hub-hero aq-hero-slim aq-hero-fullwidth">
        <div className="uni-hub-hero-headline">
          <div style={{ width: "100%" }}>
            <h1 className="uni-hub-h1">
              Page Views
              <InfoTip label="About Page Views">{DESCRIPTION}</InfoTip>
            </h1>
            <p className="uni-hub-sub aq-sub-full">{DESCRIPTION}</p>
          </div>
        </div>
      </header>

      <div
        className="uni-hub-stats"
        role="group"
        aria-label="Exploration summary"
        style={{
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          marginBottom: 32,
        }}
      >
        <Stat label="Sessions" value={visits ? totalSessions : undefined} />
        <Stat label="Explored further" value={visits ? explored : undefined} />
        <Stat
          label="Explore rate"
          value={visits ? `${exploreRate}%` : undefined}
        />
      </div>

      {error && (
        <div className="uni-hub-empty" style={{ color: "#b91c1c" }}>
          Could not load page views: {error}
        </div>
      )}
      {visits === null && !error && (
        <div className="uni-hub-empty">Loading page views…</div>
      )}

      {visits && (
        <section className="uni-hub-section" style={{ marginTop: 0 }}>
          <header className="uni-hub-section-head">
            <div className="aq-section-head-left">
              <h2 className="uni-hub-section-title">
                {metric === "explored" ? "Explored further" : "Sessions"}, last{" "}
                {days} days
              </h2>
              <span className="uni-hub-section-meta">
                avg {avgPages.toFixed(1)} pages/session
              </span>
            </div>
            <div className="aq-head-controls">
              <label
                className="lf-bot-toggle"
                title="Bots (crawlers, scanners) are excluded by default. Toggle to include non-human traffic."
              >
                <input
                  type="checkbox"
                  checked={showBots}
                  onChange={(e) => setShowBots(e.target.checked)}
                />
                Show bots
              </label>
              <span className="lf-filter-grp">
                <select
                  className="lf-select"
                  aria-label="Entry page filter"
                  value={entry}
                  onChange={(e) => setEntry(e.target.value as EntryFilter)}
                >
                  {ENTRY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <FilterHint label="About the entry filter">
                  Scope to all sessions, or only those that first landed on the
                  homepage (/) - so you can see how many homepage visitors go on
                  to explore the app.
                </FilterHint>
              </span>
              <span className="lf-filter-grp">
                <select
                  className="lf-select"
                  aria-label="Metric"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as Metric)}
                >
                  {METRIC_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <FilterHint label="About the metric">
                  What the bars count: sessions that explored further (more than
                  one unique page), or all sessions.
                </FilterHint>
              </span>
              <TimeframeSelector value={timeframe} onChange={setTimeframe} />
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
                      title={`${b.v} ${metricWord} (${labelForDaysAgo(b.daysAgo)})`}
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
      )}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number | string | undefined;
}) {
  return (
    <div className="uni-hub-stat">
      <div className="uni-hub-stat-label">{label}</div>
      <div className="uni-hub-stat-value">
        {value === undefined
          ? "—"
          : typeof value === "number"
            ? value.toLocaleString("en-US")
            : value}
      </div>
    </div>
  );
}

function labelForDaysAgo(d: number): string {
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}
