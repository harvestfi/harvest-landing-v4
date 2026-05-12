"use client";

// Studio: compose social-media product cards. Outer canvas keeps
// the homepage hero treatment (yellow base, warm radial glow, dense
// ink dots); the centerpiece is the same product-preview card we
// render on the homepage hero, populated with real vault data.
//
// The card itself renders at the chosen export resolution; a
// ResizeObserver scales the preview stage to fit the column without
// re-layout. html-to-image captures the card at full pixel size for
// PNG export regardless of the on-screen scale.

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
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
type Corner = "tl" | "bl" | "br" | "none";

type Ratio = { id: string; w: number; h: number; label: string };

const RATIOS: Ratio[] = [
  { id: "16x9", w: 1600, h: 900, label: "Twitter post (16:9)" },
  { id: "1x1", w: 1080, h: 1080, label: "Instagram square (1:1)" },
  { id: "4x5", w: 1080, h: 1350, label: "Instagram portrait (4:5)" },
  { id: "9x16", w: 1080, h: 1920, label: "Stories / Reels (9:16)" },
  { id: "3x1", w: 1500, h: 500, label: "Twitter banner (3:1)" },
];

export function StudioClient({ vaults }: { vaults: StudioVault[] }) {
  const [ratioId, setRatioId] = useState<string>(RATIOS[0].id);
  const [slug, setSlug] = useState(vaults[0]?.slug ?? "");
  const [metric, setMetric] = useState<Metric>("apy24h");
  const [corner, setCorner] = useState<Corner>("br");
  const [downloading, setDownloading] = useState(false);

  const ratio = RATIOS.find((r) => r.id === ratioId) ?? RATIOS[0];
  const vault = vaults.find((v) => v.slug === slug) ?? vaults[0];

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!wrapRef.current) return;
    const node = wrapRef.current;
    const obs = new ResizeObserver(() => {
      const wrapW = node.clientWidth;
      if (wrapW > 0) setScale(wrapW / ratio.w);
    });
    obs.observe(node);
    return () => obs.disconnect();
  }, [ratio.w]);

  if (!vault) {
    return <p className="adm-sub">No vault data available.</p>;
  }

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        width: ratio.w,
        height: ratio.h,
        pixelRatio: 1,
        cacheBust: true,
        style: {
          transform: "none",
          width: `${ratio.w}px`,
          height: `${ratio.h}px`,
        },
      });
      const link = document.createElement("a");
      link.download = `harvest-${vault?.slug ?? "card"}-${ratio.id}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Studio export failed", err);
      alert("PNG export failed - see console.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="studio">
      <aside className="studio-controls">
        <div className="studio-field">
          <span className="studio-label">Ratio</span>
          <div className="studio-segment" role="group">
            {RATIOS.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`studio-segment-btn${ratioId === r.id ? " active" : ""}`}
                onClick={() => setRatioId(r.id)}
                title={r.label}
              >
                {r.id.replace("x", ":")}
              </button>
            ))}
          </div>
        </div>

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
                {v.productName} - {v.chain} - {formatAPY(v.apy24h)} APY
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
          <span className="studio-label">Harvest logo on card</span>
          <div className="studio-corners">
            {(
              [
                ["tl", "Top L"],
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
          <p className="studio-hint">
            Top right is reserved for the gold View pill that
            anchors the card to the product page on harvest.fi.
          </p>
        </div>

        <button
          type="button"
          className="studio-download"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? "Exporting..." : "Download PNG"}
        </button>

        <div className="studio-meta">
          <div className="studio-meta-row">
            <span>Output</span>
            <span className="studio-meta-val">{ratio.w} x {ratio.h}</span>
          </div>
          <div className="studio-meta-row">
            <span>Aspect</span>
            <span className="studio-meta-val">{ratio.label}</span>
          </div>
        </div>
      </aside>

      <section
        className="studio-preview-wrap"
        ref={wrapRef}
        style={{ aspectRatio: `${ratio.w} / ${ratio.h}` }}
      >
        <div className="studio-stage" style={{ transform: `scale(${scale})` }}>
          <StudioCard
            ref={cardRef}
            ratio={ratio}
            vault={vault}
            metric={metric}
            corner={corner}
          />
        </div>
      </section>
    </div>
  );
}

function StudioCard({
  ref,
  ratio,
  vault,
  metric,
  corner,
}: {
  ref: React.Ref<HTMLDivElement>;
  ratio: Ratio;
  vault: StudioVault;
  metric: Metric;
  corner: Corner;
}) {
  return (
    <article
      ref={ref}
      className={`studio-card studio-card--${ratio.id}`}
      style={
        {
          width: ratio.w,
          height: ratio.h,
          ["--card-w" as string]: `${ratio.w}px`,
          ["--card-h" as string]: `${ratio.h}px`,
        } as React.CSSProperties
      }
    >
      <ProductCard vault={vault} metric={metric} corner={corner} />
    </article>
  );
}

function ProductCard({
  vault,
  metric,
  corner,
}: {
  vault: StudioVault;
  metric: Metric;
  corner: Corner;
}) {
  const headline = useMemo(() => headlineFor(vault, metric), [vault, metric]);
  const series = useMemo(
    () => (metric === "tvl" ? vault.tvlSpark : vault.apySpark),
    [vault, metric],
  );
  // Bars: same 24-bar grid as the homepage hero preview. Pad short
  // series with the first value so the visual density is consistent
  // across vaults regardless of how many real records we have.
  const bars = useMemo(() => normalizeBars(series, 24), [series]);
  const activeTabId: "tvl" | "apy" | "sharePrice" =
    metric === "tvl" ? "tvl" : "apy";

  return (
    <div className="studio-prevcard">
      {/* Top-right View pill: visual anchor back to the product page,
          same gold-on-ink chip as the homepage hero preview. */}
      <span className="studio-prevcard-cta">
        View
        <span className="studio-prevcard-cta-arrow" aria-hidden="true">↗</span>
      </span>

      <header className="studio-prevcard-head">
        <span className="studio-prevcard-icon">
          <AssetIcon asset={vault.asset} size={44} />
        </span>
        <div className="studio-prevcard-id">
          <h3 className="studio-prevcard-name">{vault.productName}</h3>
          <p className="studio-prevcard-byline">
            <span className="studio-prevcard-byline-chain">
              <ChainIcon chain={vault.chain} size={13} />
              {vault.chain}
            </span>
            <span aria-hidden="true">·</span>
            <span>{vault.protocol}</span>
            {vault.vaultType ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{vault.vaultType}</span>
              </>
            ) : null}
          </p>
        </div>
      </header>

      <div className="studio-prevcard-bignum">
        <span className="studio-prevcard-bignum-value">{headline.value}</span>
        <span className="studio-prevcard-bignum-label">{headline.label}</span>
      </div>

      <div className="studio-prevcard-ranges" aria-label="Range">
        {(["1M", "3M", "1Y", "ALL"] as const).map((r) => (
          <span
            key={r}
            className={`studio-prevcard-range${r === "1M" ? " active" : ""}`}
          >
            {r}
          </span>
        ))}
      </div>

      <div className="studio-prevcard-chart">
        <div className="studio-prevcard-bars">
          {bars.map((h, i) => (
            <span
              key={i}
              className="studio-prevcard-bar"
              style={{ height: `${Math.max(4, h)}%` }}
            />
          ))}
        </div>
      </div>

      <div className="studio-prevcard-foot">
        <div className="studio-prevcard-tabs" aria-label="Metric">
          {(
            [
              ["tvl", "TVL"],
              ["apy", "APY"],
              ["sharePrice", "Share price"],
            ] as [string, string][]
          ).map(([id, label]) => (
            <span
              key={id}
              className={`studio-prevcard-tab${id === activeTabId ? " active" : ""}`}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="studio-prevcard-style" aria-label="Chart style">
          <span className="studio-prevcard-style-btn active" aria-label="Bars">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="7" width="2" height="5" rx="0.5" fill="currentColor" />
              <rect x="6" y="4" width="2" height="8" rx="0.5" fill="currentColor" />
              <rect x="10" y="6" width="2" height="6" rx="0.5" fill="currentColor" />
            </svg>
          </span>
          <span className="studio-prevcard-style-btn" aria-label="Line">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 10 5 6 8 8 12 3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="studio-prevcard-style-btn" aria-label="Step">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 10 5 10 5 6 8 6 8 8 12 8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>

      {corner !== "none" ? (
        <span className={`studio-prevcard-mark studio-prevcard-mark-${corner}`}>
          <span className="studio-prevcard-mark-name">Harvest</span>
          <span className="studio-prevcard-mark-dot" aria-hidden="true" />
        </span>
      ) : null}
    </div>
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

function normalizeBars(values: number[], target: number): number[] {
  if (!values || values.length === 0) {
    return Array.from({ length: target }, () => 12);
  }
  let sampled: number[];
  if (values.length >= target) {
    const step = (values.length - 1) / (target - 1);
    sampled = Array.from(
      { length: target },
      (_, i) => values[Math.round(i * step)],
    );
  } else {
    sampled = [
      ...Array.from({ length: target - values.length }, () => values[0]),
      ...values,
    ];
  }
  const max = Math.max(...sampled);
  const min = Math.min(...sampled);
  const span = max - min;
  if (span === 0) return sampled.map(() => 60);
  return sampled.map((v) => ((v - min) / span) * 100);
}
