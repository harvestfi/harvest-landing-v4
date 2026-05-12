"use client";

// Studio: build product-card images at multiple social-media ratios
// (Twitter 16:9, Instagram 1:1 and 4:5, Stories 9:16, Twitter banner
// 3:1) using the same yellow + dotted hero treatment as the homepage.
//
// Three layouts pick the composition:
//   - hero     : big metric + product name + optional sparkline
//   - trend    : chart-focused; sparkline dominates the card
//   - compare  : 2-3 vaults stacked in a leaderboard
//
// The card renders at its full export resolution; a ResizeObserver
// scales the stage to fit the preview pane without re-layout. PNG
// export uses html-to-image to capture the card at full pixel size
// regardless of the on-screen scale.

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
type Corner = "tl" | "tr" | "bl" | "br" | "none";
type LayoutId = "hero" | "trend" | "compare";

type Ratio = {
  id: string;
  w: number;
  h: number;
  label: string;
};

const RATIOS: Ratio[] = [
  { id: "16x9", w: 1600, h: 900, label: "Twitter post (16:9)" },
  { id: "1x1", w: 1080, h: 1080, label: "Instagram square (1:1)" },
  { id: "4x5", w: 1080, h: 1350, label: "Instagram portrait (4:5)" },
  { id: "9x16", w: 1080, h: 1920, label: "Stories / Reels (9:16)" },
  { id: "3x1", w: 1500, h: 500, label: "Twitter banner (3:1)" },
];

const LAYOUTS: { id: LayoutId; label: string }[] = [
  { id: "hero", label: "Hero" },
  { id: "trend", label: "Trend" },
  { id: "compare", label: "Compare" },
];

const MAX_COMPARE = 3;

