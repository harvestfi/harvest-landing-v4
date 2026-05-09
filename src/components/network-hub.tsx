import Link from "next/link";
import { YieldVault } from "@/lib/types";
import { VaultList } from "./vault-list";
import { formatAPY, formatTVL, stripChainSuffix } from "@/lib/format";
import { networkHubH1 } from "@/lib/seo";
import { breadcrumbSchema, itemListSchema } from "@/lib/jsonld";
import { networkHubCrumbs } from "@/lib/seo";
import { SITE_URL } from "@/lib/constants";
import { NETWORKS, NETWORK_BLURBS } from "@/lib/networks";

interface Props {
  networkSlug: string;
  networkDisplay: string;
  vaults: YieldVault[];
  sparklines?: Record<string, number[]>;
  allVaults: YieldVault[];
}

export function NetworkHub({
  networkSlug,
  networkDisplay,
  vaults,
  sparklines,
  allVaults,
}: Props) {
  const totalTvl = vaults.reduce((s, v) => s + v.tvl, 0);
  const bestApy = vaults.reduce((b, v) => (v.apy24h > b ? v.apy24h : b), 0);
  const avgApy =
    vaults.length > 0
      ? vaults.reduce((s, v) => s + v.apy24h, 0) / vaults.length
      : 0;
  const assetCount = new Set(vaults.map((v) => v.asset)).size;

  const crumbs = networkHubCrumbs(networkDisplay);
  const hubUrl = `${SITE_URL}/${networkSlug}`;

  // Asset family breakdown, used both in the editorial intro and to inform
  // copy. We list assets in descending count order so the most represented
  // family in our index reads first.
  const assetCounts = new Map<string, number>();
  for (const v of vaults) {
    assetCounts.set(v.asset, (assetCounts.get(v.asset) ?? 0) + 1);
  }
  const assetsRanked = Array.from(assetCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  const assetListLabel = humanList(assetsRanked.map(([a]) => a));

  // Distinct protocols (operator labels, after stripping chain suffix)
  const protocolSet = new Set(
    vaults.map((v) => stripChainSuffix(v.category, v.chain)),
  );

  const blurb = NETWORK_BLURBS[networkDisplay] ?? "";

  // Top operator + best vault, used inside FAQ answers
  const topVault = [...vaults].sort((a, b) => b.apy24h - a.apy24h)[0];
  const protoCounts = new Map<string, number>();
  for (const v of vaults) {
    const p = stripChainSuffix(v.category, v.chain);
    protoCounts.set(p, (protoCounts.get(p) ?? 0) + 1);
  }
  const topProtocols = Array.from(protoCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([p]) => p);

  // Other networks present in the index, by TVL, excluding self
  const networkTvls = new Map<string, number>();
  for (const v of allVaults) {
    networkTvls.set(v.chain, (networkTvls.get(v.chain) ?? 0) + v.tvl);
  }
  const relatedNetworks = NETWORKS.filter(
    (n) => n.slug !== networkSlug && (networkTvls.get(n.chain) ?? 0) > 0,
  )
    .sort(
      (a, b) => (networkTvls.get(b.chain) ?? 0) - (networkTvls.get(a.chain) ?? 0),
    )
    .slice(0, 4);

  const faqItems = vaults.length > 0
    ? buildNetworkFaq({
        networkDisplay,
        count: vaults.length,
        bestApy,
        topVaultName: topVault?.productName ?? "",
        topVaultSlug: topVault?.slug ?? "",
        assetListLabel,
        topProtocols,
        protocolCount: protocolSet.size,
      })
    : [];

  return (
    <main className="page uni-hub">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema(crumbs)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListSchema(vaults, hubUrl)),
        }}
      />

      <nav className="pp-crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="sep">›</span>
        <span className="current">{networkDisplay} Yields</span>
      </nav>

      <section className="hero">
        <div>
          <h1>
            {networkHubH1(networkDisplay)}
            <br />
            <span className="dim">
              {vaults.length > 0
                ? `Compare ${vaults.length} yield strategies we follow on ${networkDisplay}, across ${assetCount} asset${assetCount !== 1 ? "s" : ""}.`
                : `${networkDisplay} yield strategies are populating, check back shortly.`}
            </span>
          </h1>
          <div className="hero-actions">
            <span className="hero-meta mono">
              <span className="pulse" /> Live · {vaults.length} strategies tracked
            </span>
          </div>
        </div>
        <div className="hero-right">
          <div className="stat-tile">
            <div className="stat-label">Total TVL</div>
            <div className="stat-val mono">{formatTVL(totalTvl)}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Best APY</div>
            <div className="stat-val mono">{bestApy > 0 ? formatAPY(bestApy) : "-"}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Avg APY</div>
            <div className="stat-val mono">{avgApy > 0 ? formatAPY(avgApy) : "-"}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Assets</div>
            <div className="stat-val mono">{assetCount}</div>
          </div>
        </div>
      </section>

      <div className="section-title-bar">
        <h2>Top {networkDisplay} yields by APY</h2>
        <span className="mono dim">
          Live · ranked across {vaults.length} strategies in our index
        </span>
      </div>

      {vaults.length > 0 ? (
        <VaultList vaults={vaults} sparklines={sparklines} />
      ) : (
        <div
          style={{
            padding: "60px 0",
            textAlign: "center",
            color: "var(--ink-3)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
            background: "var(--panel)",
          }}
        >
          <p style={{ margin: 0 }}>No {networkDisplay} vaults indexed yet.</p>
          <p style={{ marginTop: 8, fontSize: 13 }}>
            Data refreshes hourly from the Harvest API.
          </p>
        </div>
      )}

      {vaults.length > 0 && (
        <section className="pp-section" id="about-network">
          <h2>About {networkDisplay} yield in this index</h2>
          <div className="about-prose">
            {blurb && <p>{blurb}</p>}
            <p>
              We currently track <strong>{vaults.length}</strong> yield
              strateg{vaults.length === 1 ? "y" : "ies"} on {networkDisplay},
              spanning {assetListLabel || "a single asset"} across{" "}
              {protocolSet.size} distinct protocol
              {protocolSet.size === 1 ? "" : "s"}.{" "}
              {topVault && (
                <>
                  The highest live APY in this set comes from{" "}
                  <Link href={`/${topVault.slug}`}>{topVault.productName}</Link>{" "}
                  at {formatAPY(bestApy)}; the average across the cohort is{" "}
                  {formatAPY(avgApy)}.
                </>
              )}
            </p>
            <p>
              Every strategy in the index is operated by Harvest Finance today;
              the {networkDisplay} cohort therefore reflects Harvest&apos;s
              {" "}{networkDisplay} deployments, not a survey of every yield
              source on the network. Inclusion criteria, APY and TVL handling,
              and ranking logic are documented on the{" "}
              <Link href="/methodology">methodology page</Link>.
            </p>
          </div>
        </section>
      )}

      {faqItems.length > 0 && (
        <section className="pp-section" id="faq">
          <h2>Frequently Asked Questions</h2>
          <div className="faq">
            {faqItems.map((item, i) => (
              <details key={i} open={i === 0}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {relatedNetworks.length > 0 && (
        <section className="pp-section" id="related-networks">
          <h2>Yield on other networks</h2>
          <div className="more-vaults">
            {relatedNetworks.map((n) => {
              const nVaults = allVaults.filter((v) => v.chain === n.chain);
              const nBest = nVaults.reduce(
                (b, v) => (v.apy24h > b ? v.apy24h : b),
                0,
              );
              const nTvl = nVaults.reduce((s, v) => s + v.tvl, 0);
              return (
                <Link key={n.slug} href={`/${n.slug}`} className="mv-card">
                  <div className="mv-head">
                    <div>
                      <div className="mv-name">Yield on {n.display}</div>
                      <div className="mv-by">
                        {nVaults.length} strateg
                        {nVaults.length === 1 ? "y" : "ies"} tracked
                      </div>
                    </div>
                  </div>
                  <div className="mv-stats">
                    <div>
                      <div>Best APY</div>
                      <div className="mv-num up">
                        {nBest > 0 ? formatAPY(nBest) : "-"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div>TVL</div>
                      <div className="mv-num">{formatTVL(nTvl)}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

function humanList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

interface FaqArgs {
  networkDisplay: string;
  count: number;
  bestApy: number;
  topVaultName: string;
  topVaultSlug: string;
  assetListLabel: string;
  topProtocols: string[];
  protocolCount: number;
}

function buildNetworkFaq(a: FaqArgs): { question: string; answer: string }[] {
  const protoList = humanList(a.topProtocols);
  return [
    {
      question: `What is the best yield on ${a.networkDisplay} right now?`,
      answer:
        a.topVaultName && a.bestApy > 0
          ? `Across the ${a.count} strategies we currently index on ${a.networkDisplay}, ${a.topVaultName} is showing the highest 24-hour APY at ${formatAPY(a.bestApy)}. Rates change as on-chain conditions shift; the table above is sorted by 24-hour APY by default and reflects the most recent build.`
          : `We currently index ${a.count} strateg${a.count === 1 ? "y" : "ies"} on ${a.networkDisplay}. The table above ranks them by 24-hour APY.`,
    },
    {
      question: `How is yield generated on ${a.networkDisplay}?`,
      answer: `Yield on ${a.networkDisplay} comes from the same set of mechanisms as elsewhere in DeFi: lending markets, liquidity provision on AMMs, leveraged staking, and incentive emissions. Each strategy in our index documents its specific source on its product page.`,
    },
    {
      question: `What protocols offer yield on ${a.networkDisplay} in this index?`,
      answer:
        a.protocolCount > 0
          ? `The ${a.count} ${a.networkDisplay} strategies we follow are deployed across ${a.protocolCount} distinct protocol${a.protocolCount === 1 ? "" : "s"}, including ${protoList}. The product table above shows the operator for each strategy.`
          : `We do not currently index any ${a.networkDisplay} strategies.`,
    },
    {
      question: `What assets can I earn yield on via ${a.networkDisplay}?`,
      answer: a.assetListLabel
        ? `Strategies in our ${a.networkDisplay} cohort accept deposits in ${a.assetListLabel}. Each product page lists the underlying asset and any reward tokens emitted by the strategy.`
        : `Asset coverage on ${a.networkDisplay} is populating; check back shortly.`,
    },
    {
      question: `Is yield farming on ${a.networkDisplay} safe?`,
      answer: `No DeFi yield strategy is risk-free. Smart-contract risk, oracle risk, liquidity risk, depeg risk, and governance risk all apply, and the same protocol can have different risk profiles on different networks. Per-strategy risk levels shown on this site are editorial classifications today; see the risk framework section of the methodology page for details.`,
    },
    {
      question: `How does ${a.networkDisplay} compare to other networks for DeFi yield?`,
      answer: `${a.networkDisplay} is one of several networks we cover. Comparisons across networks are most meaningful when controlled for asset (for example USDC on ${a.networkDisplay} versus USDC on Ethereum) because asset-specific markets dominate the rate. The "Yield on other networks" links below this page are the easiest way to make those comparisons.`,
    },
    {
      question: `How is APY on ${a.networkDisplay} calculated?`,
      answer: `24-hour APY is the mean of APY records observed in the last 24 hours from our hosted indexer. 30-day APY is the simple arithmetic mean of daily APY observations over the last 30 days, filtering out negative values. Reward tokens contribute at the rates published by the underlying protocol; we do not perform our own USD conversion of reward streams. Full details are on the methodology page.`,
    },
  ];
}
