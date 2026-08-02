import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { SITE_AUTHOR } from "@/lib/author";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AssetIcon } from "@/components/token-icons";
import richListHeader from "@/assets/icons/XRP Rich List Header.png";
import {
  breadcrumbSchema,
  faqPageSchema,
  reportDatasetSchema,
  reportWebPageSchema,
} from "@/lib/jsonld";
import { PercentileCalculator } from "@/components/richlist/percentile-calculator";
import { TopAccountsTable } from "@/components/richlist/top-accounts-table";
import { StatCards } from "@/components/richlist/stat-cards";
import { holderAvatar } from "@/components/richlist/holder-avatars";
import { AvatarStack } from "@/components/richlist/avatar-stack";
import {
  DistributionChart,
  DistributionTable,
} from "@/components/richlist/distribution-chart";
import {
  loadRichList,
  accountsAtOrAbove,
  tierOf,
  xrpAmount,
  count,
  pctLabel,
  utcDate,
  utcStamp,
} from "@/lib/xrp-richlist";
import "../_styles/home.css";
import "../_styles/report.css";
import "../_styles/rich-list.css";

// /xrp-rich-list: a live XRP Ledger holder distribution tool.
//
// A tool, not an article, and that is the load-bearing decision. On this SERP
// the two results that earn traffic are both live tools; the DR 74 and DR 76
// articles above them collect nothing. So the page leads with a calculator and
// a threshold table, and the prose exists to explain them rather than to carry
// the page.
//
// Scope boundary: /report/xrp-yield-ranking owns the yield vocabulary. Nothing
// in the title, H1, meta description or any H2 here competes with it. Yield
// appears in exactly two places, one column of the threshold table and the
// bridge block, both of which link down to the report.

const PAGE_URL = `${SITE_URL}/xrp-rich-list`;

// First publication, fixed. It was wired to the ledger close alongside
// dateModified, so the two were always identical and the page looked freshly
// published on every snapshot. The gap between those fields is how a crawler
// tells a maintained page from a republished one, and a page that always looks
// brand new never accumulates that history. This is the route's first commit
// and it does not move again.
const PUBLISHED_ISO = "2026-07-31T00:00:00.000Z";

// Chris Larsen's total net worth, which this page cannot read and therefore
// cites. Forbes and Bloomberg both serve a CAPTCHA to automated fetches, so it
// cannot be pulled at build time; it is entered by hand with the date it was
// read on and the profile it came from. Forbes calls this a real-time figure,
// so it moves with the market and the read date is the load-bearing part
// rather than a formality.
//
// The section renders the comparison only when `usd` is set. An undated
// net-worth figure with no source is the one kind of claim the method on this
// page forbids, so null is a correct state rather than a gap.
const LARSEN_NET_WORTH: { usd: number | null; readOn: string } = {
  usd: 11_500_000_000,
  readOn: "August 1, 2026",
};
const LARSEN_SOURCE = {
  name: "Forbes",
  url: "https://www.forbes.com/profile/chris-larsen/",
};

