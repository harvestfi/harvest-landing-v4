"use client";

// Acquisition funnel - step 03: User Networth.
// Sourced from wallet_connections_prod. Pulls the full table via
// paginated REST calls and aggregates client-side. The daily-TVL
// chart caps visible bars at $100M; rows beyond that are corrupt
// snapshots (a few exceed $1B) and paint red so the operator can
// spot them while the cap stops one outlier from flattening the
// rest of the chart.

import { useEffect, useMemo, useState } from "react";
import { supabaseSelectAll } from "@/lib/supabase";
import { formatTVL } from "@/lib/format";
import {
  TimeframeSelector,
  resolveDays,
  type Timeframe,
} from "@/components/admin/timeframe-selector";

interface WalletConnection {
  id: string;
  wallet_address: string;
  connected_at: string;
  balance: number | null;
  harvest_balance: number | null;
}

const ROWS_DISPLAY_LIMIT = 200;
// Daily TVL above this is an outlier - the underlying row contains
// a corrupt balance reading. Bars cap at this height and paint red.
const TVL_OUTLIER_CAP = 100_000_000; // $100M
// 5-column track for the connections table.
const TABLE_COLS =
  "150px minmax(180px, 1.4fr) 1fr 1fr 110px";

export default function UserNetworthPage() {
  const [connections, setConnections] = useState<WalletConnection[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = `select=id,wallet_address,connected_at,balance,harvest_balance&order=connected_at.desc`;
        const data = await supabaseSelectAll<WalletConnection>(
          "wallet_connections_prod",
          params,
        );
        if (!cancelled) setConnections(data);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    if (!connections) return null;
    const now = Date.now();
    const dayMs = 86_400_000;

    const uniquesIn = (days: number) => {
      const cutoff = now - days * dayMs;
      const set = new Set<string>();
      for (const c of connections) {
        if (new Date(c.connected_at).getTime() < cutoff) continue;
        if (c.wallet_address) set.add(c.wallet_address.toLowerCase());
      }
      return set.size;
    };

    // Aggregate net worth = latest balance per wallet, summed.
    // Wallets with corrupt latest snapshots (harvest_balance >
    // TVL_OUTLIER_CAP, balance > TVL_OUTLIER_CAP * 10) are excluded
    // so one bad row doesn't trash the headline.
    const latestPerWallet = new Map<string, WalletConnection>();
    for (const c of connections) {
      if (!c.wallet_address) continue;
      const key = c.wallet_address.toLowerCase();
      const prev = latestPerWallet.get(key);
      if (
        !prev ||
        new Date(c.connected_at).getTime() >
          new Date(prev.connected_at).getTime()
      ) {
        latestPerWallet.set(key, c);
      }
    }
    let sumBalance = 0;
    let sumHarvest = 0;
    let outlierWallets = 0;
    for (const c of latestPerWallet.values()) {
      const bal = Number(c.balance ?? 0);
      const hbal = Number(c.harvest_balance ?? 0);
      if (hbal > TVL_OUTLIER_CAP || bal > TVL_OUTLIER_CAP * 10) {
        outlierWallets++;
        continue;
      }
      sumBalance += bal;
      sumHarvest += hbal;
    }

    return {
      last24: uniquesIn(1),
      last7: uniquesIn(7),
      last30: uniquesIn(30),
      uniqueWallets: latestPerWallet.size,
      sumBalance,
      sumHarvest,
      outlierWallets,
    };
  }, [connections]);

  return (
    <>
      <section className="aq-step-header">
        <h2 className="aq-step-title">User Networth</h2>
        <p className="aq-step-sub">
          Wallet connections to the Harvest app, snapshot-recorded with each
          wallet&apos;s total balance and the portion currently held in
          Harvest vaults. Sourced from <code>wallet_connections_prod</code>;
          the full table is paginated client-side and aggregated with
          latest-per-wallet dedupe so a wallet that reconnects ten times
          still counts once. Outlier rows (corrupt snapshots above $100M
          daily) are marked red on the chart and excluded from the
          aggregate totals.
        </p>
      </section>

      <div
        className="uni-hub-stats"
        role="group"
        aria-label="Networth summary"
        style={{
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          marginBottom: 32,
        }}
      >
        <Stat label="Unique wallets (24h)" value={stats?.last24} />
        <Stat label="Unique wallets (7d)" value={stats?.last7} />
        <Stat label="Unique wallets (30d)" value={stats?.last30} />
        <Stat
          label="Aggregate in Harvest"
          value={
            stats === null ? undefined : formatTVL(stats.sumHarvest)
          }
          asString
        />
      </div>

      {error && (
        <div className="uni-hub-empty" style={{ color: "#b91c1c" }}>
          Could not load wallet connections: {error}
        </div>
      )}

      {connections === null && !error && (
        <div className="uni-hub-empty">Loading wallet connections…</div>
      )}

      {connections && (
        <>
          <ChartSection
            connections={connections}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />
          <NetworthCard stats={stats} totalConnections={connections.length} />
          <TableSection
            connections={connections.slice(0, ROWS_DISPLAY_LIMIT)}
          />
        </>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  asString = false,
}: {
  label: string;
  value: number | string | undefined;
  asString?: boolean;
}) {
  let display: string;
  if (value === undefined) display = "—";
  else if (typeof value === "string") display = value;
  else display = value.toLocaleString("en-US");
  return (
    <div className="uni-hub-stat">
      <div className="uni-hub-stat-label">{label}</div>
      <div
        className="uni-hub-stat-value"
        style={asString ? { fontSize: 22 } : undefined}
      >
        {display}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Chart — daily aggregate harvest_balance over the last 30 days.
// Bars cap visually at TVL_OUTLIER_CAP ($100M); any day whose raw
// sum exceeds the cap renders at full height in red and the
// tooltip carries the real value. The scale-cap is what makes the
// non-outlier days legible at all - one $1B bar otherwise crushes
// every other day to a 1px stub.
// ──────────────────────────────────────────────────────────────────

interface Bin {
  v: number;
  outlier: boolean;
  daysAgo: number;
}

function ChartSection({
  connections,
  timeframe,
  onTimeframeChange,
}: {
  connections: WalletConnection[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}) {
  const oldestMs = useMemo(() => {
    if (connections.length === 0) return null;
    let oldest = Infinity;
    for (const c of connections) {
      const t = new Date(c.connected_at).getTime();
      if (t < oldest) oldest = t;
    }
    return Number.isFinite(oldest) ? oldest : null;
  }, [connections]);
  const days = resolveDays(timeframe, oldestMs);

  const { bins, max, total, latest, peak, outlierDays } = useMemo(() => {
    const now = Date.now();
    const dayMs = 86_400_000;
    const sums = new Array(days).fill(0) as number[];
    for (const c of connections) {
      const daysAgo = Math.floor(
        (now - new Date(c.connected_at).getTime()) / dayMs,
      );
      if (daysAgo < 0 || daysAgo >= days) continue;
      const hbal = Number(c.harvest_balance ?? 0);
      if (!Number.isFinite(hbal) || hbal <= 0) continue;
      sums[days - 1 - daysAgo] += hbal;
    }
    const bins: Bin[] = sums.map((v, i) => ({
      v,
      outlier: v > TVL_OUTLIER_CAP,
      daysAgo: days - 1 - i,
    }));
    // Cap the visual ceiling at the outlier threshold so non-outlier
    // days fill the plot area properly. A real $1B day still paints
    // full height (red) but doesn't squash the rest.
    const cappedMax = Math.max(
      1,
      ...bins.map((b) => Math.min(b.v, TVL_OUTLIER_CAP)),
    );
    const totalAll = sums.reduce((s, n) => s + n, 0);
    return {
      bins,
      max: cappedMax,
      total: totalAll,
      latest: bins[bins.length - 1]?.v ?? 0,
      peak: Math.max(0, ...bins.filter((b) => !b.outlier).map((b) => b.v)),
      outlierDays: bins.filter((b) => b.outlier).length,
    };
  }, [connections, days]);

  return (
    <section className="uni-hub-section" style={{ marginTop: 0 }}>
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">
            Daily harvest balance, last {days} days
          </h2>
          <span className="uni-hub-section-meta">
            today {formatTVL(latest)} · peak {formatTVL(peak)}/day
            {outlierDays > 0 ? ` · ${outlierDays} outlier day(s)` : ""}
          </span>
        </div>
        <TimeframeSelector value={timeframe} onChange={onTimeframeChange} />
      </header>
      <div className="aq-chart-card">
        <div className="aq-chart-bignum">{formatTVL(total)}</div>
        <div className="aq-chart-bignum-label">
          cumulative harvest_balance snapshots over the trailing {days} days
        </div>

        <div className="aq-chart">
          <div className="aq-chart-bars">
            {bins.map((b, i) => {
              // Render outlier bars at full plot height + red, all
              // others scale against the $100M cap.
              const visualHeight = b.outlier
                ? 100
                : b.v > 0
                  ? Math.max((b.v / max) * 100, 4)
                  : 0;
              const labelDay = labelForDaysAgo(b.daysAgo);
              const titleText = b.outlier
                ? `${formatTVL(b.v)} (outlier, capped at $100M) — ${labelDay}`
                : `${formatTVL(b.v)} — ${labelDay}`;
              return (
                <div key={i} className="aq-bar-col" title={titleText}>
                  <div
                    className={`aq-bar${b.outlier ? " aq-bar-outlier" : ""}`}
                    style={{ height: `${visualHeight}%` }}
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
// Net-worth aggregate — moved below the chart per request. Shows
// the headline totals (Total in Harvest, Total wallet net worth,
// Share in Harvest) with outliers already excluded by the parent
// stats memo.
// ──────────────────────────────────────────────────────────────────

function NetworthCard({
  stats,
  totalConnections,
}: {
  stats: {
    uniqueWallets: number;
    sumBalance: number;
    sumHarvest: number;
    outlierWallets: number;
  } | null;
  totalConnections: number;
}) {
  if (!stats) return null;
  const share =
    stats.sumBalance > 0
      ? (stats.sumHarvest / stats.sumBalance) * 100
      : null;

  return (
    <section className="uni-hub-section">
      <header className="uni-hub-section-head">
        <h2 className="uni-hub-section-title">Net-worth aggregate</h2>
        <span className="uni-hub-section-meta">
          {totalConnections.toLocaleString("en-US")} connection events ·{" "}
          {stats.uniqueWallets.toLocaleString("en-US")} unique wallets
          {stats.outlierWallets > 0
            ? ` · ${stats.outlierWallets} outlier wallet(s) excluded`
            : ""}
        </span>
      </header>

      <div className="aq-networth-grid">
        <div className="aq-networth-tile aq-networth-tile-primary">
          <div className="aq-networth-label">Total in Harvest</div>
          <div className="aq-networth-value">{formatTVL(stats.sumHarvest)}</div>
          <div className="aq-networth-meta">
            sum of latest harvest_balance per wallet (outliers excluded)
          </div>
        </div>
        <div className="aq-networth-tile">
          <div className="aq-networth-label">Total wallet net worth</div>
          <div className="aq-networth-value">{formatTVL(stats.sumBalance)}</div>
          <div className="aq-networth-meta">
            sum of latest balance per wallet (outliers excluded)
          </div>
        </div>
        <div className="aq-networth-tile">
          <div className="aq-networth-label">Share in Harvest</div>
          <div className="aq-networth-value">
            {share === null ? "—" : `${share.toFixed(1)}%`}
          </div>
          <div className="aq-networth-meta">harvest_balance ÷ balance</div>
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────
// Recent connections table.
// ──────────────────────────────────────────────────────────────────

function TableSection({
  connections,
}: {
  connections: WalletConnection[];
}) {
  return (
    <section className="uni-hub-section">
      <header className="uni-hub-section-head">
        <h2 className="uni-hub-section-title">Recent connections</h2>
        <span className="uni-hub-section-meta">
          showing latest {connections.length.toLocaleString("en-US")}
        </span>
      </header>

      {connections.length === 0 ? (
        <div className="uni-hub-empty">
          No wallet connections returned. If the table exists in Supabase, it
          may need an anon SELECT policy:{" "}
          <code className="rules-code">
            create policy &quot;anon read&quot; on wallet_connections_prod for
            select to anon using (true);
          </code>
        </div>
      ) : (
        <div className="hub-table-wrap aq-recent-wrap">
          <div className="hub-table aq-clicks-table aq-recent-table">
            <div
              className="hub-thead"
              style={{ gridTemplateColumns: TABLE_COLS }}
            >
              <span className="hub-th">Time</span>
              <span className="hub-th">Wallet</span>
              <span className="hub-th">Wallet balance</span>
              <span className="hub-th">Harvest balance</span>
              <span className="hub-th">Share</span>
            </div>
            {connections.map((c) => {
              const bal = Number(c.balance ?? 0);
              const hbal = Number(c.harvest_balance ?? 0);
              const share = bal > 0 ? (hbal / bal) * 100 : null;
              return (
                <div
                  key={c.id}
                  className="hub-row"
                  style={{ gridTemplateColumns: TABLE_COLS }}
                >
                  <span className="hub-cell aq-cell-time">
                    {formatTime(c.connected_at)}
                  </span>
                  <span className="hub-cell aq-cell-vault">
                    <span className="aq-vault-link" title={c.wallet_address}>
                      {truncateAddress(c.wallet_address)}
                    </span>
                  </span>
                  <span className="hub-cell">
                    {bal > 0 ? formatTVL(bal) : "—"}
                  </span>
                  <span className="hub-cell">
                    {hbal > 0 ? formatTVL(hbal) : "—"}
                  </span>
                  <span className="hub-cell">
                    {share === null ? "—" : `${share.toFixed(1)}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function truncateAddress(addr: string | null | undefined): string {
  if (!addr) return "—";
  if (addr.length < 12) return addr;
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
