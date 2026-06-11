"use client";

// Admin > SEO Summary. A lean, standalone read of the search funnel.
//   1. Acquired   - sessions the index pulled in from a search engine
//   2. Reached app - those sessions that clicked through to the app
//   3. Deposited  - those that ended in an on-chain deposit, attributed back
//                   through wallet_connections_prod and filtered for autopilot
//                   / allocator reallocations.
// A session is "SEO" if any of its visits came from a search engine. Every
// funnel stage, the 30-day chart, and the activity table read off the same
// session set. The table shows ONE collapsed row per session (so the row
// count equals the headline number) and follows the chart's metric toggle:
// pick Reached app / Deposited to narrow both the chart and the table to the
// sessions that got that far. Expand a row to see that session's actions.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TimeframeSelector,
  resolveDays,
  type Timeframe,
} from "@/components/admin/timeframe-selector";
import { CountryFlag } from "@/components/admin/country-flag";
import { RefreshButton } from "@/components/admin/refresh-button";
import { supabaseSelect, supabaseSelectAll } from "@/lib/supabase";
import { isMutedActor, detectRebalancerActors } from "@/lib/muted-actors";
import { classifyChannel, channelTone, channelGroup } from "@/lib/channels";
import "../../_styles/asset-hub.css";

interface VisitRow {
  created_at: string;
  session_id: string | null;
  page_path: string | null;
  source: string | null;
  country: string | null;
}
interface ClickRow {
  created_at: string;
  session_id: string | null;
  vault_slug: string | null;
  source_page: string | null;
  source: string | null;
  country: string | null;
}
interface ConnRow {
  wallet_address: string;
  connected_at: string;
  session_id: string | null;
}
interface EventRow {
  block_timestamp: string;
  event_type: string;
  wallet_address: string;
  vault_address: string;
  vault_slug: string | null;
  chain: string;
  tx_hash: string;
}

const FETCH_LIMIT = 5000;

type Metric = "acquired" | "reached" | "deposited";
const METRIC_OPTIONS: ReadonlyArray<{ value: Metric; label: string }> = [
  { value: "acquired", label: "Acquired" },
  { value: "reached", label: "Reached app" },
  { value: "deposited", label: "Deposited" },
];

const SEO_DISPLAY_LIMIT = 200;
// Same column rhythm as the Live Feed stream so the two read alike.
const SEO_FEED_COLS = "132px 132px 92px 104px minmax(170px, 1.7fr) 128px 54px";

// One action within a session (a visit, click, or on-chain event).
interface SeoAction {
  id: string;
  time: string;
  kind: "visit" | "click" | "deposit" | "withdraw";
  page: string | null;
  vaultSlug: string | null;
  wallet: string | null;
  chain: string | null;
  tx: string | null;
}

// One SEO-acquired session: the unit of the funnel. One table row.
interface SeoSession {
  sessionId: string;
  seoName: string; // the search channel that acquired it (e.g. "Google")
  country: string | null;
  wallet: string | null;
  firstVisitMs: number;
  firstClickMs: number; // Infinity if it never clicked into the app
  firstDepositMs: number; // Infinity if it never deposited
  latestMs: number;
  reached: boolean;
  deposited: boolean;
  pageCount: number;
  actions: SeoAction[]; // newest first
}

