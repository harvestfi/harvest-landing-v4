// USDC Yield Report (draft).
//
// Long-form research page on the /usdc hub layout: same shell classes
// (uni-hub-test uh-page ae ld usdc-ld), same DocsRails "On this page" rail and
// app promo, same section shape (rp-eyebrow + h2 + uh-lead), so type scale,
// measure and margins match /usdc exactly. Only the tables, the risk cards and
// the chart are new (usdc-yield-report.css).
//
// Every figure renders from data/usdc-yield-report.json, which is merged from
// the per-venue research files (seoairesearch/usdc-yield-report/data) plus an
// editorial curation layer that assigns each vault a tier:
//   core         TVL at or above the floor: the main ranking
//   smaller      under the floor, no utilization flag
//   utilization  rate driven by high utilization or a niche borrower market;
//                shown in its own section with withdrawal-risk framing
import type { Metadata } from "next";
import { SharePriceChart } from "@/components/share-price-chart";
import { LeaveGuard } from "@/components/leave-guard";
import { REPORT_PATH } from "@/lib/usdc-yield-report";
import { articleSchema, breadcrumbSchema, reportDatasetSchema } from "@/lib/jsonld";
import { VaultContracts } from "@/components/vault-contracts";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { AssetIcon, ChainIcon } from "@/components/token-icons";
import { RankTable } from "@/components/rank-table";
import type { EdRow } from "@/lib/editorial-hub";
import { HomeCrumb } from "@/components/home-crumb";
import { DocsRails } from "@/components/editorial-hub";
import "../../_styles/asset-hub.css";
import "../../_styles/usdc-hub.css";
import "../../_styles/asset-editorial.css";
import "../../_styles/asset-ld.css";
import "../../_styles/usdc-yield-report.css";

const URL = `${SITE_URL}${REPORT_PATH}`;
const APP_URL = "https://app.harvest.finance/?search=usdc&asset=singlestakes";

type Apy = { d7?: number; d30?: number; d90?: number };
type Vault = {
  name: string;
  venue: string;
  chain: string;
  curator?: string;
  address: string;
  tvl_usd_now?: number;
  realized_apy: Apy;
  /** Same, with a one-off share-price jump removed (not recurring yield). */
  realized_apy_ex_step?: Apy;
  rolling7d?: { min?: number; median?: number; max?: number };
  merkl?: { had_rewards_in_period?: boolean };
  merkl_tokens: string[];
  merkl_in_share_price: boolean;
  /** Highest-APR reward campaign that overlapped the period. */
  merkl_peak?: { apr: number; start: string; end: string; token?: string };
  rewardEligibility?: string;
  tier: "core" | "smaller" | "utilization" | "credit";
  /** Credit vaults: what the vault is, and how withdrawals work. */
  structure?: string;
  exit?: string;
  exitShort?: string;
  utilRange?: string;
  rateSource?: string;
  withdrawal?: string;
  note?: string;
  series: [string, number][];
};
type Report = {
  period: { start: string; end: string; days: number };
  asOf: string;
  asOfIso: string;
  venues: string[];
  chains: string[];
  tvlFloorUsd: number;
  vaults: Vault[];
};

function loadReport(): Report {
  const p = path.join(process.cwd(), "data", "usdc-yield-report.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** "2026-11-23" -> "November 2026". UTC so the month never shifts by timezone. */
const monthLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

/** Realized APY the report uses: excludes one-off jumps where the research flagged them. */
const real = (x: Vault, k: keyof Apy) => x.realized_apy_ex_step?.[k] ?? x.realized_apy[k];
/** What the venue shows a depositor. Harvest shows a 30-day average beside the live rate; use that, it is the figure comparable to realized 30d. */

const pct = (x?: number) => (x == null ? "–" : `${x.toFixed(2)}%`);
const usd = (x?: number) =>
  x == null ? "–" : x >= 1e9 ? `$${(x / 1e9).toFixed(2)}B` : x >= 1e6 ? `$${(x / 1e6).toFixed(1)}M` : `$${Math.round(x / 1e3)}K`;
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : NaN;
};
// A monthly report ranks by the month: realized 30d first, 90d as context.
const by30 = (a: Vault, b: Vault) => (real(b, "d30") ?? -1) - (real(a, "d30") ?? -1);

const TOC: [string, string][] = [
  ["summary", "Summary"],
  ["ranking", "Ranking, $10M+ vaults"],
  ["smaller-vaults", "Smaller vaults"],
  ["utilization-risk", "Utilization risk"],
  ["credit-vaults", "Credit vaults"],
  ["rewards", "Rewards on top"],
  ["by-platform", "By platform"],
  ["share-price", "Share price history"],
  ["faq", "Questions"],
  ["methodology", "Methodology"],
  ["definitions", "Definitions"],
  ["limitations", "Disclosure"],
  ["addresses", "Contract addresses"],
];

export async function generateMetadata(): Promise<Metadata> {
  const r = loadReport();
  // Headline leads with the month: the report is a dated edition, and the
  // month is what people search for ("usdc yield november 2026").
  const title = `USDC Yield Report - ${monthLabel(r.asOfIso)} Ranking | Harvest Finance`;
  const description =
    `Realized USDC yield on ${r.vaults.length} vaults across ${r.venues.map((x) => x.replace(/ v\d$/, "")).join(", ")}, measured from on-chain share ` +
    `prices over the last 30 days, with the Merkl rewards paid on top listed separately.`;
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, url: URL, siteName: SITE_NAME, type: "article" },
    alternates: {
      canonical: URL,
      // The same report for machines: Markdown text and the full dataset.
      types: { "text/markdown": `${URL}.md`, "application/json": `${URL}.json` },
    },
  };
}

function Block({
  id,
  eyebrow,
  title,
  lead,
  asOf,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  /** One short paragraph, or several: no paragraph should run past three lines. */
  lead?: string | string[];
  asOf?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="uh-block" aria-labelledby={id}>
      <p className="rp-eyebrow" data-dateline={asOf ? "" : undefined}>
        {eyebrow}
        {asOf && (
          <>
            <span className="uh-eyebrow-sep" aria-hidden="true"> · </span>
            <span className="uh-eyebrow-date">{asOf}</span>
          </>
        )}
      </p>
      <h2 id={id}>{title}</h2>
      {(Array.isArray(lead) ? lead : lead ? [lead] : []).map((t) => (
        <p className="uh-lead" key={t}>
          {t}
        </p>
      ))}
      {children}
    </section>
  );
}

