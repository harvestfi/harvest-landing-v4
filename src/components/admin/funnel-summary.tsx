"use client";

// Admin funnel summary, shared by the SEO Summary and AI Summary pages.
//   1. Acquired   - sessions the index pulled in from the source group
//                   (a search engine for SEO, an AI answer engine for AI)
//   2. Reached app - those sessions that clicked through to the app
//   3. Deposited  - those that ended in an on-chain deposit, attributed back
//                   through wallet_connections_prod and filtered for autopilot
//                   / allocator reallocations.
// A session belongs here if any of its visits came from the scoped group.
// Every funnel stage, the 30-day chart, and the activity table read off the
// same session set. The table shows ONE collapsed row per session (so the row
// count equals the headline number) and follows the chart's metric toggle:
// pick Reached app / Deposited to narrow both the chart and the table to the
// sessions that got that far. Expand a row to see that session's actions.
// The two pages differ only by `group` + display `copy`.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { WalletLabel } from "@/components/admin/wallet-label";
import { supabaseSelectAll } from "@/lib/supabase";
import { TablePager } from "@/components/admin/table-pager";
import { formatTVL } from "@/lib/format";
import { isMutedActor, detectRebalancerActors } from "@/lib/muted-actors";
import {
  classifyChannel,
  classifyVisit,
  channelTone,
  channelGroup,
  shortChannelLabel,
  sourceDomain,
} from "@/lib/channels";
import { isBotRow, detectSpoofedFingerprints, fingerprintKey } from "@/lib/bots";
import { FilterHint } from "@/components/admin/filter-hint";
import "@/app/_styles/asset-hub.css";

// Coarse source group this funnel is scoped to (search engines vs AI answer
// engines). Everything else - chart, funnel stats, session table, filters -
// is identical between the two, so the SEO Summary and AI Summary pages both
// render this one component with a different group + display copy.
export type FunnelGroup = "SEO" | "AI";

export interface FunnelCopy {
  title: string;
  description: string;
  acquiredLabel: string;
  engineFilterLabel: string;
  engineHint: string;
  stageHint: string;
  isolateHint: string;
  // Engines + their domains used to seed the demo funnel on a data-less fork.
  sampleEngines: string[];
  sampleDomains: Record<string, string>;
}

interface VisitRow {
  created_at: string;
  session_id: string | null;
  page_path: string | null;
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
  session_id: string | null;
  vault_slug: string | null;
  source_page: string | null;
  source: string | null;
  country: string | null;
  device_type: string | null;
}
interface ConnRow {
  wallet_address: string;
  connected_at: string;
  session_id: string | null;
  balance: number | null;
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

// Full history: pulled in its entirety (paginated server-side via
// supabaseSelectAll) and the session table is navigated 25 rows/page.

type Metric = "acquired" | "reached" | "deposited";
const METRIC_OPTIONS: ReadonlyArray<{ value: Metric; label: string }> = [
  { value: "acquired", label: "Acquired" },
  { value: "reached", label: "Reached app" },
  { value: "deposited", label: "Deposited" },
];

const SEO_ROWS_PER_PAGE = 25;
// Same column rhythm as the Live Feed stream so the two read alike
// (Time, Source, Country, Stage, Activity, Device, Wallet, Tx).
const SEO_FEED_COLS =
  "132px 132px 92px 104px minmax(170px, 1.7fr) 64px 96px 128px 84px 54px";

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
  seoName: string; // primary (first-touch) search channel, e.g. "Google"
  // Every distinct search engine that touched the session (first-seen
  // order), so the engine filter and breakdown are multi-touch: a session
  // acquired via Google that later came back through Brave counts under
  // both. seoName stays the first touch for the default row label.
  seoEngines: string[];
  country: string | null;
  device: string | null;
  srcDomain: string | null;
  wallet: string | null;
  netWorth: number | null;
  status: "new" | "existing" | null;
  bot: boolean;
  entryPage: string; // page_path of the first visit ("/" = homepage)
  fp: string; // device fingerprint (ua + screen), for visitor coalescing
  firstVisitMs: number;
  firstClickMs: number; // Infinity if it never clicked into the app
  firstDepositMs: number; // Infinity if it never deposited
  latestMs: number;
  reached: boolean;
  deposited: boolean;
  pageCount: number;
  mergedCount: number; // how many raw sessions folded into this visitor (1 = none)
  actions: SeoAction[]; // newest first
}

