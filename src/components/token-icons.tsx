/* eslint-disable @next/next/no-img-element */
import usdcIcon from "@/assets/icons/USDC.png";
import usdtIcon from "@/assets/icons/USDT.png";
import ethIcon from "@/assets/icons/ETH.png";
import wbtcIcon from "@/assets/icons/WBTC.png";
import cbbtcIcon from "@/assets/icons/cbBTC.png";
import eurcIcon from "@/assets/icons/EURC.png";
import stxrpIcon from "@/assets/icons/stXRP.svg";
import fxrpIcon from "@/assets/icons/FXRP.webp";
import xrpIcon from "@/assets/icons/xrp.svg";

import baseIcon from "@/assets/icons/base.png";
import arbitrumIcon from "@/assets/icons/arbitrum.png";
import mainnetIcon from "@/assets/icons/mainnet.png";
import bnbIcon from "@/assets/icons/bnb.png";
import avaxIcon from "@/assets/icons/avax.png";
import sonicIcon from "@/assets/icons/sonic.png";
import polygonIcon from "@/assets/icons/polygon.svg";
import zksyncIcon from "@/assets/icons/zksync.svg";
import hyperevmIcon from "@/assets/icons/hyperevm.svg";

const ASSET_ICONS: Record<string, { src: string }> = {
  USDC: usdcIcon,
  USDT: usdtIcon,
  USDT0: usdtIcon,
  ETH: ethIcon,
  WETH: ethIcon,
  BTC: wbtcIcon,
  WBTC: wbtcIcon,
  wBTC: wbtcIcon,
  cbBTC: cbbtcIcon,
  EURC: eurcIcon,
  // XRP-family tokens for the /report/xrp-yield-ranking page.
  stXRP: stxrpIcon,
  STXRP: stxrpIcon,
  FXRP: fxrpIcon,
  fxrp: fxrpIcon,
};

const CHAIN_ICONS: Record<string, { src: string }> = {
  Base: baseIcon,
  Ethereum: mainnetIcon,
  Arbitrum: arbitrumIcon,
  Polygon: polygonIcon,
  zkSync: zksyncIcon,
  HyperEVM: hyperevmIcon,
  BNB: bnbIcon,
  Avalanche: avaxIcon,
  Sonic: sonicIcon,
};

interface IconProps {
  size?: number;
  // Set when the icon is the LCP candidate (hero asset on a page above
  // the fold). Switches to eager loading + high fetchpriority so the
  // browser pulls the file alongside the HTML rather than after layout.
  priority?: boolean;
}

export function AssetIcon({
  asset,
  size = 22,
  priority = false,
}: { asset: string } & IconProps) {
  // Exact match first; then any unmapped XRP-family token (XRP, cbXRP, csXRP,
  // wXRP...) falls back to the generic XRP mark rather than a letter monogram.
  // Keeps the map open for exact per-token icons to be added later.
  const icon = ASSET_ICONS[asset] ?? (/xrp/i.test(asset) ? xrpIcon : undefined);
  if (icon) {
    return (
      <img
        src={icon.src}
        alt={asset}
        width={size}
        height={size}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        style={{ width: size, height: size, borderRadius: "50%" }}
      />
    );
  }
  return (
    <span
      className="asset-dot"
      style={{ background: "#999", width: size, height: size, fontSize: size * 0.5 }}
    >
      {asset[0] || "?"}
    </span>
  );
}

export function ChainIcon({
  chain,
  size = 18,
  priority = false,
}: { chain: string } & IconProps) {
  const icon = CHAIN_ICONS[chain];
  if (icon) {
    return (
      <img
        src={icon.src}
        alt={chain}
        width={size}
        height={size}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        style={{ width: size, height: size, borderRadius: "50%" }}
      />
    );
  }
  return null;
}