// Locked by the build spec. No live figures: threshold values move with the
// distribution and a title that disagrees with the page after a rebuild is
// worse than a title with no number. Percentage tier names are fixed labels
// and are safe. No year anywhere in metadata, so nothing goes stale in January.
const TITLE = "XRP Rich List: Top Holders and Your Rank";
// "Updated hourly" used to close this line and was not true: the walk runs on
// `20 */6 * * *`, four times a day. A cadence claim in a snippet is checkable
// against the dateline on the page, so it has to match the cron.
const DESCRIPTION =
  "Live XRP rich list calculator and holder distribution. See the top 1%, 10% and 25% thresholds and find where your balance ranks, read from the XRP Ledger.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: `${TITLE} | ${SITE_NAME}` },
    description: DESCRIPTION,
    alternates: { canonical: PAGE_URL },
    openGraph: {
      // website, not article. This page is a tool, and on this SERP the tools
      // take the traffic while the high-authority articles above them take
      // none, so there is no reason to signal being an article. Freshness
      // moves to where it belongs and is better expressed anyway:
      // datePublished and dateModified on the WebPage and Dataset nodes, plus
      // a visible line above the fold.
      type: "website",
      url: PAGE_URL,
      title: TITLE,
      description: DESCRIPTION,
      siteName: SITE_NAME,
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

/** Lucide's `check` glyph, inlined. See the note on the calculator section:
 *  one icon does not justify a runtime dependency, and this is that icon's
 *  own path data at its own stroke settings, so it is the same mark. */
function Check() {
  return (
    <svg
      className="rl-check"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// The four largest XRP yield products by category, read from the same
// data/xrp-yield.json the report is built from, so the two pages cannot
// disagree about a rate. One product per category rather than the four
// largest overall: ranked purely by size the list is two Upshift vaults and
// something paying a negative rate, which shows the reader nothing about
// where XRP yield comes from.
interface YieldPick {
  category: string;
  platform: string;
  asset: string;
  chain: string;
  apy: number;
  tvlUsd: number;
  holders?: { count: number } | null;
}

function loadYieldPicks(): { picks: YieldPick[]; asOf: string } | null {
  try {
    const f = join(process.cwd(), "data", "xrp-yield.json");
    if (!existsSync(f)) return null;
    const d = JSON.parse(readFileSync(f, "utf-8")) as {
      generatedAt: string;
      pools: YieldPick[];
    };
    if (!Array.isArray(d.pools) || !d.pools.length) return null;
    const picks: YieldPick[] = [];
    for (const c of ["Vault", "Lending market", "Liquidity pool", "Fixed-Rate"]) {
      const top = d.pools
        .filter((x) => x.category === c && Number.isFinite(x.apy) && x.tvlUsd > 0)
        .sort((a, b) => b.tvlUsd - a.tvlUsd)[0];
      if (top) picks.push(top);
    }
    // Highest rate first. Sorting by deposits put the biggest venue on top
    // and the best rate last, which is the wrong answer to "where do people
    // earn on XRP".
    picks.sort((a, b) => b.apy - a.apy);
    return picks.length === 4 ? { picks, asOf: d.generatedAt } : null;
  } catch {
    return null;
  }
}

// The wrapped/staked XRP holder count, read from data/xrp-yield.json at build
// time rather than from the copy frozen into the rich-list snapshot.
//
// The snapshot carries a `yieldComparison` block, but it is stamped when the
// ledger walk runs and the yield pipeline runs on a different clock. The walk
// finished at 04:38 and the yield data refreshed at 16:09 the same day, so the
// page was quoting a figure eight days older than the file sitting next to it.
// The bridge section already reads this file directly; so does this now, and
// the two can no longer disagree.
interface YieldComparison {
  receiptTokenHolders: number;
  products: number;
  asOf: string;
  oldestAsOf: string;
  basis: string;
}

function loadYieldComparison(): YieldComparison | null {
  try {
    const f = join(process.cwd(), "data", "xrp-yield.json");
    if (!existsSync(f)) return null;
    const d = JSON.parse(readFileSync(f, "utf-8")) as {
      pools: { holders?: { count: number; asOf?: string } | null }[];
    };
    const rows = (d.pools ?? []).filter((p) => (p.holders?.count ?? 0) > 0);
    if (!rows.length) return null;
    const stamps = rows
      .map((p) => p.holders?.asOf)
      .filter((x): x is string => !!x)
      .sort();
    if (!stamps.length) return null;
    return {
      receiptTokenHolders: rows.reduce((a, p) => a + (p.holders?.count ?? 0), 0),
      products: rows.length,
      // Newest for the headline date, oldest kept so the note can state the
      // window the counts were actually read across. Every product is read on
      // its own schedule, so a single "as of" is the newest of them and the
      // note has to say the rest.
      asOf: stamps[stamps.length - 1],
      oldestAsOf: stamps[0],
      basis:
        "sum of per-product receipt-token holder counts on Flare and Base, not deduplicated across products",
    };
  } catch {
    return null;
  }
}

const usdShort = (n: number): string =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1_000)}k`;

function Crumbs() {
  return (
    <nav className="rp-crumbs" aria-label="Breadcrumb">
      <Link href="/">{SITE_NAME}</Link>
      <span className="sep">/</span>
      <span>XRP Rich List</span>
    </nav>
  );
}

export default function XrpRichListPage() {
  const data = loadRichList();

  if (!data) {
    return (
      <div className="uni-home-test rp-page rl-page">
        <Crumbs />
        <section className="uni-home-hero">
          <div className="uni-home-hero-inner">
            <h1 className="uni-home-h1">XRP Rich List</h1>
          <p className="rp-lead">
            The XRP Ledger snapshot behind this page is being rebuilt. Live
            figures return once the next ledger walk completes.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const snap = data.ledgerCloseIso;
  const snapDate = utcDate(snap);
  const snapStamp = utcStamp(snap);
  // Derived from the snapshot, never hardcoded, so the current-year cluster is
  // covered with no annual maintenance and it rolls over on 1 January, which
  // is exactly when the demand rolls.
  const year = new Date(snap).getUTCFullYear();

  // pctLabel drops the decimals above 10% because the tier table reads better
  // in whole numbers there. The concentration breakdown cannot: 35.65 and 36
  // are the difference between a figure a reader can check against the table
  // and one they cannot.
  const share2 = (v: number) => `${v.toFixed(2)}%`;

  const t1 = tierOf(data, 1);
  const t10 = tierOf(data, 10);
  const t50 = tierOf(data, 50);

  // Live file first, the snapshot's frozen copy as a fallback. Held apart so
  // the read-window note can key on the live shape without widening the type
  // of everything downstream.
  const ycLive = loadYieldComparison();
  const yc = ycLive ?? data.yieldComparison;
  const yieldPicks = loadYieldPicks();
  // Two counts of different kinds of object, so the ratio is presented as a
  // comparison rather than as a share. See the pipeline comment: an XRPL
  // account and a Flare or Base address holding a wrapped-XRP receipt token
  // are not the same thing, and one person can be several of either.
  const yieldRatioPct = yc ? (yc.receiptTokenHolders / data.accounts) * 100 : null;

  // Labels come from data/xrpl-account-labels.json, each carrying the evidence
  // it rests on. Separately, `domain` is what the account publishes about
  // itself onchain, which is the strongest evidence tier and currently empty
  // across every ranked account.
  // How deep the snapshot runs, read from the snapshot rather than written
  // down. The hourly walk decides this, so a hardcoded number is wrong the
  // first time that job changes depth or falls back to a shallower run, and
  // wrong on a page whose whole pitch is that its figures are checkable.
  const ranked = data.top.length;

  // Named holders can hold across several accounts, so a question about one
  // of them is a sum over the ranking rather than a single row. Derived here
  // rather than written down, so the answers cannot drift from the table.
  const holderTotals = new Map<
    string,
    { xrp: number; accounts: number; type: string | null }
  >();
  for (const t of data.top) {
    if (!t.label?.name) continue;
    const cur = holderTotals.get(t.label.name) ?? {
      xrp: 0,
      accounts: 0,
      type: t.label.type ?? null,
    };
    cur.xrp += t.xrp;
    cur.accounts += 1;
    holderTotals.set(t.label.name, cur);
  }
  // The distinct marks behind each breakdown group, ordered by how much the
  // holder behind them controls, so the first face in a stack is the one that
  // dominates the row. Derived from the same rows the row's figures are, so a
  // group can never show a logo for a holder it does not contain.
  const rankedRows = data.top;
  const groupMarks = (match: (t: (typeof rankedRows)[number]) => boolean) =>
    [...new Map(
      rankedRows
        .filter((t) => t.label?.name && match(t))
        .sort((a, b) => b.xrp - a.xrp)
        .map((t) => [t.label!.name, t.label!.name]),
    ).keys()].filter((n) => holderAvatar(n));

  const largestExchange = [...holderTotals.entries()]
    .filter(([, v]) => v.type === "exchange")
    .sort((a, b) => b[1].xrp - a[1].xrp)[0];
  const larsen = holderTotals.get("chrislarsen") ?? null;
  const usd = (xrp: number) =>
    data.xrpUsd ? `$${count(xrp * data.xrpUsd)}` : null;

  const labelled = data.top.filter((t) => t.label);
  const selfDeclared = data.top.filter((t) => t.domain);
  // The naming research covers the first hundred rows. The snapshot now runs
  // five times deeper than that, so the count above would read as thin
  // coverage of five hundred accounts unless the page says where the work
  // reaches. Derived rather than asserted, so it stays true if a name is ever
  // added further down.
  const namedBelowFirst100 = labelled.filter((t) => t.rank > 100).length;
  // The evidence line used to sit under every name in the table, which set the
  // height of forty-nine of the hundred rows. Every current attribution comes
  // from the same provider, so it is disclosed once here instead. If the
  // registry ever mixes providers this falls back to the generic wording.
  const attributions = new Set(
    labelled.map((t) => t.label?.attribution).filter((a): a is string => !!a),
  );
  const attribution = attributions.size === 1 ? [...attributions][0] : null;

  // Needs two distinct observation days before a movement sentence means
  // anything. One walk compared against itself reports no change and reads as
  // a stalled page.
  const hist =
    data.thresholdHistory && data.thresholdHistory.length >= 2
      ? data.thresholdHistory
      : null;
  const histFirst = hist?.[0] ?? null;

  const faqs = [
    {
      q: "Is there an XRP rich list?",
      a: `Yes, and it is also written as XRP richlist in one word. The XRP Ledger is public, so this page reads all ${count(data.accounts)} funded accounts from ledger ${count(data.ledgerIndex)}, closed ${snapStamp}, and ranks them by the XRP each one controls. How the walk and its histogram work, including the ${data.method.thresholdRelativeErrorPct}% threshold resolution that applied on ${snapDate}, is set out in the method section further down this page.`,
    },
    {
      q: "How often is this XRP rich list updated?",
      a: `Four times a day. The figures on this page come from ledger ${count(data.ledgerIndex)}, which closed ${snapStamp}, and the next walk replaces every number here with a reading from a later ledger. Nothing is averaged or carried over between runs: each update is one pass over every account in a single validated ledger, so the page always describes a state that existed rather than a blend of several.`,
    },
    {
      q: "How many XRP do you need to be in the top 1%?",
      a: t1
        ? `A balance of ${xrpAmount(t1.minXrp)} XRP put an account in the top 1% of funded XRP Ledger accounts as of ${snapDate}. That tier held ${pctLabel(t1.pctOfXrp)} of all XRP in funded accounts as of ${snapDate}.`
        : "",
    },
    {
      q: "How many XRP holders have 10,000 or more?",
      a: `${count(data.exactCounts["10000"] ?? 0)} funded XRP Ledger accounts held at least 10,000 XRP as of ${snapDate}, out of ${count(data.accounts)} funded accounts in total. At the round balances either side of it, as of ${snapDate}: ${count(data.exactCounts["1000"] ?? 0)} accounts held at least 1,000 XRP, ${count(data.exactCounts["20000"] ?? 0)} held at least 20,000 XRP, ${count(data.exactCounts["100000"] ?? 0)} held at least 100,000 XRP, and ${count(data.exactCounts["1000000"] ?? 0)} held at least 1,000,000 XRP. Every one of those counts is exact rather than read off the histogram.`,
    },
{
      q: "How many XRP Ledger accounts are there?",
      a: `${count(data.accounts)} accounts were funded on the XRP Ledger as of ${snapDate}. An account cannot exist on the ledger without meeting the base reserve, which validators lowered to 1 XRP in December 2024, so every account in that count holds a balance.`,
    },
    {
      q: "Who owns the most XRP?",
      a: data.top[0]
        ? `The largest single XRP Ledger account held ${xrpAmount(data.top[0].xrp)} XRP as of ${snapDate}, which is ${pctLabel(data.top[0].pctOfSupply)} of the XRP in funded accounts. Large accounts are usually exchange or custodian wallets holding balances for many customers rather than one owner, and this page names an account only against evidence it can show beside the name.`
        : "",
    },
    {
      q: "Is XRP ownership concentrated?",
      a: t1 && t50
        ? `The top 1% of funded XRP Ledger accounts held ${pctLabel(t1.pctOfXrp)} of the XRP in those accounts as of ${snapDate}. The top 50% held ${pctLabel(t50.pctOfXrp)} as of ${snapDate}, which means the lower half of accounts together held the remainder.`
        : "",
    },
{
      q: "How much XRP does Ripple hold?",
      a: data.concentration?.rippleXrp
        ? `Ripple the company controlled ${count(data.concentration.rippleXrp)} XRP as of ${snapDate}${
            data.xrpUsd ? `, worth about ${usd(data.concentration.rippleXrp)}` : ""
          }, across ${data.concentration.rippleAccounts} accounts in the ranking on this page. That is ${share2((data.concentration.rippleXrp / data.xrpHeld) * 100)} of all XRP in funded accounts as of ${snapDate}.${
            data.concentration.rippleEscrowedXrp
              ? ` Most of it cannot move: ${count(data.concentration.rippleEscrowedXrp)} XRP of that total sat in onchain escrow as of ${snapDate}, released on a schedule set in the ledger rather than held as a spendable balance.`
              : ""
          } Wallets belonging to Ripple's co-founders are counted separately and are not in this figure.`
        : "",
    },
{
      q: "Which exchange holds the most XRP?",
      a: largestExchange
        ? `${largestExchange[0]} held the most XRP of any exchange in this ranking as of ${snapDate}, with ${count(largestExchange[1].xrp)} XRP${
            data.xrpUsd ? ` worth about ${usd(largestExchange[1].xrp)}` : ""
          } across ${largestExchange[1].accounts} accounts. An exchange wallet holds balances for many customers at once, so a figure like this describes a venue's deposits rather than one owner's fortune.${
            data.concentration?.exchangeXrp
              ? ` Known exchange wallets held ${count(data.concentration.exchangeXrp)} XRP between them as of ${snapDate}, across ${data.concentration.exchangeAccounts} of the ranked accounts.`
              : ""
          }`
        : "",
    },
{
      q: "What is XRP's circulating supply?",
      a: data.totalSupplyXrp
        ? `${count(data.totalSupplyXrp)} XRP existed on the XRP Ledger as of ${snapDate}, read from the ledger's own total supply field rather than from a market tracker.${
            data.escrowedXrp != null
              ? ` Market listings usually quote a circulating supply that excludes XRP locked in onchain escrow, which was ${count(data.escrowedXrp)} XRP on that date, leaving ${count(data.totalSupplyXrp - data.escrowedXrp)} XRP circulating under that definition as of ${snapDate}.`
              : ""
          }`
        : "",
    },
    {
      q: "How much XRP has been burned?",
      a: data.totalSupplyXrp
        ? `${count(1e11 - data.totalSupplyXrp)} XRP had been destroyed by transaction fees as of ${snapDate}, measured as the gap between the 100,000,000,000 XRP created at launch and the ${count(data.totalSupplyXrp)} XRP the ledger reported on that date. Every XRP Ledger transaction destroys a small fee and no mechanism creates new XRP, so the total only falls. That is the amount gone since launch rather than a burn rate: a rate needs two measurements at different times, and this page reads one ledger.`
        : "",
    },
    {
      q: "Is 1,000 XRP a lot?",
      a: `${count(data.exactCounts["1000"] ?? 0)} of the ${count(data.accounts)} funded XRP Ledger accounts held at least 1,000 XRP as of ${snapDate}, so a balance that size sat above ${pctLabel(100 - ((data.exactCounts["1000"] ?? 0) / data.accounts) * 100)} of them${
        data.xrpUsd ? ` and was worth about ${usd(1000)} at ${data.xrpUsd.toFixed(4)} US dollars per XRP on that date` : ""
      }. Most accounts on the ledger hold very little, which is why a balance that feels small still places well up the distribution.`,
    },
    {
      q: "How many XRP would make you an XRP millionaire?",
      a: data.xrpUsd
        ? (() => {
            const need = 1_000_000 / data.xrpUsd;
            const above = Math.round(accountsAtOrAbove(data.ladder, need));
            return `${count(need)} XRP was worth one million US dollars as of ${snapDate}, at ${data.xrpUsd.toFixed(4)} dollars per XRP. About ${count(above)} funded XRP Ledger accounts held at least that much as of ${snapDate}, which is ${pctLabel((above / data.accounts) * 100)} of all funded accounts. The XRP figure moves with the price, so the balance needed changes daily even when nobody buys or sells.`;
          })()
        : "",
    },
    {
      q: "What is the median XRP balance?",
      a: t50
        ? `Half of all funded XRP Ledger accounts held ${xrpAmount(t50.minXrp)} XRP or less as of ${snapDate}, so that is the median balance. The mean sits far higher because a few accounts holding billions pull it up: ${count(data.accounts)} accounts shared ${xrpAmount(data.xrpHeld)} XRP as of ${snapDate}. When a distribution is this skewed the median describes a typical holder and the mean does not.`
        : "",
    },
    {
      q: "What share of all XRP do the top 100 wallets hold?",
      a: data.concentration?.top100PctOfXrp
        ? `The 100 largest XRP Ledger accounts held ${share2(data.concentration.top100PctOfXrp)} of all XRP in funded accounts as of ${snapDate}. Taking known exchange wallets out of that leaves ${share2(data.concentration.exExchangePctOfXrp)} as of the same date, which is the closer read on concentration, because an exchange wallet holds balances for many customers rather than for one owner.`
        : "",
    },
    {
      q: "How much of all XRP sits on exchanges?",
      a: data.concentration?.exchangeXrp
        ? `Known exchange wallets in the top 100 held ${count(data.concentration.exchangeXrp)} XRP as of ${snapDate}, which is ${share2((data.concentration.exchangeXrp / data.xrpHeld) * 100)} of all XRP in funded accounts${
            data.xrpUsd ? ` and worth about ${usd(data.concentration.exchangeXrp)}` : ""
          }. That covers the ${data.concentration.exchangeAccounts} accounts this page could attribute to a venue as of ${snapDate}, so it is a floor rather than a total: an exchange wallet nobody has identified is counted as unnamed.`
        : "",
    },
    {
      q: "How much XRP is locked in escrow?",
      a: data.escrowedXrp
        ? `${count(data.escrowedXrp)} XRP sat in onchain escrow as of ${snapDate}, which is ${share2((data.escrowedXrp / data.xrpHeld) * 100)} of all XRP in funded accounts${
            data.escrowObjects && data.escrowAccounts
              ? `, held in ${count(data.escrowObjects)} escrow objects across ${count(data.escrowAccounts)} accounts`
              : ""
          }. Escrowed XRP cannot be spent until the release date written into the ledger, and this page counts it toward the balance of the account that owns it, because that is what the account controls.`
        : "",
    },
    {
      q: "How many XRP holders earn yield on their XRP?",
      a: yc
        ? `${count(yc.receiptTokenHolders)} addresses held a wrapped or staked XRP product across ${yc.products} tracked venues as of ${utcDate(yc.asOf ?? snap)}, against ${count(data.accounts)} funded XRP Ledger accounts as of ${snapDate}. The two count different objects, so the comparison is a ratio rather than a share, and as of ${snapDate} it works out at ${pctLabel(yieldRatioPct ?? 0)}. The XRP Ledger pays no protocol reward for holding a balance and has no validator staking, so a balance that sits there earns nothing by design.`
        : "",
    },
    {
      // "XRP whale" is asked constantly and the word appeared nowhere on a
      // page that holds the only figures which can answer it. Answered with
      // the bands rather than with a definition, because there is no official
      // threshold and inventing one would be the wrong kind of confidence.
      q: "What counts as an XRP whale?",
      a: (() => {
        const m1 = data.bands.find((b) => b.min === 1_000_000);
        const m10 = data.bands.find((b) => b.min === 10_000_000);
        if (!m1 || !m10) return "";
        const both = m1.accounts + m10.accounts;
        return `There is no official threshold, so the honest answer is a distribution rather than a number. ${count(both)} of the ${count(data.accounts)} funded XRP Ledger accounts held 1,000,000 XRP or more as of ${snapDate}, which is ${pctLabel(m1.pctOfAccounts + m10.pctOfAccounts)} of them, and those accounts controlled ${pctLabel(m1.pctOfXrp + m10.pctOfXrp)} of all XRP on that date. Above them, ${count(m10.accounts)} accounts held 10,000,000 XRP or more as of ${snapDate}. For a threshold that moves with the ledger rather than a round number, the top 1% of accounts started at ${t1 ? xrpAmount(t1.minXrp) : "the figure in the table above"} XRP as of ${snapDate}.`;
      })(),
    },
].filter((f) => f.a);

  const crumbs = [
    { name: "Home", url: SITE_URL },
    { name: "XRP Rich List", url: PAGE_URL },
  ];

  return (
    <div className="uni-home-test rp-page rl-page">
      <Crumbs />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(crumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(faqs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            reportDatasetSchema({
              name: "XRP Ledger holder distribution dataset",
              description: `Balance distribution across all ${count(data.accounts)} funded XRP Ledger accounts, with tier thresholds, decade bands and the largest ${ranked} accounts, read from ledger ${count(data.ledgerIndex)}.`,
              url: PAGE_URL,
              // The newest observation, which is the ledger close, not the
              // pipeline run. A build that changed nothing must not advance it.
              dateModified: snap,
              numberOfItems: data.accounts,
              keywords: ["XRP", "XRPL", "rich list", "holder distribution", "wallet balances"],
              // The ledger itself. There is no aggregator in the path and
              // nothing here credits one.
              sources: ["https://xrpl.org"],
              // Every file build-richlist-export.mjs writes. Two of the four
              // were missing, so the thresholds and the ranked accounts were
              // downloadable and undeclared.
              distribution: [
                { format: "application/json", url: `${SITE_URL}/data/xrp-rich-list/index.json` },
                { format: "text/csv", url: `${SITE_URL}/data/xrp-rich-list/distribution.csv` },
                { format: "text/csv", url: `${SITE_URL}/data/xrp-rich-list/thresholds.csv` },
                { format: "text/csv", url: `${SITE_URL}/data/xrp-rich-list/top-accounts.csv` },
              ],
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "XRP rich list calculator",
            url: `${PAGE_URL}#calculator`,
            applicationCategory: "FinanceApplication",
            operatingSystem: "Any",
            browserRequirements: "Requires JavaScript for the balance lookup",
            description:
              "Enter an XRP balance and see its percentile against every funded XRP Ledger account. No wallet connection and no address.",
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            author: { "@type": "Organization", name: SITE_AUTHOR.name, url: SITE_AUTHOR.url },
          }),
        }}
      />
      {/* The page carries a dateline and its value is that the figures are
          current, so it declares a dateModified that a crawler can trust: the
          pinned ledger's close, never the build time. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            reportWebPageSchema({
              name: "XRP Rich List",
              url: PAGE_URL,
              description: DESCRIPTION,
              datePublished: PUBLISHED_ISO,
              dateModified: snap,
            }),
          ),
        }}
      />
      {/* The ranking as a list, because a ranked list is what the query asks
          for and the table alone does not say so in a form a crawler reads.
          Every ranked account is here rather than a sample, so numberOfItems
          describes the list it is attached to. Positions come from the
          snapshot, so this cannot disagree with the table above it. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `Largest XRP Ledger accounts as of ${snapDate}`,
            description: `The ${count(ranked)} XRP Ledger accounts holding the most XRP, spendable and escrowed together, read from ledger ${count(data.ledgerIndex)}.`,
            url: `${PAGE_URL}#top-accounts`,
            itemListOrder: "https://schema.org/ItemListOrderDescending",
            numberOfItems: ranked,
            itemListElement: data.top.map((t, i) => ({
              "@type": "ListItem",
              // Position is the index, not the row's `rank` field. ListItem
              // positions have to be unique and sequential, and the snapshot
              // currently on main carries 16 duplicate ranks and 14 ordering
              // breaks from a checkpoint bug in the ledger walk. Reading the
              // array order keeps the structured data valid while that is
              // still true, and agrees with the column once it is fixed.
              position: i + 1,
              // The name where the registry can show a source for it, the
              // address otherwise. Never a guess: an unnamed account is
              // published as its address rather than as an inference.
              name: t.label?.name ?? t.address,
            })),
          }),
        }}
      />

      {/* ---------------------------------------------------------- hero
          Laid out as an article rather than as a hero: headline, dateline,
          featured image, then a summary. That shape is what the pages winning
          this SERP use, and it puts the three facts a reader came for above
          the fold without making them read a paragraph to reach them. */}
      <section className="rl-intro">
        <h1 className="uni-home-h1 rl-h1">XRP Rich List &amp; Calculator</h1>
        <p className="rl-dateline">
          Live from the XRP Ledger, refreshed four times a day. Latest
          snapshot: {snapStamp}.
        </p>
        {/* Featured image. Static import, so Next emits the intrinsic size and
            the slot reserves its own height before the file loads. `priority`
            because it is the largest element above the fold and is what LCP
            measures on this page.

            Empty alt on purpose. The image is decorative: it repeats the
            headline in pixels and shows faces the page never names, and every
            claim on this page lives in the summary underneath it. An alt that
            described the faces would be asserting identities the ranking
            itself refuses to assert without evidence. */}
        <Image
          src={richListHeader}
          alt=""
          className="rl-figure"
          sizes="100vw"
          priority
        />
        {/* Image credit. The header is a composite of portraits this page did
            not take, and a page that insists on a source for every name owes
            one for every face too. Kept to a caption because it is provenance
            rather than something a reader came for. */}
        <p className="rl-figure-credit">
          Header image: portrait of Chris Larsen courtesy of RippleWorks;
          portrait of Brad Garlinghouse and the remaining portraits from X.
        </p>

        <h2 className="rl-summary-h">Summary</h2>
        <ul className="rl-keyfind">
          {/* The hook, and the one line most visitors came for. It used to
              open on the largest holding attributed to a person, which is the
              more careful claim but buries the plain fact under two
              qualifications before reaching a number. The careful version
              still exists in full in the concentration section. */}
          {data.top[0] ? (
            <li>
              The richest XRP wallet holds{" "}
              <strong>{count(data.top[0].xrp)} XRP</strong>
              {data.xrpUsd ? (
                <>
                  , worth{" "}
                  <strong>${count(data.top[0].xrp * data.xrpUsd)}</strong>
                </>
              ) : null}{" "}
              as of {snapDate}.
            </li>
          ) : null}
          {largestExchange ? (
            <li>
              The largest exchange holding XRP is{" "}
              <strong>{largestExchange[0]}</strong>, with{" "}
              <strong>{count(largestExchange[1].xrp)} XRP</strong> across{" "}
              {largestExchange[1].accounts} accounts as of {snapDate}
              {data.xrpUsd ? <>, worth {usd(largestExchange[1].xrp)}</> : null}.
            </li>
          ) : null}
          {larsen ? (
            <li>
              Chris Larsen, Ripple&rsquo;s co-founder and executive chairman,
              holds <strong>{count(larsen.xrp)} XRP</strong> across{" "}
              {larsen.accounts} ranked accounts as of {snapDate}
              {data.xrpUsd ? (
                <>
                  , worth <strong>{usd(larsen.xrp)}</strong>{" "}
                  at that date&rsquo;s rate
                </>
              ) : null}
              .
            </li>
          ) : null}
          <li>
            <strong>{count(data.accounts)}</strong> XRP addresses were funded on
            the XRP Ledger as of {snapDate}, controlling{" "}
            {xrpAmount(data.xrpHeld)} XRP between them.
          </li>
          {t1 ? (
            <li>
              To sit in the top 1% of XRP holders an account needed at least{" "}
              <strong>{xrpAmount(t1.minXrp)} XRP</strong> as of {snapDate}.
            </li>
          ) : null}
        </ul>
      </section>

      {/* Calculator.
          Laid out on the shadcn "feature" pattern: one bordered, rounded card
          holding a two-column grid, with an eyebrow badge, heading, lead and a
          checklist on the left and the artifact on the right. In that pattern's
          reference markup the right column is an empty muted square; here it is
          the calculator itself, which is the point of the section.

          Written against this repo's own tokens rather than copied verbatim.
          See the note in _styles/rich-list.css for why. */}
      <section className="rl-section rl-feature" aria-labelledby="calculator-title">
        <div className="rl-feature-card">
          <div className="rl-feature-copy">
            {/* The badge sits inside the heading block rather than above it,
                so the flex gap between the two is the block's own 10px rather
                than the column's 26px. The mark lives in the badge, sized to
                its line box. */}
            <div className="rl-feature-head">
              <span className="rl-eyebrow-badge">
                <AssetIcon asset="XRP" size={16} decorative />
                Calculator
              </span>
              {/* One element, no <br>. The break split the heading in two
                  for anything that strips tags, which is how it came out of an
                  extractor as "## The XRP" followed by "## Rich List
                  Calculator". */}
              <h2 id="calculator-title" className="rl-calc-title">
                XRP Rich List Calculator
              </h2>
              <p className="rl-calc-pitch-sub">
                Enter your XRP balance to see where you rank on the rich list.
              </p>
            </div>

            <ul className="rl-checklist" data-lint="chrome">
              <li>
                <Check />
                <div>
                  <p>Free to use</p>
                  <p className="rl-checklist-sub">No address or wallet needed.</p>
                </div>
              </li>
              <li>
                <Check />
                <div>
                  <p>Measured against over 8M XRP accounts</p>
                  <p className="rl-checklist-sub">
                    Checked against {count(data.accounts)} XRP accounts.
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <PercentileCalculator
            ladder={data.ladder}
            accounts={data.accounts}
            ranked={ranked}
            snapshotDate={snapDate}
          />
        </div>
      </section>

      <section className="uni-home-content rl-jump" aria-labelledby="jump">
        <h2 id="jump" className="rl-sr">On this page</h2>
        <nav className="rp-toc" aria-label="On this page">
          <span className="rp-toc-label">On this page</span>
          <a href="#calculator">Calculator</a>
          <a href="#top-accounts">Top {count(ranked)}</a>
          <a href="#thresholds">Thresholds</a>
          <a href="#larsen">Chris Larsen</a>
          <a href="#supply">Supply</a>
          <a href="#what-it-shows">What it shows</a>
          {yc ? <a href="#working-vs-idle">Working or idle</a> : null}
          <a href="#faq">Questions</a>
          <a href="#methodology">Method</a>
        </nav>
      </section>

      {/* Three artifacts, three sections. A table, then a chart, then a
          second table stacked under one heading gave the reader no way to tell
          which caption belonged to which, and nowhere to breathe. Each now
          carries its own lead in and its own note underneath. */}

      {/* -------------------------------------------------- thresholds */}
      {/* ------------------------------------------------ top accounts */}
      <section className="uni-home-content rl-section" aria-labelledby="top-accounts">
        <p className="rp-eyebrow">Largest accounts</p>
        <h2 id="top-accounts">XRP top holders: the {count(ranked)} largest wallets</h2>
        <p className="rp-lead">
          The {count(ranked)} largest funded XRP Ledger accounts as of{" "}
          {snapDate}, read from ledger {count(data.ledgerIndex)} and ranked on
          the XRP each one controls{ranked > 100 ? ", a hundred to a page" : ""}.
        </p>
        <TopAccountsTable
          rows={data.top}
          snapshotDate={snapDate}
          xrpUsd={data.xrpUsd ?? null}
        />

        <p className="rl-note">
          {labelled.length > 0
            ? `${labelled.length} of the ${data.top.length} ranked accounts carry a name as of ${snapDate}.`
            : `None of the ${data.top.length} ranked accounts is named as of ${snapDate}.`}{" "}
          {ranked > 100 && labelled.length > 0 && namedBelowFirst100 === 0
            ? "All of them sit in the first hundred rows, which is as far as the naming research reaches."
            : null}{" "}
          {selfDeclared.length === 0
            ? "Not one of them publishes a domain onchain, which is the only identity an account can declare about itself."
            : `${selfDeclared.length} publish a domain onchain, which is the strongest evidence available.`}
        </p>
        <p className="rl-note">
          Naming an account from how it transacts would be a guess, so this page
          names an account only against a source it can show.
        </p>
        <p className="rl-note">
          An account is ranked on its spendable balance plus anything it holds
          in onchain escrow, which is why an account with a few hundred XRP
          spendable can sit near the top.
        </p>

        {data.xrpUsd ? (
          <p className="rl-note">
            Dollar values use {data.xrpUsd.toFixed(4)} US dollars per XRP as of{" "}
            {snapDate}, read from {data.xrpUsdSource}. They move with the price
            and the XRP amounts beside them do not.
          </p>
        ) : null}
        <p className="rl-note">
          Share of supply is measured against all XRP in funded accounts as of{" "}
          {snapDate}. The escrow column is the part of each balance locked
          onchain on that date rather than a figure on top of it.
        </p>
        <p className="rl-note">
          {attribution
            ? `Every name in the table is attributed by ${attribution} rather than established by this page.`
            : "Every name in the table is a third-party attribution rather than a finding of this page."}
        </p>
      </section>

      {/* -------------------------------------------------------- FAQ */}
      <section className="uni-home-content rl-section" aria-labelledby="thresholds">
        <p className="rp-eyebrow">Distribution</p>
        <h2 id="thresholds">XRP rich list {year}: current thresholds</h2>
        <p className="rp-lead">
          {t1 && t10 && t50
            ? `The minimum to sit in the top 1% of funded XRP Ledger accounts was ${xrpAmount(t1.minXrp)} XRP as of ${snapDate}, against ${xrpAmount(t10.minXrp)} XRP for the top 10% and ${xrpAmount(t50.minXrp)} XRP for the top 50%.`
            : ""}
        </p>
        <p className="rl-section-intro">
          A tier threshold is the smallest amount of XRP that placed an account
          in that percentage of all {count(data.accounts)} funded accounts as of{" "}
          {snapDate}. An account is measured on what it controls, which is its
          spendable balance plus anything it holds in onchain escrow.
        </p>

        <div className="rl-dtable-wrap" data-nosnippet="">
          <table className="rl-dtable rl-tiers">
            <caption className="rl-dtable-cap">
              XRP rich list thresholds by percentage tier, as of {snapDate}
            </caption>
            <thead>
              <tr>
                <th scope="col">Percentage tier</th>
                <th scope="col">Minimum XRP controlled</th>
                <th scope="col">Accounts at or above</th>
                <th scope="col">That tier alone</th>
                <th scope="col">Cumulative share of XRP</th>
              </tr>
            </thead>
            <tbody>
              {data.tiers.map((t, i) => {
                // Each row's share counts everything above it too, so the
                // column climbs rather than summing. The marginal figure is
                // what this tier adds on its own, which is the number a reader
                // is looking for when they try to add the column up.
                const prev = i === 0 ? 0 : data.tiers[i - 1].pctOfXrp;
                const alone = Math.max(0, t.pctOfXrp - prev);
                return (
                  <tr key={t.pct}>
                    <th scope="row">Top {t.pct}%</th>
                    <td className="rl-num" data-label="Minimum XRP">{xrpAmount(t.minXrp)}</td>
                    <td className="rl-num" data-label="Accounts at or above">{count(t.accounts)}</td>
                    <td className="rl-num" data-label="That tier alone">{pctLabel(alone)}</td>
                    <td className="rl-num" data-label="Cumulative share">{pctLabel(t.pctOfXrp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="rl-note">
          Every tier contains the ones above it, so the cumulative column
          climbs down the table rather than summing to 100%: the top 1% row
          counts the top 0.1% inside it. The column beside it is what each
          tier adds on its own, and those do sum. Thresholds are read from a
          histogram of every account balance, which bounds each figure at{" "}
          {data.method.thresholdRelativeErrorPct}% as of {snapDate}. Shares are
          measured against all XRP in funded accounts, escrowed and spendable
          together.
        </p>
      </section>

      {/* ------------------------------------------------------- chart */}
      <section className="uni-home-content rl-section" aria-labelledby="chart">
        <p className="rp-eyebrow">Shape of the ledger</p>
        <h2 id="chart">How XRP is spread across wallets</h2>
        <p className="rp-lead">
          Most funded XRP Ledger accounts hold very little.{" "}
          {pctLabel(
            data.bands
              .filter((b) => b.max != null && b.max <= 1_000)
              .reduce((a, b) => a + b.pctOfAccounts, 0),
          )}{" "}
          of them held under 1,000 XRP as of {snapDate}.
        </p>
        <p className="rl-section-intro">
          Every bar below is one balance band, and its height and the number
          above it are how many accounts held an amount inside that band as of{" "}
          {snapDate}. The smaller figure under each band is that band&rsquo;s
          share of all funded accounts on the same date.
        </p>

        {/* Card chrome in the shape shadcn gives a chart: bordered and
            rounded, a header carrying the title and a one-line description,
            the plot in the body below it. */}
        <div className="rl-chart-card">
          <div className="rl-chart-card-head">
            <div>
              <h3 className="rl-chart-card-title">
                XRP rich list chart: funded accounts by balance band
              </h3>
              <p className="rl-chart-card-desc">
                All {count(data.accounts)} funded XRP Ledger accounts as of{" "}
                {snapDate}
              </p>
            </div>
            <span className="rl-chart-legend">
              <span className="rl-chart-swatch" aria-hidden="true" />
              Accounts
            </span>
          </div>
          <div className="rl-chart-card-body rl-chart-scroll">
            <DistributionChart
              bands={data.bands}
              snapshotDate={snapDate}
              totalAccounts={data.accounts}
            />
          </div>
        </div>

        <p className="rl-note">
          The XRP rich list chart above draws one bar per balance band, and the
          figure above a bar
          is how many funded XRP Ledger accounts held an amount inside that
          band as of {snapDate}. All {count(data.accounts)} funded accounts sit
          in exactly one band each as of {snapDate}.
        </p>
        <p className="rl-note">
          Bar heights use a square-root scale as of {snapDate}, so a band holding
          a few hundred accounts stays visible beside one holding three million.
          Reading heights against each other therefore understates the gap
          between them; the printed counts are the exact figures.
        </p>
      </section>

      {/* -------------------------------------------------- band table */}
      <section className="uni-home-content rl-section" aria-labelledby="bands">
        <p className="rp-eyebrow">Band by band</p>
        <h2 id="bands">Wallets and XRP held, by balance band</h2>
        <p className="rp-lead">
          The largest band by account count and the largest by XRP held are not
          the same band, and the table below is where that separation is visible
          as of {snapDate}.
        </p>
        <p className="rl-section-intro">
          Every one of the {count(data.accounts)} funded accounts sits in exactly
          one band as of {snapDate}. The last two columns are the XRP those
          accounts controlled and what share of all XRP that came to, on the
          same date.
        </p>

        <DistributionTable bands={data.bands} snapshotDate={snapDate} />

        <p className="rl-note">
          Bands are decade-wide and read as at least the lower bound and below
          the upper one. Amounts count escrowed XRP alongside spendable
          balances, measured as of {snapDate}.
        </p>
      </section>

      {/* ------------------------------------------------ what it shows */}
      <section className="uni-home-content rl-section" aria-labelledby="what-it-shows">
        <p className="rp-eyebrow">Reading the numbers</p>
        <h2 id="what-it-shows">What the XRP balance distribution shows</h2>
        <div className="rp-article">
          <p>
            {t1
              ? `The top 1% of funded XRP Ledger accounts held ${pctLabel(t1.pctOfXrp)} of the XRP controlled across funded accounts as of ${snapDate}.`
              : ""}{" "}
            {t50
              ? `The top 50% held ${pctLabel(t50.pctOfXrp)} as of ${snapDate}, which leaves the smaller half of accounts holding the rest.`
              : ""}{" "}
            {data.escrowedXrp
              ? `Those shares count escrowed XRP alongside spendable balances, and ${xrpAmount(data.escrowedXrp)} XRP of the total was locked in escrow as of ${snapDate}.`
              : ""}
          </p>
          <p>
            Concentration at the top of this list is not the same as
            concentration of ownership. The largest accounts on the XRP Ledger
            are mostly exchange and custodian wallets, and a single one of them
            can hold balances for millions of customers, which is why this page
            names an account only against evidence it can show beside the name.
          </p>
          <p>
            Most funded accounts hold very little. {" "}
            {data.bands.filter((b) => b.max != null && b.max <= 1000).reduce((s, b) => s + b.pctOfAccounts, 0) > 0
              ? `Accounts holding under 1,000 XRP made up ${pctLabel(
                  data.bands
                    .filter((b) => b.max != null && b.max <= 1_000)
                    .reduce((s, b) => s + b.pctOfAccounts, 0),
                )} of all funded accounts as of ${snapDate}, and together they held ${pctLabel(
                  data.bands
                    .filter((b) => b.max != null && b.max <= 1_000)
                    .reduce((s, b) => s + b.pctOfXrp, 0),
                )} of the XRP in funded accounts.`
              : ""}{" "}
            That shape is why most people who check a balance against this list
            place higher than they expect.
          </p>

          {/* Threshold movement. Nobody else on this SERP shows it, and it is
              the reason to come back next month. Renders only once the daily
              walk has accumulated a second observation, so the first snapshot
              after launch does not print a comparison against itself. */}
          {hist && histFirst && t10 ? (
            <ul className="rl-keyfind">
              <li>
                The top 10% threshold has moved from{" "}
                <strong>{xrpAmount(histFirst.tiers["10"])} XRP</strong> on{" "}
                {utcDate(`${histFirst.d}T00:00:00Z`)} to{" "}
                <strong>{xrpAmount(t10.minXrp)} XRP</strong> as of {snapDate}.
              </li>
              {histFirst.tiers["1"] && t1 ? (
                <li>
                  The top 1% threshold has moved from{" "}
                  <strong>{xrpAmount(histFirst.tiers["1"])} XRP</strong> on{" "}
                  {utcDate(`${histFirst.d}T00:00:00Z`)} to{" "}
                  <strong>{xrpAmount(t1.minXrp)} XRP</strong> as of {snapDate}.
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </section>

      {/* --------------------------------------------- working vs idle */}
      {yc && yieldRatioPct != null ? (
        <section className="uni-home-content rl-section" aria-labelledby="working-vs-idle">
          <p className="rp-eyebrow">Comparison</p>
          <h2 id="working-vs-idle">How much XRP is working rather than sitting idle</h2>
          <div className="rp-article">
            <p className="rp-lead">
              {count(data.accounts)} accounts were funded on the XRP Ledger as of{" "}
              {snapDate}. Across the wrapped and staked XRP products tracked in
              the XRP yield ranking, {count(yc.receiptTokenHolders)} addresses
              held a position as of {utcDate(yc.asOf ?? snap)}, a figure equal to{" "}
              {pctLabel(yieldRatioPct)} of that XRPL account count.
            </p>
            <p>
              The two figures count different objects and the comparison is a
              ratio rather than a share. An XRP Ledger account is an entry in
              the ledger&rsquo;s own state. A tracked position is an address on
              Flare or Base holding a receipt token for wrapped or staked XRP,
              counted once per product, so a person holding two products appears
              twice. Both readings push the same way: the number of XRP holders
              with a balance doing anything at all is small next to the number
              of accounts that simply hold.
            </p>
            {ycLive && ycLive.oldestAsOf !== ycLive.asOf ? (
              <p>
                Every product in the XRP yield ranking is read on its own
                schedule, so the total is a sum of counts taken between{" "}
                {utcDate(ycLive.oldestAsOf)} and {utcDate(ycLive.asOf)} rather
                than all at one moment.
              </p>
            ) : null}
            <p>
              The XRP Ledger pays no protocol reward for holding a balance, and
              it has no validator staking, so a balance that sits on the ledger
              earns nothing by design rather than by neglect.{" "}
              <Link href="/report/xrp-yield-ranking">
                The XRP yield ranking
              </Link>{" "}
              tracks where XRP-denominated rates actually come from.
            </p>
          </div>
        </section>
      ) : null}

      {/* ----------------------------------------------- concentration */}
      {data.concentration ? (
        <section className="uni-home-content rl-section" aria-labelledby="concentration">
          <p className="rp-eyebrow">Concentration</p>
          <h2 id="concentration">What the largest 100 accounts hold</h2>
          <p className="rp-lead">
            The 100 largest XRP Ledger accounts controlled{" "}
            {share2(data.concentration.top100PctOfXrp)} of all XRP as of{" "}
            {snapDate}, and{" "}
            {share2(data.concentration.exExchangePctOfXrp)} once known exchange
            wallets are set aside.
          </p>
          <p className="rl-section-intro">
            An exchange wallet is thousands of customer balances pooled into one
            account, so counting it as concentration reads the ledger wrong. The
            second figure is the closer answer to how few hands hold XRP, and it
            is still only as complete as the {data.concentration.labelledAccounts}{" "}
            accounts named in this list as of {snapDate}.
          </p>

          {data.concentration.ripplePctOfXrp != null ? (
            <p className="rl-section-intro">
              The headline share is also mostly one entity. Ripple itself
              controlled {data.concentration.rippleAccounts} of these accounts as
              of {snapDate}, holding{" "}
              <strong>{share2(data.concentration.ripplePctOfXrp)}</strong> of all
              XRP in funded accounts on that date, which is more than half of
              everything the top 100 held. Most of it cannot move:{" "}
              {xrpAmount(data.concentration.rippleEscrowedXrp ?? 0)} XRP of that
              position sat in onchain escrow as of {snapDate}, released against a
              published schedule rather than sitting as a spendable balance.
            </p>
          ) : null}

          <StatCards
            stats={[
              {
                value: share2(data.concentration.top100PctOfXrp),
                label: `of all XRP held by the top 100 accounts, ${snapDate}`,
              },
              {
                value: share2(data.concentration.exExchangePctOfXrp),
                label: `held once the ${data.concentration.exchangeAccounts} known exchange wallets are excluded, ${snapDate}`,
              },
              {
                value: xrpAmount(data.concentration.exchangeXrp),
                label: `XRP sitting in those exchange wallets, ${snapDate}`,
              },
            ]}
          />

          {data.concentration.residualPctOfXrp != null ? (
            <>
              <div className="rl-breakdown" role="table" aria-label={`The top 100 XRP Ledger accounts split by who holds them, ${snapDate}`}>
                <div className="rl-breakdown-head" role="row">
                  <span role="columnheader">Group</span>
                  <span role="columnheader" className="rl-rank-n">Accounts</span>
                  <span role="columnheader" className="rl-rank-n">XRP</span>
                  <span role="columnheader" className="rl-rank-n">Share of all XRP</span>
                </div>
                {[
                  {
                    k: "ripple",
                    name: "Ripple-controlled",
                    marks: groupMarks((t) => t.label?.affiliation === "ripple"),
                    n: data.concentration.rippleAccounts ?? 0,
                    x: data.concentration.rippleXrp ?? 0,
                    p: data.concentration.ripplePctOfXrp ?? 0,
                  },
                  {
                    k: "exchange",
                    name: "Known exchanges",
                    marks: groupMarks((t) => t.label?.type === "exchange"),
                    n: data.concentration.exchangeAccounts,
                    x: data.concentration.exchangeXrp,
                    p:
                      data.concentration.top100PctOfXrp -
                      data.concentration.exExchangePctOfXrp,
                  },
                  {
                    k: "founder",
                    name: "Ripple founders",
                    marks: groupMarks((t) => t.label?.affiliation === "ripple-founder"),
                    n: data.concentration.founderAccounts ?? 0,
                    x: data.concentration.founderXrp ?? 0,
                    p: data.concentration.founderPctOfXrp ?? 0,
                  },
                  {
                    k: "residual",
                    name: "Unnamed accounts",
                    marks: [] as string[],
                    n: data.concentration.residualAccounts ?? 0,
                    x: data.concentration.residualXrp ?? 0,
                    p: data.concentration.residualPctOfXrp ?? 0,
                  },
                ].map((g) => (
                  <div className="rl-breakdown-row" role="row" key={g.k}>
                    <span role="cell" className="rl-breakdown-group">
                      {g.name}
                      <AvatarStack names={g.marks} />
                    </span>
                    <span role="cell" className="rl-rank-n">{g.n}</span>
                    <span role="cell" className="rl-rank-n">{xrpAmount(g.x)}</span>
                    <span role="cell" className="rl-rank-n">{share2(g.p)}</span>
                  </div>
                ))}
              </div>
              <p className="rl-section-intro">
                Set every named group aside and{" "}
                {data.concentration.residualAccounts} accounts are left, holding{" "}
                <strong>{share2(data.concentration.residualPctOfXrp)}</strong> of
                all XRP as of {snapDate}. Those are the positions this page cannot
                attribute to anyone as of that date, and they are the part of the
                ranking where a reader learns something a headline share does not
                tell them. Each group can be filtered out of the ranking
                above, so the remainder reads on its own.
              </p>
              <p className="rl-section-intro">
                One more distinction worth keeping. The{" "}
                {data.concentration.founderAccounts} founder accounts are personal
                balances attributed to people who co-founded Ripple, holding{" "}
                {share2(data.concentration.founderPctOfXrp ?? 0)} of all XRP as of{" "}
                {snapDate}. They are counted apart from the company because the
                company does not control them, and a total that merges the two
                overstates what Ripple holds by that margin.
              </p>
            </>
          ) : null}

          {data.concentration.largestIndividual ? (
            <p className="rl-highlight">
              The largest holding attributed to a person rather than to a company
              or a trading venue was{" "}
              <strong>
                {count(data.concentration.largestIndividual.xrp)} XRP
              </strong>
              {data.xrpUsd ? (
                <>
                  , worth about{" "}
                  <strong>
                    ${count(data.concentration.largestIndividual.xrp * data.xrpUsd)}
                  </strong>{" "}
                  at {data.xrpUsd.toFixed(4)} US dollars per XRP
                </>
              ) : null}{" "}
              as of {snapDate}, at rank{" "}
              {data.concentration.largestIndividual.rank} in the list above.
            </p>
          ) : null}

          <p className="rl-note">{data.concentration.basis}</p>
        </section>
      ) : null}

      {/* ------------------------------------------------------ larsen */}
      {larsen ? (
        <section className="uni-home-content rl-section" aria-labelledby="larsen">
          <p className="rp-eyebrow">Named holder</p>
          <h2 id="larsen">How much XRP does Chris Larsen hold?</h2>
          <p className="rp-lead">
            Accounts attributed to Chris Larsen, Ripple&rsquo;s co-founder and
            executive chairman, held{" "}
            <strong>{count(larsen.xrp)} XRP</strong> as of {snapDate}
            {data.xrpUsd ? <>, worth about {usd(larsen.xrp)}</> : null}, across{" "}
            {larsen.accounts} accounts in the ranking above.
          </p>
          <p className="rl-section-intro">
            Larsen&rsquo;s ranked accounts held{" "}
            {share2((larsen.xrp / data.xrpHeld) * 100)} of all XRP in funded
            accounts as of {snapDate}. The figure covers ranked accounts
            only, so any balance held further down the ledger is not in it, and
            the attribution comes from the label registry rather than from a
            claim this page makes about who controls a key.
          </p>
          {LARSEN_NET_WORTH.usd ? (
            <p className="rl-section-intro">
              {LARSEN_SOURCE.name} put his total net worth at{" "}
              <strong>${count(LARSEN_NET_WORTH.usd)}</strong> as of{" "}
              {LARSEN_NET_WORTH.readOn}, which puts the XRP above at{" "}
              <strong>
                {pctLabel(
                  ((larsen.xrp * (data.xrpUsd ?? 0)) / LARSEN_NET_WORTH.usd) *
                    100,
                )}
              </strong>{" "}
              of it as of {snapDate}. That total is cited rather than measured.
              This page reads the XRP Ledger and nothing else, so the holding
              is ours and the net worth belongs to{" "}
              <a href={LARSEN_SOURCE.url} rel="nofollow noopener">
                {LARSEN_SOURCE.name}
              </a>
              , who describe it as a real-time figure that moves with the
              market.
            </p>
          ) : (
            <p className="rl-note">
              Only the onchain figure is stated here. Estimates of his total net
              worth are published elsewhere and are not read from the ledger, so
              this page does not repeat one without naming its source and the
              date it was read.
            </p>
          )}
        </section>
      ) : null}

      {/* ----------------------------------------------------- supply */}
      {/* The denominator. Every share on this page is a fraction of the XRP
          that exists, and until now the page printed the numerators and never
          named the denominator in the words people use for it. The ledger's
          own total_coins field is read on the same walk, so this is a
          first-party figure rather than one quoted from a market tracker. */}
      {data.totalSupplyXrp ? (
        <section className="uni-home-content rl-section" aria-labelledby="supply">
          <p className="rp-eyebrow">The denominator</p>
          <h2 id="supply">XRP supply: circulating, escrowed and burned</h2>
          <p className="rp-lead">
            {count(data.totalSupplyXrp)} XRP existed on the XRP Ledger as of{" "}
            {snapDate}, read from the ledger&rsquo;s own total supply field at
            ledger {count(data.ledgerIndex)} rather than from a market tracker.
          </p>
          <p className="rl-section-intro">
            Market listings usually quote a circulating supply that leaves out
            the XRP locked in onchain escrow, because escrowed XRP cannot be
            sold until it is released. Both figures are below, along with the
            escrow they differ by, so the number a reader arrives with can be
            matched to a definition rather than guessed at.
          </p>

          <div className="rl-dtable-wrap" data-nosnippet="">
            <table className="rl-dtable">
              <caption className="rl-dtable-cap">
                XRP supply on the XRP Ledger, as of {snapDate}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col">XRP</th>
                  <th scope="col">Share of total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Total supply on the ledger</th>
                  <td data-label="XRP">{count(data.totalSupplyXrp)}</td>
                  <td data-label="Share of total">100%</td>
                </tr>
                {data.escrowedXrp != null ? (
                  <tr>
                    <th scope="row">Locked in onchain escrow</th>
                    <td data-label="XRP">{count(data.escrowedXrp)}</td>
                    <td data-label="Share of total">
                      {share2((data.escrowedXrp / data.totalSupplyXrp) * 100)}
                    </td>
                  </tr>
                ) : null}
                {data.escrowedXrp != null ? (
                  <tr>
                    <th scope="row">Circulating, escrow excluded</th>
                    <td data-label="XRP">
                      {count(data.totalSupplyXrp - data.escrowedXrp)}
                    </td>
                    <td data-label="Share of total">
                      {share2(
                        ((data.totalSupplyXrp - data.escrowedXrp) /
                          data.totalSupplyXrp) *
                          100,
                      )}
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <th scope="row">Destroyed by fees since launch</th>
                  <td data-label="XRP">{count(1e11 - data.totalSupplyXrp)}</td>
                  <td data-label="Share of total">
                    {share2(((1e11 - data.totalSupplyXrp) / 1e11) * 100)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="rl-note">
            XRP was created once, at launch, with 100,000,000,000 units and no
            way to make more. Every transaction destroys a small fee, so the
            total only falls, which is why the total on the ledger as of{" "}
            {snapDate} is {count(1e11 - data.totalSupplyXrp)} XRP below the
            amount that was created.
          </p>
          <p className="rl-note">
            That figure is the total destroyed since launch and not a rate. A
            burn rate needs two measurements taken at different times, and this
            page reads one ledger, so it can state the amount gone and not how
            fast it is going.
          </p>
          {data.escrowAccounts != null && data.escrowObjects != null ? (
            <p className="rl-note">
              The escrowed XRP sat in {count(data.escrowObjects)} escrow objects
              held by {count(data.escrowAccounts)} accounts as of {snapDate},
              each with its own release date set onchain.
            </p>
          ) : null}
          {data.supplyReconciliation ? (
            <p className="rl-note">
              Summing every account balance read in the walk gives{" "}
              {count(data.supplyReconciliation.walkedXrp)} XRP against the
              ledger&rsquo;s own total of{" "}
              {count(data.supplyReconciliation.ledgerTotalCoinsXrp)} XRP as of{" "}
              {snapDate}, a gap of{" "}
              {data.supplyReconciliation.differencePct.toFixed(4)}% that comes
              from XRP held in ledger objects other than accounts.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ----------------------------------------------------- bridge */}
      {/* Laid out as the draggable-priority-list rows: a numbered mono rail on
          the left, title and meta in the body, bordered and rounded, lit on
          hover. Not draggable, and deliberately so: these are four kinds of
          venue, not a ranking a reader reorders, and a drag affordance on a
          list that cannot be dropped anywhere is a lie about what it does. */}
      <section className="uni-home-content rl-section" aria-labelledby="bridge">
        <div className="rl-bridge">
          <p className="rp-eyebrow">Earning on XRP</p>
          <h2 id="bridge">XRP yield sources: where people earn on XRP</h2>
          <p>
            Holding XRP on the XRP Ledger pays nothing, so every rate on
            XRP-denominated capital is earned somewhere else.{" "}
            {yc ? (
              <>
                <strong>{count(yc.receiptTokenHolders)} addresses</strong> were
                already holding a wrapped or staked XRP product onchain as of{" "}
                {utcDate(yc.asOf ?? snap)}, across {yc.products} products on
                Flare and Base.
              </>
            ) : null}{" "}
            These are the four places that rate comes from.
          </p>

          <Link className="rl-bridge-cta rl-bridge-cta-top" href="/report/xrp-yield-ranking">
            Open the XRP yield report
            <span aria-hidden="true">&rarr;</span>
          </Link>

          {/* Plain bullets rather than a numbered rail. The rank implied an
              order these four do not have: a vault is not the second-best
              kind of venue, it is a different kind. */}
          <ul className="rl-sources">
            {[
              {
                title: "Lending markets",
                meta: "Wrapped XRP supplied as collateral, earning what borrowers pay. The rate moves with utilisation.",
              },
              {
                title: "Vaults",
                meta: "A strategy holds the position and compounds it. The rate is realised price-per-share growth rather than a quoted number.",
              },
              {
                title: "Liquidity venues",
                meta: "XRP paired against another asset, earning trading fees plus any incentive the venue pays on top.",
              },
              {
                title: "Fixed-rate products",
                meta: "A rate locked to a maturity date, priced by the market rather than floating with demand.",
              },
            ].map((r) => (
              <li className="rl-source" key={r.title}>
                <span className="rl-source-body">
                  <span className="rl-source-title">{r.title}</span>
                  <span className="rl-source-meta">{r.meta}</span>
                </span>
              </li>
            ))}
          </ul>

          {yieldPicks ? (
            <>
              {/* One card per venue kind, the largest by deposits in each. No
                  action inside a card: four buttons to the same destination is
                  four chances to pick the wrong one, so the section carries a
                  single CTA underneath instead. */}
              <div className="rl-picks">
                {yieldPicks.picks.map((k) => (
                  <div className="rl-pick" key={k.category}>
                    <div className="rl-pick-head">
                      <span className="rl-pick-name">
                        {/* The first asset in the pair, which is the token a
                            depositor actually brings. */}
                        <AssetIcon
                          asset={k.asset.split(" / ")[0] as "FXRP" | "stXRP"}
                          size={22}
                          decorative
                        />
                        <span className="rl-pick-platform">{k.platform}</span>
                      </span>
                      <span className="rl-pick-badge">{k.category}</span>
                    </div>
                    <div className="rl-pick-rate">{k.apy.toFixed(2)}%</div>
                    <dl className="rl-pick-meta" data-lint="chrome">
                      <div>
                        <dt>Deposits</dt>
                        <dd>{usdShort(k.tvlUsd)}</dd>
                      </div>
                      <div>
                        <dt>Asset</dt>
                        <dd>{k.asset}</dd>
                      </div>
                      <div>
                        <dt>Holders</dt>
                        <dd>{k.holders?.count ? count(k.holders.count) : "n/a"}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>

              {/* Prose twin for the four cards. A retrieval system cannot cite
                  a figure sitting in a card without inventing the sentence
                  around it, so each card's rate exists here as a complete
                  dated sentence carrying its own scope. */}
              {/* One sentence, for the venue most people actually use. Four
                  of these, one per card, restated the whole grid in prose and
                  read as arithmetic rather than as a finding. */}
              {(() => {
                const top = [...yieldPicks.picks].sort(
                  (a, b) => (b.holders?.count ?? 0) - (a.holders?.count ?? 0),
                )[0];
                if (!top?.holders?.count) return null;
                return (
                  <p className="rl-source-note-line">
                    The most used of these was {top.asset} on {top.platform},
                    where {count(top.holders.count)} wallets held{" "}
                    {usdShort(top.tvlUsd)} at {top.apy.toFixed(2)}% as of{" "}
                    {utcDate(yieldPicks.asOf)}.
                  </p>
                );
              })()}
            </>
          ) : null}

          <p className="rl-source-note-line">
            No venue in Harvest&rsquo;s XRP yield ranking pays a native XRP
            staking rate, because the XRP Ledger does not offer one. Every rate
            in that ranking is read from the venue&rsquo;s own contracts rather
            than from an aggregator.
          </p>

          <Link className="rl-bridge-cta" href="/report/xrp-yield-ranking">
            Open the XRP yield report
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* Centred header over a narrower accordion column, questions divided by
          a hairline with a chevron that turns on open: the faq3 layout.

          Still <details> rather than an accordion component. The answers carry
          the figures this page is cited for, and a JS accordion hides them
          from anything that does not run scripts. `name` makes the group
          exclusive natively, which is what the reference's type="single"
          collapsible does, and browsers without it just allow several open. */}
      <section className="uni-home-content rl-section rl-faq-section" aria-labelledby="faq">
        <div className="rl-faq-head">
          <p className="rp-eyebrow">Questions</p>
          <h2 id="faq">XRP rich list questions</h2>
          <p className="rl-faq-desc">
            What people ask about XRP holder counts and thresholds, answered
            from the {snapDate} ledger snapshot behind this page.
          </p>
        </div>
        <div className="rl-faq">
          {faqs.map((f, i) => (
            <details className="rl-faq-item" name="rl-faq" key={f.q} open={i === 0}>
              <summary className="rl-faq-q">
                <span>{f.q}</span>
                <svg
                  className="rl-faq-chev"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <p className="rl-faq-a">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- methodology */}
      <section className="uni-home-content rl-section" aria-labelledby="methodology">
        <p className="rp-eyebrow">Method</p>
        <h2 id="methodology">How this XRP rich list is built</h2>
        <dl className="rp-methodology-dl rl-method">
          <dt>Source</dt>
          <dd>
            Every AccountRoot object in one validated XRP Ledger, read over
            public JSON-RPC from XRP Ledger nodes. Ledger{" "}
            {count(data.ledgerIndex)} closed {snapStamp} and is the single
            source for every figure on this page. No explorer rich list and no
            third-party dataset is used.
          </dd>
          <dt>Why one ledger</dt>
          <dd>
            The XRP Ledger closes a new version every three to five seconds. The
            walk is pinned to one ledger index so the snapshot describes a state
            that actually existed, rather than mixing accounts read seconds
            apart.
          </dd>
          <dt>What counts as a funded account</dt>
          <dd>{data.method.fundedAccountDefinition}</dd>
          <dt>What each account is ranked on</dt>
          <dd>
            The XRP an account controls, which is its spendable balance plus
            anything it has locked in onchain escrow. The two are separate on the
            ledger: escrowed drops leave the account&rsquo;s balance and sit in an
            Escrow object until their release date. Ranking on balance alone
            would put the six largest XRP positions on the network outside this
            list, since each of those accounts holds a few hundred XRP spendable
            against billions locked.
          </dd>
          <dt>How percentiles are computed</dt>
          <dd>
            Balances are aggregated into a log-spaced histogram as they stream,
            at {count(data.method.bucketsPerDecade)} buckets per decade, which
            bounds the error on any tier threshold shown for {snapDate} at{" "}
            {data.method.thresholdRelativeErrorPct}%. Counts quoted at round
            balances as of {snapDate}, such as the number of accounts holding at
            least 10,000 XRP, are counted exactly rather than read off the
            histogram.
          </dd>
          <dt>How the walk is checked</dt>
          <dd>
            {data.supplyReconciliation ? (
              <>
                Spendable balances and escrowed XRP, both read at ledger{" "}
                {count(data.ledgerIndex)}, came to{" "}
                {count(data.supplyReconciliation.walkedXrp)} XRP against the
                ledger&rsquo;s own total supply of{" "}
                {count(data.supplyReconciliation.ledgerTotalCoinsXrp)} XRP as of{" "}
                {snapDate}, a difference of{" "}
                {count(Math.abs(data.supplyReconciliation.differenceXrp))} XRP,
                or {data.supplyReconciliation.differencePct}% of supply. That
                remainder sits in ledger objects which also hold XRP outside an
                account balance, chiefly payment channels, and it is reported
                rather than distributed across accounts it cannot be attributed
                to. The check earns its place by size: a walk that missed pages
                would show a gap of billions rather than of thousands, which is
                how a truncated escrow pass was caught during development.
              </>
            ) : (
              "Spendable balances and escrowed XRP are read at the same ledger index and summed against the ledger's own total supply. Every XRP that exists sits in an account or in an escrow, so a truncated walk shows up as a gap of billions."
            )}
          </dd>
          <dt>Labels</dt>
          <dd>
            An account is named only against evidence the page can show: a
            domain the account publishes onchain, an operator whose domain lists
            the address under the XRP Ledger&rsquo;s own standard, an address the
            operator published officially, or an attribution by a named data
            provider. Which one applies is printed next to every name. Identity
            is never inferred from how an account transacts, and the build
            rejects a label that cannot state its source.
          </dd>
          <dt>Known limitations</dt>
          <dd>
            An account is not a person. Exchanges and custodians hold balances
            for many customers in a small number of accounts, and one person can
            control many accounts, so this distribution describes accounts
            rather than owners. Balances held off the XRP Ledger, including XRP
            wrapped onto other networks, are outside it.
          </dd>
        </dl>
        <p className="rp-source-note">
          Published by {SITE_AUTHOR.name}. Figures on this page are informational
          research, not financial advice.
        </p>
      </section>
    </div>
  );
}
