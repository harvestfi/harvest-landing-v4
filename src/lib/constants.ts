import { Asset } from "./types";

export const ASSET_COLORS: Record<Asset, string> = {
  USDC: "bg-blue-500",
  USDT: "bg-emerald-500",
  ETH: "bg-indigo-500",
  BTC: "bg-orange-500",
  EURC: "bg-blue-400",
};

export const SITE_NAME = "Harvest";
// 140-160 char floor per Google's recommended description length.
// Mentions the four anchor assets + the hourly-refresh cadence so the
// snippet that appears in search results carries the value prop on
// its own line without needing the title for context.
export const SITE_DESCRIPTION =
  "Compare every DeFi yield strategy we track, across Ethereum, Base, Arbitrum and more. Live APY for USDC, USDT, ETH and Bitcoin, refreshed hourly.";
export const SITE_URL = "https://harvest.finance";

// Base URL used for metadataBase, so og:image / twitter:image ABSOLUTE
// urls resolve to a domain the social scraper can actually fetch.
// Defaults to the production domain so the cutover needs no extra config:
// once harvest.finance serves this build, link previews work with nothing
// to set. The only side effect is that, before the domain is pointed here,
// og:image previews on the Vercel staging URL won't render (they point at
// harvest.finance, which doesn't serve this build yet). Set
// NEXT_PUBLIC_SITE_URL to override for a given deploy (e.g. the staging
// domain). Canonical links + sitemap + JSON-LD use SITE_URL regardless.
export const OG_BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://harvest.finance"
).replace(/\/$/, "");