const EXPLORER: Record<string, string> = {
  Ethereum: "https://etherscan.io/address/",
  Base: "https://basescan.org/address/",
  Arbitrum: "https://arbiscan.io/address/",
  Monad: "https://monadscan.com/address/",
};
const explorer = (v: Vault) => (EXPLORER[v.chain] ?? EXPLORER.Ethereum) + v.address;

/** The vault's own page on its platform's app: where a row click goes. */
const AAVE_USDC: Record<string, string> = {
  Ethereum: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  Base: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  Arbitrum: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
};
const aaveMarket = (v: Vault) =>
  /horizon/i.test(v.name) ? "proto_horizon_v3"
  : /prime/i.test(v.name) ? "proto_lido_v3"
  : v.chain === "Base" ? "proto_base_v3"
  : v.chain === "Arbitrum" ? "proto_arbitrum_v3"
  : "proto_mainnet_v3";
const product = (v: Vault) => {
  const net = v.chain.toLowerCase();
  if (v.venue === "Morpho") return `https://app.morpho.org/${net}/vault/${v.address}`;
  if (v.venue.startsWith("Aave"))
    return `https://app.aave.com/reserve-overview/?underlyingAsset=${AAVE_USDC[v.chain] ?? AAVE_USDC.Ethereum}&marketName=${aaveMarket(v)}`;
  if (v.venue.startsWith("Euler")) return `https://app.euler.finance/vault/${v.address}?network=${net}`;
  if (v.venue === "IPOR Fusion") return `https://app.ipor.io/fusion/${net}/${v.address.toLowerCase()}`;
  if (v.venue === "Accountable") return "https://yield.accountable.capital/";
  if (v.venue === "Harvest") return `https://app.harvest.finance/${net}/${v.address}`;
  return explorer(v);
};

/** The takeaway box under a ranking: a headline sentence, then statements that
 *  each name their subject and figure, so any one can be quoted alone. */
