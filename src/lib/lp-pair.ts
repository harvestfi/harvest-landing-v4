// LP-pair Autocompounder helper. The discriminator is
// `underlyingLogos.length > 1` (single-asset vaults expose just
// the one underlying icon; LP-pair vaults expose two).
//
// Returns null for single-asset vaults so callers can branch
// cleanly. Returns {counterpart, platform, rewardToken} otherwise,
// each canonicalised for display (e.g. "WBTC", "Quickswap",
// "dQUICK").

import type { YieldVault } from "./types";
import { stripChainSuffix } from "./format";

export interface LpPair {
  counterpart: string;
  platform: string;
  rewardToken: string | null;
}

// Hand-tuned mapping from lowercase icon-derived strings to the
// canonical display ticker. The fallback for unknown tokens is
// the uppercase string, which works for most reward tokens out of
// the box (AERO, BSWAP, MATIC, etc.). Add entries here when an
// icon name needs casing or punctuation tweaks that uppercase
// alone can't produce.
const TICKER_CANONICAL: Record<string, string> = {
  wbtc: "WBTC",
  usdc: "USDC",
  usdt: "USDT",
  usdbc: "USDbC",
  cbbtc: "cbBTC",
  tbtc: "tBTC",
  steth: "stETH",
  wsteth: "wstETH",
  aero: "AERO",
  bswap: "BSWAP",
  virtual: "VIRTUAL",
  vvv: "VVV",
  eth: "ETH",
  btc: "BTC",
  matic: "MATIC",
  pol: "POL",
  arb: "ARB",
  op: "OP",
  crv: "CRV",
  cvx: "CVX",
};

function canonicaliseTicker(raw: string): string {
  const k = raw.toLowerCase();
  return TICKER_CANONICAL[k] ?? raw.toUpperCase();
}

// Parse a logo path into its bare symbol. Inputs look like
// "./icons/wbtc.svg" or "/icons/wbtc.svg" or full URLs; the path
// segment immediately before the extension is the symbol slug.
function parseSymbolFromIconPath(path: string): string {
  const last = path.split("/").pop() ?? "";
  return last.replace(/\.(svg|png|jpg|jpeg|webp)$/i, "");
}

export function getLpPair(vault: YieldVault): LpPair | null {
  const logos = vault.underlyingLogos;
  if (!logos || logos.length <= 1) return null;

  const symbols = logos
    .map(parseSymbolFromIconPath)
    .map((s) => s.trim())
    .filter(Boolean);
  if (symbols.length <= 1) return null;

  // Counterpart = the icon symbol that isn't the vault's primary
  // asset. Compared case-insensitively because the asset field is
  // canonical-cased ("ETH", "USDC") while icon stems are
  // lowercase ("eth", "usdc"). Case-insensitive cbbtc vs CBBTC
  // also handled here (vault.asset uses "BTC" for cbBTC vaults).
  const assetLc = vault.asset.toLowerCase();
  // Specifically: BTC-asset vaults use cbbtc/wbtc/tbtc icons; the
  // "counterpart" is the icon that isn't a BTC variant.
  const isBtcSibling = (s: string) =>
    ["btc", "wbtc", "cbbtc", "tbtc", "ubtc", "hemibtc"].includes(
      s.toLowerCase(),
    );
  const counterpartRaw =
    symbols.find((s) =>
      assetLc === "btc" ? !isBtcSibling(s) : s.toLowerCase() !== assetLc,
    ) ?? symbols[0];

  const platform = stripChainSuffix(vault.category, vault.chain);
  const rewardToken =
    vault.rewardTokens && vault.rewardTokens[0]?.symbol
      ? vault.rewardTokens[0].symbol
      : null;

  return {
    counterpart: canonicaliseTicker(counterpartRaw),
    platform,
    rewardToken,
  };
}

export function isLpPairVault(vault: YieldVault): boolean {
  return getLpPair(vault) !== null;
}

// Canonical display name for product pages. LP-pair vaults expand
// the generic "ETH Aerodrome" database name into "ETH/VVV Aerodrome"
// so visitors landing on the page know exactly which pair they're
// looking at. Single-asset vaults return their raw productName.
// Ranking views deliberately do NOT use this helper - they keep the
// compact productName and signal LP-pair products with an [LP] badge
// instead, so dense ranking tables stay scannable.
export function getCanonicalDisplayName(vault: YieldVault): string {
  const pair = getLpPair(vault);
  if (!pair) return vault.productName;
  // Stake DAO OnlyBoost products carry boost-component icons
  // (CVX for ETH, alternate-BTC variants for WBTC) that fire the
  // LP-pair discriminator, but their database productName
  // ("ETH OnlyBoost", "WBTC OnlyBoost", "stETH OnlyBoost") is
  // already disambiguated by the asset prefix + OnlyBoost suffix.
  // Generating "ETH/CVX Stake DAO" here would replace meaningful
  // branding with the name of an internal boost token, so honor
  // the productName as-is for this product family.
  if (vault.productName.toLowerCase().includes("onlyboost")) {
    return vault.productName;
  }
  // Defensive fallback for malformed icon data: if the counterpart
  // couldn't be parsed cleanly (empty or whitespace), fall back to
  // the database productName to avoid rendering "ETH/ Aerodrome"
  // or "ETH/undefined Aerodrome".
  const counterpart = pair.counterpart?.trim();
  const platform = pair.platform?.trim();
  if (!counterpart || !platform) return vault.productName;
  return `${vault.asset.toUpperCase()}/${counterpart} ${platform}`;
}
