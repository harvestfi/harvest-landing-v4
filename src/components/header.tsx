import Link from "next/link";
import { SearchBox } from "./search-box";
import { AssetIcon } from "./token-icons";
import { ThemeToggle } from "./theme-toggle";

// Synchronous server component. The search index is no longer
// embedded in the rendered HTML - SearchBox fetches a static JSON
// blob (/search-index.json, emitted at build time by
// scripts/build-search-index.mjs) on first focus, so every page
// render avoids the duplicate getLiveVaults() server fetch.
export function Header() {
  const navItems = [
    { label: "USDC", href: "/usdc", asset: "USDC" },
    { label: "USDT", href: "/usdt", asset: "USDT" },
    { label: "ETH", href: "/eth", asset: "ETH" },
    { label: "BTC", href: "/btc", asset: "BTC" },
  ];

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link href="/" className="brand" aria-label="Harvest, go to homepage">
          <span className="brand-name">Harvest</span>
          <span className="brand-dot" aria-hidden="true" />
        </Link>
        <nav className="navlinks">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className="nav-asset-link">
              <AssetIcon asset={item.asset} size={16} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="nav-right">
          <SearchBox />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
