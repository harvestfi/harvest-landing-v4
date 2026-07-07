import type { HolderGrowth } from "@/lib/data";

// "Holder growth": a unique, freshness-carrying content block built from the
// subgraph userBalances timeseries (see scripts/fetch-holder-growth.mjs) -
// how many wallets have held the vault since launch, how many earn today, and
// the cumulative curve. Gated so near-empty pass-through vaults (autopilot
// liquidity channels with a handful of internal holders) never surface a thin
// or embarrassing count: we only render when the vault has a real holder base
// AND real TVL. Pure server component - static in the export.
//
// Rendered copy deliberately avoids the "deposit / depositor" word family:
// product-page prose bans it (see scripts/check-banned-words.mjs), so the
// editorial voice here is "wallets / holders / held". Internal data field
// names (totalDepositors, currentDepositors) keep their subgraph-derived
// naming since they never reach the page text.

const MIN_CURRENT_DEPOSITORS = 25;
const MIN_TVL_USD = 10_000;

function monthYear(iso: string | null): string {
  if (!iso) return "launch";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "launch";
  return d.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function DepositorGrowth({
  growth,
  vault,
}: {
  growth: HolderGrowth | null;
  vault: { productName: string; tvl: number };
}) {
  // Gate: skip liquidity-channel / near-empty vaults entirely.
  if (
    !growth ||
    growth.currentDepositors < MIN_CURRENT_DEPOSITORS ||
    vault.tvl < MIN_TVL_USD
  ) {
    return null;
  }

  const { totalDepositors, currentDepositors, new30d, curve, launchDate } =
    growth;
  const since = monthYear(launchDate);

  const sentence =
    `${totalDepositors.toLocaleString("en-US")} wallets have held ${vault.productName} since ${since}. ` +
    `${currentDepositors.toLocaleString("en-US")} are earning today` +
    (new30d > 0
      ? `, with ${new30d.toLocaleString("en-US")} joining in the last 30 days.`
      : ".");

  // Cumulative sparkline (area + line) over the monthly curve.
  const max = Math.max(1, ...curve.map((p) => p.c));
  const n = curve.length;
  const pts = curve.map((p, i) => ({
    x: n > 1 ? (i / (n - 1)) * 100 : 0,
    y: 28 - (p.c / max) * 26,
  }));
  const line = pts
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L100 28 L0 28 Z`;
  const green = "#15803d";

  return (
    <section className="pp-section" id="holders">
      <h2>Holder growth</h2>
      <p style={{ maxWidth: "62ch" }}>{sentence}</p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          margin: "14px 0 6px",
        }}
      >
        {[
          {
            label: `Holders since ${launchDate ? monthYear(launchDate) : "launch"}`,
            value: totalDepositors.toLocaleString("en-US"),
          },
          {
            label: "Earning today",
            value: currentDepositors.toLocaleString("en-US"),
          },
          {
            label: "New in last 30 days",
            value: (new30d > 0 ? "+" : "") + new30d.toLocaleString("en-US"),
          },
        ].map((s) => (
          <div key={s.label}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                fontFamily: "var(--mono, monospace)",
                color: "var(--uni-ink, inherit)",
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--uni-ink-3, #6e6c66)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {n >= 2 && (
        <svg
          viewBox="0 0 100 28"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Cumulative holders for ${vault.productName} from ${since} to today`}
          style={{
            width: "100%",
            height: 120,
            display: "block",
            marginTop: 10,
          }}
        >
          <path d={area} fill={green} fillOpacity={0.12} />
          <path
            d={line}
            fill="none"
            stroke={green}
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      <p
        style={{
          fontSize: 11.5,
          color: "var(--uni-ink-3, #6e6c66)",
          marginTop: 8,
        }}
      >
        Wallet counts are derived from on-chain vault-token balances; internal
        allocator wallets are excluded. Cumulative holders are counted from
        each wallet&rsquo;s first on-chain balance.
      </p>
    </section>
  );
}
