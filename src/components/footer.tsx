import Link from "next/link";
import { getLiveVaults } from "@/lib/data";
import { NETWORKS } from "@/lib/networks";
import { formatTVL } from "@/lib/format";

const ASSET_LABELS: Record<string, string> = {
  USDC: "USDC Yield",
  USDT: "USDT Yield",
  ETH: "Ethereum Yield",
  BTC: "Bitcoin Yield",
};

const ASSET_HREF: Record<string, string> = {
  USDC: "/usdc",
  USDT: "/usdt",
  ETH: "/eth",
  BTC: "/btc",
};

// Resources column: only links to pages that actually exist on the site.
const RESOURCES = [
  { label: "Methodology", href: "/methodology" },
  { label: "Risk Framework", href: "/risk-framework" },
];

// Legitimacy-signal pages.
const COMPANY = [
  { label: "About", href: "/about" },
  { label: "Disclosures", href: "/disclosures" },
  { label: "Security & Audits", href: "/security" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Contact", href: "/contact" },
];

const SOCIAL: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: "Twitter",
    href: "https://twitter.com/harvest_finance",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Medium",
    href: "https://medium.com/harvest-finance",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M2.846 6.887c.03-.295-.083-.586-.303-.784L.275 3.297V2.91h7.314l5.654 12.404L18.222 2.91H25.2v.387l-1.945 1.866c-.168.128-.252.339-.218.547v13.708c-.034.208.05.418.218.547l1.901 1.866v.387h-9.564v-.387l1.967-1.911c.193-.193.193-.25.193-.547V8.246l-5.466 13.882h-.738L4.999 8.246v9.305c-.053.394.077.79.353 1.075l2.563 3.115v.387H.748v-.387l2.563-3.115c.273-.286.395-.683.318-1.075V6.887z" />
      </svg>
    ),
  },
  {
    label: "Discord",
    href: "https://discord.gg/xHXe3tYjPY",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.07.07 0 0 0-.075.035c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.5 12.5 0 0 0-.617-1.249.073.073 0 0 0-.075-.035 19.74 19.74 0 0 0-3.762 1.169.066.066 0 0 0-.03.027C2.092 8.045 1.21 11.62 1.65 15.151a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.992 3.029.077.077 0 0 0 .084-.027c.461-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.105 13.13 13.13 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.128 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.04.106c.36.699.772 1.363 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.029.077.077 0 0 0 .032-.054c.5-4.087-.838-7.63-3.549-10.755a.06.06 0 0 0-.031-.028zM8.02 13.001c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.956 2.42-2.157 2.42zm7.974 0c-1.183 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.156-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.42-2.157 2.42z" />
      </svg>
    ),
  },
  {
    label: "GitHub",
    href: "https://github.com/harvestfi",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-1.97c-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
      </svg>
    ),
  },
];

interface AssetEntry {
  asset: string;
  href: string;
  label: string;
  count: number;
  tvl: number;
}

interface NetworkEntry {
  slug: string;
  display: string;
  count: number;
  tvl: number;
}

