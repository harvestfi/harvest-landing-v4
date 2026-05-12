"use client";

// Studio: build product-card images at the classic Twitter 16:9
// aspect ratio (1600 x 900) using the same yellow + dotted hero
// treatment as the homepage. The card itself renders at its full
// export resolution inside a scaled wrapper, so a screenshot of the
// preview area gives a pixel-perfect 1600x900 PNG without any
// extra export library. Right-click "save image" on the card also
// works because the card is plain DOM.

import { useState } from "react";
import { AssetIcon, ChainIcon } from "@/components/token-icons";
import { formatAPY, formatTVL } from "@/lib/format";

export type StudioVault = {
  slug: string;
  productName: string;
  asset: string;
  chain: string;
  protocol: string;
  vaultType: string;
  category: string;
  apy24h: number;
  apy30d: number;
  tvl: number;
  apySpark: number[];
  tvlSpark: number[];
};

type Metric = "apy24h" | "apy30d" | "tvl";
type Corner = "tl" | "tr" | "bl" | "br" | "none";

const CARD_W = 1600;
const CARD_H = 900;

export function StudioClient({ vaults }: { vaults: StudioVault[] }) {
  const [slug, setSlug] = useState(vaults[0]?.slug ?? "");
  const [metric, setMetric] = useState<Metric>("apy24h");
  const [corner, setCorner] = useState<Corner>("br");
  const [showSpark, setShowSpark] = useState(true);

  const vault = vaults.find((v) => v.slug === slug) ?? vaults[0];

  if (!vault) {
    return <p className="adm-sub">No vault data available.</p>;
  }

  return (
    <div className="studio">
      <aside className="studio-controls">
        <div className="studio-field">
          <label className="studio-label" htmlFor="studio-vault">Vault</label>
          <select
            id="studio-vault"
            className="studio-select"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          >
            {vaults.map((v) => (
              <option key={v.slug} value={v.slug}>
                {v.productName} - {v.chain} - {formatAPY(v.apy24h)} APY - {formatTVL(v.tvl)}
              </option>
            ))}
          </select>
        </div>

        <div className="studio-field">
          <span className="studio-label">Headline metric</span>
          <div className="studio-segment" role="group">
            {(
              [
                ["apy24h", "24h APY"],
                ["apy30d", "30d APY"],
                ["tvl", "TVL"],
              ] as [Metric, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`studio-segment-btn${metric === k ? " active" : ""}`}
                onClick={() => setMetric(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="studio-field">
          <span className="studio-label">Harvest logo</span>
          <div className="studio-corners">
            {(
              [
                ["tl", "Top L"],
                ["tr", "Top R"],
                ["bl", "Bot L"],
                ["br", "Bot R"],
                ["none", "Off"],
              ] as [Corner, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`studio-segment-btn${corner === k ? " active" : ""}`}
                onClick={() => setCorner(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="studio-field">
          <label className="studio-check">
            <input
              type="checkbox"
              checked={showSpark}
              onChange={(e) => setShowSpark(e.target.checked)}
            />
            <span>Show sparkline</span>
          </label>
        </div>

        <div className="studio-meta">
          <div className="studio-meta-row">
            <span>Output size</span>
            <span className="studio-meta-val">1600 x 900</span>
          </div>
          <div className="studio-meta-row">
            <span>Aspect</span>
            <span className="studio-meta-val">16:9 (Twitter / X)</span>
          </div>
          <p className="studio-tip">
            Right-click the preview to save as image, or screenshot
            the card region. The preview renders at full export size
            and is only scaled visually.
          </p>
        </div>
      </aside>

      <section className="studio-preview-wrap">
        <div className="studio-stage">
          <StudioCard
            vault={vault}
            metric={metric}
            corner={corner}
            showSpark={showSpark}
          />
        </div>
      </section>
    </div>
  );
}

function StudioCard({
  vault,
  metric,
  corner,
  showSpark,
}: {
  vault: StudioVault;
  metric: Metric;
  corner: Corner;
  showSpark: boolean;
}) {
  const headline = headlineFor(vault, metric);
  const series = metric === "tvl" ? vault.tvlSpark : vault.apySpark;
  const sparkPath = buildSparklinePath(series);

  return (
    <article
      className="studio-card"
      style={{ width: CARD_W, height: CARD_H }}
    >
      {/* Top-left meta row: chain + protocol + vault type */}
      <header className="studio-card-meta">
        <span className="studio-card-meta-chip">
          <ChainIcon chain={vault.chain} size={28} />
          <span>{vault.chain}</span>
        </span>
        <span className="studio-card-meta-sep" aria-hidden="true">·</span>
        <span>{vault.protocol}</span>
        {vault.vaultType ? (
          <>
            <span className="studio-card-meta-sep" aria-hidden="true">·</span>
            <span>{vault.vaultType}</span>
          </>
        ) : null}
      </header>

      {/* Asset + product name */}
      <div className="studio-card-id">
        <span className="studio-card-asset">
          <AssetIcon asset={vault.asset} size={88} />
        </span>
        <h2 className="studio-card-name">{vault.productName}</h2>
      </div>

      {/* Headline number */}
      <div className="studio-card-figure">
        <span className="studio-card-value">{headline.value}</span>
        <span className="studio-card-label">{headline.label}</span>
      </div>

      {/* Sparkline */}
      {showSpark && sparkPath ? (
        <div className="studio-card-spark">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            width="100%"
            height="100%"
          >
            <path
              d={sparkPath}
              fill="none"
              stroke="#191717"
              strokeWidth="0.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      ) : null}

      {/* Harvest wordmark in chosen corner */}
      {corner !== "none" ? (
        <span className={`studio-card-mark studio-card-mark-${corner}`}>
          <span className="studio-card-mark-name">Harvest</span>
          <span className="studio-card-mark-dot" aria-hidden="true" />
        </span>
      ) : null}
    </article>
  );
}

function headlineFor(
  v: StudioVault,
  m: Metric,
): { value: string; label: string } {
  switch (m) {
    case "apy24h":
      return { value: formatAPY(v.apy24h), label: "24h APY" };
    case "apy30d":
      return { value: formatAPY(v.apy30d), label: "30d APY" };
    case "tvl":
      return { value: formatTVL(v.tvl), label: "Total value locked" };
  }
}

function buildSparklinePath(values: number[]): string {
  if (!values || values.length < 2) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - ((v - min) / span) * 100;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}
