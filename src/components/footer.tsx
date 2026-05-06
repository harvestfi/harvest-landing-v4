import Link from "next/link";

const ASSET_HUBS = [
  { label: "USDC Yield", href: "/usdc" },
  { label: "USDT Yield", href: "/usdt" },
  { label: "Ethereum Yield", href: "/eth" },
  { label: "Bitcoin Yield", href: "/btc" },
];

const NETWORK_HUBS = [
  { label: "Ethereum", href: "/ethereum" },
  { label: "Base", href: "/base" },
  { label: "Arbitrum", href: "/arbitrum" },
  { label: "Polygon", href: "/polygon" },
  { label: "HyperEVM", href: "/hyperevm" },
  { label: "zkSync", href: "/zksync" },
];

const RESOURCES = [
  { label: "API", href: "#" },
  { label: "Methodology", href: "/methodology" },
  { label: "Risk framework", href: "/methodology#risk-framework" },
  { label: "Docs", href: "#" },
  { label: "Status", href: "#" },
  { label: "Terms", href: "#" },
];

export function Footer() {
  return (
    <footer className="foot">
      <div className="foot-inner">
        <div className="foot-brand">
          <span className="brand-name">Harvest</span>
          <span className="mono dim"> · Independent onchain yield index. Updated daily.</span>
        </div>

        <div className="foot-grid">
          <div className="foot-col">
            <div className="foot-col-label mono dim">Assets</div>
            {ASSET_HUBS.map((l) => (
              <Link key={l.href} href={l.href} className="foot-link">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="foot-col">
            <div className="foot-col-label mono dim">Networks</div>
            {NETWORK_HUBS.map((l) => (
              <Link key={l.href} href={l.href} className="foot-link">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="foot-col">
            <div className="foot-col-label mono dim">Resources</div>
            {RESOURCES.map((l) => (
              <a key={l.label} href={l.href} className="foot-link">
                {l.label}
              </a>
            ))}
          </div>
        </div>

        <div className="mono dim foot-copy">&copy; 2026 · Data refreshed hourly</div>
      </div>
    </footer>
  );
}
