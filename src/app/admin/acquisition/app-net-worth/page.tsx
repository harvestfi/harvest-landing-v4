"use client";

// Acquisition funnel - step 03: User Networth.
// Mirror of the Traffic + App Clicks layout but sourced from
// wallet_connections_prod. Each row is one connection event of a
// wallet to the Harvest app, snapshot-recorded with the wallet's
// total balance and the portion currently held in Harvest vaults.
// Last 5000 connections are pulled client-side; aggregates are
// computed across that window with latest-per-wallet dedupe.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseSelect } from "@/lib/supabase";
import { formatTVL } from "@/lib/format";

interface WalletConnection {
  id: string;
  wallet_address: string;
  connected_at: string;
  balance: number | null;
  harvest_balance: number | null;
}

const ROWS_FETCH_LIMIT = 5000;
const ROWS_DISPLAY_LIMIT = 200;
const CHART_DAYS = 30;
// 5-column track for the connections table.
const TABLE_COLS =
  "150px minmax(180px, 1.4fr) 1fr 1fr 110px";

export default function UserNetworthPage() {
  const [connections, setConnections] = useState<WalletConnection[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = `select=id,wallet_address,connected_at,balance,harvest_balance&order=connected_at.desc&limit=${ROWS_FETCH_LIMIT}`;
        const data = await supabaseSelect<WalletConnection>(
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

    // Unique wallets per window. A wallet that connected 8 times in
    // the last 24h is counted once.
    const uniquesIn = (days: number) => {
      const cutoff = now - days * dayMs;
      const set = new Set<string>();
      for (const c of connections) {
        if (new Date(c.connected_at).getTime() < cutoff) continue;
        if (c.wallet_address) set.add(c.wallet_address.toLowerCase());
      }
      return set.size;
    };

    // Aggregate net worth = sum of LATEST balance per wallet across
    // the fetched window. Each wallet contributes the balance from
    // its most recent connection event. Same logic for harvest
    // balance.
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
    for (const c of latestPerWallet.values()) {
      sumBalance += Number(c.balance ?? 0);
      sumHarvest += Number(c.harvest_balance ?? 0);
    }

    return {
      last24: uniquesIn(1),
      last7: uniquesIn(7),
      last30: uniquesIn(30),
      uniqueWallets: latestPerWallet.size,
      sumBalance,
      sumHarvest,
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
          the latest 5,000 connection events are pulled client-side and
          aggregated with latest-per-wallet dedupe so a wallet that reconnects
          ten times still counts once in the totals.
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
          <NetworthCard stats={stats} totalConnections={connections.length} />
          <ChartSection connections={connections} days={CHART_DAYS} />
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
// Net-worth card — surfaces the three aggregate dollar values up
// front so the operator sees the funnel-bottom number at a glance.
// ──────────────────────────────────────────────────────────────────

function NetworthCard({
  stats,
  totalConnections,
}: {
  stats: {
    uniqueWallets: number;
    sumBalance: number;
    sumHarvest: number;
  } | null;
  totalConnections: number;
}) {
  if (!stats) return null;
  const share =
    stats.sumBalance > 0
      ? (stats.sumHarvest / stats.sumBalance) * 100
      : null;

  return (
    <section className="uni-hub-section" style={{ marginTop: 0 }}>
      <header className="uni-hub-section-head">
        <h2 className="uni-hub-section-title">Net-worth aggregate</h2>
        <span className="uni-hub-section-meta">
          {totalConnections.toLocaleString("en-US")} connection events ·{" "}
          {stats.uniqueWallets.toLocaleString("en-US")} unique wallets
        </span>
      </header>

      <div className="aq-networth-grid">
        <div className="aq-networth-tile aq-networth-tile-primary">
          <div className="aq-networth-label">Total in Harvest</div>
          <div className="aq-networth-value">{formatTVL(stats.sumHarvest)}</div>
          <div className="aq-networth-meta">
            sum of latest harvest_balance per wallet
          </div>
        </div>
        <div className="aq-networth-tile">
          <div className="aq-networth-label">Total wallet net worth</div>
          <div className="aq-networth-value">{formatTVL(stats.sumBalance)}</div>
          <div className="aq-networth-meta">
            sum of latest balance per wallet
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
// Chart — gold bars, daily unique-wallet connections.
// ──────────────────────────────────────────────────────────────────

function ChartSection({
  connections,
  days,
}: {
  connections: WalletConnection[];
  days: number;
}) {
  const { bins, max, total, latest, peak } = useMemo(() => {
    const now = Date.now();
    const dayMs = 86_400_000;
    // Bin holds a Set of wallet addresses connecting that day, so
    // the bar represents unique wallets per day (not raw events).
    const bins: { wallets: Set<string>; daysAgo: number }[] = [];
    for (let i = 0; i < days; i++) {
      bins.push({ wallets: new Set(), daysAgo: days - 1 - i });
    }
    for (const c of connections) {
      const daysAgo = Math.floor(
        (now - new Date(c.connected_at).getTime()) / dayMs,
      );
      if (daysAgo >= 0 && daysAgo < days && c.wallet_address) {
        bins[days - 1 - daysAgo].wallets.add(c.wallet_address.toLowerCase());
      }
    }
    const out = bins.map((b) => ({ v: b.wallets.size, daysAgo: b.daysAgo }));
    const m = Math.max(1, ...out.map((b) => b.v));
    const totalUniques = new Set<string>();
    for (const b of bins) for (const w of b.wallets) totalUniques.add(w);
    return {
      bins: out,
      max: m,
      total: totalUniques.size,
      latest: out[out.length - 1]?.v ?? 0,
      peak: m,
    };
  }, [connections, days]);

  return (
    <section className="uni-hub-section">
      <header className="uni-hub-section-head">
        <h2 className="uni-hub-section-title">
          Daily unique wallets — last {days} days
        </h2>
        <span className="uni-hub-section-meta">
          today {latest.toLocaleString("en-US")} · peak{" "}
          {peak.toLocaleString("en-US")}/day
        </span>
      </header>
      <div className="aq-chart-card">
        <div className="aq-chart-bignum">{total.toLocaleString("en-US")}</div>
        <div className="aq-chart-bignum-label">
          unique wallets connected across the trailing {days} days
        </div>

        <div className="aq-chart">
          <div className="aq-chart-bars">
            {bins.map((b, i) => {
              const heightPct = Math.max((b.v / max) * 100, b.v > 0 ? 4 : 0);
              return (
                <div
                  key={i}
                  className="aq-bar-col"
                  title={`${b.v} unique wallet${b.v === 1 ? "" : "s"} (${labelForDaysAgo(b.daysAgo)})`}
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
        <div className="hub-table-wrap">
          <div className="hub-table aq-clicks-table">
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
