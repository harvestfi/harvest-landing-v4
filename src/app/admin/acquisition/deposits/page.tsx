"use client";

// Acquisition funnel - step 04: Deposits (TVL).
// Network-wide Harvest TVL aggregated from per-vault history, paired
// with a daily new-wallets chart and a cohort funnel that walks
// visits -> clicks -> new wallet connects -> depositors for the
// selected timeframe.
//
// Data sources:
//  - Network TVL: precomputed at build time by
//    scripts/build-network-tvl.mjs into src/data/network-tvl-daily.json
//  - Wallet connects: wallet_connections_prod (Supabase)
//  - Visits / clicks: frontpage_visits and outbound_clicks (Supabase),
//    used for the cohort funnel.
//
// Depositor proxy: a wallet is treated as a "depositor" if its
// harvest_balance is currently > 0 (and below the outlier cap). This
// is a snapshot, not a first-deposit-date - good enough for the
// conversion-rate cohort framing until we wire onchain Deposit-event
// timestamps from the subgraph.

import { useEffect, useMemo, useState } from "react";
import { supabaseSelectAll } from "@/lib/supabase";
import {
  TimeframeSelector,
  resolveDays,
  type Timeframe,
} from "@/components/admin/timeframe-selector";
import networkTvl from "@/data/network-tvl-daily.json";

interface WalletRow {
  wallet_address: string;
  connected_at: string;
  harvest_balance: number | null;
  balance: number | null;
}

interface VisitRow {
  created_at: string;
  session_id: string;
}

interface ClickRow {
  created_at: string;
  session_id: string;
}

interface DailyTvlPoint {
  date: string;
  tvl: number;
}

interface NetworkTvlFile {
  generated_at: string;
  days: number;
  vaults: number;
  series: DailyTvlPoint[];
}

const TVL: NetworkTvlFile = networkTvl as NetworkTvlFile;
const WALLET_OUTLIER_CAP = 100_000_000;
const DAY_MS = 86_400_000;