// Demo funnel for credential-less environments (the staging fork). ~60
// SEO sessions spread across the last ~30 days, ~50% reaching the app
// and ~20% depositing, so the stat row, the chart and the paginated
// table all populate. Deterministic; mirrors the shape the real
// pipeline produces.
function buildSampleSeoSessions(
  seo: string[],
  dom: Record<string, string>,
): {
  sessions: SeoSession[];
  oldestMs: number | null;
} {
  const now = Date.now();
  const DAY = 86_400_000;
  const devs = ["desktop", "mobile", "tablet"];
  const countries = ["US", "GB", "DE", "PL", "BR", "IN", "CA", "FR", "NL", "SG"];
  const wallets = ["0x417c8e123e5d0f3e0a0c0ee171606e61ccb637df", "0x8a3fce21b9d47a0c6f5e2d18b4c7a90e3f1d6b24", "0xa07f3c91e6b2d8540c19a3f7b08e2d45c6019e8b", "0xa56a2edcf9315e2cf98bd8d2b0a41a5eda3a09a2", "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"];
  const worths: (number | null)[] = [4200, 18500, 142000, 1250000, 3400, 56000, 890000, null];
  const slugs = ["weth-autopilot-base", "usdc-autopilot-base", "usdc-aerodrome-aero-base", "eth-clearstar-reactor-v2-base"];
  const visitPages = ["/", "/usdc", "/eth", "/btc", "/methodology"];
  const sampleTx = "0x9f2c1ab73e08d45c6a1f90b3e27d4c85a06f1e93b2d7c40859a1e6f3c08d24b71";
  const evChains = ["Base", "Ethereum", "Arbitrum"];
  const sessions: SeoSession[] = [];
  let oldest = Infinity;
  for (let i = 0; i < 60; i++) {
    const seoName = seo[i % seo.length];
    const reached = i % 2 === 0;
    const deposited = i % 5 === 0;
    const firstVisitMs =
      now - Math.round((i * 0.46 + (i % 5) * 0.7) * DAY) - (i % 8) * 3_600_000;
    const firstClickMs = reached
      ? firstVisitMs + 90_000 + (i % 6) * 60_000
      : Infinity;
    const firstDepositMs = deposited
      ? (reached ? firstClickMs : firstVisitMs) + 240_000
      : Infinity;
    const latestMs = deposited
      ? firstDepositMs
      : reached
        ? firstClickMs
        : firstVisitMs;
    const pageCount = 1 + (i % 4);
    const wallet = reached || i % 3 === 0 ? wallets[i % wallets.length] : null;
    const actions: SeoAction[] = [];
    for (let p = 0; p < pageCount; p++) {
      actions.push({
        id: `sv-${i}-${p}`,
        time: new Date(firstVisitMs + p * 60_000).toISOString(),
        kind: "visit",
        page: visitPages[(i + p) % visitPages.length],
        vaultSlug: null,
        wallet: null,
        chain: null,
        tx: null,
      });
    }
    if (reached) {
      actions.push({
        id: `sc-${i}`,
        time: new Date(firstClickMs).toISOString(),
        kind: "click",
        page: `/${slugs[i % slugs.length]}`,
        vaultSlug: slugs[i % slugs.length],
        wallet: null,
        chain: null,
        tx: null,
      });
    }
    if (deposited) {
      actions.push({
        id: `sd-${i}`,
        time: new Date(firstDepositMs).toISOString(),
        kind: "deposit",
        page: null,
        vaultSlug: slugs[i % slugs.length],
        wallet: wallets[i % wallets.length],
        chain: evChains[i % evChains.length],
        tx: sampleTx,
      });
    }
    actions.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    // Give every 3rd demo session a second search touch so the
    // multi-touch engine filter has something to exercise on a data-less
    // fork (a Google session that also came back via Brave, etc).
    const secondEngine = seo[(i + 1) % seo.length];
    const seoEngines =
      i % 3 === 0 && secondEngine !== seoName
        ? [seoName, secondEngine]
        : [seoName];
    sessions.push({
      sessionId: `sample-seo-${i}`,
      seoName,
      seoEngines,
      country: countries[i % countries.length],
      device: devs[i % devs.length],
      srcDomain: dom[seoName],
      wallet,
      netWorth: wallet ? worths[i % worths.length] : null,
      // Mix of returning vs first-time for the demo.
      status: !wallet ? null : i % 3 === 0 ? "existing" : "new",
      // A few sample sessions are crawlers so the "Show bots" toggle has
      // something to reveal on a data-less fork.
      bot: i % 13 === 0,
      entryPage: visitPages[i % visitPages.length],
      fp: `sample-ua-${i}|1170x2532|1170x2532`,
      firstVisitMs,
      firstClickMs,
      firstDepositMs,
      latestMs,
      reached,
      deposited,
      pageCount,
      mergedCount: 1,
      actions,
    });
    if (firstVisitMs < oldest) oldest = firstVisitMs;
  }
  sessions.sort((a, b) => b.latestMs - a.latestMs);
  return { sessions, oldestMs: Number.isFinite(oldest) ? oldest : null };
}

// Hard cap on how far a coalesced visitor can span. Sessions sharing a device
// fingerprint + country + primary engine merge only when their WEB first-touch
// times (firstVisitMs) fall inside this window of each other - so a merged
// visitor is at most ~1h wide. Keyed on firstVisitMs, never latestMs, because a
// session's latestMs is dragged months out by the wallet's on-chain events
// pinned to it; using it would chain the merge across the whole relationship.
const VISITOR_MERGE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// On-chain events (deposit/withdraw) are pinned to the wallet's acquisition
// session. Only attribute an event to that session when it lands within this
// window of the session's web activity, so a single visit doesn't absorb the
// wallet's entire lifetime of transactions (and isn't stamped "Deposited" off a
// deposit made long before/after the visit). New/Existing status still consults
// the wallet's full history - only the per-session action/stage attribution is
// windowed.
const EVENT_ATTRIBUTION_WINDOW_MS = 72 * 60 * 60 * 1000; // 72h after last web touch
const EVENT_ATTRIBUTION_GRACE_MS = 10 * 60 * 1000; // 10m before first web touch (tx-time skew)

// A fingerprint is only trustworthy for coalescing when it carries a real
// user-agent (the leading field in fingerprintKey); a blank one would over
// merge unrelated visitors, so those are always left standalone.
function usableFingerprint(fp: string): boolean {
  return !!fp && !fp.startsWith("|");
}

// Fold a time-ordered group of same-visitor sessions into one.
function mergeVisitorGroup(group: SeoSession[]): SeoSession {
  const base = group[0]; // earliest firstVisitMs
  const engines = new Set<string>();
  let firstVisitMs = Infinity;
  let firstClickMs = Infinity;
  let firstDepositMs = Infinity;
  let latestMs = -Infinity;
  let pageCount = 0;
  let bot = false;
  let wallet: string | null = null;
  let netWorth: number | null = null;
  let status: "new" | "existing" | null = null;
  let entryPage = base.entryPage;
  let entryMs = Infinity;
  const actions: SeoAction[] = [];
  for (const s of group) {
    s.seoEngines.forEach((e) => engines.add(e));
    firstVisitMs = Math.min(firstVisitMs, s.firstVisitMs);
    firstClickMs = Math.min(firstClickMs, s.firstClickMs);
    firstDepositMs = Math.min(firstDepositMs, s.firstDepositMs);
    latestMs = Math.max(latestMs, s.latestMs);
    pageCount += s.pageCount;
    bot = bot || s.bot;
    if (!wallet && s.wallet) {
      wallet = s.wallet;
      netWorth = s.netWorth;
      status = s.status;
    }
    if (s.firstVisitMs < entryMs) {
      entryMs = s.firstVisitMs;
      entryPage = s.entryPage;
    }
    actions.push(...s.actions);
  }
  actions.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return {
    sessionId: base.sessionId,
    seoName: base.seoName,
    seoEngines: [...engines],
    country: base.country,
    device: base.device,
    srcDomain: base.srcDomain,
    wallet,
    netWorth,
    status,
    bot,
    entryPage,
    fp: base.fp,
    firstVisitMs,
    firstClickMs,
    firstDepositMs,
    latestMs,
    reached: Number.isFinite(firstClickMs),
    deposited: Number.isFinite(firstDepositMs),
    pageCount,
    mergedCount: group.length,
    actions,
  };
}

