"use client";

// Control room > Deposit Activity (Base).
//
// A USD-denominated deposit / withdraw feed for Base, sourced from the
// Harvest subgraph (userTransactions) rather than the public-RPC indexer.
// The subgraph indexer (scripts/index-vault-events-subgraph.mjs) writes a
// USD value per leg into vault_events_prod.amount_usd, so this page reads
// ONLY rows that carry a USD value:
//
//   chain = Base  AND  amount_usd IS NOT NULL
//
// That predicate cleanly isolates subgraph-sourced rows from the RPC
// indexer's rows (which leave amount_usd null), so the two sources never
// double-count here even while both run.
//
// Covers both autocompounders (vault legs) and autopilots (plasmaVault
// legs) - the subgraph entity carries both. Internal allocator /
// rebalancer wallets are filtered out so the figures reflect real users.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseSelectAll } from "@/lib/supabase";
import { isMutedActor, detectRebalancerActors } from "@/lib/muted-actors";
import {
  TimeframeSelector,
  resolveDays,
  type Timeframe,
} from "@/components/admin/timeframe-selector";

interface EventRow {
  tx_hash: string;
  log_index: number;
  block_timestamp: string;
  vault_address: string;
  vault_slug: string | null;
  event_type: "deposit" | "withdraw" | "transfer";
  wallet_address: string;
  amount_shares: string;
  amount_usd: number | null;
}

const DAY_MS = 86_400_000;

