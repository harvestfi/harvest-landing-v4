"use client";

// Wallet history client. Reads ?address=0x... from the URL and stitches a
// single chronological timeline of everything we know about that wallet:
//
//   - on-chain deposits / withdrawals      (vault_events_prod, subgraph)
//   - in-app wallet connections + balance  (wallet_connections_prod)
//   - front-end visits / app clicks        (frontpage_visits / outbound_clicks,
//                                            joined via the wallet's sessions)
//
// Rendered as a classic row table, newest first, with a summary header.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseSelectAll } from "@/lib/supabase";
import { AssetIcon, ChainIcon } from "@/components/token-icons";
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
  event_type: "deposit" | "withdraw" | "transfer";
  wallet_address: string;
  amount_usd: number | null;
  amount_token: number | null;
}
interface ConnRow {
  connected_at: string;
  session_id: string | null;
  balance: number | null;
  harvest_balance: number | null;
}
interface VisitRow {
  created_at: string;
  session_id: string | null;
  page_path: string | null;
  source: string | null;
}
interface ClickRow {
  created_at: string;
  session_id: string | null;
  vault_slug: string | null;
  source_page: string | null;
  target_url: string | null;
}

type Kind = "deposit" | "withdraw" | "connect" | "visit" | "click";
interface TimelineRow {
  id: string;
  ms: number;
  iso: string;
  kind: Kind;
  // event-only
  chain?: string;
  vaultAddr?: string;
  usd?: number | null;
  token?: number | null;
  txHref?: string;
  // visit/click/connect
  page?: string | null;
  vaultSlug?: string | null;
  targetUrl?: string | null;
  balance?: number | null;
  harvestBalance?: number | null;
}

