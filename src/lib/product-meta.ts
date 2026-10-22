// The product page's meta description, shared with its Markdown version.
import type { YieldVault } from "./types";
import { getLpPair } from "./lp-pair";
import { productPageDescription } from "./seo";

export function productMetaDescription(vault: YieldVault): string {
  const lpPair = getLpPair(vault);
  return lpPair
    ? `Autocompounding LP yield on the ${vault.asset}/${lpPair.counterpart} pair on ${lpPair.platform} (${vault.chain}). ${lpPair.rewardToken ?? "Platform-native"} rewards are claimed and added back to the position automatically.`
    : productPageDescription(vault);
}