export default function DepositActivityPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("90d");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await supabaseSelectAll<EventRow>(
          "vault_events_prod",
          "select=tx_hash,log_index,block_timestamp,vault_address,vault_slug," +
            "event_type,wallet_address,amount_shares,amount_usd" +
            "&chain=eq.Base&amount_usd=not.is.null" +
            "&order=block_timestamp.desc",
        );
        if (cancelled) return;
        setEvents(rows);
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Internal allocator / rebalancer wallets - excluded so reallocations
  // don't inflate depositor counts or flow.
  const rebalancers = useMemo(
    () => (events ? detectRebalancerActors(events) : new Set<string>()),
    [events],
  );
  const realEvents = useMemo(() => {
    if (!events) return null;
    // Dedupe by (tx_hash, log_index): a re-run of the indexer can re-insert
    // the ~60s overlap window (the table has no unique constraint to absorb
    // it), so collapse repeats before any counting.
    const seen = new Set<string>();
    const out: EventRow[] = [];
    for (const e of events) {
      const a = (e.wallet_address || "").toLowerCase();
      if (!a || isMutedActor(a) || rebalancers.has(a)) continue;
      const key = `${e.tx_hash}-${e.log_index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
    return out;
  }, [events, rebalancers]);

  const oldestMs = useMemo(() => {
    if (!realEvents || realEvents.length === 0) return null;
    let oldest = Infinity;
    for (const e of realEvents) {
      const t = new Date(e.block_timestamp).getTime();
      if (t < oldest) oldest = t;
    }
    return Number.isFinite(oldest) ? oldest : null;
  }, [realEvents]);
  const days = resolveDays(timeframe, oldestMs);

  // Window the events to the selected timeframe, then roll up the headline
  // figures and the daily net-flow series in a single pass.
  const { windowed, stats } = useMemo(() => {
    if (!realEvents) {
      return { windowed: [] as EventRow[], stats: null };
    }
    const cutoff = Date.now() - days * DAY_MS;
    const win = realEvents.filter(
      (e) => new Date(e.block_timestamp).getTime() >= cutoff,
    );
    let depCount = 0;
    let wdCount = 0;
    let depUsd = 0;
    let wdUsd = 0;
    const wallets = new Set<string>();
    for (const e of win) {
      const usd = e.amount_usd ?? 0;
      wallets.add((e.wallet_address || "").toLowerCase());
      if (e.event_type === "deposit") {
        depCount++;
        depUsd += usd;
      } else if (e.event_type === "withdraw") {
        wdCount++;
        wdUsd += usd;
      }
    }
    return {
      windowed: win,
      stats: {
        depCount,
        wdCount,
        depUsd,
        wdUsd,
        netUsd: depUsd - wdUsd,
        wallets: wallets.size,
        avgDep: depCount > 0 ? depUsd / depCount : 0,
      },
    };
  }, [realEvents, days]);

  const loading = events === null;

  return (
    <div className="uni-hub-test">
      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <div>
            <h1 className="uni-hub-h1">Deposit Activity · Base</h1>
            <p className="uni-hub-sub">
              USD-denominated deposit and withdraw flow on Base, pulled
              directly from the Harvest subgraph (one pre-decoded row per
              transaction, covering both autocompounders and autopilots).
              Internal allocator wallets are filtered out, so these are real
              user flows.
            </p>
          </div>
        </div>

        <div
          className="uni-hub-stats"
          role="group"
          aria-label="Deposit activity summary"
          style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
        >
          <Stat
            label={`Deposits · ${days}d`}
            value={
              stats ? `${stats.depCount.toLocaleString("en-US")}` : null
            }
            sub={stats ? formatUsd(stats.depUsd) : undefined}
          />
          <Stat
            label={`Withdrawals · ${days}d`}
            value={stats ? `${stats.wdCount.toLocaleString("en-US")}` : null}
            sub={stats ? formatUsd(stats.wdUsd) : undefined}
          />
          <Stat
            label="Net flow"
            value={stats ? formatSignedUsd(stats.netUsd) : null}
            tone={
              stats ? (stats.netUsd >= 0 ? "pos" : "neg") : undefined
            }
          />
          <Stat
            label="Avg deposit size"
            value={stats ? formatUsd(stats.avgDep) : null}
            sub={stats ? `${stats.wallets.toLocaleString("en-US")} wallets` : undefined}
          />
        </div>
      </header>

      {err && (
        <div className="uni-hub-empty" style={{ color: "#b91c1c" }}>
          Could not load Supabase: {err}
        </div>
      )}

      {!loading && stats && (
        <>
          <DailyFlowChart
            events={windowed}
            days={days}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />
          <EventsFeed events={windowed} />
        </>
      )}

      {loading && !err && (
        <div className="uni-hub-empty">Loading deposit activity…</div>
      )}

      {!loading && !err && stats && windowed.length === 0 && (
        <div className="uni-hub-empty">
          No subgraph-indexed Base events yet. Run the &ldquo;Index Vault
          Events (Subgraph)&rdquo; action to populate amount_usd rows.
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | null;
  sub?: string;
  tone?: "pos" | "neg";
}) {
  const color =
    tone === "pos" ? "#15803d" : tone === "neg" ? "#b91c1c" : undefined;
  return (
    <div className="uni-hub-stat">
      <div className="uni-hub-stat-label">{label}</div>
      <div className="uni-hub-stat-value" style={color ? { color } : undefined}>
        {value ?? "—"}
      </div>
      {sub && <div className="uni-hub-stat-label">{sub}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Daily net-flow chart: one bar per day, deposits minus withdrawals in
// USD. Green above the baseline (net inflow), red below (net outflow).
// ──────────────────────────────────────────────────────────────────

function DailyFlowChart({
  events,
  days,
  timeframe,
  onTimeframeChange,
}: {
  events: EventRow[];
  days: number;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}) {
  const [hovered, setHovered] = useState<{
    net: number;
    dep: number;
    wd: number;
    daysAgo: number;
  } | null>(null);

  const { bins, maxAbs, totalNet } = useMemo(() => {
    const now = Date.now();
    const out = Array.from({ length: days }, (_, i) => ({
      dep: 0,
      wd: 0,
      net: 0,
      daysAgo: days - 1 - i,
    }));
    for (const e of events) {
      const daysAgo = Math.floor(
        (now - new Date(e.block_timestamp).getTime()) / DAY_MS,
      );
      if (daysAgo < 0 || daysAgo >= days) continue;
      const slot = out[days - 1 - daysAgo];
      const usd = e.amount_usd ?? 0;
      if (e.event_type === "deposit") slot.dep += usd;
      else if (e.event_type === "withdraw") slot.wd += usd;
    }
    let m = 1;
    let net = 0;
    for (const b of out) {
      b.net = b.dep - b.wd;
      net += b.net;
      m = Math.max(m, Math.abs(b.net));
    }
    return { bins: out, maxAbs: m, totalNet: net };
  }, [events, days]);

  return (
    <section className="uni-hub-section" style={{ marginTop: 0 }}>
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">
            Daily net flow, last {days} days
          </h2>
          <span className="uni-hub-section-meta">
            net {formatSignedUsd(totalNet)} over the window · green = inflow,
            red = outflow
          </span>
        </div>
        <TimeframeSelector value={timeframe} onChange={onTimeframeChange} />
      </header>
      <div className="aq-chart-card">
        <div
          className="aq-chart-bignum"
          style={{
            color: hovered
              ? hovered.net >= 0
                ? "#15803d"
                : "#b91c1c"
              : undefined,
          }}
        >
          {formatSignedUsd(hovered ? hovered.net : totalNet)}
        </div>
        <div className="aq-chart-bignum-label">
          {hovered
            ? `net flow ${labelForDaysAgo(hovered.daysAgo)} · ${formatUsd(
                hovered.dep,
              )} in / ${formatUsd(hovered.wd)} out`
            : `net deposit flow across the trailing ${days} days`}
        </div>
        <div className="aq-chart" style={{ height: 180 }}>
          <div
            className="aq-chart-bars"
            style={{ alignItems: "center", height: "100%" }}
          >
            {bins.map((b, i) => {
              const heightPct = Math.max(
                (Math.abs(b.net) / maxAbs) * 50,
                b.net !== 0 ? 2 : 0,
              );
              const up = b.net >= 0;
              return (
                <div
                  key={i}
                  className="aq-bar-col"
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                  title={`${formatSignedUsd(b.net)} (${labelForDaysAgo(b.daysAgo)})`}
                  onMouseEnter={() => setHovered(b)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    style={{
                      height: up ? `${heightPct}%` : 0,
                      alignSelf: "stretch",
                      background: "#15803d",
                      borderRadius: "2px 2px 0 0",
                      marginTop: "auto",
                    }}
                  />
                  <div
                    style={{
                      height: up ? 0 : `${heightPct}%`,
                      alignSelf: "stretch",
                      background: "#b91c1c",
                      borderRadius: "0 0 2px 2px",
                      marginBottom: "auto",
                    }}
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
// Events feed - real onchain deposit / withdraw legs, USD priced.
// ──────────────────────────────────────────────────────────────────

const EVENTS_COLS =
  "150px minmax(180px, 1.6fr) 110px 130px minmax(140px, 1fr) 70px";
const FEED_LIMIT = 250;

function EventsFeed({ events }: { events: EventRow[] }) {
  const display = useMemo(
    () =>
      [...events]
        .sort(
          (a, b) =>
            new Date(b.block_timestamp).getTime() -
            new Date(a.block_timestamp).getTime(),
        )
        .slice(0, FEED_LIMIT),
    [events],
  );

  return (
    <section className="uni-hub-section">
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">
            Deposit + withdraw events
          </h2>
          <span className="uni-hub-section-meta">
            most recent {Math.min(display.length, FEED_LIMIT)} of{" "}
            {events.length.toLocaleString("en-US")} in window · subgraph
            indexed, USD priced at transaction time
          </span>
        </div>
      </header>

      {display.length === 0 ? (
        <div className="uni-hub-empty">No events in this window.</div>
      ) : (
        <div className="hub-table-wrap aq-recent-wrap">
          <div className="hub-table aq-clicks-table aq-recent-table">
            <div
              className="hub-thead"
              style={{ gridTemplateColumns: EVENTS_COLS }}
            >
              <span className="hub-th">Time</span>
              <span className="hub-th">Vault</span>
              <span className="hub-th">Event</span>
              <span className="hub-th">Amount (USD)</span>
              <span className="hub-th">Wallet</span>
              <span className="hub-th">Tx</span>
            </div>
            {display.map((e) => (
              <div
                key={`${e.tx_hash}-${e.log_index}`}
                className="hub-row"
                style={{ gridTemplateColumns: EVENTS_COLS }}
              >
                <span className="hub-cell aq-cell-time">
                  {formatTime(e.block_timestamp)}
                </span>
                <span className="hub-cell aq-cell-vault">
                  {e.vault_slug ? (
                    <Link href={`/${e.vault_slug}`} className="aq-vault-link">
                      {e.vault_slug}
                    </Link>
                  ) : (
                    <span style={{ fontFamily: "var(--sans)", fontSize: 12.5 }}>
                      {shortenAddress(e.vault_address)}
                    </span>
                  )}
                </span>
                <span className="hub-cell">
                  <span
                    style={{
                      color:
                        e.event_type === "deposit" ? "#15803d" : "#b91c1c",
                      fontWeight: 600,
                    }}
                  >
                    {e.event_type}
                  </span>
                </span>
                <span className="hub-cell" style={{ fontWeight: 600 }}>
                  {e.amount_usd != null ? formatUsd(e.amount_usd) : "—"}
                </span>
                <span className="hub-cell">
                  <a
                    href={`https://debank.com/profile/${e.wallet_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aq-vault-link"
                    style={{ fontFamily: "var(--sans)", fontSize: 12.5 }}
                  >
                    {shortenAddress(e.wallet_address)}
                  </a>
                </span>
                <span className="hub-cell">
                  <a
                    href={`https://basescan.org/tx/${e.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aq-vault-link"
                  >
                    view
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

// ──────────────────────────────────────────────────────────────────
// formatting helpers
// ──────────────────────────────────────────────────────────────────

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function labelForDaysAgo(d: number): string {
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function formatSignedUsd(n: number): string {
  const sign = n < 0 ? "-" : "+";
  return `${sign}${formatUsd(Math.abs(n))}`;
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
