"use client";

// Client half of the Deposit Activity page. The server wrapper (page.tsx)
// loads vault metadata (address -> product name / asset / slug) and passes
// it in as vaultMeta; everything below fetches vault_events_prod live and
// renders the figures, chart and feed. See page.tsx for the data model.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseSelectAll } from "@/lib/supabase";
import { isMutedActor, detectRebalancerActors } from "@/lib/muted-actors";
import { AssetIcon } from "@/components/token-icons";
import {
  TimeframeSelector,
  resolveDays,
  type Timeframe,
} from "@/components/admin/timeframe-selector";
import "../../_styles/asset-hub.css";

export interface VaultMetaEntry {
  name: string;
  asset: string;
  slug: string;
}
export type VaultMeta = Record<string, VaultMetaEntry>;

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

const NETWORK_ORDER = [
  "Ethereum",
  "Base",
  "Arbitrum",
  "Polygon",
  "zkSync",
  "HyperEVM",
];

type TypeFilter = "all" | "deposit" | "withdraw";

export default function DepositActivityClient({
  vaultMeta,
}: {
  vaultMeta: VaultMeta;
}) {
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

  const networks = useMemo(() => {
    if (!realEvents) return [] as string[];
    const present = new Set(realEvents.map((e) => e.chain));
    return NETWORK_ORDER.filter((n) => present.has(n));
  }, [realEvents]);

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
        <section
          className="uni-hub-section"
          style={{ marginTop: 0, marginBottom: 4 }}
        >
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
          <EventsFeed
            events={windowed}
            scope={network === "all" ? "all networks" : network}
            vaultMeta={vaultMeta}
          />
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
// Daily net-flow chart (unchanged): deposits minus withdrawals per day.
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
// Events feed - real onchain deposit / withdraw legs, USD + token units.
// ──────────────────────────────────────────────────────────────────

const EVENTS_COLS =
  "104px minmax(170px, 1.5fr) 84px 104px 104px 116px minmax(132px, 1fr) 52px";
const FEED_LIMIT = 250;

function EventsFeed({
  events,
  scope,
  vaultMeta,
}: {
  events: EventRow[];
  scope: string;
  vaultMeta: VaultMeta;
}) {
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
              <span className="hub-th">Units</span>
              <span className="hub-th">Wallet</span>
              <span className="hub-th">Tx</span>
            </div>
            {display.map((e) => {
              const meta = vaultMeta[(e.vault_address || "").toLowerCase()];
              const units = unitsFor(e.amount_shares, meta?.asset);
              return (
                <div
                  key={`${e.tx_hash}-${e.log_index}`}
                  className="hub-row"
                  style={{ gridTemplateColumns: EVENTS_COLS }}
                >
                  <span className="hub-cell aq-cell-time">
                    {formatTime(e.block_timestamp)}
                  </span>
                  <span
                    className="hub-cell aq-cell-vault"
                    style={{ display: "flex", alignItems: "center", gap: 7 }}
                  >
                    {meta ? (
                      <AssetIcon asset={meta.asset} size={18} />
                    ) : null}
                    {meta ? (
                      <Link href={`/${meta.slug}`} className="aq-vault-link">
                        {meta.name}
                      </Link>
                    ) : (
                      <span style={{ fontFamily: "var(--sans)", fontSize: 12.5 }}>
                        {shortenAddress(e.vault_address)}
                      </span>
                    )}
                  </span>
                  <span className="hub-cell">{e.chain}</span>
                  <span className="hub-cell">
                    <span className={`lf-event lf-event-${e.event_type}`}>
                      <EventIcon type={e.event_type} />
                      {e.event_type}
                    </span>
                  </span>
                  <span className="hub-cell" style={{ fontWeight: 600 }}>
                    {formatUsdCell(e.amount_usd)}
                  </span>
                  <span
                    className="hub-cell"
                    style={{ fontFamily: "var(--sans)", fontSize: 12 }}
                  >
                    {units != null
                      ? `${formatUnits(units)}${meta?.asset ? " " + meta.asset : ""}`
                      : "—"}
                  </span>
                  <span
                    className="hub-cell"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span style={{ fontFamily: "var(--sans)", fontSize: 12.5 }}>
                      {shortenAddress(e.wallet_address)}
                    </span>
                    <DebankBadge address={e.wallet_address} />
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
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// Direction arrow, mirroring the Live Feed event badge (deposit in, withdraw
// out).
function EventIcon({ type }: { type: "deposit" | "withdraw" | "transfer" }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
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

// Small circular "D" linking to the wallet's DeBank profile.
function DebankBadge({ address }: { address: string }) {
  if (!address) return null;
  return (
    <a
      href={`https://debank.com/profile/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      title="View on DeBank"
      aria-label="View wallet on DeBank"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        borderRadius: "50%",
        border: "1px solid var(--uni-ink-3)",
        fontFamily: "var(--sans)",
        fontSize: 9.5,
        fontWeight: 700,
        lineHeight: 1,
        color: "var(--uni-ink-2)",
        textDecoration: "none",
        flexShrink: 0,
      }}
    >
      D
    </a>
  );
}

// ──────────────────────────────────────────────────────────────────
// formatting helpers
// ──────────────────────────────────────────────────────────────────

// Underlying-token decimals by asset. `value` from the subgraph is in the
// underlying token's smallest units, so we scale by these to show a human
// token amount. Harvest's assets all sit on standard decimals; unknown
// assets fall back to 18.
const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  USDT0: 6,
  EURC: 6,
  DAI: 18,
  ETH: 18,
  WETH: 18,
  BTC: 8,
  WBTC: 8,
  cbBTC: 8,
  tBTC: 18,
};

function unitsFor(amountShares: string, asset?: string): number | null {
  const dec = asset ? (TOKEN_DECIMALS[asset] ?? 18) : 18;
  const n = Number(amountShares) / 10 ** dec;
  return Number.isFinite(n) ? n : null;
}

function formatUnits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  if (n >= 1) return n.toFixed(3);
  if (n > 0) return n.toPrecision(2);
  return "0";
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
  if (n >= 1) return `$${n.toFixed(0)}`;
  if (n > 0) return `$${n.toFixed(2)}`;
  return "$0";
}

// Per-row USD: distinguish "no price" (null) from sub-cent dust (0) so the
// "why is USD missing" reads clearly in the feed.
function formatUsdCell(n: number | null): string {
  if (n == null) return "—";
  if (n === 0) return "<$0.01";
  return formatUsd(n);
}

function formatSignedUsd(n: number): string {
  const sign = n < 0 ? "-" : "+";
  return `${sign}${formatUsd(Math.abs(n))}`;
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

// Relative time for the first 24h ("just now", "5m ago", "3h ago"); older
// rows fall back to an absolute short date.
function formatTime(iso: string): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return iso;
  const diff = Date.now() - ms;
  if (diff < 0) return "now";
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
