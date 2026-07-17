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

// WebPage node carrying Speakable: marks the H1 title + byline (chain ·
// protocol · vault type) as the concise, answer-ready summary for voice /
// AI answer engines. Speakable is defined on WebPage, not FinancialProduct,
// so it gets its own node.
export function webPageSchema(vault: YieldVault): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: vault.productName,
    url: `${SITE_URL}/${vault.slug}`,
    // The page's figures are derived from our documented methodology; this is
    // a valid CreativeWork provenance link (FinancialProduct, a Service, can't
    // carry isBasedOn, so the citation signal lives here and on the Dataset).
    isBasedOn: `${SITE_URL}/methodology`,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [".uni-title", ".uni-title-byline"],
    },
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

// Report pages (e.g. /report/xrp-yield-ranking) aren't per-vault, so they use
// these plain builders instead of the YieldVault-typed ones above.

export function faqPageSchema(faqs: { q: string; a: string }[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

// Ranking as an ItemList. Kept to plain name + url ListItems (not
// FinancialProduct): the ranked venues are external protocols, not our
// products, so we avoid schema that would read as if we offer them.
export function reportItemListSchema(
  items: { name: string; url: string }[],
  listUrl: string,
): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: listUrl,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: it.url,
    })),
  };
}

export function reportWebPageSchema(o: {
  name: string;
  url: string;
  description: string;
  dateModified: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: o.name,
    url: o.url,
    description: o.description,
    dateModified: o.dateModified,
    isBasedOn: `${SITE_URL}/methodology`,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

// Dataset node for report pages (e.g. /report/xrp-yield-ranking). Unlike the
// per-vault datasetSchema above, this describes an externally-sourced ranking
// dataset (DeFiLlama + Spectra), so provenance points at those sources.
export function reportDatasetSchema(o: {
  name: string;
  description: string;
  url: string;
  dateModified: string;
  numberOfItems?: number;
  keywords?: string[];
  sources?: string[];
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: o.name,
    description: o.description,
    url: o.url,
    creator: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    dateModified: o.dateModified,
    isBasedOn: (o.sources ?? []).map((s) => s),
    ...(o.numberOfItems ? { size: `${o.numberOfItems} venues` } : {}),
    keywords: o.keywords ?? ["XRP", "DeFi", "yield", "APY", "TVL"],
    isAccessibleForFree: true,
    license: "https://creativecommons.org/licenses/by/4.0/",
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

// A vault qualifies for a Dataset (and a downloadable CSV export) once
// either series has at least this many indexed points. The same 30-point
// floor drives hasThinHistory in lib/data.ts, so the Dataset schema, the
// CSV download, and the noindex gate all agree on "enough data to be a
// real, indexable page".
export const DATASET_MIN_POINTS = 30;

export function hasDatasetDownload(history: FullVaultHistory): boolean {
  return (
    history.apyHistory.length >= DATASET_MIN_POINTS ||
    history.tvlHistory.length >= DATASET_MIN_POINTS
  );
}

// Public path of the per-vault CSV export emitted at build time by
// scripts/build-history-csv.mjs. Used by both the Dataset schema's
// DataDownload distribution and the on-page "Download CSV" link, so the
// schema and the UI can never point at different URLs.
export function historyCsvHref(slug: string): string {
  return `/history/${slug}.csv`;
}

export function datasetSchema(
  vault: YieldVault,
  history: FullVaultHistory,
): object | null {
  if (!hasDatasetDownload(history)) {
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
    // Freshness + provenance signals AI answer engines look for: when the data
    // was last refreshed, what it is derived from (our documented methodology),
    // and a ready-to-use citation string.
    dateModified: new Date(Math.max(...allTs) * 1000).toISOString(),
    isBasedOn: `${SITE_URL}/methodology`,
    citation: `Harvest Finance on-chain yield index. "${vault.productName} historical APY, TVL and share-price data." ${SITE_URL}/${vault.slug}. Indexed from on-chain vault-contract events; methodology at ${SITE_URL}/methodology.`,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
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
    // CSV first (a real, parseable file Google's Dataset crawler and
    // researchers can download), then the agent-native JSON (current
    // metrics + history summary + addresses), then the on-page HTML table
    // as a human-readable secondary distribution.
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: `${SITE_URL}${historyCsvHref(vault.slug)}`,
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: `${SITE_URL}/data/${vault.slug}.json`,
      },
      {
        "@type": "DataDownload",
        encodingFormat: "text/html",
        contentUrl: `${SITE_URL}/${vault.slug}#history`,
      },
    ],
  };
}