// Coalesce tab-fragmented visitors into one row each. Groups by fingerprint +
// country + primary engine, then merges within-group sessions whose activity
// windows sit within VISITOR_MERGE_GAP_MS. Sessions with no usable fingerprint
// stay standalone.
function coalesceVisitors(sessions: SeoSession[]): SeoSession[] {
  const groups = new Map<string, SeoSession[]>();
  const out: SeoSession[] = [];
  for (const s of sessions) {
    if (!usableFingerprint(s.fp)) {
      out.push(s);
      continue;
    }
    const key = `${s.fp}||${s.country ?? ""}||${s.seoName}`;
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }
  for (const grp of groups.values()) {
    if (grp.length === 1) {
      out.push(grp[0]);
      continue;
    }
    grp.sort((a, b) => a.firstVisitMs - b.firstVisitMs);
    let bucket: SeoSession[] = [];
    let bucketStart = 0; // firstVisitMs of the bucket's earliest session
    const flush = () => {
      if (bucket.length === 1) out.push(bucket[0]);
      else if (bucket.length > 1) out.push(mergeVisitorGroup(bucket));
      bucket = [];
    };
    for (const s of grp) {
      if (bucket.length === 0) {
        bucket = [s];
        bucketStart = s.firstVisitMs;
      } else if (s.firstVisitMs - bucketStart <= VISITOR_MERGE_WINDOW_MS) {
        bucket.push(s);
      } else {
        flush();
        bucket = [s];
        bucketStart = s.firstVisitMs;
      }
    }
    flush();
  }
  out.sort((x, y) => y.latestMs - x.latestMs);
  return out;
}

