import { YieldVault } from "./types";
import { SITE_NAME, SITE_URL } from "./constants";
import type { FullVaultHistory } from "./history-api";
import type { Crumb } from "./seo";
import { getProtocolLabel } from "./seo";

export function breadcrumbSchema(crumbs: Crumb[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => {
      const entry: Record<string, unknown> = {
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
      };
      // Last item has no item URL per Google's BreadcrumbList spec
      if (c.url && i < crumbs.length - 1) entry.item = c.url;
      return entry;
    }),
  };
}

export function financialProductSchema(vault: YieldVault): object {
  // provider = the operator publishing the page (Harvest). seller is
  // the underlying venue (Aave, Morpho, Aerodrome, etc.) where the
  // strategy actually routes the deposit. Previously both were
  // collapsed onto `provider`, which made Google read each product
  // as if Aave / Morpho owned the index page itself.
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    name: vault.productName,
    url: `${SITE_URL}/${vault.slug}`,
    description: `${vault.description} Historical onchain yield analytics for ${vault.productName} on ${vault.chain}, indexed by ${SITE_NAME}. Informational data tool, not financial advice.`,
    inLanguage: "en",
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    brand: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    seller: {
      "@type": "Organization",
      name: getProtocolLabel(vault),
    },
    category: vault.category,
    feesAndCommissionsSpecification: "N/A",
  };

  if (vault.apy30d > 0) {
    schema.interestRate = {
      "@type": "QuantitativeValue",
      value: (vault.apy30d / 100).toFixed(4),
      unitText: "PERCENT",
    };
  }

  return schema;
}

export function itemListSchema(vaults: YieldVault[], hubUrl: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: hubUrl,
    itemListElement: vaults.map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "FinancialProduct",
        name: v.productName,
        url: `${SITE_URL}/${v.slug}`,
        provider: { "@type": "Organization", name: v.protocol.name },
        ...(v.apy30d > 0
          ? {
              interestRate: {
                "@type": "QuantitativeValue",
                value: (v.apy30d / 100).toFixed(4),
                unitText: "PERCENT",
              },
            }
          : {}),
      },
    })),
  };
}

export function articleSchema({
  title,
  description,
  url,
  dateModified,
  datePublished,
}: {
  title: string;
  description: string;
  url: string;
  dateModified: string;
  datePublished: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url,
    datePublished,
    dateModified,
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

export function datasetSchema(
  vault: YieldVault,
  history: FullVaultHistory,
): object | null {
  if (history.apyHistory.length < 30 && history.tvlHistory.length < 30) {
    return null;
  }

  const allTs: number[] = [
    ...history.apyHistory.map((p) => p.timestamp),
    ...history.tvlHistory.map((p) => p.timestamp),
    ...history.sharePriceHistory.map((p) => p.timestamp),
  ];
  const startDate = new Date(Math.min(...allTs) * 1000)
    .toISOString()
    .split("T")[0];
  const endDate = new Date(Math.max(...allTs) * 1000)
    .toISOString()
    .split("T")[0];

  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${vault.productName} historical APY, TVL and share-price data`,
    description: `Daily APY (${history.apyHistory.length} points), TVL (${history.tvlHistory.length} points) and share-price (${history.sharePriceHistory.length} points) history for the ${vault.productName} vault on ${vault.chain}, indexed by ${SITE_NAME} from onchain vault-contract events. Historical analytics for research, not financial advice.`,
    url: `${SITE_URL}/${vault.slug}#history`,
    creator: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    temporalCoverage: `${startDate}/${endDate}`,
    keywords: [
      vault.asset,
      vault.chain,
      vault.protocol.name,
      vault.category,
      "DeFi",
      "yield",
      "APY",
      "TVL",
    ],
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "text/html",
      contentUrl: `${SITE_URL}/${vault.slug}#history`,
    },
  };
}
