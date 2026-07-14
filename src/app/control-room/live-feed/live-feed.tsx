"use client";

// Admin > Live Feed. The heart of Harvest activity in one reverse-chron
// stream, merging four real Supabase sources:
//   - frontpage_visits     -> page views (real source + country)
//   - outbound_clicks      -> [View strategy] CTA clicks into the app
//   - vault_events_prod    -> on-chain deposits / withdrawals
//   - wallet_connections_prod (wallet <-> session_id) -> the join that
//     attributes an on-chain event back to the index session that drove
//     it, now that the app persists the hsid as session_id.
//
// Attribution (first-touch):
//   event.wallet -> wallet_connections_prod.session_id
//                -> frontpage_visits/outbound_clicks.session_id -> source
// A funnel-linked app event whose session reached us directly reads
// "Homepage" (owned); one that arrived via Google/Reddit/etc. keeps that
// channel; an event from a wallet that never touched the index has no
// identifiable acquisition source and reads "Direct" (GA-style). The
// "Product / Page" column shows the visited URL for a visit and the
// front-end product name (mapped from slug/address) for a click or
// on-chain event.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseSelectAll } from "@/lib/supabase";
import { formatTVL } from "@/lib/format";
import { isMutedActor, detectRebalancerActors } from "@/lib/muted-actors";
import {
  classifyChannel,
  classifyVisit,
  appChannel,
  channelTone,
  channelGroup,
  shortChannelLabel,
  sourceDomain,
  brandFromSource,
  type SourceGroup,
} from "@/lib/channels";
import {
  TimeframeSelector,
  resolveDays,
  type Timeframe,
} from "@/components/admin/timeframe-selector";
import { CountryFlag } from "@/components/admin/country-flag";
import { DeviceIcon } from "@/components/admin/device-icon";
import { InfoTip } from "@/components/admin/info-tip";
import { RefreshButton } from "@/components/admin/refresh-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { TablePager } from "@/components/admin/table-pager";
import { WalletLabel } from "@/components/admin/wallet-label";
import { isBotRow, detectSpoofedFingerprints, fingerprintKey } from "@/lib/bots";
import { FilterHint } from "@/components/admin/filter-hint";
import { SearchSelect } from "@/components/admin/search-select";
import "../../_styles/asset-hub.css";

interface VaultEventRow {
  tx_hash: string;
  log_index: number;
  block_timestamp: string;
  chain: string;
  vault_address: string;
  vault_slug: string | null;
  event_type: "deposit" | "withdraw" | "transfer";
  wallet_address: string;
  amount_shares: string | null;
}
interface VisitRow {
  created_at: string;
  session_id: string;
  page_path: string;
  source: string | null;
  country: string | null;
  device_type: string | null;
  referrer: string | null;
  is_bot: boolean | null;
  user_agent: string | null;
  screen_width: number | null;
  screen_height: number | null;
  viewport_width: number | null;
  viewport_height: number | null;
  timezone: string | null;
}
interface ClickRow {
  created_at: string;
  session_id: string;
  vault_slug: string | null;
  source_page: string;
  target_url: string;
  source: string | null;
  country: string | null;
  device_type: string | null;
  is_bot: boolean | null;
  user_agent: string | null;
}
interface ConnectionRow {
  wallet_address: string;
  connected_at: string;
  session_id: string | null;
  balance: number | null;
}

type FeedItem =
  | {
      kind: "visit";
      bot: boolean;
      id: string;
      time: string;
      channel: string;
      country: string | null;
      device: string | null;
      srcDomain: string | null;
      pagePath: string;
      hsid: string | null;
      wallet: string | null;
      netWorth: number | null;
    }
  | {
      kind: "click";
      bot: boolean;
      id: string;
      time: string;
      channel: string;
      country: string | null;
      device: string | null;
      srcDomain: string | null;
      vaultSlug: string | null;
      sourcePage: string;
      targetUrl: string;
      hsid: string | null;
      wallet: string | null;
      netWorth: number | null;
    }
  | {
      kind: "event";
      bot: boolean;
      id: string;
      time: string;
      channel: string;
      country: string | null;
      device: string | null;
      srcDomain: string | null;
      attributed: boolean;
      upstream: string | null;
      hsid: string | null;
      eventType: "deposit" | "withdraw";
      wallet: string;
      vaultSlug: string | null;
      vaultAddress: string;
      chain: string;
      tx: string;
      netWorth: number | null;
    };

type VisitItem = Extract<FeedItem, { kind: "visit" }>;

// One browsing cluster (visits sharing an hsid with no >1h gap) folded into a
// single stream row. One hsid can yield several clusters when the visitor
// returns hours later, so clusterId - not sessionId - is the unique key.
interface VisitGroup {
  clusterId: string; // unique per cluster (the master visit's id)
  sessionId: string; // the hsid (shown on hover); may repeat across clusters
  time: string; // most recent visit in the cluster
  channel: string;
  country: string | null;
  device: string | null;
  srcDomain: string | null;
  wallet: string | null;
  netWorth: number | null;
  bot: boolean;
  pages: VisitItem[]; // newest first
}

// A row in the Stream is either a standalone activity item or a collapsed
// multi-page visit session.
type StreamRow =
  | { kind: "item"; item: FeedItem }
  | { kind: "group"; group: VisitGroup };

type ActivityFilter = "all" | "visits" | "clicks" | "deposits" | "withdrawals";
const ACTIVITY_OPTIONS: ReadonlyArray<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "visits", label: "Visits" },
  { value: "clicks", label: "Clicks" },
  { value: "deposits", label: "Deposits" },
  { value: "withdrawals", label: "Withdrawals" },
];

// Engagement / landing filter. "engaged"/"deep" isolate multi-page sessions;
// "subpage" isolates every session whose FIRST touch was a non-root page,
// regardless of how many pages it saw - the "a sub-page surfaced as a new
// access point" signal (e.g. Direct landing straight on a product page).
type Engagement = "all" | "engaged" | "deep" | "subpage";
const ENGAGEMENT_OPTIONS: ReadonlyArray<{ value: Engagement; label: string }> = [
  { value: "all", label: "All sessions" },
  { value: "subpage", label: "Sub-page first touch" },
  { value: "engaged", label: "Engaged (any landing)" },
  { value: "deep", label: "Engaged (deep landing)" },
];

// Tolerance for matching a wallet connection to a later on-chain event:
// the connect is written client-side moments before the deposit, while
// the deposit time comes from the chain block, so allow a little slack
// when deciding which connect "precedes" the event.
const CONNECT_SKEW_MS = 90_000;
// An hsid lives in per-tab sessionStorage, so it can persist for many hours
// across a kept-open tab - the same visitor returning hours apart shares one
// hsid. Split a session into separate clusters whenever the gap between
// consecutive page views exceeds this inactivity window, so a 20-hour-old
// tab doesn't collapse a day of return visits into one row. (GA uses 30m;
// 1h is a touch more forgiving for slow reading.)
const SESSION_GAP_MS = 60 * 60 * 1000;
// Full history: every source is pulled in its entirety (paginated
// server-side via supabaseSelectAll) so the stream goes back as far as
// the data does, then rendered 25 rows per page. No fetch/display caps -
// the operator asked for max history depth, navigated by the pager.
const ROWS_PER_PAGE = 25;
const FEED_COLS =
  "132px 132px 92px 104px minmax(170px, 1.7fr) 64px 96px 128px 84px 54px";

// Source-group toggle for the Stream filter. Collapses the many per-channel
// names into the buckets an operator reasons about. "Referral" isolates real
// external sites we don't have a named channel for (aggregators like
// CoinMarketCap, blogs, etc.) - their row badge shows the domain itself.
const SOURCE_GROUPS: ReadonlyArray<{ value: SourceGroup; label: string }> = [
  { value: "all", label: "All" },
  { value: "SEO", label: "SEO" },
  { value: "AI", label: "AI" },
  { value: "Social", label: "Social" },
  { value: "Wallet", label: "Wallet" },
  { value: "App", label: "App" },
  { value: "Email", label: "Email" },
  { value: "Referral", label: "Referral" },
  { value: "Direct", label: "Direct" },
];