export async function Footer() {
  const vaults = await getLiveVaults();

  // === Asset & network columns: live counts, TVL-ordered ============
  const tvlByAsset = new Map<string, number>();
  const countByAsset = new Map<string, number>();
  for (const v of vaults) {
    tvlByAsset.set(v.asset, (tvlByAsset.get(v.asset) ?? 0) + v.tvl);
    countByAsset.set(v.asset, (countByAsset.get(v.asset) ?? 0) + 1);
  }
  const assetEntries: AssetEntry[] = Object.keys(ASSET_LABELS)
    .filter((a) => (countByAsset.get(a) ?? 0) > 0)
    .map((a) => ({
      asset: a,
      href: ASSET_HREF[a],
      label: ASSET_LABELS[a],
      count: countByAsset.get(a) ?? 0,
      tvl: tvlByAsset.get(a) ?? 0,
    }))
    .sort((a, b) => b.tvl - a.tvl);

  const tvlByChain = new Map<string, number>();
  const countByChain = new Map<string, number>();
  for (const v of vaults) {
    tvlByChain.set(v.chain, (tvlByChain.get(v.chain) ?? 0) + v.tvl);
    countByChain.set(v.chain, (countByChain.get(v.chain) ?? 0) + 1);
  }
  const networkEntries: NetworkEntry[] = NETWORKS.filter(
    (n) => (countByChain.get(n.chain) ?? 0) > 0,
  )
    .map((n) => ({
      slug: n.slug,
      display: n.display,
      count: countByChain.get(n.chain) ?? 0,
      tvl: tvlByChain.get(n.chain) ?? 0,
    }))
    .sort((a, b) => b.tvl - a.tvl);

  // === Brand column live stats ======================================
  const totalTvl = vaults.reduce((s, v) => s + v.tvl, 0);
  const networksWithCoverage = networkEntries.length;

  return (
    <footer className="foot">
      <div className="foot-inner">
        {/* === 4-column grid (Brand, Assets, Networks, Resources) === */}
        <div className="foot-grid">
          {/* Column 1: Brand */}
          <div className="foot-col foot-col-brand">
            <Link href="/" className="brand" aria-label="Harvest, go to homepage">
              <span className="brand-name">Harvest</span>
              <span className="brand-dot" aria-hidden="true" />
            </Link>
            <span className="foot-tagline">
              Independent onchain yield index
            </span>
            <span className="foot-since">
              Operating since 2020 · 5+ years onchain
            </span>
            <p className="foot-blurb">
              Harvest is an onchain yield index tracking{" "}
              {vaults.length}+ DeFi yield strategies across major networks.
              APY, TVL and performance data are updated hourly and derive from
              our own indexer monitoring vault contracts continuously since
              2020. See <Link href="/methodology">methodology</Link> for how
              data is collected and calculated.
            </p>
            <div className="foot-stats">
              <span>{formatTVL(totalTvl)} tracked TVL</span>
              <span className="foot-stats-sep">·</span>
              <span>{vaults.length} active strategies</span>
              <span className="foot-stats-sep">·</span>
              <span>
                {networksWithCoverage} network
                {networksWithCoverage !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="foot-social" aria-label="Social links">
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="foot-social-link"
                  aria-label={s.label}
                  title={s.label}
                  rel={s.href !== "#" ? "me noopener" : "noopener"}
                  target={s.href !== "#" ? "_blank" : undefined}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Column 2: Assets */}
          <div className="foot-col">
            <div className="foot-col-label mono dim">Yield by Asset</div>
            {assetEntries.map((e) => (
              <Link key={e.asset} href={e.href} className="foot-link">
                {e.label} <span className="foot-count">({e.count})</span>
              </Link>
            ))}
          </div>

          {/* Column 3: Networks */}
          <div className="foot-col">
            <div className="foot-col-label mono dim">Yield by Network</div>
            {networkEntries.map((e) => (
              <Link key={e.slug} href={`/${e.slug}`} className="foot-link">
                {e.display} <span className="foot-count">({e.count})</span>
              </Link>
            ))}
          </div>

          {/* Column 4: Resources + Company */}
          <div className="foot-col">
            <div className="foot-col-label mono dim">Resources</div>
            {RESOURCES.map((l) => (
              <Link key={l.label} href={l.href} className="foot-link">
                {l.label}
              </Link>
            ))}
            <div className="foot-col-label mono dim" style={{ marginTop: 14 }}>
              Company
            </div>
            {COMPANY.map((l) =>
              l.href.startsWith("/") ? (
                <Link key={l.label} href={l.href} className="foot-link">
                  {l.label}
                </Link>
              ) : (
                <a key={l.label} href={l.href} className="foot-link">
                  {l.label}
                </a>
              ),
            )}
          </div>
        </div>

        {/* === Trust strip: distribution + audits ================
            Two rows of brand names. Logos will replace the text
            once the assets are uploaded. Sits between the link
            grid and the legal line so it reads as the bridge
            between "what we are" and "what backs us". */}
        <section className="foot-trust" aria-label="Distribution and audits">
          <div className="foot-trust-row">
            <span className="foot-trust-label">Available on</span>
            <ul className="foot-trust-list">
              {[
                "Binance",
                "Coinbase",
                "crypto.com",
                "Kraken",
                "Uniswap",
                "Camelot",
              ].map((name) => (
                <li key={name} className="foot-trust-item">
                  {name}
                </li>
              ))}
            </ul>
          </div>
          <div className="foot-trust-row">
            <span className="foot-trust-label">Audited by</span>
            <ul className="foot-trust-list">
              {["Least Authority", "Haechi Audit", "PeckShield", "Certik", "Halborn"].map(
                (name) => (
                  <li key={name} className="foot-trust-item">
                    {name}
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>

        {/* === Legal compliance === */}
        <div className="foot-legal">
          <div className="foot-legal-line">
            &copy; 2026 Harvest Finance · Operating onchain since 2020 · Data
            refreshed hourly · See{" "}
            <Link href="/methodology">methodology</Link> for calculation
            details · All content on this site is published for informational
            purposes only and does not constitute investment, financial, legal,
            or tax advice; nothing here should be relied upon as a basis for
            any investment decision, and past performance does not guarantee
            future returns.
          </div>
          <div className="foot-legal-meta">
            <Link href="/sitemap.xml">sitemap</Link>
            <span className="foot-legal-sep">·</span>
            <Link href="/llms.txt">llms.txt</Link>
            <span className="foot-legal-sep">·</span>
            <Link href="/robots.txt">robots.txt</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
