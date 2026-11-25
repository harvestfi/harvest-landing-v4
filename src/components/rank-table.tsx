"use client";

// The main ranking table on the asset hubs, after the data-table pattern: a
// framed card with a toolbar (title, search), sortable headers, a product cell
// with an icon tile, a TVL bar, a liquidity status and one action per row,
// which is the row itself. Plain CSS (asset-editorial.css, asset-ld.css), no
// motion library: sorting reorders, search filters, nothing else moves.
import { useMemo, useState } from "react";
import Link from "next/link";
import { AssetIcon, ChainIcon } from "@/components/token-icons";
import type { EdRow } from "@/lib/editorial-hub";

type SortKey = "apy" | "apy30" | "tvl" | "name";
type Dir = "asc" | "desc";

const fmtApy = (v: number | null) => (v == null || !Number.isFinite(v) ? "–" : `${v.toFixed(2)}%`);
const fmtTvl = (v: number) =>
  v >= 1e9
    ? `$${(v / 1e9).toFixed(1)}B`
    : v >= 1e6
      ? `$${(v / 1e6).toFixed(1)}M`
      : v >= 1e3
        ? `$${Math.round(v / 1e3)}K`
        : v >= 1
          ? `$${Math.round(v)}`
          : "<$1";

function Chevron({ dir, active }: { dir: Dir; active: boolean }) {
  return (
    <svg
      className="rk-sort-ico"
      data-active={active ? "true" : "false"}
      data-dir={dir}
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

export function RankTable({
  rows,
  title,
  floorLabel,
  appUrl,
  cta = { label: "Explore all in the app" },
  note = true,
  tvl = true,
  icon,
  labels,
}: {
  /** Column headings, for tables that rank something other than live APY
   *  (e.g. the USDC Yield Report's realized 90d / 30d). Defaults are the hubs'. */
  labels?: { name?: string; apy?: string; apy30?: string };
  rows: EdRow[];
  title: string;
  /** "$50K": the liquidity floor, named in the status column. */
  floorLabel: string;
  /** The app, filtered to this asset. */
  appUrl: string;
  /** The toolbar button; null hides it (rankings of third-party venues). */
  cta?: { label: string } | null;
  /** The low-TVL note under the table; off where TVL is not the vault's own. */
  note?: boolean;
  /** The TVL column. Off on a top ranking that has a full ranking (with TVL
   *  and its note) further down the page. */
  tvl?: boolean;
  /** The hub's mark before the title: an asset, a network, or both. */
  icon?: { asset?: string; chain?: string; assets?: string[] };
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir }>({ key: "apy", dir: "desc" });
  const topId = rows[0]?.slug;

  const shown = useMemo(() => {
    const list = rows;
    const val = (r: EdRow) =>
      sort.key === "apy" ? r.apy : sort.key === "apy30" ? r.apy30 : sort.key === "tvl" ? r.tvl : r.name;
    return [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
      return sort.dir === "asc" ? c : -c;
    });
  }, [rows, sort]);

  const head = (key: SortKey, label: string, cls = "") => {
    const active = sort.key === key;
    return (
      <th
        scope="col"
        className={cls}
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          className="rk-sort"
          data-active={active ? "true" : "false"}
          onClick={() =>
            setSort((s) =>
              s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "name" ? "asc" : "desc" },
            )
          }
        >
          <span>{label}</span>
          <Chevron dir={active ? sort.dir : "desc"} active={active} />
        </button>
      </th>
    );
  };

  return (
    <div className="rk">
      <div className="rk-bar">
        <p className="rk-title">
          {icon ? (
            <span className="rk-title-ico" aria-hidden="true">
              {icon.assets
                ? icon.assets.map((a) => <AssetIcon key={a} asset={a} size={18} decorative />)
                : icon.chain
                  ? <ChainIcon chain={icon.chain} size={18} decorative />
                  : icon.asset
                    ? <AssetIcon asset={icon.asset} size={18} decorative />
                    : null}
            </span>
          ) : null}
          <span>{title}</span>
        </p>
        {cta ? (
        <a className="rk-cta" href={appUrl} target="_blank" rel="noopener noreferrer">
          {cta.label}
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 11 11 5M6 5h5v5" />
          </svg>
        </a>
        ) : null}
      </div>
      <div className="rk-scroll">
        <table className="rk-table">
          <thead>
            <tr>
              {head("name", labels?.name ?? "Strategy", "rk-c-name")}
              {head("apy", labels?.apy ?? "24h APY", "rk-num rk-c-apy")}
              {head("apy30", labels?.apy30 ?? "30d avg", "rk-num rk-c-30")}
              {tvl ? head("tvl", "TVL", "rk-num rk-c-tvl") : null}
              <th scope="col" className="rk-c-go" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={r.slug}
                className={r.slug === topId ? "rk-row is-top" : "rk-row"}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("a,button,input")) return;
                  // Same navigation as the name link, so Next handles it.
                  e.currentTarget.querySelector<HTMLAnchorElement>("a.rk-name")?.click();
                }}
              >
                <th scope="row" className="rk-c-name">
                  <span className="rk-prod">
                    <span className="rk-tile" aria-hidden="true">
                      <AssetIcon asset={r.token} size={20} decorative />
                      <span className="rk-tile-chain">
                        <ChainIcon chain={r.chain} size={11} decorative />
                      </span>
                    </span>
                    <span className="rk-prod-txt">
                      {r.href && /^https?:/.test(r.href) ? (
                        <a href={r.href} className="rk-name" title={r.name} target="_blank" rel="noopener noreferrer">
                          {r.name}
                        </a>
                      ) : (
                        <Link href={r.href ?? `/${r.slug}`} className="rk-name" title={r.name}>
                          {r.name}
                        </Link>
                      )}
                      <span className="rk-sub">{`${r.chain} · ${r.venue}`}</span>
                    </span>
                  </span>
                </th>
                <td className="rk-num rk-c-apy">
                  <strong>{fmtApy(r.apy)}</strong>
                </td>
                <td className="rk-num rk-c-30">{fmtApy(r.apy30)}</td>
                {tvl ? (
                <td className="rk-num rk-c-tvl">
                  <span className="rk-tvl">
                    <span
                      className="rk-tvl-v"
                      title={r.thin ? `Under ${floorLabel} behind this rate` : undefined}
                    >{fmtTvl(r.tvl)}</span>
                  </span>
                </td>
                ) : null}
                {/* A small arrow: the whole row is a link. */}
                <td className="rk-c-go" aria-hidden="true">
                  <svg className="rk-go" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 4 4 4-4 4" />
                  </svg>
                </td>
              </tr>
            ))}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={tvl ? 5 : 4} className="rk-empty">
                  No strategy matches that search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {/* Low TVL reads as "unusable" to most readers, and for an autocompounder
          it does not mean that: the vault lends into a liquid market and the
          TVL counts only what sits in the vault itself. */}
      {note && tvl ? (
      <p className="rk-note">
        <strong>About low TVL.</strong>{" "}
        Most strategies in this ranking are autocompounders built
        on liquid lending venues such as Aave, Morpho and Fluid. The TVL column counts only what
        sits in the vault itself at that moment, not the liquidity of the market underneath, so a
        vault showing a low TVL can still be fully usable: it earns the market&rsquo;s rate and
        pays withdrawals from the market&rsquo;s liquidity.
      </p>
      ) : null}
    </div>
  );
}
