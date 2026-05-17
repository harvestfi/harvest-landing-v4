"use client";

// Acquisition funnel - step 04: Deposits (TVL).
// Network-wide Harvest TVL aggregated from per-vault history. The
// daily series is precomputed at build time by
// scripts/build-network-tvl.mjs into src/data/network-tvl-daily.json
// so the client doesn't have to parse the 300 KB raw history.json.
//
// V1 scope: total TVL chart + summary tiles. Cohort attribution
// (visits -> clicks -> connects -> depositors) is the next pass and
// will sit below the chart once wallet_session_links is populated
// on the app side.

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
  harvest_balance: number | null;
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

// Cap a single vault's reported balance at this number when rolling
// up the wallet snapshot - mirrors the outlier cap on the User
// Networth page so corrupted Debank readings don't dominate the
// tiles here either.
const WALLET_OUTLIER_CAP = 100_000_000;

export default function DepositsPage() {
  const [wallets, setWallets] = useState<WalletRow[] | null>(null);
  const [walletErr, setWalletErr] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await supabaseSelectAll<WalletRow>(
          "wallet_connections_prod",
          "select=wallet_address,harvest_balance",
        );
        if (!cancelled) setWallets(data);
      } catch (e) {
        if (!cancelled) setWalletErr(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const walletStats = useMemo(() => {
    if (!wallets) return null;
    let activeDepositors = 0;
    let trackedBalance = 0;
    for (const w of wallets) {
      const b = typeof w.harvest_balance === "number" ? w.harvest_balance : 0;
      if (b > 0 && b < WALLET_OUTLIER_CAP) {
        activeDepositors++;
        trackedBalance += b;
      }
    }
    return { activeDepositors, trackedBalance };
  }, [wallets]);

  const latestTvl = TVL.series[TVL.series.length - 1]?.tvl ?? 0;
  const avgPosition =
    walletStats && walletStats.activeDepositors > 0
      ? walletStats.trackedBalance / walletStats.activeDepositors
      : null;

  return (
    <>
      <section className="aq-step-header">
        <h2 className="aq-step-title">Deposits (TVL)</h2>
        <p className="aq-step-sub">
          Network-wide Harvest TVL aggregated across the {TVL.vaults} vaults
          we index. The terminal step of the funnel: anonymous visit
          converted into a real onchain position. Cohort attribution
          (visits to depositors) lands in the next pass.
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

      {walletErr && (
        <div className="uni-hub-empty" style={{ color: "#b91c1c" }}>
          Could not load wallet snapshot: {walletErr}
        </div>
      )}

      <ChartSection
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
      />
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

function ChartSection({
  timeframe,
  onTimeframeChange,
}: {
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}) {
  const oldestMs = useMemo(() => {
    const first = TVL.series[0]?.date;
    if (!first) return null;
    return new Date(first + "T00:00:00Z").getTime();
  }, []);
  const days = resolveDays(timeframe, oldestMs);

  const { bins, max, latest, peak } = useMemo(() => {
    // The precomputed series ends on the build day. Walk backwards
    // from the last entry so "today" lines up with the freshest bar.
    const tail = TVL.series.slice(-days);
    const out = tail.map((p) => ({ date: p.date, tvl: p.tvl }));
    const m = Math.max(1, ...out.map((b) => b.tvl));
    return {
      bins: out,
      max: m,
      latest: out[out.length - 1]?.tvl ?? 0,
      peak: m,
    };
  }, [days]);

  return (
    <section className="uni-hub-section" style={{ marginTop: 0 }}>
      <header className="uni-hub-section-head">
        <div className="aq-section-head-left">
          <h2 className="uni-hub-section-title">
            Network TVL — last {days} days
          </h2>
          <span className="uni-hub-section-meta">
            today {formatUsd(latest)} · peak {formatUsd(peak)}
          </span>
        </div>
        <TimeframeSelector value={timeframe} onChange={onTimeframeChange} />
      </header>
      <div className="aq-chart-card">
        <div className="aq-chart-bignum">{formatUsd(latest)}</div>
        <div className="aq-chart-bignum-label">
          current Harvest TVL across {TVL.vaults} indexed vaults
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

function formatUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}