// ── Source channel classification (shared with the SEO Summary) ─────
// classifyChannel / appChannel / channelTone / channelGroup live in
// @/lib/channels so both feeds bucket sources identically.

// ── Sample fallback (only when every real source is empty) ──────────
// The demo stream is generated in the items memo (see realEmpty); these
// are the only shared seed values it reuses.
const SAMPLE_TX: readonly string[] = [
  "0x9f2c1ab73e08d45c6a1f90b3e27d4c85a06f1e93b2d7c40859a1e6f3c08d24b71",
  "0x3b7e0d92a14c6f85309e1b4a7c0d28f6e5a9c1340b8d6e2f7019a4c83e6d50f29",
  "0xc1a6e3920d74b85f016c9a3e7b0d42f8e5690a1c34b7d6e2f80193a4c56e0d8b9",
];

// "Activity heartbeat": one bar per day counting EVERY tracked Live Feed
// action that day - page visits, deep page exploration, app clicks and
// on-chain deposits/withdrawals, any source. A single pulse of total site+app
// activity, independent of the stream's source/type filters (it only follows
// the shared "Show bots" preference so crawler bursts don't distort the human
// pulse). Hidden by default; shown/hidden via the header toggle. In Breakdown
// mode each bar splits by action type, with a click-to-isolate legend and a
// per-type hover tooltip - the same UX as the SEO / AI Summary charts.
const HEARTBEAT_TYPES: { key: string; label: string; color: string }[] = [
  { key: "visit", label: "Page visit", color: "#4E79A7" },
  { key: "click", label: "App click", color: "#F28E2B" },
  { key: "deposit", label: "Deposit", color: "#59A14F" },
  { key: "withdraw", label: "Withdraw", color: "#E15759" },
];
function heartbeatType(it: FeedItem): string {
  if (it.kind === "visit") return "visit";
  if (it.kind === "click") return "click";
  return it.eventType; // "deposit" | "withdraw"
}