export default function DepositsPage() {
  const [wallets, setWallets] = useState<WalletRow[] | null>(null);
  const [visits, setVisits] = useState<VisitRow[] | null>(null);
  const [clicks, setClicks] = useState<ClickRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [w, v, c] = await Promise.all([
          supabaseSelectAll<WalletRow>(
            "wallet_connections_prod",
            "select=wallet_address,connected_at,harvest_balance,balance&order=connected_at.desc",
          ),
          supabaseSelectAll<VisitRow>(
            "frontpage_visits",
            "select=created_at,session_id&order=created_at.desc",
          ),
          supabaseSelectAll<ClickRow>(
            "outbound_clicks",
            "select=created_at,session_id&order=created_at.desc",
          ),
        ]);
        if (cancelled) return;
        setWallets(w);
        setVisits(v);
        setClicks(c);
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Earliest-connect per wallet, deduped, capped at the outlier
  // threshold. Used by both the daily new-wallets chart and the
  // funnel "new connects" count.
  const uniqueWallets = useMemo(() => {
    if (!wallets) return null;
    const earliest = new Map<string, WalletRow>();
    for (const w of wallets) {
      const addr = (w.wallet_address || "").toLowerCase();
      if (!addr) continue;
      const prev = earliest.get(addr);
      if (!prev || w.connected_at < prev.connected_at) {
        earliest.set(addr, w);
      }
    }
    return [...earliest.values()];
  }, [wallets]);

  const walletStats = useMemo(() => {
    if (!uniqueWallets) return null;
    let activeDepositors = 0;
    let trackedBalance = 0;
    for (const w of uniqueWallets) {
      const b = typeof w.harvest_balance === "number" ? w.harvest_balance : 0;
      if (b > 0 && b < WALLET_OUTLIER_CAP) {
        activeDepositors++;
        trackedBalance += b;
      }
    }
    return { activeDepositors, trackedBalance };
  }, [uniqueWallets]);

  const latestTvl = TVL.series[TVL.series.length - 1]?.tvl ?? 0;
  const avgPosition =
    walletStats && walletStats.activeDepositors > 0
      ? walletStats.trackedBalance / walletStats.activeDepositors
      : null;

  const loading = wallets === null || visits === null || clicks === null;

  return (
    <>
      <section className="aq-step-header">
        <h2 className="aq-step-title">Deposits (TVL)</h2>
        <p className="aq-step-sub">
          Network-wide Harvest TVL aggregated across the {TVL.vaults} vaults
          we index, with a cohort funnel that follows visits through to
          first-deposit. The terminal step: anonymous visit converted into
          a real onchain position.
        </p>
      </section>

      <div
        className="uni-hub-stats"
        role="group"
        aria-label="Deposit summary"
        style={{
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          marginBottom: 32,
        }}
      >
        <Stat label="Current TVL" value={formatUsd(latestTvl)} />
        <Stat
          label="Active depositor wallets"
          value={
            walletStats === null
              ? null
              : walletStats.activeDepositors.toLocaleString("en-US")
          }
        />
        <Stat
          label="Tracked wallet TVL"
          value={
            walletStats === null ? null : formatUsd(walletStats.trackedBalance)
          }
        />
        <Stat
          label="Avg position size"
          value={avgPosition === null ? null : formatUsd(avgPosition)}
        />
      </div>

      {err && (
        <div className="uni-hub-empty" style={{ color: "#b91c1c" }}>
          Could not load Supabase tables: {err}
        </div>
      )}

      <TvlChartSection
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
      />

      {!loading && uniqueWallets && (
        <>
          <NewWalletsChartSection
            wallets={uniqueWallets}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />
          <FunnelSection
            visits={visits!}
            clicks={clicks!}
            wallets={uniqueWallets}
            timeframe={timeframe}
          />
          <RecentDepositorsSection wallets={uniqueWallets} />
        </>
      )}

      {loading && !err && (
        <div className="uni-hub-empty">Loading cohort data…</div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="uni-hub-stat">
      <div className="uni-hub-stat-label">{label}</div>
      <div className="uni-hub-stat-value">{value ?? "—"}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// TVL chart - network-wide, sourced from the precomputed daily JSON.
// ──────────────────────────────────────────────────────────────────

function TvlChartSection({
  timeframe,
  onTimeframeChange,
}: {
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}) {
  const [hovered, setHovered] = useState<{ date: string; tvl: number } | null>(
    null,
  );

  const oldestMs = useMemo(() => {
    const first = TVL.series[0]?.date;
    if (!first) return null;
    return new Date(first + "T00:00:00Z").getTime();
  }, []);
  const days = resolveDays(timeframe, oldestMs);

  const { bins, max, latest, peak } = useMemo(() => {
    const tail = TVL.series.slice(-days);
    const out = tail.map((p) => ({ date: p.date, tvl: p.tvl }));
    const m = Math.max(1, ...out.map((b) => b.tvl));
    const peakBin = out.reduce(
      (best, b) => (b.tvl > best.tvl ? b : best),
      out[0] ?? { date: "", tvl: 0 },
    );
    return {
      bins: out,
      max: m,
      latest: out[out.length - 1]?.tvl ?? 0,
      peak: peakBin.tvl,
    };
  }, [days]);

  return (
    <section className="uni-hub-section" style={{ marginTop: 0 }}>
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">
            Network TVL, last {days} days
          </h2>
          <span className="uni-hub-section-meta">
            today {formatUsd(latest)} · peak {formatUsd(peak)}
          </span>
        </div>
        <TimeframeSelector value={timeframe} onChange={onTimeframeChange} />
      </header>
      <div className="aq-chart-card">
        <div className="aq-chart-bignum">
          {formatUsd(hovered ? hovered.tvl : latest)}
        </div>
        <div className="aq-chart-bignum-label">
          {hovered
            ? `Harvest TVL on ${hovered.date}`
            : `current Harvest TVL across ${TVL.vaults} indexed vaults`}
        </div>
        <div className="aq-chart">
          <div className="aq-chart-bars">
            {bins.map((b, i) => {
              const heightPct = Math.max((b.tvl / max) * 100, b.tvl > 0 ? 4 : 0);
              return (
                <div
                  key={i}
                  className="aq-bar-col"
                  title={`${formatUsd(b.tvl)} (${b.date})`}
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

// ──────────────────────────────────────────────────────────────────
// New wallets per day - mirrors the bar shape of the other charts
// in the funnel so the four steps read as a coherent series. Bin a
// wallet on the day of its earliest connected_at row.
// ──────────────────────────────────────────────────────────────────

function NewWalletsChartSection({
  wallets,
  timeframe,
  onTimeframeChange,
}: {
  wallets: WalletRow[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}) {
  const [hovered, setHovered] = useState<{ v: number; daysAgo: number } | null>(
    null,
  );

  const oldestMs = useMemo(() => {
    if (wallets.length === 0) return null;
    let oldest = Infinity;
    for (const w of wallets) {
      const t = new Date(w.connected_at).getTime();
      if (t < oldest) oldest = t;
    }
    return Number.isFinite(oldest) ? oldest : null;
  }, [wallets]);
  const days = resolveDays(timeframe, oldestMs);

  const { bins, max, total, latest, peak } = useMemo(() => {
    const now = Date.now();
    const out: { v: number; daysAgo: number }[] = [];
    for (let i = 0; i < days; i++) {
      out.push({ v: 0, daysAgo: days - 1 - i });
    }
    let inWindow = 0;
    for (const w of wallets) {
      const daysAgo = Math.floor(
        (now - new Date(w.connected_at).getTime()) / DAY_MS,
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
  }, [wallets, days]);

  return (
    <section className="uni-hub-section">
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">
            New wallets, last {days} days
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
          {(hovered ? hovered.v : total).toLocaleString("en-US")}
        </div>
        <div className="aq-chart-bignum-label">
          {hovered
            ? `new wallets ${labelForDaysAgo(hovered.daysAgo)}`
            : `first-time wallet connections in the trailing ${days} days`}
        </div>

        <div className="aq-chart">
          <div className="aq-chart-bars">
            {bins.map((b, i) => {
              const heightPct = Math.max((b.v / max) * 100, b.v > 0 ? 4 : 0);
              return (
                <div
                  key={i}
                  className="aq-bar-col"
                  title={`${b.v} new wallet${b.v === 1 ? "" : "s"} (${labelForDaysAgo(b.daysAgo)})`}
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

// ──────────────────────────────────────────────────────────────────
// Funnel - cohort attribution for the selected timeframe. Four
// counts (visits / clicks / new wallets / depositors) with three
// step-conversion rates between them. No claim that a specific
// visitor became a specific depositor; this is rate-level only and
// honest about that until wallet_session_links is populated by the
// app side.
// ──────────────────────────────────────────────────────────────────

function FunnelSection({
  visits,
  clicks,
  wallets,
  timeframe,
}: {
  visits: VisitRow[];
  clicks: ClickRow[];
  wallets: WalletRow[];
  timeframe: Timeframe;
}) {
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

  const cohort = useMemo(() => {
    const now = Date.now();
    const cutoff = now - days * DAY_MS;
    let visitCount = 0;
    let visitSessions = new Set<string>();
    for (const v of visits) {
      const t = new Date(v.created_at).getTime();
      if (t >= cutoff) {
        visitCount++;
        visitSessions.add(v.session_id);
      }
    }
    let clickCount = 0;
    let clickSessions = new Set<string>();
    for (const c of clicks) {
      const t = new Date(c.created_at).getTime();
      if (t >= cutoff) {
        clickCount++;
        clickSessions.add(c.session_id);
      }
    }
    let newWallets = 0;
    let depositors = 0;
    let depositorTvl = 0;
    for (const w of wallets) {
      const t = new Date(w.connected_at).getTime();
      if (t >= cutoff) {
        newWallets++;
        const b =
          typeof w.harvest_balance === "number" ? w.harvest_balance : 0;
        if (b > 0 && b < WALLET_OUTLIER_CAP) {
          depositors++;
          depositorTvl += b;
        }
      }
    }
    return {
      visitCount,
      uniqueVisitors: visitSessions.size,
      clickCount,
      clickSessions: clickSessions.size,
      newWallets,
      depositors,
      depositorTvl,
    };
  }, [visits, clicks, wallets, days]);

  const pct = (num: number, den: number): string =>
    den === 0 ? "—" : `${((num / den) * 100).toFixed(1)}%`;

  return (
    <section className="uni-hub-section">
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">
            Cohort funnel — last {days} days
          </h2>
          <span className="uni-hub-section-meta">
            cohort rates, not individual attribution (pending
            wallet_session_links)
          </span>
        </div>
      </header>

      <div className="aq-cohort-funnel">
        <CohortStep
          rank="01"
          label="Visits"
          value={cohort.visitCount.toLocaleString("en-US")}
          sub={`${cohort.uniqueVisitors.toLocaleString("en-US")} unique sessions`}
        />
        <CohortArrow
          rate={pct(cohort.clickCount, cohort.visitCount)}
          caption="click-through"
        />
        <CohortStep
          rank="02"
          label="App clicks"
          value={cohort.clickCount.toLocaleString("en-US")}
          sub={`${cohort.clickSessions.toLocaleString("en-US")} sessions clicked`}
        />
        <CohortArrow
          rate={pct(cohort.newWallets, cohort.clickSessions)}
          caption="connect rate (clicks to new wallets)"
        />
        <CohortStep
          rank="03"
          label="New wallets"
          value={cohort.newWallets.toLocaleString("en-US")}
          sub="first-seen in this window"
        />
        <CohortArrow
          rate={pct(cohort.depositors, cohort.newWallets)}
          caption="deposit rate (new wallets to depositors)"
        />
        <CohortStep
          rank="04"
          label="Depositors"
          value={cohort.depositors.toLocaleString("en-US")}
          sub={`${formatUsd(cohort.depositorTvl)} TVL`}
        />
      </div>
    </section>
  );
}

function CohortStep({
  rank,
  label,
  value,
  sub,
}: {
  rank: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="aq-cohort-step">
      <div className="aq-cohort-rank">{rank}</div>
      <div className="aq-cohort-label">{label}</div>
      <div className="aq-cohort-value">{value}</div>
      <div className="aq-cohort-sub">{sub}</div>
    </div>
  );
}

function CohortArrow({ rate, caption }: { rate: string; caption: string }) {
  return (
    <div className="aq-cohort-arrow">
      <div className="aq-cohort-rate">{rate}</div>
      <div className="aq-cohort-arrow-caption">{caption}</div>
    </div>
  );
}

function formatUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

// ──────────────────────────────────────────────────────────────────
// Recent depositors - wallets first seen in the last 7 days that
// currently hold a Harvest position. Proxies a deposit-event feed
// until we wire onchain Deposit events from the subgraph. Sorted
// most-recent first; truncated to a single readable page.
// ──────────────────────────────────────────────────────────────────

const RECENT_DEPOSITORS_DAYS = 7;
const RECENT_DEPOSITORS_LIMIT = 200;

const RECENT_DEPOSITORS_COLS =
  "150px minmax(220px, 1.6fr) 120px 120px 70px";

function RecentDepositorsSection({ wallets }: { wallets: WalletRow[] }) {
  const rows = useMemo(() => {
    const now = Date.now();
    const cutoff = now - RECENT_DEPOSITORS_DAYS * DAY_MS;
    const out: WalletRow[] = [];
    for (const w of wallets) {
      const t = new Date(w.connected_at).getTime();
      if (t < cutoff) continue;
      const b =
        typeof w.harvest_balance === "number" ? w.harvest_balance : 0;
      if (b <= 0 || b >= WALLET_OUTLIER_CAP) continue;
      out.push(w);
    }
    out.sort(
      (a, b) =>
        new Date(b.connected_at).getTime() -
        new Date(a.connected_at).getTime(),
    );
    return out.slice(0, RECENT_DEPOSITORS_LIMIT);
  }, [wallets]);

  return (
    <section className="uni-hub-section">
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">
            Recent depositors, last {RECENT_DEPOSITORS_DAYS} days
          </h2>
          <span className="uni-hub-section-meta">
            wallets first seen in this window that currently hold a Harvest
            position. Will be replaced by onchain Deposit events once the
            subgraph feed is wired.
          </span>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="uni-hub-empty">
          No new depositors in the last {RECENT_DEPOSITORS_DAYS} days yet.
        </div>
      ) : (
        <div className="hub-table-wrap aq-recent-wrap">
          <div className="hub-table aq-clicks-table aq-recent-table">
            <div
              className="hub-thead"
              style={{ gridTemplateColumns: RECENT_DEPOSITORS_COLS }}
            >
              <span className="hub-th">Time</span>
              <span className="hub-th">Wallet</span>
              <span className="hub-th">Harvest balance</span>
              <span className="hub-th">Total wallet</span>
              <span className="hub-th">Link</span>
            </div>
            {rows.map((w) => (
              <div
                key={w.wallet_address}
                className="hub-row"
                style={{ gridTemplateColumns: RECENT_DEPOSITORS_COLS }}
              >
                <span className="hub-cell aq-cell-time">
                  {formatTime(w.connected_at)}
                </span>
                <span className="hub-cell aq-cell-vault">
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12.5 }}>
                    {shortenAddress(w.wallet_address)}
                  </span>
                </span>
                <span className="hub-cell">
                  {formatUsd(w.harvest_balance ?? 0)}
                </span>
                <span className="hub-cell">
                  {typeof w.balance === "number" && w.balance > 0
                    ? formatUsd(w.balance)
                    : "—"}
                </span>
                <span className="hub-cell">
                  <a
                    href={`https://debank.com/profile/${w.wallet_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aq-vault-link"
                  >
                    debank
                  </a>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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
