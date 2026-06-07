"use client";

// Admin > SEO Summary. A lean, standalone read of the whole SEO funnel:
//   1. Acquired   - unique sessions the index site pulled in (frontpage_visits)
//   2. Reached app - unique sessions that clicked through to the app (outbound_clicks)
//   3. Deposited  - unique sessions that ended in an on-chain deposit, attributed
//                   back through wallet_connections_prod (wallet -> session) and
//                   filtered for autopilot/allocator reallocations.
// Each stage is counted by unique session over the selected window, with a
// 30-day daily-bar chart (today's bar on the right, empty columns to its left
// before tracking began) and a metric toggle to chart any single stage.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TimeframeSelector,
  resolveDays,
  type Timeframe,
} from "@/components/admin/timeframe-selector";
import { CountryFlag } from "@/components/admin/country-flag";
import { supabaseSelect, supabaseSelectAll } from "@/lib/supabase";
import { isMutedActor, detectRebalancerActors } from "@/lib/muted-actors";
import {
  classifyChannel,
  appChannel,
  channelTone,
  channelGroup,
} from "@/lib/channels";
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
// Same column rhythm as the Live Feed stream so the two tables read alike.
const SEO_FEED_COLS = "132px 132px 92px 104px minmax(170px, 1.7fr) 128px 54px";

interface SeoRow {
  id: string;
  time: string;
  channel: string;
  country: string | null;
  kind: "visit" | "click" | "deposit" | "withdraw";
  page: string | null;
  vaultSlug: string | null;
  wallet: string | null;
  chain: string | null;
  tx: string | null;
}

