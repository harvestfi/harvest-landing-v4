import { writeFileSync } from "fs";
import { YieldVault, Asset } from "./types";
import { fetchVaultHistory } from "./history-api";

const HARVEST_API = "https://api.harvest.finance/vaults?key=harvest-key";

const CHAIN_NAMES: Record<string, string> = {
  eth: "Ethereum",
  matic: "Polygon",
  arbitrum: "Arbitrum",
  base: "Base",
  zksync: "zkSync",
  hyperevm: "HyperEVM",
};

const SUPPORTED_ASSETS: Record<string, Asset> = {
  USDC: "USDC",
  USDT: "USDT",
  ETH: "ETH",
  WETH: "ETH",
  stETH: "ETH",
  wstETH: "ETH",
  rETH: "ETH",
  cbETH: "ETH",
  weETH: "ETH",
  frxETH: "ETH",
  sfrxETH: "ETH",
  BTC: "BTC",
  WBTC: "BTC",
  cbBTC: "BTC",
  tBTC: "BTC",
  LBTC: "BTC",
  sBTC: "BTC",
  EURC: "EURC",
};

function log(msg: string) {
  try {
    writeFileSync("/dev/stderr", msg + "\n");
  } catch {
    console.log(msg);
  }
}

interface HarvestVault {
  id: string;
  chain: string;
  tokenNames: string[];
  platform: string[];
  tags: string[];
  vaultAddress: string;
  tokenAddress: string;
  strategyAddress: string;
  estimatedApy: string;
  estimatedApyBreakdown: (string | number)[];
  boostedEstimatedAPY: string;
  totalValueLocked: string | number;
  underlyingBalanceWithInvestment: string;
  usdPrice: string;
  pricePerFullShare: string;
  decimals: string;
  inactive: boolean;
  logoUrl: string[];
  apyIconUrls: string[];
  apyTokenSymbols: string[];
  _sourceChain: string;
  _vaultKey: string;
  [key: string]: unknown;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export async function fetchHarvestVaults(): Promise<YieldVault[]> {
  try {
    log("[harvest-api] fetching vaults...");
    const res = await fetch(HARVEST_API);

    if (!res.ok) {
      log(`[harvest-api] failed: ${res.status}`);
      return [];
    }

    const raw = await res.json();

    const chainKeys = Object.keys(CHAIN_NAMES);
    const allVaults: HarvestVault[] = [];

    for (const key of chainKeys) {
      const chainData = raw[key];
      if (!chainData || typeof chainData !== "object") continue;

      const entries = Object.entries(chainData as Record<string, unknown>);
      for (const [vaultKey, vaultData] of entries) {
        if (typeof vaultData === "object" && vaultData !== null) {
          allVaults.push({
            ...(vaultData as HarvestVault),
            _sourceChain: key,
            _vaultKey: vaultKey,
          });
        }
      }
    }

    log(`[harvest-api] total vaults: ${allVaults.length}`);

    // Filter: active vaults with supported assets only
    const activeVaults = allVaults.filter((v) => !v.inactive);
    log(`[harvest-api] active vaults: ${activeVaults.length}`);

    // For now, filter to USDC only as requested
    const usdcVaults = activeVaults.filter((v) => {
      const names = v.tokenNames || [];
      return names.some((n) => n.toUpperCase() === "USDC");
    });

    log(`[harvest-api] USDC vaults: ${usdcVaults.length}`);
    for (const v of usdcVaults) {
      log(`[harvest-api] USDC: id=${v.id} chain=${v._sourceChain} platform=${v.platform?.[0]} apy=${v.estimatedApy} tvl=${v.totalValueLocked}`);
    }

    // Fetch historical APY data for top vaults (limit to top 20 by TVL to avoid too many requests)
    const sortedByTvl = [...usdcVaults].sort(
      (a, b) => parseNumber(b.totalValueLocked) - parseNumber(a.totalValueLocked),
    );
    const topVaults = sortedByTvl.slice(0, 20);
    const historyMap = new Map<string, { apy24h: number | null; apy30d: number | null }>();

    const historyResults = await Promise.all(
      topVaults.map((v) => fetchVaultHistory(v.vaultAddress, v._sourceChain)),
    );
    topVaults.forEach((v, i) => {
      historyMap.set(v.vaultAddress, {
        apy24h: historyResults[i].apy24h,
        apy30d: historyResults[i].apy30d,
      });
    });

    const seenSlugs = new Set<string>();
    const results: YieldVault[] = usdcVaults.map((v) => {
      const chain = CHAIN_NAMES[v._sourceChain] || v._sourceChain;
      const platform = v.platform?.[0] || "Harvest";

      // Build a human-readable product name from platform
      // e.g. "Morpho - Gauntlet Core V2" -> "USDC Gauntlet Core V2"
      // e.g. "Aave" -> "USDC Aave"
      const platformParts = platform.split(" - ");
      const protocol = platformParts[0].trim();
      const strategy = platformParts.length > 1 ? platformParts.slice(1).join(" - ").trim() : "";
      const productName = strategy ? `USDC ${strategy}` : `USDC ${protocol}`;
      const categoryDisplay = `${protocol} - ${chain}`;
      const currentApy = parseNumber(v.estimatedApy);
      const tvl = parseNumber(v.totalValueLocked);
      const history = historyMap.get(v.vaultAddress);

      // Slug uses the actual underlying token symbol (cbbtc, wsteth, ...)
      // so ETH and wstETH variants of the same strategy get distinct URLs.
      const matchedToken =
        (v.tokenNames || []).find((n) =>
          Object.prototype.hasOwnProperty.call(SUPPORTED_ASSETS, n),
        ) || "USDC";
      // Spec: {asset}-{protocol}-{vault-disambiguator}-{network}
      // Always include protocol slot so vaults with the same strategy name
      // across different protocols stay distinct (no -2/-3 dedup hacks).
      const tokenUpper = matchedToken.toUpperCase();
      const strategyStripped = strategy
        .replace(new RegExp("^" + tokenUpper + "\\s+", "i"), "")
        .trim();
      let disambiguator = strategyStripped ? slugify(strategyStripped) : "";
      const protocolSlug = slugify(protocol);
      const chainSlug = slugify(chain);

      // LP pair fallback: when productName/strategy collides across vaults,
      // disambiguate by the OTHER token from tokenNames.
      if (!disambiguator || disambiguator === protocolSlug) {
        const others = (v.tokenNames || []).filter(
          (n) => String(n).toUpperCase() !== tokenUpper,
        );
        if (others.length > 0) {
          disambiguator = others.map((n) => slugify(n)).join("-");
        }
      }

      const baseSlug =
        disambiguator && disambiguator !== protocolSlug
          ? `${slugify(matchedToken)}-${protocolSlug}-${disambiguator}-${chainSlug}`
          : `${slugify(matchedToken)}-${protocolSlug}-${chainSlug}`;

      // Deduplicate with -2, -3 etc
      let slug = baseSlug;
      let counter = 1;
      while (seenSlugs.has(slug)) {
        counter++;
        slug = `${baseSlug}-${counter}`;
      }
      seenSlugs.add(slug);

      // Build APY breakdown from token symbols and breakdown values
      const breakdownValues = v.estimatedApyBreakdown || [];
      const tokenSymbols = v.apyTokenSymbols || [];
      const apyBreakdown: { source: string; apy: number }[] = breakdownValues.map(
        (val, i) => ({
          source:
            tokenSymbols[i] ||
            (breakdownValues.length === 1 ? "Base Rate" : `Source ${i + 1}`),
          apy: parseNumber(val),
        }),
      );

      const boostedApy = v.boostedEstimatedAPY
        ? parseNumber(v.boostedEstimatedAPY)
        : null;

      const iconUrls = v.apyIconUrls || [];
      // Collapse duplicate reward symbols at the source: the upstream feed
      // can list the same token more than once (e.g. two sub-vaults both
      // paying WETH), which otherwise renders "WETH, WETH" in Strategy
      // details and "WETH and other reward tokens" in prose. Keep the first
      // occurrence so a genuinely multi-token vault still carries every
      // distinct reward.
      const seenRewardSymbols = new Set<string>();
      const rewardTokens = tokenSymbols.map((sym, i) => ({
        symbol: sym,
        logoUrl: iconUrls[i] || "",
      })).filter((r) => {
        if (!r.symbol || !r.logoUrl) return false;
        if (seenRewardSymbols.has(r.symbol)) return false;
        seenRewardSymbols.add(r.symbol);
        return true;
      });

      return {
        id: v.vaultAddress,
        slug,
        asset: "USDC" as Asset,
        productName,
        protocol: { name: "Harvest Finance", slug: "harvest-finance" },
        vaultType: v.tags?.some((t) => t.toLowerCase().includes("pilot")) ? "Autopilot" as const : "Autocompounder" as const,
        apy24h: history?.apy24h ?? currentApy,
        apy30d: history?.apy30d ?? currentApy,
        tvl,
        description: `${productName} on ${protocol} (${chain}). Yield strategy indexed by Harvest.`,
        chain,
        contractAddress: v.vaultAddress,
        riskLevel: "low" as const,
        category: categoryDisplay,
        launchDate: "",
        apyBreakdown,
        boostedApy: boostedApy && boostedApy > 0 ? boostedApy : null,
        strategyAddress: v.strategyAddress || undefined,
        tokenAddress: v.tokenAddress || undefined,
        underlyingLogos: Array.isArray(v.logoUrl) ? v.logoUrl.filter(Boolean) : undefined,
        rewardTokens: rewardTokens.length > 0 ? rewardTokens : undefined,
      };
    });

    // Sort by APY descending (highest yield first)
    results.sort((a, b) => b.apy24h - a.apy24h);

    log(`[harvest-api] final count: ${results.length}`);
    return results;
  } catch (err) {
    log(`[harvest-api] error: ${err}`);
    return [];
  }
}