export function FunnelSummary({
  group,
  copy,
}: {
  group: FunnelGroup;
  copy: FunnelCopy;
}) {
  const [visits, setVisits] = useState<VisitRow[] | null>(null);
  const [clicks, setClicks] = useState<ClickRow[] | null>(null);
  const [conns, setConns] = useState<ConnRow[] | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Default to the full history (matching the full-depth, paginated
  // table) so the funnel boxes count every session, not just the last
  // 30 days. The timeframe selector can still narrow the window.
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [metric, setMetric] = useState<Metric>("acquired");
  const [engine, setEngine] = useState<string>("all");
  // Human-first by default: crawler sessions are hidden until opted in.
  const [showBots, setShowBots] = useState(false);
  // "Isolate direct": hide SEO sessions whose first page was the homepage,
  // leaving only those that landed straight on a content page.
  const [deepLandingOnly, setDeepLandingOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);

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
      supabaseSelectAll<VisitRow>(
        "frontpage_visits",
        "select=created_at,session_id,page_path,source,country,device_type,referrer,is_bot,user_agent,screen_width,screen_height,viewport_width,viewport_height,timezone&order=created_at.desc",
      ),
      supabaseSelectAll<ClickRow>(
        "outbound_clicks",
        "select=created_at,session_id,vault_slug,source_page,source,country,device_type&order=created_at.desc",
      ),
      supabaseSelectAll<ConnRow>(
        "wallet_connections_prod",
        "select=wallet_address,connected_at,session_id,balance&order=connected_at.desc",
      ),
      supabaseSelectAll<EventRow>(
        "vault_events_prod",
        "select=block_timestamp,event_type,wallet_address,vault_address,vault_slug,chain,tx_hash&event_type=in.(deposit,withdraw)&order=block_timestamp.desc",
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
      setPage(0);
    } catch (e) {
      setErr(String(e));
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

  const loaded =
    visits !== null && clicks !== null && conns !== null && events !== null;
  const realEmpty =
    loaded &&
    visits!.length === 0 &&
    clicks!.length === 0 &&
    conns!.length === 0 &&
    events!.length === 0;

  // One pass over all sources, rolled up per session. A session is SEO if any
  // of its visits came from a search engine. Every output - funnel series and
  // the session list the table renders - derives from this single set, so the
  // numbers and the table can never disagree.
  const { sessions, oldestMs } = useMemo(() => {
    if (!loaded) return { sessions: [] as SeoSession[], oldestMs: null as number | null };
    // No Supabase creds (e.g. the staging fork): show a generated demo
    // funnel so the page isn't blank, marked "sample" in the header.
    if (realEmpty) return buildSampleSeoSessions(copy.sampleEngines, copy.sampleDomains);

    interface Acc {
      seoName: string | null;
      seoMs: number;
      // engine name -> earliest timestamp it touched this session, so we
      // can list every search engine that acquired/re-acquired it
      // (multi-touch) and still derive the first-touch primary.
      seoEngines: Map<string, number>;
      country: string | null;
      device: string | null;
      srcDomain: string | null;
      firstVisitMs: number;
      firstClickMs: number;
      firstDepositMs: number;
      latestMs: number;
      pageCount: number;
      bot: boolean;
      entryPage: string;
      fp: string; // device fingerprint, to coalesce tab-fragmented visitors
      actions: SeoAction[];
    }
    const acc = new Map<string, Acc>();
    const get = (id: string): Acc => {
      let a = acc.get(id);
      if (!a) {
        a = {
          seoName: null,
          seoMs: Infinity,
          seoEngines: new Map<string, number>(),
          country: null,
          device: null,
          srcDomain: null,
          firstVisitMs: Infinity,
          firstClickMs: Infinity,
          firstDepositMs: Infinity,
          latestMs: -Infinity,
          pageCount: 0,
          bot: false,
          entryPage: "/",
          fp: "",
          actions: [],
        };
        acc.set(id, a);
      }
      return a;
    };

    // Cluster-poisoning: fingerprints of the referrer-spoofing fleets, so a
    // session carrying one is flagged bot even when its viewport mimics a
    // real maximized browser and its referrer spoofs organic search.
    const poisoned = detectSpoofedFingerprints(visits!);

    for (const v of visits!) {
      if (!v.session_id) continue;
      const t = new Date(v.created_at).getTime();
      if (!Number.isFinite(t)) continue;
      const a = get(v.session_id);
      a.pageCount++;
      if (
        !a.bot &&
        (isBotRow(v) || poisoned.has(fingerprintKey(v)))
      )
        a.bot = true;
      if (t < a.firstVisitMs) {
        a.firstVisitMs = t;
        a.entryPage = v.page_path || "/";
      }
      if (!a.fp) a.fp = fingerprintKey(v);
      if (t > a.latestMs) a.latestMs = t;
      if (a.country === null && v.country) a.country = v.country;
      if (a.device === null && v.device_type) a.device = v.device_type;
      const ch = classifyVisit(v.source, v.referrer);
      if (channelGroup(ch) === group) {
        const prevEng = a.seoEngines.get(ch);
        if (prevEng === undefined || t < prevEng) a.seoEngines.set(ch, t);
        if (t < a.seoMs) {
          a.seoMs = t;
          a.seoName = ch;
          // Domain of the search visit that acquired the session, for the
          // Source tooltip (e.g. "google.com").
          a.srcDomain = sourceDomain(v.referrer);
        }
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
      if (a.device === null && c.device_type) a.device = c.device_type;
      // A search touch can land on a click row, not just a visit (e.g. the
      // session's visit wasn't logged, or its source was captured on the
      // outbound click). The Live Feed already badges those rows as
      // Brave/Yandex/Baidu/etc, so mirror that here: let a search-sourced
      // click mark the session SEO too, keeping the funnel and the feed in
      // agreement. Earliest SEO touch across visits + clicks wins.
      const cch = classifyChannel(c.source);
      if (channelGroup(cch) === group) {
        const prevEng = a.seoEngines.get(cch);
        if (prevEng === undefined || t < prevEng) a.seoEngines.set(cch, t);
        if (t < a.seoMs) {
          a.seoMs = t;
          a.seoName = cch;
          if (!a.srcDomain) a.srcDomain = sourceDomain(c.source);
        }
      }
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
    // wallet -> latest captured net worth (DeBank USD balance at connect).
    const walletBalance = new Map<string, number>();
    const walletBalanceT = new Map<string, number>();
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
      if (w.balance != null && Number.isFinite(w.balance)) {
        const pb = walletBalanceT.get(addr);
        if (pb === undefined || t > pb) {
          walletBalanceT.set(addr, t);
          walletBalance.set(addr, w.balance);
        }
      }
    }

    // Snapshot each session's WEB-only latest activity before events fold in,
    // so the attribution window below is measured against real browsing rather
    // than a latestMs that the events themselves would inflate.
    const webLatestMs = new Map<string, number>();
    for (const [sid, av] of acc) webLatestMs.set(sid, av.latestMs);

    // Deposits / withdrawals attributed to a session, deduped by tx+vault and
    // with autopilot/allocator reallocations excluded. Only events inside the
    // session's attribution window are attached, so a session reflects its own
    // timeframe, not the wallet's whole on-chain history.
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
      // Windowed attribution: skip events outside this session's web timeframe
      // so a visit doesn't inherit the wallet's entire transaction history.
      const webStart = Math.min(a.firstVisitMs, a.firstClickMs);
      const wStart = webStart - EVENT_ATTRIBUTION_GRACE_MS;
      const wEnd = (webLatestMs.get(sid) ?? webStart) + EVENT_ATTRIBUTION_WINDOW_MS;
      if (ms < wStart || ms > wEnd) continue;
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

    // Earliest deposit per wallet, and earliest tracked visit per wallet
    // (via the session<->wallet join). New/Existing anchors to the wallet's
    // first visit (its acquisition): Existing iff it deposited before then,
    // New otherwise - incl. first-time depositors and repeat deposits within
    // the same acquisition. Keyed per wallet so it stays consistent across
    // the wallet's sessions and with the Live Feed.
    const firstDepByWallet = new Map<string, number>();
    for (const e of events!) {
      if (e.event_type !== "deposit") continue;
      const addr = (e.wallet_address || "").toLowerCase();
      if (!addr) continue;
      const ms = new Date(e.block_timestamp).getTime();
      if (!Number.isFinite(ms)) continue;
      const prev = firstDepByWallet.get(addr);
      if (prev === undefined || ms < prev) firstDepByWallet.set(addr, ms);
    }
    const firstVisitByWallet = new Map<string, number>();
    for (const [sid, av] of acc) {
      const w = sessionWallet.get(sid);
      if (!w || !Number.isFinite(av.firstVisitMs)) continue;
      const prev = firstVisitByWallet.get(w);
      if (prev === undefined || av.firstVisitMs < prev) {
        firstVisitByWallet.set(w, av.firstVisitMs);
      }
    }

    const sessions: SeoSession[] = [];
    let oldest = Infinity;
    for (const [id, a] of acc) {
      if (a.seoName === null) continue; // not an SEO session
      a.actions.sort(
        (x, y) => new Date(y.time).getTime() - new Date(x.time).getTime(),
      );
      const wallet =
        sessionWallet.get(id) ??
        a.actions.find((x) => x.wallet)?.wallet ??
        null;
      const wl = wallet ? wallet.toLowerCase() : null;
      const fd = wl ? firstDepByWallet.get(wl) : undefined;
      // Anchor to the wallet's first visit (acquisition), not this session's,
      // so repeat depositors and multi-session wallets stay consistent.
      const fv = (wl ? firstVisitByWallet.get(wl) : undefined) ?? a.firstVisitMs;
      const status: "new" | "existing" | null = !wallet
        ? null
        : fd !== undefined && fd < fv
          ? "existing"
          : "new";
      sessions.push({
        sessionId: id,
        seoName: a.seoName,
        // distinct engines, first-touch first
        seoEngines: [...a.seoEngines.entries()]
          .sort((x, y) => x[1] - y[1])
          .map(([name]) => name),
        country: a.country,
        device: a.device,
        srcDomain: a.srcDomain,
        wallet,
        netWorth: wallet ? walletBalance.get(wallet.toLowerCase()) ?? null : null,
        status,
        bot: a.bot,
        entryPage: a.entryPage,
        fp: a.fp,
        firstVisitMs: a.firstVisitMs,
        firstClickMs: a.firstClickMs,
        firstDepositMs: a.firstDepositMs,
        latestMs: a.latestMs,
        reached: Number.isFinite(a.firstClickMs),
        deposited: Number.isFinite(a.firstDepositMs),
        pageCount: a.pageCount,
        mergedCount: 1,
        actions: a.actions,
      });
      if (a.firstVisitMs < oldest) oldest = a.firstVisitMs;
    }

    // Coalesce tab-fragmented visitors: several tabs opened at once as a first
    // touch each mint their own session id (no shared session existed yet), so
    // one person shows up as several 1-page "Acquired" sessions. Merge sessions
    // that share a device fingerprint + country + primary engine and whose
    // activity windows sit within VISITOR_MERGE_GAP_MS of each other into one
    // visitor, so the funnel counts people, not tabs.
    const coalesced = coalesceVisitors(sessions);

    return {
      sessions: coalesced,
      oldestMs: Number.isFinite(oldest) ? oldest : null,
    };
  }, [loaded, realEmpty, visits, clicks, conns, events, group, copy]);

  // Search-engine options + the engine-filtered base set every funnel
  // output reads from (stats, chart, table), mirroring the Live Feed's
  // source filter. Multi-touch: the option list is the union of every
  // engine that touched any session, and selecting one keeps every
  // session that engine touched (not just the ones it acquired
  // first-touch) - so Brave/Baidu surface even when a later touch.
  const engineOptions = Array.from(
    new Set(sessions.flatMap((s) => s.seoEngines)),
  ).sort();
  const enginedSessions = (
    engine === "all"
      ? sessions
      : sessions.filter((s) => s.seoEngines.includes(engine))
  )
    .filter((s) => showBots || !s.bot)
    .filter((s) => !deepLandingOnly || s.entryPage !== "/");

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
    enginedSessions.filter((s) => {
      const ts = stageOf(s, m);
      return ts !== null && inWindow(ts);
    }).length;

  const acquired = countFor("acquired");
  const reached = countFor("reached");
  const deposited = countFor("deposited");
  const pctOfAcquired = (n: number) =>
    acquired > 0 ? `${Math.round((n / acquired) * 100)}% of acquired` : "no data yet";

  // Chart points + table list, both for the selected metric and window. Each
  // point carries its session's primary (first-touch) engine so the chart can
  // optionally break the daily bars down by search / AI engine.
  const points: { ts: number; engine: string; landing: string }[] = [];
  const visibleSessions: SeoSession[] = [];
  for (const s of enginedSessions) {
    const ts = stageOf(s, metric);
    if (ts === null || !inWindow(ts)) continue;
    points.push({ ts, engine: s.seoName, landing: s.entryPage });
    visibleSessions.push(s);
  }
  const metricLabel = METRIC_OPTIONS.find((o) => o.value === metric)!.label;

  const description = copy.description;

  return (
    <div className="uni-hub-test lf-page">
      <header className="uni-hub-hero aq-hero-slim aq-hero-fullwidth">
        <div className="uni-hub-hero-headline">
          <div style={{ width: "100%" }}>
            <h1 className="uni-hub-h1">
              {copy.title}
              <InfoTip label={`About ${copy.title}`}>{description}</InfoTip>
              {realEmpty && <span className="aq-sample-badge">sample</span>}
            </h1>
            <p className="uni-hub-sub aq-sub-full">{description}</p>
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
              label={copy.acquiredLabel}
              value={acquired}
              sub={
                timeframe === "all"
                  ? "SEO sessions, all time"
                  : `SEO sessions, last ${days}d`
              }
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

          {/* Filter bar in the Live Feed register: Refresh + iconed
              dropdowns (globe = search engine, funnel = funnel stage).
              The stage dropdown drives the chart + table; the engine
              dropdown scopes the whole funnel to one search source. */}
          <div className="lf-filterbar">
            <RefreshButton onClick={handleRefresh} refreshing={refreshing} />
            <span className="lf-filter-grp">
            <label className="lf-filter" aria-label={copy.engineFilterLabel}>
              <span className="lf-filter-icon" aria-hidden="true">
                <EngineFilterIcon />
              </span>
              <select
                className="lf-select lf-select-iconed"
                value={engine}
                onChange={(e) => {
                  setEngine(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All engines</option>
                {engineOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <FilterHint label="About the engine filter">{copy.engineHint}</FilterHint>
            </span>
            <span className="lf-filter-grp">
            <label className="lf-filter" aria-label="Funnel stage filter">
              <span className="lf-filter-icon" aria-hidden="true">
                <StageFilterIcon />
              </span>
              <select
                className="lf-select lf-select-iconed"
                value={metric}
                onChange={(e) => {
                  setMetric(e.target.value as Metric);
                  setPage(0);
                }}
              >
                {METRIC_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <FilterHint label="About the stage filter">{copy.stageHint}</FilterHint>
            </span>
            <label
              className="lf-bot-toggle"
              title="Crawler sessions (search bots, scanners) are hidden by default. Toggle to audit non-human SEO traffic."
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
              <label className="lf-bot-toggle">
                <input
                  type="checkbox"
                  checked={deepLandingOnly}
                  onChange={(e) => {
                    setDeepLandingOnly(e.target.checked);
                    setPage(0);
                  }}
                />
                Isolate direct
              </label>
              <FilterHint label="About isolate direct">{copy.isolateHint}</FilterHint>
            </span>
          </div>

          <ChartSection
            points={points}
            days={days}
            metricLabel={metricLabel}
            timeframe={timeframe}
            onTimeframeChange={(tf) => {
              setTimeframe(tf);
              setPage(0);
            }}
            // When "Isolate direct" is on we're looking at non-root first-touch
            // SEO sessions, so the natural breakdown is by the landing sub-page
            // (which pages pull SEO traffic), not by engine.
            dimension={deepLandingOnly ? "landing" : "engine"}
          />

          {(() => {
            const totalPages = Math.max(
              1,
              Math.ceil(visibleSessions.length / SEO_ROWS_PER_PAGE),
            );
            const safePage = Math.min(page, totalPages - 1);
            const pageSessions = visibleSessions.slice(
              safePage * SEO_ROWS_PER_PAGE,
              safePage * SEO_ROWS_PER_PAGE + SEO_ROWS_PER_PAGE,
            );
            return (
              <>
                <SeoSessionTable
                  sessions={pageSessions}
                  metricLabel={metricLabel}
                  selectedEngine={engine}
                  expanded={expanded}
                  onToggle={toggle}
                />
                <TablePager
                  page={safePage}
                  totalPages={totalPages}
                  totalRows={visibleSessions.length}
                  onPage={setPage}
                  unit="sessions"
                />
              </>
            );
          })()}
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
      <div className="uni-hub-stat-sub">{sub}</div>
    </div>
  );
}

// Globe glyph for the search-engine filter.
function EngineFilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

// Funnel glyph for the funnel-stage filter.
function StageFilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h18l-7 8v6l-4 2v-8z" />
    </svg>
  );
}

// Categorical palette for the engine breakdown: distinct hues at similar
// saturation/lightness so segments read apart in both light and dark, with the
// legend carrying identity. Engines map to a stable color via their position
// in the set actually present, so a given engine keeps its color across
// timeframes and modes.
const ENGINE_PALETTE = [
  "#4E79A7", "#F28E2B", "#59A14F", "#E15759", "#B07AA1",
  "#76B7B2", "#EDC948", "#FF9DA7", "#9C755F", "#BAB0AC",
];
// Master ordering so the common engines get sensible, consistent colors
// regardless of which subset is present on a given page (SEO vs AI).
const ENGINE_ORDER = [
  "Google", "Bing", "DuckDuckGo", "Brave", "Yandex", "Baidu",
  "Ecosia", "Startpage", "Qwant", "Naver", "Seznam", "Kagi", "Mojeek", "Ask",
  "ChatGPT", "Perplexity", "Claude", "Gemini", "Minara",
];

type ChartMode = "all" | "breakdown";
type ChartDimension = "engine" | "landing";

// Landing-page breakdowns can have a long tail of rarely-hit sub-pages; cap
// the chart/legend to the busiest TOP_LANDINGS and fold the rest into "Other"
// so the stack and legend stay readable. Engines are few, so they're never
// capped.
const TOP_LANDINGS = 12;
const OTHER = "Other";

// Legend/tooltip label: strip the leading slash off landing paths so they read
// compactly; engines and "Other" pass through unchanged.
function catLabel(cat: string, dimension: ChartDimension): string {
  if (dimension === "landing" && cat !== OTHER) return cat.replace(/^\//, "");
  return cat;
}

function ChartSection({
  points,
  days,
  metricLabel,
  timeframe,
  onTimeframeChange,
  dimension = "engine",
}: {
  points: { ts: number; engine: string; landing: string }[];
  days: number;
  metricLabel: string;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  dimension?: ChartDimension;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [mode, setMode] = useState<ChartMode>("all");
  // Categories toggled off via the legend (breakdown mode). Hidden ones drop
  // out of the bars, the totals and the tooltip, so clicking every category but
  // one isolates that one's trend over time.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  // Reset legend isolation when the breakdown dimension flips, so hidden engine
  // names don't linger as we switch to landing pages. Switching to the landing
  // dimension (Isolate direct on) also auto-engages Breakdown, so the per
  // sub-page bars show without a second click.
  useEffect(() => {
    setHidden(new Set());
    if (dimension === "landing") setMode("breakdown");
  }, [dimension]);

  const catRaw = (p: { engine: string; landing: string }) =>
    dimension === "landing" ? p.landing || "/" : p.engine;

  // Categories present, ordered (master engine order, or landing pages by
  // volume with a capped tail), each with a stable palette color. Drives the
  // stacked segments and the legend. `top` is the set of categories drawn
  // individually; anything outside it folds into "Other".
  const engines = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of points) {
      const k = catRaw(p);
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    }
    let ordered: string[];
    if (dimension === "engine") {
      const present = [...counts.keys()];
      ordered = [
        ...ENGINE_ORDER.filter((e) => counts.has(e)),
        ...present.filter((e) => !ENGINE_ORDER.includes(e)).sort(),
      ];
    } else {
      const present = [...counts.keys()].sort(
        (a, b) => (counts.get(b) || 0) - (counts.get(a) || 0),
      );
      ordered =
        present.length > TOP_LANDINGS
          ? [...present.slice(0, TOP_LANDINGS), OTHER]
          : present;
    }
    const color: Record<string, string> = {};
    ordered.forEach(
      (e, i) => (color[e] = ENGINE_PALETTE[i % ENGINE_PALETTE.length]),
    );
    return { ordered, color, top: new Set(ordered) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, dimension]);

  // Map a point to the category actually drawn (tail -> "Other").
  const catOf = (p: { engine: string; landing: string }) => {
    const k = catRaw(p);
    return engines.top.has(k) ? k : OTHER;
  };

  // Per-day counts, keeping the full per-engine split so visibility toggles
  // and the tooltip can recompute without a re-bin.
  const bins = useMemo(() => {
    const now = Date.now();
    const dayMs = 86_400_000;
    const out: {
      vAll: number;
      daysAgo: number;
      byEngine: Record<string, number>;
    }[] = [];
    for (let i = 0; i < days; i++)
      out.push({ vAll: 0, daysAgo: days - 1 - i, byEngine: {} });
    for (const p of points) {
      const daysAgo = Math.floor((now - p.ts) / dayMs);
      if (daysAgo >= 0 && daysAgo < days) {
        const bin = out[days - 1 - daysAgo];
        bin.vAll++;
        const cat = catOf(p);
        bin.byEngine[cat] = (bin.byEngine[cat] || 0) + 1;
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, days, engines]);

  // Engines actually drawn: all of them in "All" mode, only the un-hidden ones
  // in "Breakdown". The visible count per day drives bar height, totals and the
  // tooltip, so isolating an engine rescales the chart to it.
  const visibleEngines = useMemo(
    () =>
      mode === "breakdown"
        ? engines.ordered.filter((e) => !hidden.has(e))
        : engines.ordered,
    [engines.ordered, hidden, mode],
  );
  const countOf = (b: (typeof bins)[number]) =>
    mode === "breakdown"
      ? visibleEngines.reduce((s, e) => s + (b.byEngine[e] || 0), 0)
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
  }, [bins, visibleEngines, mode]);

  const noun = metricLabel.toLowerCase();
  const hoveredBin = hoverIdx != null ? bins[hoverIdx] : null;
  const hoveredCount = hoveredBin ? countOf(hoveredBin) : 0;
  const displayValue = hoveredBin ? hoveredCount : total;
  const displayLabel = hoveredBin
    ? `${noun} ${labelForDaysAgo(hoveredBin.daysAgo)}`
    : `${noun} across the trailing ${days} days`;

  const toggleEngine = (e: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });

  // Legend select-all / deselect-all. All visible => clear hidden set is a
  // no-op, so the control flips: everything on -> hide everything, otherwise
  // -> show everything. `someHidden` drives the indeterminate box state.
  const allShown = hidden.size === 0;
  const someHidden = hidden.size > 0 && hidden.size < engines.ordered.length;
  const toggleAll = () =>
    setHidden((prev) => (prev.size === 0 ? new Set(engines.ordered) : new Set()));

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
          <TimeframeSelector value={timeframe} onChange={onTimeframeChange} />
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
                    // Stacked, one colored segment per VISIBLE engine,
                    // bottom-anchored by the column's flex-end. Heights are
                    // shares of the day's visible total.
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
                      {visibleEngines
                        .filter((e) => b.byEngine[e])
                        .map((e) => (
                          <div
                            key={e}
                            style={{
                              height: `${(b.byEngine[e] / v) * 100}%`,
                              background: engines.color[e],
                            }}
                          />
                        ))}
                    </div>
                  )}
                </div>
              );
            })}

            {hoveredBin && hoveredCount > 0 && (
              <ChartTooltip
                bin={hoveredBin}
                count={hoveredCount}
                engines={visibleEngines}
                color={engines.color}
                noun={noun}
                idx={hoverIdx as number}
                days={days}
                labelOf={(e) => catLabel(e, dimension)}
              />
            )}
          </div>
          <div className="aq-chart-axis">
            <span>{days}d ago</span>
            <span>{Math.floor(days / 2)}d ago</span>
            <span>today</span>
          </div>
        </div>

        {mode === "breakdown" && engines.ordered.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px 14px",
              }}
            >
              {engines.ordered.map((e) => {
                const off = hidden.has(e);
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => toggleEngine(e)}
                    aria-pressed={!off}
                    title={off ? `Show ${e}` : `Hide ${e}`}
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
                        background: off ? "transparent" : engines.color[e],
                        boxShadow: off ? `inset 0 0 0 1.5px ${engines.color[e]}` : "none",
                        flexShrink: 0,
                      }}
                    />
                    {catLabel(e, dimension)}
                  </button>
                );
              })}
            </div>

            {/* Select all / deselect all, bottom-right of the legend. */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button
                type="button"
                onClick={toggleAll}
                aria-pressed={allShown}
                title={allShown ? "Deselect all categories" : "Select all categories"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12,
                  padding: "2px 2px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "inherit",
                  opacity: 0.85,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: allShown ? "#ffb936" : "transparent",
                    color: allShown ? "#191717" : "currentColor",
                    boxShadow: allShown ? "none" : "inset 0 0 0 1.5px currentColor",
                  }}
                >
                  {allShown ? (
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : someHidden ? (
                    <span
                      style={{
                        width: 7,
                        height: 2,
                        borderRadius: 1,
                        background: "currentColor",
                      }}
                    />
                  ) : null}
                </span>
                {allShown ? "Deselect all" : "Select all"}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// Floating tooltip for a hovered day column: the per-engine split (swatch,
// name, count, share of the day) newest-first by count, then the day total.
// Positioned over the hovered column inside the (relative) bars container.
function ChartTooltip({
  bin,
  count,
  engines,
  color,
  noun,
  idx,
  days,
  labelOf = (e) => e,
}: {
  bin: { daysAgo: number; byEngine: Record<string, number> };
  count: number;
  engines: string[];
  color: Record<string, string>;
  noun: string;
  idx: number;
  days: number;
  labelOf?: (e: string) => string;
}) {
  const rows = engines
    .filter((e) => bin.byEngine[e])
    .map((e) => ({ e, n: bin.byEngine[e] }))
    .sort((a, b) => b.n - a.n);
  const leftPct = ((idx + 0.5) / days) * 100;
  // Keep the card on-screen: anchor left near the start, right near the end,
  // centered in the middle.
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
        minWidth: 200,
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
        {labelForDaysAgo(bin.daysAgo)}
      </div>
      {rows.map(({ e, n }) => (
        <div
          key={e}
          style={{ display: "flex", alignItems: "center", gap: 7 }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 2,
              background: color[e],
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1 }}>{labelOf(e)}</span>
          <span style={{ fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>
            {n.toLocaleString("en-US")} {noun} ({Math.round((n / count) * 100)}%)
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
          {count.toLocaleString("en-US")} {noun}
        </span>
      </div>
    </div>
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
  selectedEngine,
  expanded,
  onToggle,
}: {
  sessions: SeoSession[];
  metricLabel: string;
  selectedEngine: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <section className="uni-hub-section">
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">{metricLabel} sessions</h2>
          <span className="uni-hub-section-meta">
            one row per session · expand to see its actions · full history,
            25 per page
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
            <span className="uni-hub-th">Device</span>
            <span className="uni-hub-th lf-status-cell">New / Existing</span>
            <span className="uni-hub-th">Wallet</span>
            <span className="uni-hub-th lf-networth-cell">Net worth</span>
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
                ? { label: "Deposited", short: "Dep.", tone: "deposit" }
                : s.reached
                  ? { label: "Reached app", short: "App", tone: "click" }
                  : { label: "Acquired", short: "Acq.", tone: "visit" };
              return (
                <SessionRows
                  key={s.sessionId}
                  session={s}
                  isOpen={isOpen}
                  stage={stage}
                  selectedEngine={selectedEngine}
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
  selectedEngine,
  onToggle,
}: {
  session: SeoSession;
  isOpen: boolean;
  stage: { label: string; short: string; tone: string };
  selectedEngine: string;
  onToggle: () => void;
}) {
  // When filtered to one engine, label the row with that engine (it's why
  // the row is here, even if first-touch was someone else). Under "all",
  // show the first-touch primary and flag extra touches with a "+N".
  const displayEngine =
    selectedEngine !== "all" ? selectedEngine : s.seoName;
  const extraEngines =
    selectedEngine === "all"
      ? s.seoEngines.filter((e) => e !== s.seoName)
      : [];
  return (
    <>
      <div
        className={`uni-hub-row lf-session-row${s.bot ? " lf-row-bot" : ""}`}
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
          <TimeLabel ms={s.latestMs} />
        </span>
        <span className="uni-hub-cell" data-label="Source">
          <span
            className={`lf-badge lf-badge-${channelTone(displayEngine)}`}
            title={s.srcDomain ?? undefined}
          >
            <span className="lf-lbl-full">{displayEngine}</span>
            <span className="lf-lbl-short">
              {shortChannelLabel(displayEngine)}
            </span>
          </span>
          {extraEngines.length > 0 && (
            <span
              className="lf-botflag"
              style={{ background: "transparent", color: "inherit", opacity: 0.55 }}
              title={`Also acquired via ${extraEngines.join(", ")}`}
            >
              +{extraEngines.length}
            </span>
          )}
          {s.bot && (
            <span className="lf-botflag" title="Non-human / bot traffic">
              bot
            </span>
          )}
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
            <StageIcon kind={stage.tone} />
            <span className="lf-lbl-full">{stage.label}</span>
            <span className="lf-lbl-short">{stage.short}</span>
          </span>
        </span>
        <span className="uni-hub-cell lf-product" data-label="Activity">
          <span className="lf-session-count">
            <span className="lf-lbl-full">
              {s.pageCount} page{s.pageCount === 1 ? "" : "s"}
              {s.deposited ? " · deposit" : s.reached ? " · click" : ""}
              {s.mergedCount > 1 ? ` · ${s.mergedCount} tabs` : ""}
            </span>
            <span className="lf-lbl-short lf-count-pill">{s.pageCount}</span>
          </span>
        </span>
        <span className="uni-hub-cell lf-device-cell" data-label="Device">
          <DeviceIcon device={s.device} />
        </span>
        <span className="uni-hub-cell lf-status-cell" data-label="New / Existing">
          <StatusBadge status={s.status} wallet={s.wallet} />
        </span>
        <span className="uni-hub-cell" data-label="Wallet">
          {s.wallet ? (
            <WalletLabel address={s.wallet} />
          ) : (
            <span className="lf-dim">—</span>
          )}
        </span>
        <span className="uni-hub-cell lf-networth-cell" data-label="Net worth">
          {s.netWorth != null ? (
            <span className="lf-mono" title={`$${Math.round(s.netWorth).toLocaleString("en-US")}`}>
              {formatTVL(s.netWorth)}
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
              <span className="lf-lbl-full">{relativeTime(a.time)}</span>
              <span className="lf-lbl-short">{relativeTime(a.time, true)}</span>
            </span>
            <span className="uni-hub-cell" data-label="Source">
              <span className="lf-dim">—</span>
            </span>
            <span className="uni-hub-cell" data-label="Country">
              <span className="lf-dim">—</span>
            </span>
            <span className="uni-hub-cell" data-label="Stage">
              <span className={`lf-event lf-event-${a.kind}`}>
                <StageIcon kind={a.kind} />
                <span className="lf-lbl-full">
                  {a.kind === "visit"
                    ? "Visit"
                    : a.kind === "click"
                      ? "App click"
                      : a.kind}
                </span>
                <span className="lf-lbl-short">
                  {a.kind === "visit"
                    ? "Visit"
                    : a.kind === "click"
                      ? "App"
                      : a.kind === "deposit"
                        ? "Dep"
                        : "With"}
                </span>
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
            <span className="uni-hub-cell lf-device-cell" data-label="Device">
              <span className="lf-dim">—</span>
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
              {a.tx && a.chain ? (
                <a
                  href={txLink(a.chain, a.tx)}
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

// Stage glyphs matching the Live Feed event icons: eye = visit /
// acquired, pointer = app click / reached, arrows = deposit (in) and
// withdraw (out). They keep the chips readable when the mobile rows
// collapse the chip to icon-only.
function StageIcon({ kind }: { kind: string }) {
  if (kind === "deposit" || kind === "withdraw") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {kind === "withdraw" ? (
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
  if (kind === "click") {
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
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
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

// With dateOnly, rows past 24h show just the date (no hour) - used for
// the tight mobile rows; desktop keeps the full timestamp + title.
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

// Full timestamp on desktop, date-only past 24h on the mobile rows.
function TimeLabel({ ms }: { ms: number }) {
  if (!Number.isFinite(ms)) return <span className="lf-dim">—</span>;
  const iso = new Date(ms).toISOString();
  return (
    <>
      <span className="lf-lbl-full">{relativeTime(iso)}</span>
      <span className="lf-lbl-short">{relativeTime(iso, true)}</span>
    </>
  );
}