export default function SeoSummaryPage() {
  const [visits, setVisits] = useState<VisitRow[] | null>(null);
  const [clicks, setClicks] = useState<ClickRow[] | null>(null);
  const [conns, setConns] = useState<ConnRow[] | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [metric, setMetric] = useState<Metric>("acquired");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [refreshing, setRefreshing] = useState(false);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // The four Supabase pulls behind the funnel, in one place so the
  // mount load and the manual Refresh button issue the same queries.
  const fetchAll = useCallback(async () => {
    const [v, c, w, e] = await Promise.all([
      supabaseSelect<VisitRow>(
        "frontpage_visits",
        `select=created_at,session_id,page_path,source,country&order=created_at.desc&limit=${FETCH_LIMIT}`,
      ),
      supabaseSelect<ClickRow>(
        "outbound_clicks",
        `select=created_at,session_id,vault_slug,source_page,source,country&order=created_at.desc&limit=${FETCH_LIMIT}`,
      ),
      supabaseSelectAll<ConnRow>(
        "wallet_connections_prod",
        "select=wallet_address,connected_at,session_id&order=connected_at.desc",
      ),
      supabaseSelect<EventRow>(
        "vault_events_prod",
        `select=block_timestamp,event_type,wallet_address,vault_address,vault_slug,chain,tx_hash&event_type=in.(deposit,withdraw)&order=block_timestamp.desc&limit=${FETCH_LIMIT}`,
      ),
    ]);
    return { v, c, w, e };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { v, c, w, e } = await fetchAll();
        if (cancelled) return;
        setVisits(v);
        setClicks(c);
        setConns(w);
        setEvents(e);
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setErr(null);
    try {
      const { v, c, w, e } = await fetchAll();
      setVisits(v);
      setClicks(c);
      setConns(w);
      setEvents(e);
    } catch (e) {
      setErr(String(e));
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

  const loaded =
    visits !== null && clicks !== null && conns !== null && events !== null;

  // One pass over all sources, rolled up per session. A session is SEO if any
  // of its visits came from a search engine. Every output - funnel series and
  // the session list the table renders - derives from this single set, so the
  // numbers and the table can never disagree.
  const { sessions, oldestMs } = useMemo(() => {
    if (!loaded) return { sessions: [] as SeoSession[], oldestMs: null as number | null };

    interface Acc {
      seoName: string | null;
      seoMs: number;
      country: string | null;
      firstVisitMs: number;
      firstClickMs: number;
      firstDepositMs: number;
      latestMs: number;
      pageCount: number;
      actions: SeoAction[];
    }
    const acc = new Map<string, Acc>();
    const get = (id: string): Acc => {
      let a = acc.get(id);
      if (!a) {
        a = {
          seoName: null,
          seoMs: Infinity,
          country: null,
          firstVisitMs: Infinity,
          firstClickMs: Infinity,
          firstDepositMs: Infinity,
          latestMs: -Infinity,
          pageCount: 0,
          actions: [],
        };
        acc.set(id, a);
      }
      return a;
    };

    for (const v of visits!) {
      if (!v.session_id) continue;
      const t = new Date(v.created_at).getTime();
      if (!Number.isFinite(t)) continue;
      const a = get(v.session_id);
      a.pageCount++;
      if (t < a.firstVisitMs) a.firstVisitMs = t;
      if (t > a.latestMs) a.latestMs = t;
      if (a.country === null && v.country) a.country = v.country;
      const ch = classifyChannel(v.source);
      if (channelGroup(ch) === "SEO" && t < a.seoMs) {
        a.seoMs = t;
        a.seoName = ch;
      }
      a.actions.push({
        id: `v-${v.session_id}-${v.created_at}`,
        time: v.created_at,
        kind: "visit",
        page: v.page_path || "/",
        vaultSlug: null,
        wallet: null,
        chain: null,
        tx: null,
      });
    }

    for (const c of clicks!) {
      if (!c.session_id) continue;
      const t = new Date(c.created_at).getTime();
      if (!Number.isFinite(t)) continue;
      const a = get(c.session_id);
      if (t < a.firstClickMs) a.firstClickMs = t;
      if (t > a.latestMs) a.latestMs = t;
      if (a.country === null && c.country) a.country = c.country;
      a.actions.push({
        id: `c-${c.session_id}-${c.created_at}`,
        time: c.created_at,
        kind: "click",
        page: c.source_page || "/",
        vaultSlug: c.vault_slug,
        wallet: null,
        chain: null,
        tx: null,
      });
    }

    // session <-> wallet, earliest connect each way (the attribution spine).
    const sessionWallet = new Map<string, string>();
    const sessionWalletT = new Map<string, number>();
    const walletSession = new Map<string, string>();
    const walletSessionT = new Map<string, number>();
    for (const w of conns!) {
      if (!w.session_id) continue;
      const addr = (w.wallet_address || "").toLowerCase();
      if (!addr) continue;
      const t = new Date(w.connected_at).getTime();
      if (!Number.isFinite(t)) continue;
      const ps = sessionWalletT.get(w.session_id);
      if (ps === undefined || t < ps) {
        sessionWalletT.set(w.session_id, t);
        sessionWallet.set(w.session_id, addr);
      }
      const pw = walletSessionT.get(addr);
      if (pw === undefined || t < pw) {
        walletSessionT.set(addr, t);
        walletSession.set(addr, w.session_id);
      }
    }

    // Deposits / withdrawals attributed to a session, deduped by tx+vault and
    // with autopilot/allocator reallocations excluded.
    const rebalancers = detectRebalancerActors(events!);
    const seen = new Set<string>();
    for (const e of events!) {
      if (e.event_type !== "deposit" && e.event_type !== "withdraw") continue;
      const addr = (e.wallet_address || "").toLowerCase();
      if (isMutedActor(addr) || rebalancers.has(addr)) continue;
      const sid = walletSession.get(addr);
      if (!sid) continue;
      const a = acc.get(sid);
      if (!a) continue;
      const key = `${(e.tx_hash || "").toLowerCase()}|${(e.vault_address || "").toLowerCase()}|${e.event_type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const ms = new Date(e.block_timestamp).getTime();
      if (!Number.isFinite(ms)) continue;
      if (ms > a.latestMs) a.latestMs = ms;
      if (e.event_type === "deposit" && ms < a.firstDepositMs)
        a.firstDepositMs = ms;
      a.actions.push({
        id: `e-${e.tx_hash}-${e.vault_address}-${e.event_type}`,
        time: e.block_timestamp,
        kind: e.event_type as "deposit" | "withdraw",
        page: null,
        vaultSlug: e.vault_slug,
        wallet: e.wallet_address,
        chain: e.chain,
        tx: e.tx_hash,
      });
    }

    const sessions: SeoSession[] = [];
    let oldest = Infinity;
    for (const [id, a] of acc) {
      if (a.seoName === null) continue; // not an SEO session
      a.actions.sort(
        (x, y) => new Date(y.time).getTime() - new Date(x.time).getTime(),
      );
      sessions.push({
        sessionId: id,
        seoName: a.seoName,
        country: a.country,
        wallet:
          sessionWallet.get(id) ??
          a.actions.find((x) => x.wallet)?.wallet ??
          null,
        firstVisitMs: a.firstVisitMs,
        firstClickMs: a.firstClickMs,
        firstDepositMs: a.firstDepositMs,
        latestMs: a.latestMs,
        reached: Number.isFinite(a.firstClickMs),
        deposited: Number.isFinite(a.firstDepositMs),
        pageCount: a.pageCount,
        actions: a.actions,
      });
      if (a.firstVisitMs < oldest) oldest = a.firstVisitMs;
    }
    sessions.sort((x, y) => y.latestMs - x.latestMs);

    return { sessions, oldestMs: Number.isFinite(oldest) ? oldest : null };
  }, [loaded, visits, clicks, conns, events]);

  const days = resolveDays(timeframe, oldestMs);
  const now = Date.now();
  const inWindow = (ms: number) => {
    const d = Math.floor((now - ms) / 86_400_000);
    return d >= 0 && d < days;
  };

  // The timestamp that qualifies a session for each stage, and whether it
  // qualifies at all. Drives both the stat counts and which sessions the table
  // shows for the selected metric - so row count == the headline number.
  const stageOf = (s: SeoSession, m: Metric): number | null => {
    if (m === "acquired") return s.firstVisitMs;
    if (m === "reached") return s.reached ? s.firstClickMs : null;
    return s.deposited ? s.firstDepositMs : null;
  };
  const countFor = (m: Metric) =>
    sessions.filter((s) => {
      const ts = stageOf(s, m);
      return ts !== null && inWindow(ts);
    }).length;

  const acquired = countFor("acquired");
  const reached = countFor("reached");
  const deposited = countFor("deposited");
  const pctOfAcquired = (n: number) =>
    acquired > 0 ? `${Math.round((n / acquired) * 100)}% of acquired` : "no data yet";

  // Chart series + table list, both for the selected metric and window.
  const series: number[] = [];
  const visibleSessions: SeoSession[] = [];
  for (const s of sessions) {
    const ts = stageOf(s, metric);
    if (ts === null || !inWindow(ts)) continue;
    series.push(ts);
    visibleSessions.push(s);
  }
  const metricLabel = METRIC_OPTIONS.find((o) => o.value === metric)!.label;

  return (
    <div className="uni-hub-test">
      <header className="uni-hub-hero aq-hero-slim aq-hero-fullwidth">
        <div className="uni-hub-hero-headline">
          <div style={{ width: "100%" }}>
            <h1 className="uni-hub-h1">SEO Summary</h1>
            <p className="uni-hub-sub aq-sub-full">
              The search funnel at a glance: of the people the index acquired
              from a search engine (Google, Bing, DuckDuckGo), how many crossed
              into app.harvest.finance and how many deposited. Every stage, the
              chart, and the table below are scoped to the same SEO sessions.
              The table lists one row per session and follows the metric toggle,
              so its row count always matches the number above; expand a row to
              see that session's actions.
            </p>
          </div>
        </div>
      </header>

      {err && (
        <div className="uni-hub-empty" style={{ color: "#b91c1c" }}>
          Could not load SEO data: {err}
        </div>
      )}
      {!loaded && !err && (
        <div className="uni-hub-empty">Loading SEO summary…</div>
      )}

      {loaded && (
        <>
          <div
            className="uni-hub-stats"
            role="group"
            aria-label="SEO funnel summary"
            style={{
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              marginBottom: 32,
            }}
          >
            <FunnelStat
              label="Acquired via search"
              value={acquired}
              sub={`SEO sessions, last ${days}d`}
            />
            <FunnelStat
              label="Reached app"
              value={reached}
              sub={pctOfAcquired(reached)}
            />
            <FunnelStat
              label="Deposited"
              value={deposited}
              sub={pctOfAcquired(deposited)}
            />
          </div>

          <ChartSection
            series={series}
            days={days}
            metricLabel={metricLabel}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            metric={metric}
            onMetricChange={setMetric}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />

          <SeoSessionTable
            sessions={visibleSessions.slice(0, SEO_DISPLAY_LIMIT)}
            metricLabel={metricLabel}
            expanded={expanded}
            onToggle={toggle}
          />
        </>
      )}
    </div>
  );
}

function FunnelStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="uni-hub-stat">
      <div className="uni-hub-stat-label">{label}</div>
      <div className="uni-hub-stat-value">{value.toLocaleString("en-US")}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: "var(--uni-ink-3)" }}>
        {sub}
      </div>
    </div>
  );
}

function ChartSection({
  series,
  days,
  metricLabel,
  timeframe,
  onTimeframeChange,
  metric,
  onMetricChange,
  onRefresh,
  refreshing,
}: {
  series: number[];
  days: number;
  metricLabel: string;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  metric: Metric;
  onMetricChange: (m: Metric) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [hovered, setHovered] = useState<{ v: number; daysAgo: number } | null>(
    null,
  );

  const { bins, max, total, latest, peak } = useMemo(() => {
    const now = Date.now();
    const dayMs = 86_400_000;
    const out: { v: number; daysAgo: number }[] = [];
    for (let i = 0; i < days; i++) out.push({ v: 0, daysAgo: days - 1 - i });
    let inWindow = 0;
    for (const t of series) {
      const daysAgo = Math.floor((now - t) / dayMs);
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
  }, [series, days]);

  const noun = metricLabel.toLowerCase();
  const displayValue = hovered ? hovered.v : total;
  const displayLabel = hovered
    ? `${noun} ${labelForDaysAgo(hovered.daysAgo)}`
    : `${noun} across the trailing ${days} days`;

  return (
    <section className="uni-hub-section" style={{ marginTop: 0 }}>
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">
            {metricLabel}, last {days} days
          </h2>
          <span className="uni-hub-section-meta">
            today {latest.toLocaleString("en-US")} · peak{" "}
            {peak.toLocaleString("en-US")}/day
          </span>
        </div>
        <div className="aq-head-controls">
          <RefreshButton onClick={onRefresh} refreshing={refreshing} />
          <TimeframeSelector value={timeframe} onChange={onTimeframeChange} />
        </div>
      </header>

      <div
        className="aq-timeframe"
        role="group"
        aria-label="Funnel metric"
        style={{ marginBottom: 12 }}
      >
        {METRIC_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`aq-timeframe-tab${metric === o.value ? " active" : ""}`}
            aria-pressed={metric === o.value}
            onClick={() => onMetricChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>

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
                  title={`${b.v.toLocaleString("en-US")} ${noun} (${labelForDaysAgo(b.daysAgo)})`}
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

// One collapsed row per SEO session (so the row count equals the headline
// number for the selected metric). The Event column shows how far the session
// got in the funnel; expand to list its individual actions.
function SeoSessionTable({
  sessions,
  metricLabel,
  expanded,
  onToggle,
}: {
  sessions: SeoSession[];
  metricLabel: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <section className="uni-hub-section">
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">{metricLabel} sessions</h2>
          <span className="uni-hub-section-meta">
            {sessions.length.toLocaleString("en-US")} session
            {sessions.length === 1 ? "" : "s"} · one row each, expand to see
            its actions
          </span>
        </div>
      </header>
      <div className="lf-scroll">
        <div className="uni-hub-table lf-table">
          <div
            className="uni-hub-thead"
            style={{ gridTemplateColumns: SEO_FEED_COLS }}
          >
            <span className="uni-hub-th">Time</span>
            <span className="uni-hub-th">Source</span>
            <span className="uni-hub-th">Country</span>
            <span className="uni-hub-th">Stage</span>
            <span className="uni-hub-th">Activity</span>
            <span className="uni-hub-th">Wallet</span>
            <span className="uni-hub-th">Tx</span>
          </div>
          <div className="uni-hub-tbody">
            {sessions.length === 0 && (
              <div className="uni-hub-empty">
                No sessions match this stage in range yet.
              </div>
            )}
            {sessions.map((s) => {
              const isOpen = expanded.has(s.sessionId);
              const stage = s.deposited
                ? { label: "Deposited", tone: "deposit" }
                : s.reached
                  ? { label: "Reached app", tone: "click" }
                  : { label: "Acquired", tone: "visit" };
              return (
                <SessionRows
                  key={s.sessionId}
                  session={s}
                  isOpen={isOpen}
                  stage={stage}
                  onToggle={() => onToggle(s.sessionId)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function SessionRows({
  session: s,
  isOpen,
  stage,
  onToggle,
}: {
  session: SeoSession;
  isOpen: boolean;
  stage: { label: string; tone: string };
  onToggle: () => void;
}) {
  return (
    <>
      <div
        className="uni-hub-row lf-session-row"
        style={{ gridTemplateColumns: SEO_FEED_COLS }}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <span
          className="uni-hub-cell lf-time lf-time-session"
          data-label="Time"
          title={`session ${s.sessionId}`}
        >
          <Chevron />
          {relativeTimeMs(s.latestMs)}
        </span>
        <span className="uni-hub-cell" data-label="Source">
          <span className={`lf-badge lf-badge-${channelTone(s.seoName)}`}>
            {s.seoName}
          </span>
        </span>
        <span className="uni-hub-cell" data-label="Country">
          {s.country ? (
            <CountryFlag country={s.country} />
          ) : (
            <span className="lf-dim">—</span>
          )}
        </span>
        <span className="uni-hub-cell" data-label="Stage">
          <span className={`lf-event lf-event-${stage.tone}`}>
            {stage.label}
          </span>
        </span>
        <span className="uni-hub-cell lf-product" data-label="Activity">
          <span className="lf-session-count">
            {s.pageCount} page{s.pageCount === 1 ? "" : "s"}
            {s.deposited ? " · deposit" : s.reached ? " · click" : ""}
          </span>
        </span>
        <span className="uni-hub-cell" data-label="Wallet">
          {s.wallet ? (
            <span className="lf-mono" title={s.wallet}>
              {shortenAddress(s.wallet)}
            </span>
          ) : (
            <span className="lf-dim">—</span>
          )}
        </span>
        <span className="uni-hub-cell" data-label="Tx">
          <span className="lf-dim">—</span>
        </span>
      </div>
      {isOpen &&
        s.actions.map((a) => (
          <div
            key={a.id}
            className="uni-hub-row lf-row-child"
            style={{ gridTemplateColumns: SEO_FEED_COLS }}
          >
            <span
              className="uni-hub-cell lf-time"
              data-label="Time"
              title={formatTime(a.time)}
            >
              {relativeTime(a.time)}
            </span>
            <span className="uni-hub-cell" data-label="Source">
              <span className="lf-dim">—</span>
            </span>
            <span className="uni-hub-cell" data-label="Country">
              <span className="lf-dim">—</span>
            </span>
            <span className="uni-hub-cell" data-label="Stage">
              <span className={`lf-event lf-event-${a.kind}`}>
                {a.kind === "visit"
                  ? "Visit"
                  : a.kind === "click"
                    ? "App click"
                    : a.kind}
              </span>
            </span>
            <span className="uni-hub-cell lf-product" data-label="Activity">
              {a.vaultSlug ? (
                <Link href={`/${a.vaultSlug}`} className="lf-product-link">
                  {a.vaultSlug}
                </Link>
              ) : a.page ? (
                <Link href={a.page} className="lf-product-link">
                  {a.page}
                </Link>
              ) : (
                <span className="lf-dim">—</span>
              )}
            </span>
            <span className="uni-hub-cell" data-label="Wallet">
              <span className="lf-dim">—</span>
            </span>
            <span className="uni-hub-cell" data-label="Tx">
              {a.tx && a.chain ? (
                <a
                  href={txLink(a.chain, a.tx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lf-tx"
                >
                  view
                </a>
              ) : (
                <span className="lf-dim">—</span>
              )}
            </span>
          </div>
        ))}
    </>
  );
}

function Chevron() {
  return (
    <svg
      className="lf-chevron"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function txLink(chain: string, tx: string): string {
  const base =
    chain === "Base"
      ? "https://basescan.org/tx/"
      : chain === "Polygon"
        ? "https://polygonscan.com/tx/"
        : chain === "Arbitrum"
          ? "https://arbiscan.io/tx/"
          : chain === "HyperEVM"
            ? "https://hyperevmscan.io/tx/"
            : chain === "zkSync"
              ? "https://explorer.zksync.io/tx/"
              : "https://etherscan.io/tx/";
  return base + tx;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
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

function relativeTimeMs(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  return relativeTime(new Date(ms).toISOString());
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  if (diffMs < 60_000) return "now";
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return formatTime(iso);
}