export default function WalletHistoryClient({
  vaultMeta,
}: {
  vaultMeta: VaultMeta;
}) {
  const [address, setAddress] = useState<string | null>(null);
  const [data, setData] = useState<{
    events: EventRow[];
    conns: ConnRow[];
    visits: VisitRow[];
    clicks: ClickRow[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Read the wallet from the query string client-side (avoids the
  // useSearchParams Suspense requirement and works under static export).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const a = (p.get("address") || p.get("wallet") || "").trim().toLowerCase();
    setAddress(a || null);
  }, []);

  const load = useCallback(async (addr: string) => {
    setRefreshing(true);
    try {
      const [events, conns] = await Promise.all([
        supabaseSelectAll<EventRow>(
          "vault_events_prod",
          "select=chain,tx_hash,log_index,block_timestamp,vault_address," +
            "event_type,wallet_address,amount_usd,amount_token" +
            `&wallet_address=ilike.${addr}&amount_usd=not.is.null` +
            "&order=block_timestamp.desc",
        ),
        supabaseSelectAll<ConnRow>(
          "wallet_connections_prod",
          "select=connected_at,session_id,balance,harvest_balance" +
            `&wallet_address=ilike.${addr}&order=connected_at.desc`,
        ),
      ]);

      // Front-end journey: visits + clicks for the wallet's known sessions.
      const sessionIds = [
        ...new Set(conns.map((c) => c.session_id).filter(Boolean)),
      ] as string[];
      let visits: VisitRow[] = [];
      let clicks: ClickRow[] = [];
      if (sessionIds.length > 0) {
        const inList = `(${sessionIds.join(",")})`;
        [visits, clicks] = await Promise.all([
          supabaseSelectAll<VisitRow>(
            "frontpage_visits",
            "select=created_at,session_id,page_path,source" +
              `&session_id=in.${inList}&order=created_at.desc`,
          ),
          supabaseSelectAll<ClickRow>(
            "outbound_clicks",
            "select=created_at,session_id,vault_slug,source_page,target_url" +
              `&session_id=in.${inList}&order=created_at.desc`,
          ),
        ]);
      }
      setData({ events, conns, visits, clicks });
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (address) load(address);
  }, [address, load]);

  const rows = useMemo<TimelineRow[]>(() => {
    if (!data) return [];
    const out: TimelineRow[] = [];
    for (const e of data.events) {
      if (e.event_type !== "deposit" && e.event_type !== "withdraw") continue;
      const ms = new Date(e.block_timestamp).getTime();
      out.push({
        id: `e-${e.tx_hash}-${e.log_index}`,
        ms,
        iso: e.block_timestamp,
        kind: e.event_type,
        chain: e.chain,
        vaultAddr: e.vault_address,
        usd: e.amount_usd,
        token: e.amount_token,
        txHref: txLink(e.chain, e.tx_hash),
      });
    }
    for (const c of data.conns) {
      const ms = new Date(c.connected_at).getTime();
      out.push({
        id: `c-${c.session_id}-${c.connected_at}`,
        ms,
        iso: c.connected_at,
        kind: "connect",
        balance: c.balance,
        harvestBalance: c.harvest_balance,
      });
    }
    for (const v of data.visits) {
      const ms = new Date(v.created_at).getTime();
      out.push({
        id: `v-${v.session_id}-${v.created_at}`,
        ms,
        iso: v.created_at,
        kind: "visit",
        page: v.page_path,
      });
    }
    for (const k of data.clicks) {
      const ms = new Date(k.created_at).getTime();
      out.push({
        id: `k-${k.session_id}-${k.created_at}`,
        ms,
        iso: k.created_at,
        kind: "click",
        vaultSlug: k.vault_slug,
        page: k.source_page,
        targetUrl: k.target_url,
      });
    }
    out.sort((a, b) => b.ms - a.ms);
    return out;
  }, [data]);

  const summary = useMemo(() => {
    if (!data) return null;
    let dep = 0;
    let wd = 0;
    let depCount = 0;
    let wdCount = 0;
    for (const e of data.events) {
      const usd = e.amount_usd ?? 0;
      if (e.event_type === "deposit") {
        dep += usd;
        depCount++;
      } else if (e.event_type === "withdraw") {
        wd += usd;
        wdCount++;
      }
    }
    const firstMs = rows.length ? rows[rows.length - 1].ms : null;
    // latest connection holds the most recent balance snapshot
    const harvestBalance = data.conns.find(
      (c) => typeof c.harvest_balance === "number",
    )?.harvest_balance;
    return {
      dep,
      wd,
      net: dep - wd,
      depCount,
      wdCount,
      harvestBalance: harvestBalance ?? null,
      sessions: new Set(data.conns.map((c) => c.session_id).filter(Boolean))
        .size,
      firstMs,
    };
  }, [data, rows]);

  if (!address) {
    return (
      <div className="uni-hub-test">
        <header className="uni-hub-hero">
          <h1 className="uni-hub-h1">Wallet history</h1>
          <p className="uni-hub-sub">
            No wallet selected. Open this page from a wallet link in the
            Deposit Activity feed, or append{" "}
            <code>?address=0x…</code> to the URL.
          </p>
        </header>
      </div>
    );
  }

  const loading = data === null;

  return (
    <div className="uni-hub-test">
      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <div>
            <h1 className="uni-hub-h1" style={{ wordBreak: "break-all" }}>
              {shortenAddress(address)}
            </h1>
            <p className="uni-hub-sub">
              Everything this wallet did with Harvest, newest first: on-chain
              deposits and withdrawals (subgraph), in-app wallet connections,
              and the front-end visits / app clicks tied to its sessions.
              <br />
              <span
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: 12,
                  wordBreak: "break-all",
                }}
              >
                {address}
              </span>{" "}
              <a
                href={`https://debank.com/profile/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="aq-vault-link"
              >
                DeBank ↗
              </a>
            </p>
          </div>
        </div>

        <div
          className="uni-hub-stats"
          role="group"
          aria-label="Wallet summary"
          style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
        >
          <Stat
            label="Harvest balance"
            value={
              summary && summary.harvestBalance != null
                ? formatUsd(summary.harvestBalance)
                : "—"
            }
          />
          <Stat
            label="Deposited"
            value={summary ? formatUsd(summary.dep) : null}
            sub={summary ? `${summary.depCount} txns` : undefined}
          />
          <Stat
            label="Withdrawn"
            value={summary ? formatUsd(summary.wd) : null}
            sub={summary ? `${summary.wdCount} txns` : undefined}
          />
          <Stat
            label="Net flow"
            value={summary ? formatSignedUsd(summary.net) : null}
            tone={summary ? (summary.net >= 0 ? "pos" : "neg") : undefined}
            sub={
              summary && summary.firstMs
                ? `since ${formatDate(summary.firstMs)}`
                : undefined
            }
          />
        </div>
      </header>

      <section className="uni-hub-section" style={{ marginTop: 0 }}>
        <header className="uni-hub-section-head">
          <div className="aq-section-head-left">
            <h2 className="uni-hub-section-title">Interaction timeline</h2>
            <span className="uni-hub-section-meta">
              {rows.length.toLocaleString("en-US")} events ·{" "}
              {summary?.sessions ?? 0} tracked session
              {summary?.sessions === 1 ? "" : "s"}
            </span>
          </div>
          <button
            type="button"
            className="lf-refresh"
            onClick={() => address && load(address)}
            disabled={refreshing}
          >
            <RefreshIcon spinning={refreshing} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {err && (
          <div className="uni-hub-empty" style={{ color: "#b91c1c" }}>
            Could not load Supabase: {err}
          </div>
        )}
        {loading && !err && (
          <div className="uni-hub-empty">Loading wallet history…</div>
        )}
        {!loading && !err && rows.length === 0 && (
          <div className="uni-hub-empty">
            No tracked interactions for this wallet.
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="hub-table-wrap aq-recent-wrap">
            <div className="hub-table aq-clicks-table aq-recent-table">
              <div className="hub-thead" style={{ gridTemplateColumns: COLS }}>
                <span className="hub-th">Time</span>
                <span className="hub-th">Type</span>
                <span className="hub-th">Detail</span>
                <span className="hub-th">Chain</span>
                <span className="hub-th">Amount (USD)</span>
                <span className="hub-th">Units</span>
                <span className="hub-th">Tx</span>
              </div>
              {rows.map((r) => {
                const meta = r.vaultAddr
                  ? vaultMeta[r.vaultAddr.toLowerCase()]
                  : undefined;
                return (
                  <div
                    key={r.id}
                    className="hub-row"
                    style={{ gridTemplateColumns: COLS }}
                  >
                    <span className="hub-cell aq-cell-time">
                      {formatTime(r.iso)}
                    </span>
                    <span className="hub-cell">
                      <TypeBadge kind={r.kind} />
                    </span>
                    <span
                      className="hub-cell aq-cell-vault"
                      style={{ display: "flex", alignItems: "center", gap: 7 }}
                    >
                      <DetailCell row={r} meta={meta} />
                    </span>
                    <span
                      className="hub-cell"
                      title={r.chain}
                      style={{ display: "flex", alignItems: "center" }}
                    >
                      {r.chain ? <ChainIcon chain={r.chain} size={17} /> : "—"}
                    </span>
                    <span className="hub-cell" style={{ fontWeight: 600 }}>
                      {r.kind === "deposit" || r.kind === "withdraw"
                        ? formatUsdCell(r.usd ?? null)
                        : r.kind === "connect" && r.harvestBalance != null
                          ? formatUsd(r.harvestBalance)
                          : "—"}
                    </span>
                    <span
                      className="hub-cell"
                      style={{ fontFamily: "var(--sans)", fontSize: 12 }}
                    >
                      {r.token != null
                        ? `${formatUnits(r.token)}${meta?.asset ? " " + meta.asset : ""}`
                        : "—"}
                    </span>
                    <span className="hub-cell">
                      {r.txHref ? (
                        <a
                          href={r.txHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aq-vault-link"
                        >
                          view
                        </a>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

const COLS =
  "104px 108px minmax(180px, 1.6fr) 52px 104px 116px 52px";

function DetailCell({
  row,
  meta,
}: {
  row: TimelineRow;
  meta?: VaultMetaEntry;
}) {
  if (row.kind === "deposit" || row.kind === "withdraw") {
    return (
      <>
        {meta ? <AssetIcon asset={meta.asset} size={18} /> : null}
        {meta ? (
          <Link href={`/${meta.slug}`} className="aq-vault-link">
            {meta.name}
          </Link>
        ) : (
          <span style={{ fontFamily: "var(--sans)", fontSize: 12.5 }}>
            {shortenAddress(row.vaultAddr || "")}
          </span>
        )}
      </>
    );
  }
  if (row.kind === "connect") {
    return (
      <span style={{ fontSize: 12.5 }}>
        Wallet connected
        {row.balance != null && row.balance > 0
          ? ` · wallet ${formatUsd(row.balance)}`
          : ""}
      </span>
    );
  }
  if (row.kind === "click") {
    const target = row.vaultSlug
      ? `/${row.vaultSlug}`
      : row.targetUrl || row.page || "app";
    return row.vaultSlug ? (
      <Link href={`/${row.vaultSlug}`} className="aq-vault-link">
        → {row.vaultSlug}
      </Link>
    ) : (
      <span style={{ fontSize: 12.5 }}>→ {hostOf(target)}</span>
    );
  }
  // visit
  return (
    <Link href={row.page || "/"} className="aq-vault-link">
      {row.page || "/"}
    </Link>
  );
}

function TypeBadge({ kind }: { kind: Kind }) {
  if (kind === "deposit" || kind === "withdraw") {
    return (
      <span className={`lf-event lf-event-${kind}`}>
        <EventIcon type={kind} />
        {kind}
      </span>
    );
  }
  if (kind === "click") {
    return <span className="lf-event lf-event-click">app click</span>;
  }
  if (kind === "connect") {
    return (
      <span
        className="lf-event"
        style={{
          background: "rgba(255, 185, 54, 0.18)",
          color: "#946208",
        }}
      >
        connect
      </span>
    );
  }
  return <span className="lf-event lf-event-visit">visit</span>;
}

function EventIcon({ type }: { type: "deposit" | "withdraw" }) {
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

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`lf-refresh-icon${spinning ? " spinning" : ""}`}
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
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
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
// helpers
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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatUnits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  if (n >= 1) return n.toFixed(3);
  if (n > 0) return n.toPrecision(2);
  return "0";
}

function formatUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  if (n >= 1) return `$${n.toFixed(0)}`;
  if (n > 0) return `$${n.toFixed(2)}`;
  return "$0";
}

function formatUsdCell(n: number | null): string {
  if (n == null) return "—";
  if (n === 0) return "<$0.01";
  return formatUsd(n);
}

function formatSignedUsd(n: number): string {
  const sign = n < 0 ? "-" : "+";
  return `${sign}${formatUsd(Math.abs(n))}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
