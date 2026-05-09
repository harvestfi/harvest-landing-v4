import Link from "next/link";
import { getLiveVaults } from "@/lib/data";
import { SearchBox, type SearchItem } from "./search-box";

export async function Header() {
  const navItems = [
    { label: "USDC", href: "/usdc" },
    { label: "USDT", href: "/usdt" },
    { label: "ETH", href: "/eth" },
    { label: "BTC", href: "/btc" },
    { label: "Test", href: "/test" },
    { label: "BTC test", href: "/btc-test" },
  ];

  const vaults = await getLiveVaults();
  const items: SearchItem[] = vaults.map((v) => ({
    slug: v.slug,
    productName: v.productName,
    asset: v.asset,
    chain: v.chain,
    protocol: v.protocol.name,
    category: v.category,
    apy24h: v.apy24h,
    tvl: v.tvl,
  }));

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link href="/" className="brand" aria-label="Harvest, go to homepage">
          <span className="brand-name">Harvest</span>
          <span className="brand-dot" aria-hidden="true" />
        </Link>
        <nav className="navlinks">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="nav-right">
          <SearchBox items={items} />
        </div>
      </div>
    </header>
  );
}