export default function SeoSummaryPage() {
  const [visits, setVisits] = useState<VisitRow[] | null>(null);
  const [clicks, setClicks] = useState<ClickRow[] | null>(null);
  const [conns, setConns] = useState<ConnRow[] | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [metric, setMetric] = useState<Metric>("acquired");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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
  }, []);

  const loaded =
    visits !== null && clicks !== null && conns !== null && events !== null;

  // First-occurrence timestamp per unique session, per funnel stage. Counting
  // each session once by its first touch keeps the funnel "people"-based, and
  // the daily chart reads as new-visitors / new-clickers / new-depositors.
  const { acquiredTs, reachedTs, depositedTs, oldestMs } = useMemo(() => {
    if (!loaded)
      return {
        acquiredTs: [] as number[],
        reachedTs: [] as number[],
        depositedTs: [] as number[],
        oldestMs: null as number | null,
      };

    const firstBy = (
      rows: ReadonlyArray<{ session_id: string | null; created_at: string }>,
    ) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        if (!r.session_id) continue;
        const t = new Date(r.created_at).getTime();
        if (!Number.isFinite(t)) continue;
        const prev = m.get(r.session_id);
        if (prev === undefined || t < prev) m.set(r.session_id, t);
      }
      return m;
    };

    const firstVisit = firstBy(visits!);
    const firstClick = firstBy(clicks!);
    const visitedSessions = new Set(firstVisit.keys());

    // wallet -> earliest session that connected it (the SEO attribution spine).
    const walletSession = new Map<string, string>();
    const walletSessionT = new Map<string, number>();
    for (const w of conns!) {
      if (!w.session_id) continue;
      const a = (w.wallet_address || "").toLowerCase();
      if (!a) continue;
      const t = new Date(w.connected_at).getTime();
      if (!Number.isFinite(t)) continue;
      const prev = walletSessionT.get(a);
      if (prev === undefined || t < prev) {
        walletSessionT.set(a, t);
        walletSession.set(a, w.session_id);
      }
    }

    // Attributed deposits: a deposit whose wallet ties back (via a connect) to
    // a session that visited the index. Autopilot vaults and behaviourally
    // detected allocators are excluded so internal reallocations don't count.
    const rebalancers = detectRebalancerActors(events!);
    const firstDeposit = new Map<string, number>(); // session -> earliest deposit ms
    for (const e of events!) {
      if (e.event_type !== "deposit") continue;
      const a = (e.wallet_address || "").toLowerCase();
      if (isMutedActor(a) || rebalancers.has(a)) continue;
      const sid = walletSession.get(a);
      if (!sid || !visitedSessions.has(sid)) continue;
      const t = new Date(e.block_timestamp).getTime();
      if (!Number.isFinite(t)) continue;
      const prev = firstDeposit.get(sid);
      if (prev === undefined || t < prev) firstDeposit.set(sid, t);
    }

    let oldest = Infinity;
    for (const t of firstVisit.values()) if (t < oldest) oldest = t;

    return {
      acquiredTs: [...firstVisit.values()],
      reachedTs: [...firstClick.values()],
      depositedTs: [...firstDeposit.values()],
      oldestMs: Number.isFinite(oldest) ? oldest : null,
    };
  }, [loaded, visits, clicks, conns, events]);

  // SEO-sourced activity stream: visits, clicks and deposits/withdrawals whose
  // per-row source classifies into the SEO group (Google / Bing / DuckDuckGo).
  // Mirrors the Live Feed stream's per-row channel logic, then keeps only SEO.
  const seoRows = useMemo<SeoRow[]>(() => {
    if (!loaded) return [];

    // session -> first-touch source/country (earliest visit).
    const firstTouch = new Map<
      string,
      { source: string | null; country: string | null; t: number }
    >();
    for (const v of visits!) {
      if (!v.session_id) continue;
      const t = new Date(v.created_at).getTime();
      if (!Number.isFinite(t)) continue;
      const prev = firstTouch.get(v.session_id);
      if (!prev || t < prev.t)
        firstTouch.set(v.session_id, { source: v.source, country: v.country, t });
    }

    // session -> earliest-connected wallet, and wallet -> earliest session.
    const sessionWallet = new Map<string, string>();
    const sessionWalletT = new Map<string, number>();
    const walletSession = new Map<string, string>();
    const walletSessionT = new Map<string, number>();
    for (const w of conns!) {
      if (!w.session_id) continue;
      const a = (w.wallet_address || "").toLowerCase();
      if (!a) continue;
      const t = new Date(w.connected_at).getTime();
      if (!Number.isFinite(t)) continue;
      const ps = sessionWalletT.get(w.session_id);
      if (ps === undefined || t < ps) {
        sessionWalletT.set(w.session_id, t);
        sessionWallet.set(w.session_id, a);
      }
      const pw = walletSessionT.get(a);
      if (pw === undefined || t < pw) {
        walletSessionT.set(a, t);
        walletSession.set(a, w.session_id);
      }
    }

    const rebalancers = detectRebalancerActors(events!);
    const rows: SeoRow[] = [];

    for (const v of visits!) {
      const channel = classifyChannel(v.source);
      if (channelGroup(channel) !== "SEO") continue;
      rows.push({
        id: `v-${v.session_id}-${v.created_at}`,
        time: v.created_at,
        channel,
        country: v.country,
        kind: "visit",
        page: v.page_path || "/",
        vaultSlug: null,
        wallet: v.session_id ? sessionWallet.get(v.session_id) ?? null : null,
        chain: null,
        tx: null,
      });
    }

    for (const c of clicks!) {
      const channel = appChannel(c.source);
      if (channelGroup(channel) !== "SEO") continue;
      rows.push({
        id: `c-${c.session_id}-${c.created_at}`,
        time: c.created_at,
        channel,
        country: c.country,
        kind: "click",
        page: c.source_page || "/",
        vaultSlug: c.vault_slug,
        wallet: c.session_id ? sessionWallet.get(c.session_id) ?? null : null,
        chain: null,
        tx: null,
      });
    }

    for (const e of events!) {
      if (e.event_type !== "deposit" && e.event_type !== "withdraw") continue;
      const a = (e.wallet_address || "").toLowerCase();
      if (isMutedActor(a) || rebalancers.has(a)) continue;
      const sid = walletSession.get(a);
      const ft = sid ? firstTouch.get(sid) : undefined;
      const channel = ft ? appChannel(ft.source) : "Direct";
      if (channelGroup(channel) !== "SEO") continue;
      rows.push({
        id: `e-${e.tx_hash}`,
        time: e.block_timestamp,
        channel,
        country: ft?.country ?? null,
        kind: e.event_type as "deposit" | "withdraw",
        page: null,
        vaultSlug: e.vault_slug,
        wallet: e.wallet_address,
        chain: e.chain,
        tx: e.tx_hash,
      });
    }

    return rows
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, SEO_DISPLAY_LIMIT);
  }, [loaded, visits, clicks, conns, events]);

  const days = resolveDays(timeframe, oldestMs);

  const within = (ts: number[]) => {
    const now = Date.now();
    const dayMs = 86_400_000;
    return ts.filter((t) => {
      const d = Math.floor((now - t) / dayMs);
      return d >= 0 && d < days;
    }).length;
  };
  const acquired = within(acquiredTs);
  const reached = within(reachedTs);
  const deposited = within(depositedTs);
  const pctOfAcquired = (n: number) =>
    acquired > 0 ? `${Math.round((n / acquired) * 100)}% of acquired` : "no data yet";

  const series =
    metric === "acquired"
      ? acquiredTs
      : metric === "reached"
        ? reachedTs
        : depositedTs;
  const metricLabel = METRIC_OPTIONS.find((o) => o.value === metric)!.label;

  return (
    <div className="uni-hub-test">
      <header className="uni-hub-hero aq-hero-slim aq-hero-fullwidth">
        <div className="uni-hub-hero-headline">
          <div style={{ width: "100%" }}>
            <h1 className="uni-hub-h1">SEO Summary</h1>
            <p className="uni-hub-sub aq-sub-full">
              The whole SEO funnel at a glance: how many people the index site
              acquired, how many crossed into app.harvest.finance, and how many
              completed a deposit. Each stage is a unique session over the
              selected window; deposits are attributed back to the session that
              drove them.
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
              label="Acquired to site"
              value={acquired}
              sub={`unique sessions, last ${days}d`}
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
          />

          <SeoActivityTable rows={seoRows} />
        </>
      )}
    </div>
  );
}

