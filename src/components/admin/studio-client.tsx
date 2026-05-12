"use client";

// Studio: compose social-media product cards by literally reusing
// the homepage hero treatment. The outer canvas is .uni-home-hero
// (yellow base + warm radial glow + ink dots) sized to the chosen
// ratio; the centerpiece is the live HomeHeroPreview card from
// the homepage, populated with the chosen vault's real data via
// its `vault` prop. No reimplementation - everything reuses the
// existing CSS from _styles/home.css.

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { HomeHeroPreview } from "@/components/home-hero-preview";
import { formatAPY } from "@/lib/format";

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

type Ratio = { id: string; w: number; h: number; label: string };

const RATIOS: Ratio[] = [
  { id: "1x1", w: 1080, h: 1080, label: "Instagram square (1:1)" },
  { id: "16x9", w: 1600, h: 900, label: "Twitter post (16:9)" },
  { id: "4x5", w: 1080, h: 1350, label: "Instagram portrait (4:5)" },
  { id: "9x16", w: 1080, h: 1920, label: "Stories / Reels (9:16)" },
  { id: "3x1", w: 1500, h: 500, label: "Twitter banner (3:1)" },
];

export function StudioClient({ vaults }: { vaults: StudioVault[] }) {
  const [ratioId, setRatioId] = useState<string>(RATIOS[0].id);
  const [slug, setSlug] = useState(vaults[0]?.slug ?? "");
  // Optional manual overrides for the headline value + label. Empty
  // string falls back to the vault-derived default; anything else
  // displays verbatim. Lets us hand-craft the figure that fronts the
  // social card (e.g. round to "5%" instead of the raw "4.80%").
  const [valueOverride, setValueOverride] = useState("");
  const [labelOverride, setLabelOverride] = useState("");
  // Studio overrides for the last + second-to-last bar heights on
  // the chart, in the 0..100 normalized space. Empty string =
  // leave the bar at its auto-derived height.
  const [lastBarOverride, setLastBarOverride] = useState("");
  const [secondLastBarOverride, setSecondLastBarOverride] = useState("");
  // When true, the "APY" tab in the footer reads as "Perf." instead.
  const [usePerfLabel, setUsePerfLabel] = useState(false);
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
          <label className="studio-label" htmlFor="studio-value">
            Headline value
          </label>
          <input
            id="studio-value"
            type="text"
            className="studio-input"
            placeholder={defaultHeadlineValue(vault)}
            value={valueOverride}
            onChange={(e) => setValueOverride(e.target.value)}
          />
        </div>

        <div className="studio-field">
          <label className="studio-label" htmlFor="studio-label">
            Headline label
          </label>
          <input
            id="studio-label"
            type="text"
            className="studio-input"
            placeholder="24h APY"
            value={labelOverride}
            onChange={(e) => setLabelOverride(e.target.value)}
          />
          <p className="studio-hint">
            Leave both empty to use the vault&apos;s current values.
            Anything you type shows up verbatim in the card.
          </p>
        </div>

        <div className="studio-field">
          <span className="studio-label">Trailing bar heights (0-100)</span>
          <div className="studio-bar-pair">
            <input
              id="studio-secondlastbar"
              type="number"
              min={0}
              max={100}
              step={1}
              className="studio-input"
              placeholder="2nd-last"
              value={secondLastBarOverride}
              onChange={(e) => setSecondLastBarOverride(e.target.value)}
            />
            <input
              id="studio-lastbar"
              type="number"
              min={0}
              max={100}
              step={1}
              className="studio-input"
              placeholder="last"
              value={lastBarOverride}
              onChange={(e) => setLastBarOverride(e.target.value)}
            />
          </div>
          <p className="studio-hint">
            Pin the rightmost two bars to specific heights (% of
            the chart area). Empty = auto height from the data.
          </p>
        </div>

        <div className="studio-field">
          <label className="studio-check">
            <input
              type="checkbox"
              checked={usePerfLabel}
              onChange={(e) => setUsePerfLabel(e.target.checked)}
            />
            <span>Use &ldquo;Perf.&rdquo; instead of &ldquo;APY&rdquo; tab</span>
          </label>
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
          <p className="studio-hint">
            The preview card is the live homepage hero preview wired
            to real vault data. Metric tabs and chart style toggles
            stay clickable so you can pose the snapshot before
            exporting.
          </p>
        </div>
      </aside>

      <section
        className="studio-preview-wrap"
        ref={wrapRef}
        style={{ aspectRatio: `${ratio.w} / ${ratio.h}` }}
      >
        <div className="studio-stage" style={{ transform: `scale(${scale})` }}>
          <article
            ref={cardRef}
            className={`studio-card studio-card--${ratio.id}`}
            style={{
              width: ratio.w,
              height: ratio.h,
            }}
          >
            {/* .uni-home-test only wraps the inner preview so the
                .uni-home-test .prevcard-* selectors from home.css
                resolve. The class is NOT on the article because
                .uni-home-test sets background: transparent and a
                fixed max-width that would nuke the studio canvas. */}
            <div className="studio-card-inner uni-home-test">
              <HomeHeroPreview
                vault={vaultForCard(vault)}
                variant="studio"
                headlineValueOverride={valueOverride}
                headlineLabelOverride={labelOverride}
                lastBarHeightOverride={
                  lastBarOverride.trim() === ""
                    ? undefined
                    : Number(lastBarOverride)
                }
                secondLastBarHeightOverride={
                  secondLastBarOverride.trim() === ""
                    ? undefined
                    : Number(secondLastBarOverride)
                }
                apyTabLabel={usePerfLabel ? "Perf." : undefined}
              />
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

// Match HomeHeroPreview's "apy" branch: vault.apy24h formatted as
// e.g. "4.80%". Shown as the placeholder in the override input so
// the user can see what they'd be overriding.
function defaultHeadlineValue(vault: StudioVault | undefined): string {
  if (!vault) return "";
  return formatAPY(vault.apy24h);
}

// Tweak the vault data shown on the studio card. The protocol
// field carries "Harvest Finance" from the upstream API, but the
// studio card byline reads cleaner as just "Harvest" - shorter
// and matches the wordmark in the topbar. Other fields untouched.
function vaultForCard(v: StudioVault): StudioVault {
  return {
    ...v,
    protocol: v.protocol === "Harvest Finance" ? "Harvest" : v.protocol,
  };
}