function Conclusion({ big, points }: { big: React.ReactNode; points: React.ReactNode[] }) {
  return (
    <aside className="uyr-conclusion" aria-label="Conclusion">
      <p className="uyr-conclusion-k">Conclusion</p>
      <p className="uyr-conclusion-big">{big}</p>
      <ul className="uyr-conclusion-list">
        {points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </aside>
  );
}

/** A vault as a hub ranking row: realized 30d in the main column, 90d beside it. */
const toRow = (v: Vault): EdRow => ({
  slug: v.address.toLowerCase(),
  name: v.name,
  chain: v.chain,
  venue: `${v.venue} · ${usd(v.tvl_usd_now)} TVL`,
  token: "USDC",
  apy: real(v, "d30") ?? 0,
  apy30: real(v, "d90") ?? null,
  tvl: v.tvl_usd_now ?? 0,
  thin: false,
  appUrl: product(v),
  href: product(v),
});

/** The hub ranking card, unchanged, with the report's column names. */
function VaultRanking({ rows, title }: { rows: Vault[]; title: string }) {
  return (
    <RankTable
      rows={rows.map(toRow)}
      title={title}
      icon={{ asset: "USDC" }}
      floorLabel=""
      appUrl=""
      cta={null}
      note={false}
      tvl={false}
      labels={{ name: "Vault", apy: "30d realized", apy30: "90d realized" }}
    />
  );
}

/** The product cell from the hub ranking (USDC tile with chain badge, name, "chain · venue"). */
function Prod({ v, sub }: { v: Vault; sub?: string }) {
  return (
    <span className="rk-prod">
      <span className="rk-tile" aria-hidden="true">
        <AssetIcon asset="USDC" size={20} decorative />
        <span className="rk-tile-chain">
          <ChainIcon chain={v.chain} size={11} decorative />
        </span>
      </span>
      <span className="rk-prod-txt">
        <a href={product(v)} className="rk-name" title={v.name} target="_blank" rel="noopener noreferrer">
          {v.name}
        </a>
        <span className="rk-sub">{sub ?? `${v.chain} · ${v.venue} · ${usd(v.tvl_usd_now)} TVL`}</span>
      </span>
    </span>
  );
}

/** Static table in the hub ranking card's frame, for the report's other views. */
function RkCard({
  title,
  cols,
  rows,
}: {
  title: string;
  /** First column is the product cell; the rest are numbers unless `text`. */
  cols: { label: string; text?: boolean; main?: boolean }[];
  rows: { key: string; cells: React.ReactNode[] }[];
}) {
  return (
    <div className="rk">
      <div className="rk-bar">
        <p className="rk-title">
          <span className="rk-title-ico" aria-hidden="true">
            <AssetIcon asset="USDC" size={18} decorative />
          </span>
          <span>{title}</span>
        </p>
      </div>
      <div className="rk-scroll">
        <table className="rk-table">
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th
                  key={c.label}
                  scope="col"
                  className={i === 0 ? "rk-c-name" : c.text ? "uyr-c-text" : c.main ? "rk-num rk-c-apy" : "rk-num rk-c-tvl"}
                >
                  <span className="rk-sort uyr-static">{c.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="rk-row" data-rowlink="">
                {r.cells.map((cell, i) =>
                  i === 0 ? (
                    <th key={i} scope="row" className="rk-c-name">
                      {cell}
                    </th>
                  ) : (
                    <td
                      key={i}
                      className={cols[i].text ? "uyr-c-text" : cols[i].main ? "rk-num rk-c-apy" : "rk-num rk-c-tvl"}
                    >
                      {cols[i].main ? <strong>{cell}</strong> : cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function UsdcYieldReportPage() {
  const r = loadReport();
  const all = [...r.vaults].sort(by30);
  const core = all.filter((v) => v.tier === "core");
  const smaller = all.filter((v) => v.tier === "smaller");
  const util = all.filter((v) => v.tier === "utilization");
  const credit = all.filter((v) => v.tier === "credit");
  // The Harvest autocompounder on IPOR's Bitcoin Dollar USDC vault: explained where it is listed.
  const btcd = all.find((v) => /bitcoin dollar/i.test(v.name));
  const btcdSince = btcd
    ? (() => {
        const ok = btcd.series.filter(([, p]) => Number.isFinite(p));
        const days = (Date.parse(ok[ok.length - 1][0]) - Date.parse(ok[0][0])) / 864e5;
        return ((ok[ok.length - 1][1] / ok[0][1]) ** (365 / days) - 1) * 100;
      })()
    : null;
  // Lending vaults only: credit vaults are reported in their own section.
  const lending = all.filter((v) => v.tier !== "credit");
  const list = (xs: string[]) => xs.join(", ").replace(/, ([^,]*)$/, " and $1");
  const platforms = list(r.venues.map((x) => x.replace(/ v\d$/, "")));
  const floor = "$" + `${Math.round(r.tvlFloorUsd / 1e6)}M`;
  const period = `${dayLabel(r.period.start)} to ${dayLabel(r.period.end)}, 2026`;
  const month30 = dayLabel(new Date(Date.parse(`${r.period.end}T00:00:00Z`) - 30 * 864e5).toISOString().slice(0, 10));
  const has = all.length > 0;

  const coreLo = core[core.length - 1], coreHi = core[0];
  const coreTvl = core.reduce((s, v) => s + (v.tvl_usd_now ?? 0), 0);
  // Deposit-weighted average of the large vaults: what a dollar of USDC earned on average.
  const wAvg = (k: keyof Apy) =>
    core.reduce((s, v) => s + (v.tvl_usd_now ?? 0) * (real(v, k) ?? 0), 0) / (coreTvl || 1);
  const avg30 = wAvg("d30"), avg90 = wAvg("d90");
  const small30 = smaller.map((v) => real(v, "d30")).filter((x): x is number => x != null);
  const smallMed = median(small30);
  const smallAbove = small30.filter((x) => x > avg30).length;
  const smallTvl = smaller.reduce((s, v) => s + (v.tvl_usd_now ?? 0), 0);
  const until = `${dayLabel(r.period.end)}, 2026`;
  const at = (v: Vault) => `${v.chain}, ${v.venue}`;
  const coreTies = core.filter((v) => v !== coreHi && pct(real(v, "d30")) === pct(real(coreHi, "d30")));
  const coreByTvl = [...core].sort((a, b) => (b.tvl_usd_now ?? 0) - (a.tvl_usd_now ?? 0));
  const coreBig = coreByTvl[0], coreSmall = coreByTvl[coreByTvl.length - 1];
  const smallHi = smaller[0];
  const hv30 = smaller.filter((v) => v.venue === "Harvest").map((v) => real(v, "d30")).filter((x): x is number => x != null);


  // Points-only programs (no token paid) are not reward campaigns here.
  const rewarded = lending.filter((v) => v.merkl?.had_rewards_in_period && v.merkl_peak);

  // ---- Summary findings: one product per bullet ----
  // Shape: <Label>: <rate>, <Product> (network, platform, context). Label renders blue, rate bold.
  type Finding = { label: string; name: string; rate: string; tail: string };
  // Chain and venue, minus whatever the vault's name already says ("Aave v3 Base USDC").
  const where = (v: Vault) =>
    [v.chain, v.venue].filter((x) => !v.name.toLowerCase().includes(x.toLowerCase())).join(", ");
  // Joins the bracket's parts, skipping empty ones (no stray commas).
  const tail = (...parts: (string | undefined | null | false)[]) => parts.filter(Boolean).join(", ");
  const findings: Finding[] = [];
  if (coreHi) {
    findings.push({
      label: "Most efficient",
      name: coreHi.name,
      rate: `${pct(real(coreHi, "d30"))} avg APY`,
      tail: tail(where(coreHi), `${usd(coreHi.tvl_usd_now)} TVL`),
    });
    const biggest = [...core].sort((a, b) => (b.tvl_usd_now ?? 0) - (a.tvl_usd_now ?? 0))[0];
    findings.push({
      label: "Largest market",
      name: biggest.name,
      rate: `${pct(real(biggest, "d30"))} avg APY`,
      tail: tail(where(biggest), `${usd(biggest.tvl_usd_now)} TVL`),
    });
  }
  const top = lending[0];
  if (top) {
    findings.push({
      label: "Highest on-chain rate",
      name: top.name,
      rate: `${pct(real(top, "d30"))} avg APY`,
      tail: tail(where(top), top.tier === "utilization" && "high due to prevailing high utilization"),
    });
  }
  const rewardTop = lending
    .filter((v) => v.merkl_peak && !v.merkl_in_share_price)
    .sort((a, b) => (b.merkl_peak!.apr ?? 0) - (a.merkl_peak!.apr ?? 0))[0];
  if (rewardTop?.merkl_peak) {
    const p = rewardTop.merkl_peak;
    findings.push({
      label: "Highest rate + Merkl",
      name: rewardTop.name,
      rate: `${pct(real(rewardTop, "d30"))} avg APY + ${p.apr}% ${p.token} peak`,
      tail: tail(where(rewardTop), rewardTop.rewardEligibility),
    });
  }
  const utilTop = util.filter((v) => v !== top && v.utilRange && v.utilRange !== "not measured")[0];
  if (utilTop) {
    findings.push({
      label: "High utilization",
      name: utilTop.name,
      rate: `${pct(real(utilTop, "d30"))} avg APY`,
      tail: tail(where(utilTop), `${utilTop.utilRange} utilization`, "withdrawal risk at peaks"),
    });
  }
  const creditTop = credit[0];
  if (creditTop) {
    findings.push({
      label: "Credit vaults",
      name: creditTop.name,
      rate: `${pct(real(creditTop, "d30"))} avg APY`,
      tail: tail(where(creditTop), "queued withdrawals, not instant"),
    });
  }
  // Rewards are a side note to the on-chain ranking, so they close the list.
  findings.sort((a, b) => Number(a.label === "Highest rate + Merkl") - Number(b.label === "Highest rate + Merkl"));

  const venueRows = r.venues.map((venue) => {
    const vs = all.filter((v) => v.venue === venue);
    const d30 = vs.map((v) => real(v, "d30")).filter((x): x is number => x != null);
    return {
      venue,
      count: vs.length,
      tvl: vs.reduce((s, v) => s + (v.tvl_usd_now ?? 0), 0),
      med: median(d30),
      lo: Math.min(...d30),
      hi: Math.max(...d30),
      flagged: vs.filter((v) => v.tier === "utilization").length,
      credit: vs.length > 0 && vs.every((v) => v.tier === "credit"),
    };
  });
  // Questions people actually search (Ahrefs, US), answered from this edition's
  // figures. Every answer names its period so it can be quoted alone.
  const month = monthLabel(r.asOfIso);
  const aave = core.filter((v) => v.venue.startsWith("Aave"));
  const faq: { q: string; a: string }[] = [
    {
      q: `What is the best USDC yield in ${month}?`,
      a:
        `The best USDC yield in ${month} recorded in this report was ${pct(real(coreHi, "d30"))} a year, on ${coreHi.name} ` +
        `(${at(coreHi)})${coreTies.length ? `, level with ${coreTies.map((v) => v.name).join(" and ")}` : ""}, among vaults holding more than ${floor}. ` +
        `Higher rates existed, up to ${pct(real(lending[0], "d30"))} on ${lending[0].name}, but they came from small vaults running at high ` +
        `utilization, where withdrawals can be delayed.`,
    },
    {
      q: "What is the USDC interest rate lately?",
      a:
        `The USDC interest rate lately is about ${pct(avg30)} a year. That is the deposit-weighted average across the ${core.length} largest ` +
        `USDC lending vaults in this report over the 30 days to ${until}, ${avg30 >= avg90 ? "up" : "down"} from ${pct(avg90)} over 90 days. ` +
        `Individual large vaults ranged from ${pct(real(coreLo, "d30"))} to ${pct(real(coreHi, "d30"))}.`,
    },
    ...(aave.length
      ? [{
          q: "What has the Aave USDC supply APY been recently?",
          a:
            `The Aave USDC supply APY has recently been ` +
            aave.map((v) => `${pct(real(v, "d30"))} on ${v.name.replace(/^Aave v3 /, "").replace(/ USDC.*$/, "")}`).join(", ").replace(/, ([^,]*)$/, " and $1") +
            `, measured over the 30 days to ${until}. These are realized rates read from the pool on-chain, so they differ from the live rate the Aave app shows on a given day.`,
        }]
      : []),
    {
      q: "Does USDC pay interest by itself?",
      a:
        `No. USDC held in a wallet pays nothing. The yield comes from putting it to work, most often by lending it through a platform such ` +
        `as Aave, Morpho or Euler, or through a vault that does this for you. In ${month} the large USDC lending vaults paid ` +
        `${pct(real(coreLo, "d30"))} to ${pct(real(coreHi, "d30"))} a year.`,
    },
    {
      q: "Can you stake USDC?",
      a:
        `No, not in the strict sense: USDC does not secure a network, so there is nothing to stake. What is usually called USDC staking is ` +
        `lending. Over the 30 days to ${until}, lending USDC through the largest vaults paid ${pct(avg30)} a year on average.`,
    },
    {
      q: "How often does USDC interest get paid?",
      a:
        `USDC yield in an on-chain vault is not paid out on a schedule: it accrues continuously into the vault's share price (on Aave, into ` +
        `your balance), so a deposit is worth slightly more with every block, and you collect it when you withdraw.`,
    },
    {
      q: `Which network had the best USDC rates in ${month}?`,
      a:
        `Base had the best large-vault USDC rates in ${month}: ${coreHi.name} paid ${pct(real(coreHi, "d30"))}. ` +
        `${coreBig.name}, the largest USDC market, paid ${pct(real(coreBig, "d30"))}` +
        (core.find((v) => v.chain === "Arbitrum") ? `, and ${core.find((v) => v.chain === "Arbitrum")!.name} paid ${pct(real(core.find((v) => v.chain === "Arbitrum")!, "d30"))}` : "") +
        `. This report covers ${list(r.chains)}.`,
    },
    {
      q: "Are reward tokens included in these USDC rates?",
      a:
        `No, with one exception. Rates here are what the vault itself paid. Reward tokens from programs such as Merkl arrive separately and ` +
        `are listed in their own section. Harvest vaults are the exception: they convert rewards back into USDC inside the vault, so ` +
        `their rates already include them.`,
    },
    {
      q: "How often is the USDC Yield Report updated?",
      a: `Monthly. This is the ${month} edition, covering ${month30} to ${until}, with 90-day figures from ${dayLabel(r.period.start)} for context.`,
    },
  ];
  const ld = [
    breadcrumbSchema([
      { name: "Home", url: SITE_URL },
      { name: "USDC", url: `${SITE_URL}/usdc` },
      { name: `USDC Yield Report - ${month}`, url: URL },
    ]),
    articleSchema({
      title: `USDC Yield Report - ${month} Ranking`,
      description: `Realized USDC yield on ${all.length} vaults across ${r.venues.join(", ")}, measured from on-chain share prices over the 30 days to ${until}.`,
      url: URL,
      datePublished: r.asOfIso,
      dateModified: r.asOfIso,
    }),
    reportDatasetSchema({
      name: `USDC vault realized yield, ${month}`,
      description: `Daily on-chain share prices and realized 7, 30 and 90-day APY for ${all.length} USDC vaults on ${r.venues.join(", ")}.`,
      url: URL,
      dateModified: r.asOfIso,
      temporalCoverage: `${r.period.start}/${r.period.end}`,
      keywords: ["USDC", "USDC yield", "USDC APY", "stablecoin lending", "DeFi", "Morpho", "Aave", "Euler", "Harvest"],
      sources: ["https://app.morpho.org", "https://app.aave.com", "https://app.euler.finance", "https://app.harvest.finance", "https://app.merkl.xyz", "https://defillama.com/yields"],
      distribution: [
        { format: "application/json", url: `${URL}.json` },
        { format: "text/markdown", url: `${URL}.md` },
      ],
    }),
  ];
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })),
  };

  const venueLend = venueRows.filter((v) => !v.credit);
  const venueByMed = [...venueLend].sort((a, b) => a.med - b.med);
  const venueLo = venueByMed[0], venueHi = venueByMed[venueByMed.length - 1];
  const venueWide = [...venueLend].sort((a, b) => b.hi - b.lo - (a.hi - a.lo))[0];
  const rewardDays = (v: Vault) =>
    v.merkl_peak ? Math.round((Date.parse(v.merkl_peak.end) - Date.parse(v.merkl_peak.start)) / 864e5) : 0;
  const harvestRewarded = rewarded.filter((v) => v.merkl_in_share_price).length;

  return (
    <div className="uni-hub-test uh-page ae ld usdc-ld uyr">
      <DocsRails toc={TOC} token="USDC" assetName="USDC" appUrl={APP_URL} />

      <nav className="uni-hub-crumbs" aria-label="Breadcrumb">
        <HomeCrumb />
        <span className="uni-hub-crumbs-sep" aria-hidden="true">›</span>
        <Link href="/usdc">USDC</Link>
        <span className="uni-hub-crumbs-sep" aria-hidden="true">›</span>
        <span className="uni-hub-crumbs-current">USDC Yield Report</span>
      </nav>

      <div className="uni-hub-hero uh-hero">
        <div className="uh-titlerow">
          <span className="uni-hub-hero-icon" aria-hidden="true">
            <AssetIcon asset="USDC" size={44} priority />
          </span>
          <h1 className="uni-hub-h1">USDC Yield Report - {monthLabel(r.asOfIso)} Ranking</h1>
        </div>
        <p className="uh-answer">
          {has ? (
            <>
              <span className="uyr-intro-p">
                Every USDC vault advertises an APY. What depositors actually take home is a different number, and it is
                the one that matters.
              </span>
              <span className="uyr-intro-p">
                {`For this report we went through the ${all.length} most popular and best-performing USDC vaults on ${platforms}, ` +
                  `and followed each vault's on-chain share price day by day, to show where a dollar of USDC ` +
                  `really earned the most in ${monthLabel(r.asOfIso)}.`}
              </span>
            </>
          ) : (
            `We measured the realized USDC yield of vaults on ${platforms} from their on-chain share prices.`
          )}
        </p>
        <div className="ae-hero-ctas">
          <a className="ae-btn" href={APP_URL} target="_blank" rel="noopener noreferrer">
            Open USDC vaults on Harvest
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ae-btn-ext"><path d="M5 11 11 5M6 5h5v5" /></svg>
          </a>
          <a className="ae-btn-ghost" href="#ranking">
            See the ranking <span aria-hidden="true"> ↓</span>
          </a>
        </div>
      </div>

      <section className="uh-summary" aria-labelledby="summary">
        <h2 className="uh-summary-h" id="summary">
          Summary
        </h2>
        {/* Grab-and-go findings. Each bullet names one product with its network,
            platform, figure and period, so it still makes sense when an AI
            answer or a reader lifts it alone. */}
        <ul className="uh-findings">
          {findings.map((f) => (
            <li key={f.label}>
              <span className="uyr-k">{f.label}:</span>{" "}
              {f.rate.split(/(\d[\d.]*%)/).map((t, i) => (i % 2 ? <strong key={i}>{t}</strong> : t))}, {f.name}{" "}
              {f.tail ? <span className="uyr-tail">({f.tail})</span> : null}
            </li>
          ))}
        </ul>
      </section>
      {/* The one date reference for the whole report, outside the summary box. */}
      <p className="uh-updated uyr-dateline" data-dateline="">
        All rates cover the 30 days to {until}. Published by Harvest Finance and updated monthly.{" "}
        <a href="#methodology">How we measured them</a> and <a href="#definitions">what the terms mean</a> are further down.
      </p>

      <Block
        id="ranking"
        eyebrow="Ranking"
        title={`USDC vaults above ${floor}, ranked by realized 30-day yield`}
        asOf={r.asOf}
        lead={
          [
            `These are the ${core.length} USDC vaults holding more than ${floor} each, from ${coreBig.name} with ` +
              `${usd(coreBig.tvl_usd_now)} in deposits down to ${coreSmall.name} with ${usd(coreSmall.tvl_usd_now)}.`,
            `This is where most on-chain USDC actually sits, so their rates are the closest thing to a market rate. The table ` +
              `ranks them by what a deposit earned over the last 30 days, with the 90-day figure beside it.`,
          ]
        }
      >
        {has ? <VaultRanking rows={core} title={`USDC vaults above ${floor}`} /> : null}
        {has ? (
          <Conclusion
            big={<>The average USDC lending rate across the largest vaults was <strong>{pct(avg30)}</strong> over the 30 days to {until}.</>}
            points={[
              <>The best-paying large USDC vault was <strong>{coreHi.name}</strong> ({at(coreHi)}) at {pct(real(coreHi, "d30"))}{coreTies.length ? <>, level with <strong>{coreTies.map((v) => v.name).join(", ")}</strong></> : null}.</>,
              <>The largest USDC market, <strong>{coreBig.name}</strong> with {usd(coreBig.tvl_usd_now)} in deposits, paid {pct(real(coreBig, "d30"))}.</>,
              <>The lowest rate among large USDC vaults was {pct(real(coreLo, "d30"))}, on <strong>{coreLo.name}</strong> ({at(coreLo)}).</>,
              <>USDC rates {avg30 >= avg90 ? "rose" : "fell"} during the period: the deposit-weighted average was {pct(avg30)} over 30 days against {pct(avg90)} over 90 days.</>,
              <>A realistic USDC yield on a vault holding more than {floor} was {pct(real(coreLo, "d30"))} to {pct(real(coreHi, "d30"))} a year. Rates well above that came from smaller vaults or from high utilization.</>,
            ]}
          />
        ) : null}
        <p className="uh-note">
          A realized rate is what the vault&rsquo;s share price actually did, annualized: see{" "}
          <a href="#definitions">Definitions</a> and <a href="#methodology">the method</a>.
        </p>
        <p className="uh-note">
          {`The four largest Morpho vaults on Base lend into many of the same markets, so they move together: read them as ` +
            `one signal about Base, not four.`}
        </p>
      </Block>

      <Block
        id="smaller-vaults"
        eyebrow="Smaller vaults"
        title={`Smaller USDC vaults, under ${floor}`}
        lead={
          [
            `Below ${floor} sit the specialist strategies: Aave's smaller markets (Lido Prime and Horizon RWA), curated Euler ` +
              `vaults lending against real-world-asset collateral, and Harvest and IPOR Fusion vaults that move deposits ` +
              `between lending markets.`,
            `Their rates are real but have been tested by less liquidity, and a single large deposit or withdrawal can move them.`,
          ]
        }
      >
        {has && <VaultRanking rows={smaller} title={`USDC vaults under ${floor}`} />}
        {has && small30.length ? (
          <Conclusion
            big={<>Smaller USDC vaults paid a median of <strong>{pct(smallMed)}</strong> over the 30 days to {until}, {Math.abs(smallMed - avg30).toFixed(1)} points {smallMed >= avg30 ? "above" : "below"} the large-vault average.</>}
            points={[
              <>The best-paying USDC vault under {floor} was <strong>{smallHi.name}</strong> ({at(smallHi)}) at {pct(real(smallHi, "d30"))}.</>,
              ...(hv30.length > 1
                ? [<>The {hv30.length} Harvest USDC vaults in this group paid {Math.min(...hv30).toFixed(2)}% to {Math.max(...hv30).toFixed(2)}%{Math.min(...hv30) > avg30 ? <>, each above the large-vault average of {pct(avg30)}</> : null}.</>]
                : []),
              <>{smallAbove} of the {smaller.length} smaller USDC vaults beat the large-vault average of {pct(avg30)}.</>,
              <>The extra yield comes with less depth: together these vaults hold {usd(smallTvl)}, against {usd(coreTvl)} in the large ones, so one big deposit or withdrawal can move the rate.</>,
            ]}
          />
        ) : null}
        {btcd ? (
          <p className="uh-note">
            <strong>What is under {btcd.name}:</strong> this Harvest vault autocompounds the IPOR Fusion vault Bitcoin
            Dollar USDC, curated by BTCD Labs. That vault does not lend USDC. About 92% of it is a position on Morpho
            that holds staked Bitcoin Dollar (wsBTCD) and owes WBTC, so its share price moves both ways. It launched
            on September 11, so it has no 90-day figure yet; since launch it has paid {pct(btcdSince ?? undefined)} a year.
          </p>
        ) : null}
      </Block>

      <Block
        id="utilization-risk"
        eyebrow="Higher risk"
        title="High-yield USDC vaults with utilization risk"
        lead={
          [
            `${util.length} vaults paid well above the market at some point in the period. In each case the reason is visible ` +
              `on-chain: borrowers had taken almost all the liquidity, or the vault lends into a niche market.`,
            `A lending vault's rate rises with utilization, the share of its deposits currently lent out. Near 100% the rate ` +
              `climbs steeply, and there is little or no idle USDC left for anyone who wants to withdraw.`,
          ]
        }
      >
        <RkCard
          title="Utilization-risk vaults"
          cols={[{ label: "Vault" }, { label: "30d realized", main: true }, { label: "Utilization", text: true }]}
          rows={util.map((v) => ({
            key: v.address,
            cells: [<Prod key="p" v={v} />, pct(real(v, "d30")), v.utilRange ?? "–"],
          }))}
        />
        <Conclusion
          big={<>The highest USDC rates over the 30 days to {until} came from <strong>{util.length} vaults</strong> running at high utilization, where withdrawals can be delayed.</>}
          points={[
            ...util.map((v) => (
              <><strong>{v.name}</strong> ({at(v)}) paid {pct(real(v, "d30"))}{v.rateSource ? `: it ${v.rateSource}` : "."}</>
            )),
            <>A USDC rate far above the large-vault average of {pct(avg30)} is usually a sign of high utilization, not of a better strategy.</>,
          ]}
        />
        <p className="uh-note">
          Utilization is explained in <a href="#definitions">Definitions</a>; vaults left out of the report are listed
          in <a href="#methodology">the method</a>.
        </p>
      </Block>

      {credit.length ? (
        <Block
          id="credit-vaults"
          eyebrow="Different product"
          title="USDC credit vaults with withdrawal queues"
          lead={[
            `${credit.length} USDC vaults on ${list([...new Set(credit.map((v) => v.venue))])} paid more than any large lending vault. They are a different product: ` +
              `loans to a single borrower or managed strategies, not pooled lending.`,
            `None of them allows instant withdrawal. You request, wait in a queue, then claim, so they are listed here and ` +
              `kept out of the rankings above.`,
          ]}
        >
          <RkCard
            title="Credit vaults"
            cols={[{ label: "Vault" }, { label: "30d realized", main: true }, { label: "Withdrawal", text: true }]}
            rows={credit.map((v) => ({
              key: v.address,
              cells: [<Prod key="p" v={v} />, pct(real(v, "d30")), v.exitShort ?? "Queue"],
            }))}
          />
          <Conclusion
            big={<>USDC credit vaults paid <strong>{pct(Math.min(...credit.map((v) => real(v, "d30") ?? 0)))} to {pct(Math.max(...credit.map((v) => real(v, "d30") ?? 0)))}</strong> over the 30 days to {until}, with withdrawals that take days or weeks.</>}
            points={[
              ...credit.map((v) => (
                <><strong>{v.name}</strong> ({at(v)}) paid {pct(real(v, "d30"))}{v.structure ? `: it is ${v.structure}` : ""}{v.exit ? `. Withdrawals: ${v.exit}` : ""}.</>
              )),
              <>A credit vault&rsquo;s rate is set by a loan agreement or reported by a manager, so it is not directly comparable with the rate of a lending vault that anyone can exit at once.</>,
            ]}
          />
          <p className="uh-note">
            How these vaults are priced and why they are reported separately is covered in{" "}
            <a href="#methodology">the method</a>.
          </p>
        </Block>
      ) : null}

      <Block
        id="rewards"
        eyebrow="Incentives"
        title="Rewards on top: Merkl campaigns and incentives"
        lead={
          [
            `Some vaults pay a bonus on top of their lending rate: extra tokens handed out through reward programs such as ` +
              `Merkl, usually for a few weeks at a time, to attract deposits.`,
            `These rewards arrive separately from the vault, so they are not part of the rates above, unless the vault collects ` +
              `them and converts them back into USDC, as Harvest vaults do. ${rewarded.length} of the ${lending.length} lending vaults here had a campaign.`,
          ]
        }
      >
        <RkCard
          title="Vaults with reward campaigns"
          cols={[{ label: "Vault" }, { label: "Peak APR", main: true }, { label: "Reward", text: true }]}
          rows={rewarded.map((v) => ({
            key: v.address,
            cells: [
              <Prod key="p" v={v} />,
              v.merkl_peak ? `${v.merkl_peak.apr}%` : "–",
              v.merkl_tokens.filter((x) => !/points/i.test(x)).join(", ") || "–",
            ],
          }))}
        />
        <Conclusion
          big={<>Reward campaigns ran on <strong>{rewarded.length} of the {lending.length}</strong> USDC lending vaults during the period, and none of them changed the large-vault ranking.</>}
          points={[
            ...(rewardTop?.merkl_peak
              ? [<>The highest reward rate was {rewardTop.merkl_peak.apr}% in {rewardTop.merkl_peak.token} on <strong>{rewardTop.name}</strong>, for {rewardDays(rewardTop)} days{rewardTop.rewardEligibility ? ` and ${rewardTop.rewardEligibility}` : ""}.</>]
              : []),
            <>On <strong>Aave v3 Base USDC</strong>, three USDC campaigns were open only to Jumper bridge users or to new deposits.</>,
            <>On <strong>Steakhouse High Yield USDC Edition</strong>, MORPHO and USDC rewards went to Coinbase app depositors only.</>,
            <>The {harvestRewarded} Harvest vaults with rewards convert them back into USDC inside the vault, so their rates above already include them.</>,
            <>Most campaigns outside Harvest had an eligibility condition, so for most depositors the lending rate was the whole yield.</>,
          ]}
        />
        <p className="uh-note">
          Source: campaign data from{" "}
          <a href="https://app.merkl.xyz/" target="_blank" rel="noopener noreferrer">
            Merkl
          </a>
          , read for each vault over the period.
        </p>
      </Block>

      <Block
        id="by-platform"
        eyebrow="By platform"
        title="USDC rates by platform, compared"
        lead={[
            `The platforms work differently. Aave runs one large shared pool per market. On Morpho and Euler, independent ` +
              `curators run their own vaults on top of shared lending markets.`,
            `Harvest and IPOR Fusion sit a layer above, placing deposits into markets like these. Accountable is different ` +
              `again: its vaults are loans and managed strategies with queued withdrawals. Here is how they compare over 30 days.`,
          ]
        }
      >
        <RkCard
          title="By platform"
          cols={[{ label: "Platform" }, { label: "Median 30d", main: true }, { label: "Range 30d" }]}
          rows={venueRows.map((v) => ({
            key: v.venue,
            cells: [
              <span key="p" className="rk-prod">
                <span className="rk-tile" aria-hidden="true">
                  <AssetIcon asset="USDC" size={20} decorative />
                </span>
                <span className="rk-prod-txt">
                  <span className="rk-name">{v.venue}</span>
                  <span className="rk-sub">{`${v.count} ${v.credit ? "credit vaults" : "vaults"} · ${usd(v.tvl)} TVL`}</span>
                </span>
              </span>,
              pct(v.med),
              `${v.lo.toFixed(1)}–${v.hi.toFixed(1)}%`,
            ],
          }))}
        />
        {venueRows.length > 1 ? (
          <Conclusion
            big={<>Median USDC lending rates by platform ran from <strong>{pct(venueLo.med)}</strong> on {venueLo.venue} to <strong>{pct(venueHi.med)}</strong> on {venueHi.venue} over the 30 days to {until}.</>}
            points={[
              ...venueRows.map((v) => (
                <>The {v.count} <strong>{v.venue}</strong> USDC {v.credit ? "credit vaults" : "vaults"} paid a median of {pct(v.med)}, from {pct(v.lo)} to {pct(v.hi)}{v.flagged ? `, with ${v.flagged} of them in the utilization-risk group` : ""}{v.credit ? ", with queued withdrawals, so they are not ranked against the lending platforms" : ""}.</>
              )),
              ...(venueWide.hi - venueWide.lo > venueHi.med - venueLo.med
                ? [<>The vault mattered more than the platform: rates on {venueWide.venue} alone spanned {(venueWide.hi - venueWide.lo).toFixed(1)} points, against {(venueHi.med - venueLo.med).toFixed(1)} points between the platform medians.</>]
                : []),
            ]}
          />
        ) : null}
      </Block>

      <Block
        id="share-price"
        eyebrow="History"
        title="USDC vault share price history, indexed to 100"
        lead={`Daily share price of the ${core.length} vaults above ${floor}, indexed to 100 on ${dayLabel(r.period.start)}. A steeper line earned more.`}
      >
        {has && (
          <SharePriceChart
            rows={core.map((v) => ({ id: v.address, name: v.name, chain: v.chain, series: v.series }))}
          />
        )}
      </Block>

      <Block id="faq" eyebrow="Questions" title={`USDC yield questions, answered for ${month}`}>
        <div className="uh-faq">
          {faq.map((x, i) => (
            <details className="uh-faq-item" key={x.q} open={i === 0}>
              <summary className="uh-faq-q">
                <span>{x.q}</span>
                <svg className="uh-faq-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <p className="uh-faq-a">{x.a}</p>
            </details>
          ))}
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
        {ld.map((x, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(x) }} />
        ))}
      </Block>

      <Block
        id="methodology"
        eyebrow="Method"
        title="How we measured USDC yield"
        lead="Every rate in this report comes from reading each vault's share price on-chain once a day, not from the APY a platform publishes."
      >
        <p>
          For each day in the period we took the last block at or before 00:00 UTC and read the vault&rsquo;s share
          price at that block.
        </p>
        <p>
          The call is <code>convertToAssets</code> on ERC-4626 vaults (Morpho, Euler), <code>getPricePerFullShare</code>{" "}
          on Harvest vaults, and the reserve&rsquo;s normalized income on Aave v3, which plays the same role there.
        </p>
        <p>
          Realized APY over a window is the growth of that value, annualized over 365 days:{" "}
          <code>APY = (price_end / price_start) ^ (365 / days) - 1</code>. It is after vault fees and before any reward
          paid outside the vault.
        </p>
        <p>
          The 30-day window runs from {month30} to {until}, and the 90-day window from {period}. Readings were taken on{" "}
          {list(r.chains)}.
        </p>
        <p>
          We chose up to five of the largest open native-USDC vaults by deposits on each platform, across{" "}
          {list(r.chains)}, on {r.asOf}. Deprecated, frozen and test vaults are left out.
        </p>
        <p>
          Five Euler vaults were left out on that rule: four that Euler has marked deprecated, three of them carrying
          bad debt from the Stream Finance collapse that is not yet written off, and one frozen with withdrawals
          switched off.
        </p>
        <p>
          The 30-day results for Morpho, Aave, Euler and Harvest vaults were checked against each platform&rsquo;s API
          or DefiLlama and agreed within 0.3 percentage points. IPOR Fusion and Accountable share prices were re-read
          on a second RPC node and matched each platform&rsquo;s API for the days it covers.
        </p>
        <p>
          These figures will not match the APY shown in an app on a given day, and they are not meant to.
        </p>
        <p>
          An app usually shows the rate a vault is paying right now; this report shows what a deposit earned over the
          past 30 days. Both are correct, and they answer different questions.
        </p>
        <p>
          Where a vault&rsquo;s share price moved in a single one-off step that is not recurring yield, that step is
          left out of its rate. This applied to one vault in this edition.
        </p>
        {credit.length ? (
          <p>
            Credit vaults are read the same way, with <code>convertToAssets</code>, but the number means something
            else: for a fixed-rate loan it is interest accrued at the agreed rate, and for a managed strategy it is a
            value the manager reports. That is why they are kept out of the rankings and averages.
          </p>
        ) : null}
        <h3 id="sources">Sources</h3>
        <ul className="uh-venues">
          <li>Share prices: read directly from each vault contract through public RPC nodes, at the addresses in <a href="#addresses">Contract addresses</a>.</li>
          <li>Deposits and vault lists: each platform&rsquo;s own API ({platforms}).</li>
          <li>Cross-check of 30-day rates: each platform&rsquo;s API or <a href="https://defillama.com/yields" target="_blank" rel="noopener noreferrer">DefiLlama</a>.</li>
          <li>Reward campaigns: <a href="https://app.merkl.xyz/" target="_blank" rel="noopener noreferrer">Merkl</a>.</li>
        </ul>
        <h3 id="about">About this report</h3>
        <p>
          Published by <Link href="/about">Harvest Finance</Link>, which has run on-chain yield vaults since 2020 and
          indexes vault contracts with its own indexer. Site-wide rules for how rates are collected are in the{" "}
          <Link href="/methodology">methodology</Link> and the <Link href="/risk-framework">risk framework</Link>.
        </p>
        <p>
          Data read to {until}. The report is updated monthly, and each edition keeps its own address. To report an
          error, use the <Link href="/contact">contact page</Link>.
        </p>
        <p>
          Cite as: Harvest Finance, &ldquo;USDC Yield Report - {month} Ranking&rdquo;, {URL}. The data is free to
          reuse under CC BY 4.0.
        </p>
      </Block>

      <Block
        id="definitions"
        eyebrow="Glossary"
        title="Definitions used in this report"
        lead="The terms the tables and conclusions rely on, each in one or two sentences."
      >
        <dl className="uyr-defs">
          <dt id="def-realized">Realized rate (realized APY)</dt>
          <dd>What a deposit actually earned over a window, measured from the change in the vault&rsquo;s share price and expressed as a yearly rate. It looks backward, unlike the live APY an app shows.</dd>
          <dt id="def-share-price">Share price</dt>
          <dd>How much USDC one share of a vault is worth. It rises as the vault earns, so its growth is the vault&rsquo;s yield after fees.</dd>
          <dt id="def-tvl">TVL (deposits)</dt>
          <dd>Total value locked: the USDC currently deposited in the vault, read on {r.asOf}.</dd>
          <dt id="def-avg">Large-vault average</dt>
          <dd>The average 30-day rate of the vaults holding more than {floor}, weighted by deposits, so a vault with ten times the USDC counts ten times as much.</dd>
          <dt id="def-utilization">Utilization</dt>
          <dd>The share of a lending vault&rsquo;s deposits currently lent out. High utilization raises the rate and leaves less USDC available to withdraw.</dd>
          <dt id="def-curator">Curator</dt>
          <dd>The independent team that decides where a Morpho or Euler vault lends.</dd>
          <dt id="def-rewards">Reward campaign</dt>
          <dd>Extra tokens paid to depositors for a limited time, usually through Merkl, on top of the vault&rsquo;s own rate.</dd>
        </dl>
      </Block>

      <Block
        id="limitations"
        eyebrow="Disclosure"
        title="Disclosure: what to keep in mind"
        lead="Harvest Finance publishes this report and also operates five of the vaults in it, so here is how we kept the comparison even, and where its edges are."
      >
        <p>
          Harvest vaults are measured exactly like every other vault here, from the same daily on-chain share-price
          readings, and every table is sorted on that figure alone.
        </p>
        <p>
          Anyone can repeat the measurement from the contract addresses listed at the end of this page. Two of the
          Harvest vaults hold mostly liquidity placed by the Harvest Autopilot, so their deposits overlap with it.
        </p>
        <ul className="uh-venues">
          <li>Vaults were chosen by their size today, so vaults that shrank or closed during the period are less likely to appear.</li>
          <li>Reward rates are listed as the campaigns published them and are not added to any vault&rsquo;s rate; older Aave Merit rewards could not be checked.</li>
          {btcd ? (
            <li>{btcd.name} sits on a vault that holds a leveraged bitcoin-backed position instead of lending USDC, so its rate moves with that position and can be negative over short windows.</li>
          ) : null}
          <li>Arbitrum has few entries because few USDC vaults there are large: outside Aave, none of the platforms had one above about $1.3M.</li>
        </ul>
      </Block>


      <Block
        id="addresses"
        eyebrow="Reference"
        title="Contract addresses of every vault"
        lead="The on-chain address of each vault measured in this report, on the network it runs on. Every rate here can be reproduced by reading the share price at that address."
      >
        <p className="uyr-files">
          The same report for machines: <a href={`${REPORT_PATH}.json`}>JSON dataset</a> (every vault with its daily
          share price) and <a href={`${REPORT_PATH}.md`}>Markdown version</a>.
        </p>
        <VaultContracts
          title="Vault contracts"
          rows={[...all]
            .sort((a, b) => a.venue.localeCompare(b.venue) || a.name.localeCompare(b.name))
            .map((v) => ({ address: v.address, name: v.name, chain: v.chain, venue: v.venue, href: product(v), explorer: explorer(v) }))}
        />
      </Block>
      <aside className="uyr-disclaimer" aria-label="Disclaimer">
        <p>
          <strong>Not financial advice.</strong> This report is for information only. It describes what USDC vaults paid
          in the past, which says nothing certain about what they will pay next, and it is not a recommendation to
          deposit anywhere.
        </p>
        <p>
          Every figure comes from open, on-chain data: the daily share price of each vault, read from the contract
          addresses listed above. Anyone can read the same contracts and check the numbers for themselves.
        </p>
      </aside>
      <LeaveGuard scope=".uyr" />
    </div>
  );
}