function HeartbeatSection({
  items,
  showBots,
}: {
  items: FeedItem[];
  showBots: boolean;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [mode, setMode] = useState<"all" | "breakdown">("all");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // All tracked actions, minus bots unless the operator opted in.
  const actions = useMemo(
    () => items.filter((it) => showBots || !it.bot),
    [items, showBots],
  );
  const oldestMs = useMemo(() => {
    let o = Infinity;
    for (const it of actions) {
      const t = new Date(it.time).getTime();
      if (Number.isFinite(t) && t < o) o = t;
    }
    return Number.isFinite(o) ? o : null;
  }, [actions]);
  const days = resolveDays(timeframe, oldestMs);

  const bins = useMemo(() => {
    const now = Date.now();
    const DAY = 86_400_000;
    const out = Array.from({ length: days }, (_, i) => ({
      vAll: 0,
      daysAgo: days - 1 - i,
      byType: {} as Record<string, number>,
    }));
    for (const it of actions) {
      const daysAgo = Math.floor((now - new Date(it.time).getTime()) / DAY);
      if (daysAgo >= 0 && daysAgo < days) {
        const bin = out[days - 1 - daysAgo];
        bin.vAll++;
        const k = heartbeatType(it);
        bin.byType[k] = (bin.byType[k] || 0) + 1;
      }
    }
    return out;
  }, [actions, days]);

  const visibleTypes = useMemo(
    () =>
      mode === "breakdown"
        ? HEARTBEAT_TYPES.filter((t) => !hidden.has(t.key))
        : HEARTBEAT_TYPES,
    [mode, hidden],
  );
  const countOf = (b: (typeof bins)[number]) =>
    mode === "breakdown"
      ? visibleTypes.reduce((s, t) => s + (b.byType[t.key] || 0), 0)
      : b.vAll;

  const { max, total, latest, peak } = useMemo(() => {
    const counts = bins.map(countOf);
    const m = Math.max(1, ...counts);
    return {
      max: m,
      total: counts.reduce((s, v) => s + v, 0),
      latest: counts[counts.length - 1] ?? 0,
      peak: m,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bins, visibleTypes, mode]);

  const hoveredBin = hoverIdx != null ? bins[hoverIdx] : null;
  const hoveredCount = hoveredBin ? countOf(hoveredBin) : 0;
  const displayValue = hoveredBin ? hoveredCount : total;
  const displayLabel = hoveredBin
    ? `actions ${heartbeatDaysAgo(hoveredBin.daysAgo)}`
    : `tracked actions across the trailing ${days} days`;

  const toggleType = (k: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <section className="uni-hub-section" style={{ marginTop: 28 }}>
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">Activity heartbeat</h2>
          <span className="uni-hub-section-meta">
            {total.toLocaleString("en-US")} tracked actions · last {days}d ·
            every visit, click and deposit, any source ·{" "}
            {showBots ? "incl. bots" : "bots excluded"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            className="aq-timeframe"
            role="tablist"
            aria-label="Chart breakdown mode"
          >
            {(["all", "breakdown"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={`aq-timeframe-tab${mode === m ? " active" : ""}`}
                onClick={() => setMode(m)}
              >
                {m === "all" ? "All" : "Breakdown"}
              </button>
            ))}
          </div>
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        </div>
      </header>

      <div className="aq-chart-card">
        <div className="aq-chart-bignum">
          {displayValue.toLocaleString("en-US")}
        </div>
        <div className="aq-chart-bignum-label">{displayLabel}</div>
        <div className="aq-chart">
          <div className="aq-chart-bars" style={{ position: "relative" }}>
            {bins.map((b, i) => {
              const v = countOf(b);
              const heightPct = Math.max((v / max) * 100, v > 0 ? 4 : 0);
              return (
                <div
                  key={i}
                  className="aq-bar-col"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  {mode === "all" || v === 0 ? (
                    <div className="aq-bar" style={{ height: `${heightPct}%` }} />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: `${heightPct}%`,
                        minHeight: 4,
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: "5px 5px 0 0",
                        overflow: "hidden",
                      }}
                    >
                      {visibleTypes
                        .filter((t) => b.byType[t.key])
                        .map((t) => (
                          <div
                            key={t.key}
                            style={{
                              height: `${(b.byType[t.key] / v) * 100}%`,
                              background: t.color,
                            }}
                          />
                        ))}
                    </div>
                  )}
                </div>
              );
            })}

            {hoveredBin && hoveredCount > 0 && (
              <HeartbeatTooltip
                bin={hoveredBin}
                count={hoveredCount}
                types={visibleTypes}
                idx={hoverIdx as number}
                days={days}
              />
            )}
          </div>
          <div className="aq-chart-axis">
            <span>{days}d ago</span>
            <span>{Math.floor(days / 2)}d ago</span>
            <span>today</span>
          </div>
        </div>

        <div
          className="uni-hub-section-meta"
          style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 14 }}
        >
          <span>peak {peak.toLocaleString("en-US")}/day</span>
          {mode === "breakdown" && (
            <span
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px 14px",
                marginLeft: "auto",
              }}
            >
              {HEARTBEAT_TYPES.map((t) => {
                const off = hidden.has(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => toggleType(t.key)}
                    aria-pressed={!off}
                    title={off ? `Show ${t.label}` : `Hide ${t.label}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      padding: 0,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      color: "inherit",
                      opacity: off ? 0.4 : 1,
                      textDecoration: off ? "line-through" : "none",
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: off ? "transparent" : t.color,
                        boxShadow: off ? `inset 0 0 0 1.5px ${t.color}` : "none",
                        flexShrink: 0,
                      }}
                    />
                    {t.label}
                  </button>
                );
              })}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

// Per-day hover tooltip for the heartbeat: the action-type split (swatch,
// label, count, share) newest-first by count, then the day total.
function HeartbeatTooltip({
  bin,
  count,
  types,
  idx,
  days,
}: {
  bin: { daysAgo: number; byType: Record<string, number> };
  count: number;
  types: { key: string; label: string; color: string }[];
  idx: number;
  days: number;
}) {
  const rows = types
    .filter((t) => bin.byType[t.key])
    .map((t) => ({ ...t, n: bin.byType[t.key] }))
    .sort((a, b) => b.n - a.n);
  const leftPct = ((idx + 0.5) / days) * 100;
  const tx = leftPct < 18 ? "0%" : leftPct > 82 ? "-100%" : "-50%";
  return (
    <div
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        bottom: "calc(100% + 8px)",
        transform: `translateX(${tx})`,
        zIndex: 5,
        pointerEvents: "none",
        minWidth: 190,
        padding: "10px 12px",
        borderRadius: 8,
        background: "var(--uni-card, #fff)",
        border: "1px solid var(--uni-line-2)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: 6,
          color: "var(--uni-ink-2, inherit)",
        }}
      >
        {heartbeatDaysAgo(bin.daysAgo)}
      </div>
      {rows.map((r) => (
        <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 2,
              background: r.color,
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1 }}>{r.label}</span>
          <span style={{ fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>
            {r.n.toLocaleString("en-US")} ({Math.round((r.n / count) * 100)}%)
          </span>
        </div>
      ))}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 6,
          paddingTop: 6,
          borderTop: "1px solid var(--uni-line-2)",
          fontWeight: 600,
        }}
      >
        <span>Total</span>
        <span style={{ fontFamily: "var(--mono)" }}>
          {count.toLocaleString("en-US")} actions
        </span>
      </div>
    </div>
  );
}

function heartbeatDaysAgo(d: number): string {
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

export function LiveFeed({ productNames }: { productNames: Record<string, string> }) {
  const [visits, setVisits] = useState<VisitRow[] | null>(null);
  const [clicks, setClicks] = useState<ClickRow[] | null>(null);
  const [events, setEvents] = useState<VaultEventRow[] | null>(null);
  const [connections, setConnections] = useState<ConnectionRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);

  // The four Supabase pulls that back the stream, in one place so both
  // the mount load and the manual Refresh button run the exact same
  // query set.
  const fetchAll = useCallback(async () => {
    const [v, c, e, w] = await Promise.all([
      supabaseSelectAll<VisitRow>(
        "frontpage_visits",
        "select=created_at,session_id,page_path,source,country,device_type,referrer,is_bot,user_agent,screen_width,screen_height,viewport_width,viewport_height,timezone&order=created_at.desc",
      ),
      supabaseSelectAll<ClickRow>(
        "outbound_clicks",
        "select=created_at,session_id,vault_slug,source_page,target_url,source,country,device_type,is_bot,user_agent&order=created_at.desc",
      ),
      supabaseSelectAll<VaultEventRow>(
        "vault_events_prod",
        "select=tx_hash,log_index,block_timestamp,chain,vault_address,vault_slug,event_type,wallet_address,amount_shares&event_type=in.(deposit,withdraw)&order=block_timestamp.desc",
      ),
      supabaseSelectAll<ConnectionRow>(
        "wallet_connections_prod",
        "select=wallet_address,connected_at,session_id,balance&order=connected_at.desc",
      ),
    ]);
    return { v, c, e, w };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { v, c, e, w } = await fetchAll();
        if (cancelled) return;
        setVisits(v);
        setClicks(c);
        setEvents(e);
        setConnections(w);
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
      const { v, c, e, w } = await fetchAll();
      setVisits(v);
      setClicks(c);
      setEvents(e);
      setConnections(w);
      setPage(0);
    } catch (e) {
      setErr(String(e));
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

  const loaded =
    visits !== null && clicks !== null && events !== null && connections !== null;
  const realEmpty =
    loaded &&
    visits!.length === 0 &&
    clicks!.length === 0 &&
    events!.length === 0;

  // Collapse multiple on-chain logs that belong to the same deposit (or
  // withdraw) into a single row. One user deposit can emit several mints
  // on the vault token - the user's shares plus a fee/dust mint - and a
  // row may also have been written by both event sources before the
  // subgraph cron was retired, each with a different log_index. All of
  // those share the transaction hash, so we key on tx + vault + type and
  // keep the largest share amount (the real deposit; the dust mints drop
  // out). Genuine separate deposits live in different transactions, and
  // deposits into different vaults differ on vault_address, so both stay
  // as distinct rows.
  const dedupedEvents = useMemo(() => {
    if (!events) return events;
    // Behaviourally-detected rebalancer wallets (allocators not in the
    // static denylist) computed over the full loaded window before slicing.
    const rebalancers = detectRebalancerActors(events);
    const byKey = new Map<string, VaultEventRow>();
    for (const e of events) {
      // Drop protocol-internal autopilot / allocator reallocations - they
      // are not real users or net inflows, so they have no place in the
      // stream, journeys, or any source ranking.
      if (
        isMutedActor(e.wallet_address) ||
        rebalancers.has((e.wallet_address || "").toLowerCase())
      )
        continue;
      const key = `${(e.tx_hash || "").toLowerCase()}|${(e.vault_address || "").toLowerCase()}|${e.event_type}`;
      const prev = byKey.get(key);
      if (!prev || sharesBig(e) > sharesBig(prev)) byKey.set(key, e);
    }
    return [...byKey.values()];
  }, [events]);

  // session_id -> earliest-touch { source, country, device, domain } from
  // visits, then clicks as a backfill for sessions that never logged a
  // page view. device + domain ride along so a click/event row can show
  // the device and referring domain of the session that drove it (only
  // visits carry a referrer, so domain is null for click-only sessions).
  const sessionFirstTouch = useMemo(() => {
    const m = new Map<
      string,
      {
        source: string | null;
        country: string | null;
        device: string | null;
        domain: string | null;
        t: number;
      }
    >();
    const consider = (
      sid: string | null,
      source: string | null,
      country: string | null,
      device: string | null,
      domain: string | null,
      iso: string,
    ) => {
      if (!sid) return;
      const t = new Date(iso).getTime();
      const prev = m.get(sid);
      if (!prev || t < prev.t) m.set(sid, { source, country, device, domain, t });
    };
    for (const v of visits ?? [])
      consider(
        v.session_id,
        v.source,
        v.country,
        v.device_type,
        sourceDomain(v.referrer),
        v.created_at,
      );
    for (const c of clicks ?? [])
      consider(c.session_id, c.source, c.country, c.device_type, null, c.created_at);
    return m;
  }, [visits, clicks]);

  // wallet (lowercased) -> every connection it made, ascending by time.
  // A wallet can connect across many sessions (different tabs, days, or
  // re-tests), so we keep the full list and pick per-event rather than
  // collapsing to one. Each entry carries the session_id (hsid) and the
  // DeBank balance captured at that connect.
  const walletConnections = useMemo(() => {
    const m = new Map<
      string,
      Array<{ session: string | null; t: number; balance: number | null }>
    >();
    for (const w of connections ?? []) {
      const a = (w.wallet_address || "").toLowerCase();
      if (!a) continue;
      const t = new Date(w.connected_at).getTime();
      if (!Number.isFinite(t)) continue;
      const entry = { session: w.session_id, t, balance: w.balance };
      const arr = m.get(a);
      if (arr) arr.push(entry);
      else m.set(a, [entry]);
    }
    for (const arr of m.values()) arr.sort((x, y) => x.t - y.t);
    return m;
  }, [connections]);

  // Pick the connection that best explains an event at time `atMs`: the
  // latest connect at or just before the event (last touch before the
  // conversion), falling back to the earliest connect when every connect
  // post-dates the event. This replaces a global earliest-connect join,
  // which pinned every deposit from a reused wallet to the very first
  // session that wallet ever appeared in - so a deposit driven by a fresh
  // Google session read as whatever channel drove the wallet's first-ever
  // visit. CONNECT_SKEW_MS absorbs the small clock skew between the chain
  // block timestamp and the app-written connected_at.
  const pickConnection = useCallback(
    (wallet: string, atMs: number) => {
      const conns = walletConnections.get((wallet || "").toLowerCase());
      if (!conns || conns.length === 0) return null;
      let chosen: (typeof conns)[number] | null = null;
      for (const c of conns) {
        if (c.t <= atMs + CONNECT_SKEW_MS) chosen = c;
      }
      return chosen ?? conns[0];
    },
    [walletConnections],
  );

  // hsid (session_id) -> wallet that connected on that session. The
  // reverse of walletConnections: lets a visit/click row in the Stream show
  // the wallet once the app persists the hsid on connect, even before
  // any on-chain deposit. Earliest connect per session wins.
  const sessionWallet = useMemo(() => {
    const m = new Map<string, { wallet: string; t: number }>();
    for (const w of connections ?? []) {
      if (!w.session_id) continue;
      const addr = (w.wallet_address || "").toLowerCase();
      if (!addr) continue;
      const t = new Date(w.connected_at).getTime();
      const prev = m.get(w.session_id);
      if (!prev || t < prev.t) m.set(w.session_id, { wallet: addr, t });
    }
    return m;
  }, [connections]);

  // wallet (lowercased) -> latest captured net worth (DeBank USD balance
  // recorded at connect). Most-recent non-null capture wins, so the
  // Net worth column reflects the wallet's current size, not a stale one.
  const walletBalance = useMemo(() => {
    const bal = new Map<string, number>();
    const at = new Map<string, number>();
    for (const w of connections ?? []) {
      const a = (w.wallet_address || "").toLowerCase();
      if (!a || w.balance == null || !Number.isFinite(w.balance)) continue;
      const t = new Date(w.connected_at).getTime();
      const prev = at.get(a);
      if (prev === undefined || t > prev) {
        at.set(a, t);
        bal.set(a, w.balance);
      }
    }
    return bal;
  }, [connections]);

  // Resolve an on-chain event's wallet back to its acquisition source.
  function resolveWallet(wallet: string, atMs: number): {
    channel: string;
    country: string | null;
    device: string | null;
    srcDomain: string | null;
    netWorth: number | null;
    attributed: boolean;
    upstream: string | null;
    hsid: string | null;
  } {
    const link = pickConnection(wallet, atMs);
    const netWorth =
      link?.balance ?? walletBalance.get((wallet || "").toLowerCase()) ?? null;
    const ft = link?.session ? sessionFirstTouch.get(link.session) : undefined;
    if (!ft) {
      // No web session ties this wallet to us: no identifiable acquisition
      // source, which reads as Direct (GA), not a mysterious "External".
      return {
        channel: "Direct",
        country: null,
        device: null,
        srcDomain: null,
        netWorth,
        attributed: false,
        upstream: null,
        hsid: link?.session ?? null,
      };
    }
    return {
      channel: appChannel(ft.source),
      country: ft.country,
      device: ft.device,
      srcDomain: ft.domain,
      netWorth,
      attributed: true,
      upstream: classifyChannel(ft.source),
      hsid: link?.session ?? null,
    };
  }

  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceGroup>("all");
  // Product drill-down: "" = all products, otherwise a vault slug. Filters
  // the stream to activity tied to that product (its product-page visits,
  // its into-app clicks, its on-chain deposits/withdrawals).
  const [productFilter, setProductFilter] = useState<string>("");
  // Human-first by default: bots (crawlers, scanners, link unfurlers) are
  // hidden until the operator opts in via the "Show bots" toggle.
  const [showBots, setShowBots] = useState(false);
  // Engagement filter: "all" (off), "engaged" (explored >1 page, any
  // landing), or "deep" (explored >1 page AND first touch on a non-root
  // page). Any source either way.
  const [engagement, setEngagement] = useState<Engagement>("all");
  // Activity heartbeat chart: hidden by default, toggled from the header.
  const [showHeartbeat, setShowHeartbeat] = useState(false);

  const items = useMemo<FeedItem[]>(() => {
    if (!loaded) return [];
    const now = Date.now();

    if (realEmpty) {
      // Demo stream for credential-less / brand-new environments (marked
      // "sample" in the header). Generated deterministically with enough
      // volume + time depth (~100 rows across ~7 days) to exercise the
      // pager, the >1-day date format, and the Net worth column.
      const devs = ["desktop", "mobile", "tablet"];
      const srcs = [
        "https://www.google.com/", "chatgpt.com", "https://t.co/",
        "https://www.reddit.com/", "perplexity.ai", "https://www.bing.com/",
        "coingecko.com", "defiprime.com", "(direct)", "https://duckduckgo.com/",
        // In-app webview referrers, decoded out of Direct into Wallet / Social
        // / Email / App so the new source buckets show up in the demo.
        "android-app://io.metamask", "android-app://me.rainbow",
        "android-app://com.instagram.android", "android-app://com.google.android.gm",
        "android-app://com.linkedin.android", "android-app://com.opera.browser",
        "ios-app://com.debank.rabby",
      ];
      const countries = ["US", "GB", "DE", "PL", "BR", "IN", "CA", "FR", "NL", "SG"];
      const pages = ["/", "/usdc", "/eth", "/btc", "/arbitrum", "/base", "/methodology", "/weth-autopilot-base"];
      const slugs = ["weth-autopilot-base", "usdc-autopilot-base", "usdc-aerodrome-aero-base", "usdc-hypurr-hyperevm", "eth-clearstar-reactor-v2-base"];
      const wallets = ["0x417c8e123e5d0f3e0a0c0ee171606e61ccb637df", "0x8a3fce21b9d47a0c6f5e2d18b4c7a90e3f1d6b24", "0xa07f3c91e6b2d8540c19a3f7b08e2d45c6019e8b", "0xa56a2edcf9315e2cf98bd8d2b0a41a5eda3a09a2", "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"];
      const worths: (number | null)[] = [4200, 18500, 142000, 1250000, 3400, 56000, 890000, null];
      const out: FeedItem[] = [];
      for (let i = 0; i < 70; i++) {
        const src = srcs[i % srcs.length];
        // Every 11th sample row is a crawler hitting an asset path (mirrors
        // the real .svg / bot rows) so the "Show bots" toggle has something
        // to reveal on a data-less fork.
        const isBotSample = i % 11 === 0;
        const wal = !isBotSample && i % 4 === 0 ? wallets[i % wallets.length] : null;
        out.push({
          kind: "visit",
          bot: isBotSample,
          id: `sv-${i}`,
          // Accelerating gap: ~1 min ago out to ~7 days, so plenty of
          // rows cross the 24h boundary.
          time: new Date(now - Math.round(1 + i * i * 2.1) * 60_000).toISOString(),
          channel: classifyChannel(src),
          country: countries[i % countries.length],
          device: devs[i % devs.length],
          srcDomain: sourceDomain(src),
          pagePath: isBotSample
            ? "/pool/public/logo302d83e9f8fb9ddd88ef.svg"
            : pages[i % pages.length],
          hsid: `sample-hsid-v${i}`,
          wallet: wal,
          netWorth: wal ? worths[i % worths.length] : null,
        });
      }
      // One multi-page session (collapses to an expandable row).
      ["/weth-autopilot-base", "/usdc", "/eth"].forEach((page, k) =>
        out.push({
          kind: "visit",
          bot: false,
          id: `sv-tour-${k}`,
          time: new Date(now - (5 + k * 2) * 60_000).toISOString(),
          channel: classifyChannel("chatgpt.com"),
          country: "GB",
          device: "mobile",
          srcDomain: "chatgpt.com",
          pagePath: page,
          hsid: "sample-hsid-tour",
          wallet: null,
          netWorth: null,
        }),
      );
      for (let i = 0; i < 15; i++) {
        const src = srcs[(i + 2) % srcs.length];
        const wal = i % 3 === 0 ? wallets[i % wallets.length] : null;
        const slug = slugs[i % slugs.length];
        out.push({
          kind: "click",
          bot: false,
          id: `sc-${i}`,
          time: new Date(now - Math.round(3 + i * i * 9) * 60_000).toISOString(),
          channel: appChannel(src),
          country: countries[(i + 3) % countries.length],
          device: devs[i % devs.length],
          srcDomain: sourceDomain(src),
          vaultSlug: slug,
          sourcePage: `/${slug}`,
          targetUrl: "https://app.harvest.finance/",
          hsid: `sample-hsid-c${i}`,
          wallet: wal,
          netWorth: wal ? worths[(i + 1) % worths.length] : null,
        });
      }
      const evChannels = ["Homepage", "Google", "Direct", "ChatGPT", "X / Twitter"];
      const evChains = ["Base", "Ethereum", "Arbitrum", "HyperEVM"];
      for (let i = 0; i < 12; i++) {
        const ch = evChannels[i % evChannels.length];
        out.push({
          kind: "event",
          bot: false,
          id: `se-${i}`,
          time: new Date(now - Math.round(20 + i * i * 60) * 60_000).toISOString(),
          channel: ch,
          country: countries[(i + 1) % countries.length],
          device: devs[i % devs.length],
          srcDomain: ch === "Google" ? "google.com" : null,
          attributed: ch !== "Direct",
          upstream: ch,
          hsid: ch === "Direct" ? null : `sample-hsid-e${i}`,
          eventType: i % 3 === 0 ? "withdraw" : "deposit",
          wallet: wallets[i % wallets.length],
          vaultSlug: slugs[i % slugs.length],
          vaultAddress: "0x0000000000000000000000000000000000000000",
          chain: evChains[i % evChains.length],
          tx: SAMPLE_TX[i % SAMPLE_TX.length],
          netWorth: worths[i % worths.length],
        });
      }
      return out.sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
      );
    }

    // Cluster-poisoning: fingerprints of the referrer-spoofing fleets (mimic
    // a maximized browser + spoof organic search), flagged across the whole
    // visit set so even their geo-consistent nodes read as bots.
    const poisonedFp = detectSpoofedFingerprints(visits ?? []);

    const merged: FeedItem[] = [
      ...(visits ?? []).map((v, i) => {
        const wal = v.session_id
          ? sessionWallet.get(v.session_id)?.wallet ?? null
          : null;
        // For an unrecognised referral, prefer the referrer's brand so the
        // pill shows the root domain (e.g. "Moonwell") even on older rows
        // whose stored source was a subdomain.
        const dom = sourceDomain(v.referrer);
        const baseCh = classifyVisit(v.source, v.referrer);
        return {
          kind: "visit" as const,
          bot: isBotRow(v) || poisonedFp.has(fingerprintKey(v)),
          id: `v-${v.session_id}-${v.created_at}-${i}`,
          time: v.created_at,
          channel:
            channelTone(baseCh) === "referral" && dom
              ? brandFromSource(dom)
              : baseCh,
          country: v.country,
          device: v.device_type,
          srcDomain: dom,
          pagePath: v.page_path || "/",
          hsid: v.session_id || null,
          wallet: wal,
          netWorth: wal ? walletBalance.get(wal) ?? null : null,
        };
      }),
      ...(clicks ?? []).map((c, i) => {
        const wal = c.session_id
          ? sessionWallet.get(c.session_id)?.wallet ?? null
          : null;
        // Clicks carry no referrer; fall back to the session's first visit
        // domain, and prefer its brand for an unrecognised referral so the
        // pill shows the root domain, not a subdomain.
        const cDom = c.session_id
          ? sessionFirstTouch.get(c.session_id)?.domain ?? null
          : null;
        const cBaseCh = appChannel(c.source);
        return {
          kind: "click" as const,
          bot: isBotRow({ is_bot: c.is_bot, user_agent: c.user_agent, page_path: c.source_page }),
          id: `c-${c.session_id}-${c.created_at}-${i}`,
          time: c.created_at,
          channel:
            channelTone(cBaseCh) === "referral" && cDom
              ? brandFromSource(cDom)
              : cBaseCh,
          country: c.country,
          device: c.device_type,
          srcDomain: cDom,
          vaultSlug: c.vault_slug,
          sourcePage: c.source_page || "/",
          targetUrl: c.target_url,
          hsid: c.session_id || null,
          wallet: wal,
          netWorth: wal ? walletBalance.get(wal) ?? null : null,
        };
      }),
      ...(dedupedEvents ?? []).map((e) => {
        const r = resolveWallet(
          e.wallet_address,
          new Date(e.block_timestamp).getTime(),
        );
        return {
          kind: "event" as const,
          bot: false,
          id: `e-${e.tx_hash}-${e.log_index}`,
          time: e.block_timestamp,
          channel: r.channel,
          country: r.country,
          device: r.device,
          srcDomain: r.srcDomain,
          attributed: r.attributed,
          upstream: r.upstream,
          hsid: r.hsid,
          eventType: e.event_type as "deposit" | "withdraw",
          wallet: e.wallet_address,
          vaultSlug: e.vault_slug,
          vaultAddress: e.vault_address,
          chain: e.chain,
          tx: e.tx_hash,
          netWorth: r.netWorth,
        };
      }),
    ];
    return merged.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits, clicks, dedupedEvents, pickConnection, sessionWallet, sessionFirstTouch, loaded, realEmpty]);

  // Per-session entry page + distinct pages viewed, for "Isolate engaged":
  // a session qualifies if its first touch was a non-root page and it spans
  // more than one unique page (across all sources). Built from visit rows.
  const sessionMeta = useMemo(() => {
    const m = new Map<
      string,
      { entryPage: string; entryMs: number; pages: Set<string> }
    >();
    for (const it of items) {
      if (it.kind !== "visit" || !it.hsid) continue;
      const t = new Date(it.time).getTime();
      let s = m.get(it.hsid);
      if (!s) {
        s = { entryPage: it.pagePath, entryMs: t, pages: new Set() };
        m.set(it.hsid, s);
      }
      if (Number.isFinite(t) && t < s.entryMs) {
        s.entryMs = t;
        s.entryPage = it.pagePath;
      }
      s.pages.add(it.pagePath);
    }
    return m;
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter((it) => {
        if (!showBots && it.bot) return false;
        if (engagement !== "all") {
          const s = it.hsid ? sessionMeta.get(it.hsid) : undefined;
          if (!s) return false;
          if (engagement === "subpage") {
            // Non-root first touch, any page count (single-page included).
            if (s.entryPage === "/") return false;
          } else {
            if (s.pages.size <= 1) return false;
            if (engagement === "deep" && s.entryPage === "/") return false;
          }
        }
        if (sourceFilter !== "all" && channelGroup(it.channel) !== sourceFilter)
          return false;
        if (productFilter) {
          // Keep only rows tied to the chosen product: its product-page
          // visit, or a click/on-chain event carrying its slug.
          if (it.kind === "visit") {
            if (it.pagePath.toLowerCase() !== "/" + productFilter) return false;
          } else if (it.kind === "click" || it.kind === "event") {
            if ((it.vaultSlug || "").toLowerCase() !== productFilter) return false;
          } else {
            return false;
          }
        }
        switch (activity) {
          case "visits":
            return it.kind === "visit";
          case "clicks":
            return it.kind === "click";
          case "deposits":
            return it.kind === "event" && it.eventType === "deposit";
          case "withdrawals":
            return it.kind === "event" && it.eventType === "withdraw";
          default:
            return true;
        }
      }),
    [items, activity, sourceFilter, showBots, engagement, sessionMeta, productFilter],
  );

  // Products that actually appear in the loaded activity, for the drill-down
  // dropdown - a click/deposit slug, or a product-page visit whose path maps
  // to a known product. Deduped and labelled with the product name.
  const productOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const it of items) {
      let slug: string | null = null;
      if (it.kind === "click" || it.kind === "event") slug = it.vaultSlug;
      else if (it.kind === "visit" && it.pagePath.startsWith("/")) {
        const s = it.pagePath.slice(1).toLowerCase();
        if (productNames[s]) slug = s;
      }
      if (!slug) continue;
      const key = slug.toLowerCase();
      if (!seen.has(key)) seen.set(key, productNames[key] ?? slug);
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [items, productNames]);

  // Clusters the operator has expanded to see the individual page views.
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(
    () => new Set(),
  );
  const toggleCluster = (id: string) =>
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Collapse a single visitor's page views into one master row. A person
  // touring the site fires a Visit per page; rendered flat they look like a
  // wave of traffic from one channel. Visits sharing an hsid are split into
  // clusters on any >1h gap (a kept-open tab keeps the hsid alive for hours,
  // so one hsid spans several real return visits), and each cluster with two
  // or more pages becomes a session row carrying the page count. Everything
  // else (clicks, deposits, withdrawals, and lone/anonymous visits) stays its
  // own row. Sorted newest first by the cluster's most recent visit.
  const streamRows = useMemo<StreamRow[]>(() => {
    const visitsBySession = new Map<string, VisitItem[]>();
    const rows: StreamRow[] = [];
    for (const it of filtered) {
      if (it.kind === "visit" && it.hsid) {
        const arr = visitsBySession.get(it.hsid);
        if (arr) arr.push(it);
        else visitsBySession.set(it.hsid, [it]);
      } else {
        rows.push({ kind: "item", item: it });
      }
    }
    const pushCluster = (sid: string, cluster: VisitItem[]) => {
      if (cluster.length === 0) return;
      if (cluster.length === 1) {
        rows.push({ kind: "item", item: cluster[0] });
        return;
      }
      const desc = [...cluster].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
      );
      rows.push({
        kind: "group",
        group: {
          clusterId: `cluster-${desc[0].id}`,
          sessionId: sid,
          time: desc[0].time,
          channel: desc[0].channel,
          country: desc[0].country,
          device: desc.find((v) => v.device)?.device ?? null,
          srcDomain: desc.find((v) => v.srcDomain)?.srcDomain ?? null,
          wallet: desc.find((v) => v.wallet)?.wallet ?? null,
          netWorth: desc.find((v) => v.netWorth != null)?.netWorth ?? null,
          bot: desc.some((v) => v.bot),
          pages: desc,
        },
      });
    };
    for (const [sid, visits] of visitsBySession) {
      // Ascending by time so an inactivity gap splits the session.
      const asc = [...visits].sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
      );
      let cluster: VisitItem[] = [];
      let prevTime = 0;
      for (const v of asc) {
        const t = new Date(v.time).getTime();
        if (cluster.length > 0 && t - prevTime > SESSION_GAP_MS) {
          pushCluster(sid, cluster);
          cluster = [];
        }
        cluster.push(v);
        prevTime = t;
      }
      pushCluster(sid, cluster);
    }
    return rows.sort((a, b) => {
      const ta = a.kind === "item" ? a.item.time : a.group.time;
      const tb = b.kind === "item" ? b.item.time : b.group.time;
      return new Date(tb).getTime() - new Date(ta).getTime();
    });
  }, [filtered]);

  // Earliest deposit per wallet across the whole stream (sample or
  // real), for the New / Existing classification.
  const firstDepTs = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      if (it.kind === "event" && it.eventType === "deposit" && it.wallet) {
        const w = it.wallet.toLowerCase();
        const t = new Date(it.time).getTime();
        const prev = m.get(w);
        if (prev === undefined || t < prev) m.set(w, t);
      }
    }
    return m;
  }, [items]);

  // Earliest tracked visit per wallet (via the session<->wallet join), the
  // "acquisition" time the New/Existing test anchors to.
  const firstVisitByWallet = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of visits ?? []) {
      if (!v.session_id) continue;
      const w = sessionWallet.get(v.session_id)?.wallet;
      if (!w) continue;
      const t = new Date(v.created_at).getTime();
      if (!Number.isFinite(t)) continue;
      const prev = m.get(w);
      if (prev === undefined || t < prev) m.set(w, t);
    }
    return m;
  }, [visits, sessionWallet]);

  // Existing = the wallet was already a depositor before we acquired it (its
  // earliest deposit predates its first tracked visit); New = no prior
  // balance, incl. first-time depositors who deposit during the session -
  // even on a repeat deposit. Anchoring to the first visit (not the row's own
  // time) keeps this consistent with the SEO Summary. No wallet -> none.
  const statusFor = useCallback(
    (wallet: string | null, timeMs: number): "new" | "existing" | null => {
      if (!wallet) return null;
      const w = wallet.toLowerCase();
      const fd = firstDepTs.get(w);
      if (fd === undefined) return "new";
      const fv = firstVisitByWallet.get(w);
      if (fv !== undefined) return fd < fv ? "existing" : "new";
      // Event-only wallet with no tracked visit (not in the SEO funnel):
      // fall back to whether a deposit predates this row.
      return fd < timeMs ? "existing" : "new";
    },
    [firstDepTs, firstVisitByWallet],
  );

  const loading = !loaded && !err;

  const totalPages = Math.max(1, Math.ceil(streamRows.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = streamRows.slice(
    safePage * ROWS_PER_PAGE,
    safePage * ROWS_PER_PAGE + ROWS_PER_PAGE,
  );

  function productLabel(slug: string | null, address?: string): string {
    if (slug && productNames[slug.toLowerCase()]) return productNames[slug.toLowerCase()];
    if (address && productNames[address.toLowerCase()]) return productNames[address.toLowerCase()];
    return slug ?? (address ? shortenAddress(address) : "—");
  }

  const description =
    "The heart of Harvest activity, newest first: front-page views, [View strategy] clicks into the app, and on-chain deposits and withdrawals. On-chain events are attributed back to the session that drove them, so a deposit from a wallet that connected through the index reads as Homepage; one with no tracked session reads as Direct.";

  return (
    <div className="uni-hub-test lf-page">
      <header className="uni-hub-hero aq-hero-slim aq-hero-fullwidth">
        <div
          className="uni-hub-hero-headline"
          style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="uni-hub-h1">
              Live Feed
              <InfoTip label="About Live Feed">{description}</InfoTip>
              {realEmpty && <span className="aq-sample-badge">sample</span>}
            </h1>
            <p className="uni-hub-sub aq-sub-full">{description}</p>
          </div>
          <button
            type="button"
            className={`lf-refresh${showHeartbeat ? " active" : ""}`}
            onClick={() => setShowHeartbeat((v) => !v)}
            aria-pressed={showHeartbeat}
            style={{ flexShrink: 0 }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            {showHeartbeat ? "Hide heartbeat" : "Show heartbeat"}
          </button>
        </div>
      </header>

      {showHeartbeat && <HeartbeatSection items={items} showBots={showBots} />}

      <section className="uni-hub-section" style={{ marginTop: 28 }}>
        <header className="uni-hub-section-head">
          <div className="aq-section-head-left">
            <h2 className="uni-hub-section-title">Site &amp; app activity</h2>
            <span className="uni-hub-section-meta">
              {streamRows.length.toLocaleString("en-US")}
              {filtered.length === items.length ? "" : " filtered"} rows
              {realEmpty
                ? " · preview data, no live activity yet"
                : " · full history, source attributed first-touch via the wallet-session join"}
            </span>
          </div>
        </header>

        {/* One compact control row: Refresh + the two filters as iconed
            dropdowns (globe = acquisition source, pulse = activity
            type) instead of two full-width pill bars. */}
        <div className="lf-filterbar">
          <RefreshButton onClick={handleRefresh} refreshing={refreshing} />
          <span className="lf-filter-grp">
          <label className="lf-filter" aria-label="Source filter">
            <span className="lf-filter-icon" aria-hidden="true">
              <SourceFilterIcon />
            </span>
            <select
              className="lf-select lf-select-iconed"
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value as SourceGroup);
                setPage(0);
              }}
            >
              {SOURCE_GROUPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value === "all" ? "All sources" : o.label}
                </option>
              ))}
            </select>
          </label>
          <FilterHint label="About the source filter">
            How the visitor was acquired: SEO (search engines), AI assistants,
            Social, Wallet (in-wallet dapp browsers), App (other in-app
            webviews), Email (webmail), a named Referral site, or Direct (no
            referrer, a typed URL, or an app share).
          </FilterHint>
          </span>
          <span className="lf-filter-grp">
            <SearchSelect
              value={productFilter}
              onChange={(v) => {
                setProductFilter(v);
                setPage(0);
              }}
              options={productOptions}
              allLabel="All products"
              searchPlaceholder="Search products…"
              ariaLabel="Product filter"
            />
            <FilterHint label="About the product filter">
              Drill the stream down to a single product: its product-page
              visits, its into-app clicks, and its on-chain deposits and
              withdrawals. Type to search the {productOptions.length} products
              with activity.
            </FilterHint>
          </span>
          <span className="lf-filter-grp">
          <label className="lf-filter" aria-label="Activity filter">
            <span className="lf-filter-icon" aria-hidden="true">
              <ActivityFilterIcon />
            </span>
            <select
              className="lf-select lf-select-iconed"
              value={activity}
              onChange={(e) => {
                setActivity(e.target.value as ActivityFilter);
                setPage(0);
              }}
            >
              {ACTIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value === "all" ? "All activity" : o.label}
                </option>
              ))}
            </select>
          </label>
          <FilterHint label="About the activity filter">
            Filter the stream by event type: page Visits, App Clicks into the
            app, Deposits, or Withdrawals.
          </FilterHint>
          </span>
          <label
            className="lf-bot-toggle"
            title="Bots (crawlers, scanners, link unfurlers) are hidden by default. Toggle to audit non-human traffic."
          >
            <input
              type="checkbox"
              checked={showBots}
              onChange={(e) => {
                setShowBots(e.target.checked);
                setPage(0);
              }}
            />
            Show bots
          </label>
          <span className="lf-filter-grp">
            <select
              className="lf-select"
              aria-label="Engagement filter"
              value={engagement}
              onChange={(e) => {
                setEngagement(e.target.value as Engagement);
                setPage(0);
              }}
            >
              {ENGAGEMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <FilterHint label="About the engagement filter">
              "Sub-page first touch" isolates every session whose first page was
              a non-root page (a product or hub), single-page visits included -
              pair it with the Direct source to catch a product page surfacing
              as a new access point. "Engaged (any landing)" counts every
              multi-page session, homepage or not. "Engaged (deep landing)"
              keeps only multi-page sessions whose first touch was a content
              page rather than the homepage, the highest-intent cohort.
            </FilterHint>
          </span>
        </div>

        {err && (
          <div className="uni-hub-empty" style={{ color: "#b91c1c" }}>
            Could not load activity: {err}
          </div>
        )}

        {loading ? (
          <div className="uni-hub-empty">Loading feed…</div>
        ) : (
          <>
          <div className="lf-scroll">
            <div className="uni-hub-table lf-table">
              <div className="uni-hub-thead" style={{ gridTemplateColumns: FEED_COLS }}>
                <span className="uni-hub-th">Time</span>
                <span className="uni-hub-th">Source</span>
                <span className="uni-hub-th">Country</span>
                <span className="uni-hub-th">Event</span>
                <span className="uni-hub-th">Product / Page</span>
                <span className="uni-hub-th">Device</span>
                <span className="uni-hub-th lf-status-cell">New / Existing</span>
                <span className="uni-hub-th">Wallet</span>
                <span className="uni-hub-th lf-networth-cell">Net worth</span>
                <span className="uni-hub-th">Tx</span>
              </div>
              <div className="uni-hub-tbody">
                {streamRows.length === 0 && (
                  <div className="uni-hub-empty">No activity matches this filter.</div>
                )}
                {pageRows.map((row) =>
                  row.kind === "item" ? (
                    <FeedRow
                      key={row.item.id}
                      item={row.item}
                      productLabel={productLabel}
                      statusFor={statusFor}
                    />
                  ) : (
                    <SessionGroupRow
                      key={row.group.clusterId}
                      group={row.group}
                      expanded={expandedClusters.has(row.group.clusterId)}
                      onToggle={() => toggleCluster(row.group.clusterId)}
                      statusFor={statusFor}
                    />
                  ),
                )}
              </div>
            </div>
          </div>
          <TablePager
            page={safePage}
            totalPages={totalPages}
            totalRows={streamRows.length}
            onPage={setPage}
          />
          </>
        )}
      </section>
    </div>
  );
}

// ── Stream rows ─────────────────────────────────────────────────────

type ProductLabel = (slug: string | null, address?: string) => string;

// A single activity row (visit, click, deposit or withdraw). Extracted so
// the same markup renders both top-level items and the expanded page rows
// inside a collapsed session.
//
// On mobile the product / page is NOT shown inline - the activity cell
// renders a count pill ("1") and tapping the row expands a detail line
// with the page / product link, mirroring how session rows expand into
// their visited URLs. On desktop the product stays inline and the
// detail line never renders visibly.
function FeedRow({
  item,
  productLabel,
  statusFor,
}: {
  item: FeedItem;
  productLabel: ProductLabel;
  statusFor: (wallet: string | null, timeMs: number) => "new" | "existing" | null;
}) {
  const [open, setOpen] = useState(false);
  const productNode =
    item.kind === "visit" ? (
      <Link href={item.pagePath} className="lf-product-link">
        {item.pagePath}
      </Link>
    ) : item.kind === "click" ? (
      item.vaultSlug ? (
        <Link href={`/${item.vaultSlug}`} className="lf-product-link">
          {productLabel(item.vaultSlug)}
        </Link>
      ) : (
        <Link href={item.sourcePage} className="lf-product-link">
          {item.sourcePage}
        </Link>
      )
    ) : item.vaultSlug ? (
      <Link href={`/${item.vaultSlug}`} className="lf-product-link">
        {productLabel(item.vaultSlug, item.vaultAddress)}
      </Link>
    ) : (
      <span className="lf-product-link">
        {productLabel(item.vaultSlug, item.vaultAddress)}
      </span>
    );
  return (
    <>
    <div
      className={`uni-hub-row lf-item-row${item.bot ? " lf-row-bot" : ""}`}
      style={{ gridTemplateColumns: FEED_COLS }}
      onClick={(e) => {
        // Links inside the row (product, tx) keep their own behaviour.
        if ((e.target as HTMLElement).closest("a")) return;
        setOpen((o) => !o);
      }}
    >
      <span
        className="uni-hub-cell lf-time"
        data-label="Time"
        title={formatTime(item.time)}
      >
        <TimeLabel iso={item.time} />
      </span>
      <span className="uni-hub-cell" data-label="Source">
        <span
          className={`lf-badge lf-badge-${channelTone(item.channel)}`}
          title={
            item.kind === "event" && item.attributed && item.upstream && item.upstream !== item.channel
              ? `first touch: ${item.upstream}${item.srcDomain ? ` · ${item.srcDomain}` : ""}`
              : item.srcDomain ?? undefined
          }
        >
          <span className="lf-lbl-full">{item.channel}</span>
          <span className="lf-lbl-short">{shortChannelLabel(item.channel)}</span>
        </span>
        {item.bot && (
          <span className="lf-botflag" title="Non-human / bot traffic">
            bot
          </span>
        )}
      </span>
      <span className="uni-hub-cell" data-label="Country">
        {item.country ? <CountryFlag country={item.country} /> : <span className="lf-dim">—</span>}
      </span>
      <span className="uni-hub-cell" data-label="Event">
        {item.kind === "visit" ? (
          <span
            className="lf-event lf-event-visit"
            title={item.hsid ? `hsid ${item.hsid}` : undefined}
          >
            <VisitIcon />
            <span className="lf-lbl-full">Visit</span>
          </span>
        ) : item.kind === "click" ? (
          <span
            className="lf-event lf-event-click"
            title={item.hsid ? `hsid ${item.hsid}` : undefined}
          >
            <ClickIcon />
            <span className="lf-lbl-full">App click</span>
            <span className="lf-lbl-short">App</span>
          </span>
        ) : (
          <span
            className={`lf-event lf-event-${item.eventType}`}
            title={item.hsid ? `hsid ${item.hsid}` : undefined}
          >
            <EventIcon type={item.eventType} />
            <span className="lf-lbl-full">{item.eventType}</span>
            <span className="lf-lbl-short">
              {item.eventType === "deposit" ? "Dep" : "With"}
            </span>
          </span>
        )}
      </span>
      <span className="uni-hub-cell lf-product" data-label="Product / Page">
        <span className="lf-lbl-full lf-product-full">{productNode}</span>
        <span className="lf-lbl-short lf-count-pill">1</span>
      </span>
      <span className="uni-hub-cell lf-device-cell" data-label="Device">
        <DeviceIcon device={item.device} />
      </span>
      <span className="uni-hub-cell lf-status-cell" data-label="New / Existing">
        <StatusBadge
          status={statusFor(item.wallet ?? null, new Date(item.time).getTime())}
          wallet={item.wallet ?? null}
        />
      </span>
      <span className="uni-hub-cell" data-label="Wallet">
        {item.wallet ? (
          <WalletLabel
            address={item.wallet}
            title={
              item.kind === "event"
                ? item.wallet
                : `${item.wallet} - linked to this session after the wallet connected in the app, not known at page-view time`
            }
          />
        ) : (
          <span className="lf-dim">—</span>
        )}
      </span>
      <span className="uni-hub-cell lf-networth-cell" data-label="Net worth">
        {item.netWorth != null ? (
          <span className="lf-mono" title={`$${Math.round(item.netWorth).toLocaleString("en-US")}`}>
            {formatTVL(item.netWorth)}
          </span>
        ) : (
          <span className="lf-dim">—</span>
        )}
      </span>
      <span className="uni-hub-cell" data-label="Tx">
        {item.kind === "event" ? (
          <a
            href={txLink(item.chain, item.tx)}
            target="_blank"
            rel="noopener noreferrer"
            className="lf-tx"
          >
            <span className="lf-lbl-full">view</span>
            <ExternalLinkIcon className="lf-lbl-short" />
          </a>
        ) : (
          <span className="lf-dim">—</span>
        )}
      </span>
    </div>
    {open && (
      <div className="uni-hub-row lf-row-child lf-detail-row">
        <span className="lf-detail-time">{formatTime(item.time)}</span>
        <span className="uni-hub-cell lf-product" data-label="Product / Page">
          {productNode}
        </span>
      </div>
    )}
    </>
  );
}

// Collapsed session: one master row for a visitor's whole page tour, with a
// page-count pill and a chevron. Clicking the row reveals each page visit as
// an indented child row.
function SessionGroupRow({
  group,
  expanded,
  onToggle,
  statusFor,
}: {
  group: VisitGroup;
  expanded: boolean;
  onToggle: () => void;
  statusFor: (wallet: string | null, timeMs: number) => "new" | "existing" | null;
}) {
  return (
    <>
      <div
        className={`uni-hub-row lf-session-row${group.bot ? " lf-row-bot" : ""}`}
        style={{ gridTemplateColumns: FEED_COLS }}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
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
          title={formatTime(group.time)}
        >
          <Chevron />
          <TimeLabel iso={group.time} />
        </span>
        <span className="uni-hub-cell" data-label="Source">
          <span
            className={`lf-badge lf-badge-${channelTone(group.channel)}`}
            title={group.srcDomain ?? undefined}
          >
            <span className="lf-lbl-full">{group.channel}</span>
            <span className="lf-lbl-short">{shortChannelLabel(group.channel)}</span>
          </span>
          {group.bot && (
            <span className="lf-botflag" title="Non-human / bot traffic">
              bot
            </span>
          )}
        </span>
        <span className="uni-hub-cell" data-label="Country">
          {group.country ? (
            <CountryFlag country={group.country} />
          ) : (
            <span className="lf-dim">—</span>
          )}
        </span>
        <span className="uni-hub-cell" data-label="Event">
          <span
            className="lf-event lf-event-visit"
            title={`hsid ${group.sessionId}`}
          >
            <VisitIcon />
            <span className="lf-lbl-full">Session</span>
            <span className="lf-lbl-short">Sess</span>
          </span>
        </span>
        <span className="uni-hub-cell lf-product" data-label="Product / Page">
          <span className="lf-session-count">
            <span className="lf-lbl-full">{group.pages.length} pages</span>
            <span className="lf-lbl-short lf-count-pill">{group.pages.length}</span>
          </span>
        </span>
        <span className="uni-hub-cell lf-device-cell" data-label="Device">
          <DeviceIcon device={group.device} />
        </span>
        <span className="uni-hub-cell lf-status-cell" data-label="New / Existing">
          <StatusBadge
            status={statusFor(group.wallet, new Date(group.time).getTime())}
            wallet={group.wallet}
          />
        </span>
        <span className="uni-hub-cell" data-label="Wallet">
          {group.wallet ? (
            <WalletLabel address={group.wallet} />
          ) : (
            <span className="lf-dim">—</span>
          )}
        </span>
        <span className="uni-hub-cell lf-networth-cell" data-label="Net worth">
          {group.netWorth != null ? (
            <span className="lf-mono" title={`$${Math.round(group.netWorth).toLocaleString("en-US")}`}>
              {formatTVL(group.netWorth)}
            </span>
          ) : (
            <span className="lf-dim">—</span>
          )}
        </span>
        <span className="uni-hub-cell" data-label="Tx">
          <span className="lf-dim">—</span>
        </span>
      </div>
      {expanded &&
        group.pages.map((p) => (
          <div
            key={p.id}
            className="uni-hub-row lf-row-child"
            style={{ gridTemplateColumns: FEED_COLS }}
          >
            <span
              className="uni-hub-cell lf-time"
              data-label="Time"
              title={formatTime(p.time)}
            >
              <TimeLabel iso={p.time} />
            </span>
            <span className="uni-hub-cell" data-label="Source">
              <span className="lf-dim">—</span>
            </span>
            <span className="uni-hub-cell" data-label="Country">
              <span className="lf-dim">—</span>
            </span>
            <span className="uni-hub-cell" data-label="Event">
              <span className="lf-event lf-event-visit">
                <VisitIcon />
                <span className="lf-lbl-full">Visit</span>
              </span>
            </span>
            <span className="uni-hub-cell lf-product" data-label="Product / Page">
              <Link href={p.pagePath} className="lf-product-link">
                {p.pagePath}
              </Link>
            </span>
            <span className="uni-hub-cell lf-device-cell" data-label="Device">
              <DeviceIcon device={p.device} />
            </span>
            <span className="uni-hub-cell lf-status-cell" data-label="New / Existing">
              <span className="lf-dim">—</span>
            </span>
            <span className="uni-hub-cell" data-label="Wallet">
              <span className="lf-dim">—</span>
            </span>
            <span className="uni-hub-cell lf-networth-cell" data-label="Net worth">
              <span className="lf-dim">—</span>
            </span>
            <span className="uni-hub-cell" data-label="Tx">
              <span className="lf-dim">—</span>
            </span>
          </div>
        ))}
    </>
  );
}

// Right-pointing chevron; rotates to down via CSS when the row is expanded.
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

// Raw share amount as a BigInt for comparison, 0n when missing/unparseable.
// Used to pick the largest mint when collapsing same-transaction duplicates.
function sharesBig(e: { amount_shares: string | null }): bigint {
  try {
    return e.amount_shares ? BigInt(e.amount_shares) : BigInt(0);
  } catch {
    return BigInt(0);
  }
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function txLink(chain: string, tx: string): string {
  const base =
    chain === "Ethereum"
      ? "https://etherscan.io/tx/"
      : chain === "Base"
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

// Date without the time, e.g. "Jun 13".
function formatDateOnly(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// "now", "Nm", "Nh" up to a day, then the absolute timestamp. With
// dateOnly, rows past 24h show just the date (no hour) - used for the
// tight mobile rows; the exact hour stays available on tap (expanded
// detail) and on desktop (full label + title).
function relativeTime(iso: string, dateOnly = false): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  if (diffMs < 60_000) return "now";
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return dateOnly ? formatDateOnly(iso) : formatTime(iso);
}

// Time cell content: full timestamp on desktop, date-only past 24h on
// the tight mobile rows (the <24h relative forms are identical on both).
function TimeLabel({ iso }: { iso: string }) {
  return (
    <>
      <span className="lf-lbl-full">{relativeTime(iso)}</span>
      <span className="lf-lbl-short">{relativeTime(iso, true)}</span>
    </>
  );
}

// Direction arrow: deposit points in (down), withdraw points out (up).
function EventIcon({ type }: { type: "deposit" | "withdraw" }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {type === "withdraw" ? (
        <>
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </>
      ) : (
        <>
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </>
      )}
    </svg>
  );
}

// External-link glyph: replaces the "view" tx label on mobile.
function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="View transaction">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

// Globe glyph for the source filter dropdown.
function SourceFilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

// Pulse glyph for the activity-type filter dropdown.
function ActivityFilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

// Eye glyph for a page view.
function VisitIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// Pointer/cursor glyph for a CTA click into the app.
function ClickIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 9l5 12 1.8-5.2L21 14 9 9z" />
      <path d="M7.5 3.5 8.5 6" />
      <path d="M3.5 7.5 6 8.5" />
      <path d="M3.5 12.5 6 11.5" />
      <path d="M7.5 16.5 8.5 14" />
    </svg>
  );
}