// Live-Feed-style activity stream, pre-filtered to SEO sources only.
function SeoActivityTable({ rows }: { rows: SeoRow[] }) {
  return (
    <section className="uni-hub-section">
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">SEO activity</h2>
          <span className="uni-hub-section-meta">
            {rows.length.toLocaleString("en-US")} most recent · visits, clicks
            and deposits whose source is a search engine
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
            <span className="uni-hub-th">Event</span>
            <span className="uni-hub-th">Product / Page</span>
            <span className="uni-hub-th">Wallet</span>
            <span className="uni-hub-th">Tx</span>
          </div>
          <div className="uni-hub-tbody">
            {rows.length === 0 && (
              <div className="uni-hub-empty">
                No SEO-sourced activity in range yet.
              </div>
            )}
            {rows.map((r) => (
              <div
                key={r.id}
                className="uni-hub-row"
                style={{ gridTemplateColumns: SEO_FEED_COLS }}
              >
                <span
                  className="uni-hub-cell lf-time"
                  data-label="Time"
                  title={formatTime(r.time)}
                >
                  {relativeTime(r.time)}
                </span>
                <span className="uni-hub-cell" data-label="Source">
                  <span className={`lf-badge lf-badge-${channelTone(r.channel)}`}>
                    {r.channel}
                  </span>
                </span>
                <span className="uni-hub-cell" data-label="Country">
                  {r.country ? (
                    <CountryFlag country={r.country} />
                  ) : (
                    <span className="lf-dim">—</span>
                  )}
                </span>
                <span className="uni-hub-cell" data-label="Event">
                  <span className={`lf-event lf-event-${r.kind}`}>
                    {r.kind === "visit"
                      ? "Visit"
                      : r.kind === "click"
                        ? "App click"
                        : r.kind}
                  </span>
                </span>
                <span
                  className="uni-hub-cell lf-product"
                  data-label="Product / Page"
                >
                  {r.vaultSlug ? (
                    <Link href={`/${r.vaultSlug}`} className="lf-product-link">
                      {r.vaultSlug}
                    </Link>
                  ) : r.page ? (
                    <Link href={r.page} className="lf-product-link">
                      {r.page}
                    </Link>
                  ) : (
                    <span className="lf-dim">—</span>
                  )}
                </span>
                <span className="uni-hub-cell" data-label="Wallet">
                  {r.wallet ? (
                    <span className="lf-mono" title={r.wallet}>
                      {shortenAddress(r.wallet)}
                    </span>
                  ) : (
                    <span className="lf-dim">—</span>
                  )}
                </span>
                <span className="uni-hub-cell" data-label="Tx">
                  {r.tx && r.chain ? (
                    <a
                      href={txLink(r.chain, r.tx)}
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
          </div>
        </div>
      </div>
    </section>
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
}: {
  series: number[];
  days: number;
  metricLabel: string;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  metric: Metric;
  onMetricChange: (m: Metric) => void;
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
        <TimeframeSelector value={timeframe} onChange={onTimeframeChange} />
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
