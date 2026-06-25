"use client";

// Control room > Deposit Activity.
//
// A USD-denominated deposit / withdraw feed across every network we index,
// sourced from the Harvest subgraph (userTransactions) rather than the
// public-RPC indexer. The subgraph indexer
// (scripts/index-vault-events-subgraph.mjs) writes a USD value per leg into
// vault_events_prod.amount_usd, so this page reads ONLY rows that carry a
// USD value:
//
//   amount_usd IS NOT NULL
//
// That predicate cleanly isolates subgraph-sourced rows from the RPC
// indexer's rows (which leave amount_usd null), so the two sources never
// double-count here even while both run.
//
// Covers both autocompounders (vault legs) and autopilots (plasmaVault
// legs) - the subgraph entity carries both. Internal allocator / rebalancer
// wallets are filtered out so the figures reflect real users. The Network
// and Type controls filter the headline figures, chart and feed together.

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
  chain: string;
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

// Canonical network order for the filter chips; only those actually present
// in the data are shown.
const NETWORK_ORDER = [
  "Ethereum",
  "Base",
  "Arbitrum",
  "Polygon",
  "zkSync",
  "HyperEVM",
];

type TypeFilter = "all" | "deposit" | "withdraw";

export default function DepositActivityPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("90d");
  const [network, setNetwork] = useState<string>("all");
  const [type, setType] = useState<TypeFilter>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await supabaseSelectAll<EventRow>(
          "vault_events_prod",
          "select=chain,tx_hash,log_index,block_timestamp,vault_address," +
            "vault_slug,event_type,wallet_address,amount_shares,amount_usd" +
            "&amount_usd=not.is.null" +
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
  // don't inflate depositor counts or flow. Deduped by (tx_hash, log_index)
  // to absorb the ~60s resume overlap on indexer re-runs.
  const rebalancers = useMemo(
    () => (events ? detectRebalancerActors(events) : new Set<string>()),
    [events],
  );
  const realEvents = useMemo(() => {
    if (!events) return null;
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

  // Networks actually present, in canonical order, for the filter chips.
  const networks = useMemo(() => {
    if (!realEvents) return [] as string[];
    const present = new Set(realEvents.map((e) => e.chain));
    return NETWORK_ORDER.filter((n) => present.has(n));
  }, [realEvents]);

  // Apply the Network + Type filters before any rollups so the stats, chart
  // and feed all reflect the same selection.
  const filtered = useMemo(() => {
    if (!realEvents) return null;
    return realEvents.filter(
      (e) =>
        (network === "all" || e.chain === network) &&
        (type === "all" || e.event_type === type),
    );
  }, [realEvents, network, type]);

  const oldestMs = useMemo(() => {
    if (!filtered || filtered.length === 0) return null;
    let oldest = Infinity;
    for (const e of filtered) {
      const t = new Date(e.block_timestamp).getTime();
      if (t < oldest) oldest = t;
    }
    return Number.isFinite(oldest) ? oldest : null;
  }, [filtered]);
  const days = resolveDays(timeframe, oldestMs);

  // Window to the selected timeframe, then roll up the headline figures and
  // the daily net-flow series in a single pass.
  const { windowed, stats } = useMemo(() => {
    if (!filtered) {
      return { windowed: [] as EventRow[], stats: null };
    }
    const cutoff = Date.now() - days * DAY_MS;
    const win = filtered.filter(
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
  }, [filtered, days]);

  const loading = events === null;
  const scope = network === "all" ? "all networks" : network;

  return (
    <div className="uni-hub-test">
      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <div>
            <h1 className="uni-hub-h1">Deposit Activity</h1>
            <p className="uni-hub-sub">
              USD-denominated deposit and withdraw flow across every network
              we index, pulled directly from the Harvest subgraph (one
              pre-decoded row per transaction, covering both autocompounders
              and autopilots). Internal allocator wallets are filtered out, so
              these are real user flows. Use the Network and Type controls to
              filter the figures, chart and feed.
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
            value={stats ? `${stats.depCount.toLocaleString("en-US")}` : null}
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
            tone={stats ? (stats.netUsd >= 0 ? "pos" : "neg") : undefined}
          />
          <Stat
            label="Avg deposit size"
            value={stats ? formatUsd(stats.avgDep) : null}
            sub={
              stats
                ? `${stats.wallets.toLocaleString("en-US")} wallets`
                : undefined
            }
          />
        </div>
      </header>

      {!loading && stats && (
        <section className="uni-hub-section" style={{ marginTop: 0, marginBottom: 4 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 28,
              alignItems: "center",
            }}
          >
            <FilterGroup label="Network">
              <SegSelector
                ariaLabel="Network filter"
                value={network}
                onChange={setNetwork}
                options={[
                  { value: "all", label: "All" },
                  ...networks.map((n) => ({ value: n, label: n })),
                ]}
              />
            </FilterGroup>
            <FilterGroup label="Type">
              <SegSelector
                ariaLabel="Event type filter"
                value={type}
                onChange={(v) => setType(v as TypeFilter)}
                options={[
                  { value: "all", label: "All" },
                  { value: "deposit", label: "Deposits" },
                  { value: "withdraw", label: "Withdrawals" },
                ]}
              />
            </FilterGroup>
          </div>
        </section>
      )}

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
          <EventsFeed events={windowed} scope={scope} />
        </>
      )}

      {loading && !err && (
        <div className="uni-hub-empty">Loading deposit activity…</div>
      )}

      {!loading && !err && stats && windowed.length === 0 && (
        <div className="uni-hub-empty">
          No subgraph-indexed events for this selection. Run the &ldquo;Index
          Vault Events (Subgraph)&rdquo; action to populate amount_usd rows.
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span className="uni-hub-stat-label">{label}</span>
      {children}
    </div>
  );
}

// Generic segmented chip selector, same flagship treatment as the timeframe
// picker (gold pill on the active segment).
function SegSelector({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="aq-timeframe" role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`aq-timeframe-tab${value === opt.value ? " active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
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
  "140px minmax(170px, 1.5fr) 92px 96px 120px minmax(130px, 1fr) 60px";
const FEED_LIMIT = 250;

function EventsFeed({ events, scope }: { events: EventRow[]; scope: string }) {
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
          <h2 className="uni-hub-section-title">Deposit + withdraw events</h2>
          <span className="uni-hub-section-meta">
            {scope} · most recent {Math.min(display.length, FEED_LIMIT)} of{" "}
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
            <div className="hub-thead" style={{ gridTemplateColumns: EVENTS_COLS }}>
              <span className="hub-th">Time</span>
              <span className="hub-th">Vault</span>
              <span className="hub-th">Chain</span>
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
                <span className="hub-cell">{e.chain}</span>
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
                    href={txLink(e.chain, e.tx_hash)}
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