export function StudioClient({ vaults }: { vaults: StudioVault[] }) {
  const [ratioId, setRatioId] = useState<string>(RATIOS[0].id);
  const [layoutId, setLayoutId] = useState<LayoutId>("hero");
  const [slug, setSlug] = useState(vaults[0]?.slug ?? "");
  const [compareSlugs, setCompareSlugs] = useState<string[]>(
    vaults.slice(0, 3).map((v) => v.slug),
  );
  const [metric, setMetric] = useState<Metric>("apy24h");
  const [corner, setCorner] = useState<Corner>("br");
  const [showSpark, setShowSpark] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const ratio = RATIOS.find((r) => r.id === ratioId) ?? RATIOS[0];
  const vault = vaults.find((v) => v.slug === slug) ?? vaults[0];
  const compareVaults = compareSlugs
    .map((s) => vaults.find((v) => v.slug === s))
    .filter((v): v is StudioVault => Boolean(v));

  // Auto-scale the card to fit the preview pane width while keeping
  // its full pixel dimensions for export. Using a ResizeObserver
  // instead of CSS calc(cqw/Xpx) so older browser builds stay safe.
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
        // Override the on-screen scale during capture so html-to-image
        // serializes the card at full export resolution.
        style: {
          transform: "none",
          width: `${ratio.w}px`,
          height: `${ratio.h}px`,
        },
      });
      const link = document.createElement("a");
      const subject =
        layoutId === "compare"
          ? `compare-${compareVaults.map((v) => v.slug).join("-")}`
          : (vault?.slug ?? "card");
      link.download = `harvest-${subject}-${layoutId}-${ratio.id}.png`;
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

  function toggleCompareSlug(s: string) {
    setCompareSlugs((cur) => {
      if (cur.includes(s)) return cur.filter((x) => x !== s);
      if (cur.length >= MAX_COMPARE) return [...cur.slice(1), s];
      return [...cur, s];
    });
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
          <span className="studio-label">Layout</span>
          <div className="studio-segment" role="group">
            {LAYOUTS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`studio-segment-btn${layoutId === l.id ? " active" : ""}`}
                onClick={() => setLayoutId(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {layoutId === "compare" ? (
          <div className="studio-field">
            <span className="studio-label">
              Vaults ({compareVaults.length} of {MAX_COMPARE})
            </span>
            <div className="studio-vault-list">
              {vaults.slice(0, 60).map((v) => {
                const checked = compareSlugs.includes(v.slug);
                return (
                  <label
                    key={v.slug}
                    className={`studio-vault-item${checked ? " active" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCompareSlug(v.slug)}
                    />
                    <span className="studio-vault-item-name">{v.productName}</span>
                    <span className="studio-vault-item-meta">
                      {v.chain} - {formatAPY(v.apy24h)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : (
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
        )}

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

        {layoutId !== "trend" ? (
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
        ) : null}

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
            <span className="studio-meta-val">
              {ratio.w} x {ratio.h}
            </span>
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
        <div
          className="studio-stage"
          style={{ transform: `scale(${scale})` }}
        >
          <StudioCard
            ref={cardRef}
            ratio={ratio}
            layoutId={layoutId}
            corner={corner}
            vault={vault}
            compareVaults={compareVaults}
            metric={metric}
            showSpark={showSpark}
          />
        </div>
      </section>
    </div>
  );
}

// React 19 lets us take `ref` as a regular prop without forwardRef.
function StudioCard({
  ref,
  ratio,
  layoutId,
  corner,
  vault,
  compareVaults,
  metric,
  showSpark,
}: {
  ref: React.Ref<HTMLDivElement>;
  ratio: Ratio;
  layoutId: LayoutId;
  corner: Corner;
  vault: StudioVault;
  compareVaults: StudioVault[];
  metric: Metric;
  showSpark: boolean;
}) {
  return (
    <article
      ref={ref}
      className={`studio-card studio-card--${ratio.id} studio-card--${layoutId}`}
      style={
        {
          width: ratio.w,
          height: ratio.h,
          ["--card-w" as string]: `${ratio.w}px`,
          ["--card-h" as string]: `${ratio.h}px`,
        } as React.CSSProperties
      }
    >
      {layoutId === "hero" ? (
        <HeroBody vault={vault} metric={metric} showSpark={showSpark} />
      ) : layoutId === "trend" ? (
        <TrendBody vault={vault} metric={metric} />
      ) : (
        <CompareBody vaults={compareVaults} metric={metric} />
      )}

      {corner !== "none" ? (
        <span className={`studio-card-mark studio-card-mark-${corner}`}>
          <span className="studio-card-mark-name">Harvest</span>
          <span className="studio-card-mark-dot" aria-hidden="true" />
        </span>
      ) : null}
    </article>
  );
}

function HeroBody({
  vault,
  metric,
  showSpark,
}: {
  vault: StudioVault;
  metric: Metric;
  showSpark: boolean;
}) {
  const headline = headlineFor(vault, metric);
  const sparkPath = useSparkPath(vault, metric);

  return (
    <>
      <header className="studio-card-meta">
        <span className="studio-card-meta-chip">
          <ChainIcon chain={vault.chain} size={32} />
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

      <div className="studio-card-id">
        <span className="studio-card-asset">
          <AssetIcon asset={vault.asset} size={88} />
        </span>
        <h2 className="studio-card-name">{vault.productName}</h2>
      </div>

      <div className="studio-card-figure">
        <span className="studio-card-value">{headline.value}</span>
        <span className="studio-card-label">{headline.label}</span>
      </div>

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
    </>
  );
}

function TrendBody({ vault, metric }: { vault: StudioVault; metric: Metric }) {
  const headline = headlineFor(vault, metric);
  const sparkPath = useSparkPath(vault, metric);
  const series = metric === "tvl" ? vault.tvlSpark : vault.apySpark;
  const trendUp = series.length > 1 && series[series.length - 1] >= series[0];

  return (
    <>
      <header className="studio-trend-head">
        <span className="studio-trend-head-id">
          <AssetIcon asset={vault.asset} size={56} />
          <span className="studio-trend-head-name">{vault.productName}</span>
        </span>
        <span className="studio-trend-head-meta">
          <ChainIcon chain={vault.chain} size={24} />
          <span>{vault.chain}</span>
          <span aria-hidden="true">·</span>
          <span>{vault.protocol}</span>
        </span>
      </header>

      <div className="studio-trend-chart">
        {sparkPath ? (
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
              strokeWidth="0.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <span className="studio-trend-empty">
            No history available yet.
          </span>
        )}
      </div>

      <footer className="studio-trend-foot">
        <span className="studio-trend-foot-value">{headline.value}</span>
        <span className="studio-trend-foot-label">
          {headline.label}
          {sparkPath ? (
            <span
              className={`studio-trend-arrow${trendUp ? " up" : " down"}`}
              aria-hidden="true"
            >
              {trendUp ? "▲" : "▼"}
            </span>
          ) : null}
        </span>
      </footer>
    </>
  );
}

function CompareBody({
  vaults,
  metric,
}: {
  vaults: StudioVault[];
  metric: Metric;
}) {
  const headlineLabel =
    metric === "tvl"
      ? "Total value locked"
      : metric === "apy30d"
        ? "30d APY"
        : "24h APY";

  return (
    <>
      <header className="studio-compare-head">
        <h2 className="studio-compare-title">Top yields</h2>
        <span className="studio-compare-sub">Ranked by {headlineLabel}</span>
      </header>

      <ol className="studio-compare-list">
        {vaults.map((v, i) => {
          const headline = headlineFor(v, metric);
          return (
            <li key={v.slug} className="studio-compare-row">
              <span className="studio-compare-rank">#{i + 1}</span>
              <span className="studio-compare-asset">
                <AssetIcon asset={v.asset} size={56} />
              </span>
              <span className="studio-compare-id">
                <span className="studio-compare-name">{v.productName}</span>
                <span className="studio-compare-chain">
                  <ChainIcon chain={v.chain} size={20} />
                  <span>{v.chain}</span>
                  <span aria-hidden="true">·</span>
                  <span>{v.protocol}</span>
                </span>
              </span>
              <span className="studio-compare-value">{headline.value}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function useSparkPath(vault: StudioVault, metric: Metric): string {
  return useMemo(() => {
    const series = metric === "tvl" ? vault.tvlSpark : vault.apySpark;
    return buildSparklinePath(series);
  }, [vault, metric]);
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
