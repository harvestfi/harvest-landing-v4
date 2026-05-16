import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getVaultBySlug,
  getVaults,
  getAllSlugs,
  getVaultHistory,
  isBrokenLowTvlVault,
} from "@/lib/data";
import { isCanonicalSlug } from "@/lib/canonical-vaults";
import { formatAPY, formatTVL } from "@/lib/format";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { productPageTitle, productPageDescription, productPageCrumbs, comboKey } from "@/lib/seo";
import { financialProductSchema, breadcrumbSchema, datasetSchema } from "@/lib/jsonld";
import type { YieldVault } from "@/lib/types";
import type { FullVaultHistory } from "@/lib/history-api";
import { ProductPageBody } from "@/components/product-page-body";
import { getHoldersMap } from "@/lib/data";
import { buildAutopilotFaqItems } from "@/lib/autopilot-faq";
import { buildAutocompounderFaqItems } from "@/lib/autocompounder-faq";
import "../_styles/product.css";

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vault = await getVaultBySlug(slug);
  if (!vault) return {};

  const history = await getVaultHistory(vault.contractAddress);
  const validApy = history.apyHistory.filter((p) => p.apy >= 0);
  let trackedDays = 0;
  if (validApy.length > 0) {
    const sorted = [...validApy].sort((a, b) => a.timestamp - b.timestamp);
    trackedDays = Math.round(
      (sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 86400,
    );
  }

  // The asset+protocol+network combo decides whether the vault-name
  // disambiguator stays in the title. Counted across the full vault
  // index so two vaults that share asset+protocol+network keep their
  // distinct names instead of rendering identical titles.
  const allVaults = await getVaults();
  const myKey = comboKey(vault);
  let comboCount = 0;
  for (const v of allVaults) {
    if (comboKey(v) === myKey) comboCount += 1;
  }
  const isUniqueCombo = comboCount === 1;

  const title = productPageTitle(vault, isUniqueCombo);
  const description = productPageDescription(vault, trackedDays);

  const canonical = await isCanonicalSlug(slug);
  const broken = isBrokenLowTvlVault(vault);
  const indexable = canonical && !broken;

  return {
    title: { absolute: title },
    description,
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${vault.slug}`,
      siteName: SITE_NAME,
      type: "article",
      // article:modified_time signals freshness to crawlers.
      // Resolved from the latest indexer snapshot across all
      // history series so it reflects this specific product.
      ...(() => {
        const stamps = [
          ...history.tvlHistory.map((p) => p.timestamp),
          ...history.sharePriceHistory.map((p) => p.timestamp),
          ...history.apyHistory.map((p) => p.timestamp),
        ].filter((t) => Number.isFinite(t) && t > 0);
        if (stamps.length === 0) return {};
        const ts = Math.max(...stamps);
        return { modifiedTime: new Date(ts * 1000).toISOString() };
      })(),
    },
    twitter: { card: "summary", title, description },
    alternates: { canonical: `${SITE_URL}/${vault.slug}` },
  };
}

function ProductSchemas({
  vault,
  history,
}: {
  vault: YieldVault;
  history: FullVaultHistory;
}) {
  const crumbs = productPageCrumbs(vault);
  const dataset = datasetSchema(vault, history);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(financialProductSchema(vault)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema(crumbs)),
        }}
      />
      {dataset && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }}
        />
      )}
    </>
  );
}

interface FaqItem {
  question: string;
  answer: string;
}

function FaqSchema({ items }: { items: FaqItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

function generateFaqItems(vault: YieldVault): FaqItem[] {
  return [
    {
      question: `What is the current APY for ${vault.productName}?`,
      answer:
        vault.apy24h > 0
          ? `${vault.productName} currently offers a 24-hour APY of ${formatAPY(vault.apy24h)} and a 30-day average APY of ${formatAPY(vault.apy30d)}. APY rates are variable and change based on market conditions.`
          : `${vault.productName} APY data is currently unavailable. APY rates are variable and change based on market conditions.`,
    },
    {
      question: `What chain is ${vault.productName} on?`,
      answer: `${vault.productName} is deployed on ${vault.chain}. It is operated by ${vault.protocol.name} and accepts ${vault.asset} deposits.`,
    },
    {
      question: `How does ${vault.productName} work?`,
      answer: `${vault.productName} is a yield strategy on ${vault.chain} operated by ${vault.protocol.name}. It accepts ${vault.asset} deposits and automatically manages them to generate yield. ${vault.description}`,
    },
    {
      question: `What is the TVL of ${vault.productName}?`,
      answer:
        vault.tvl > 0
          ? `${vault.productName} currently has a total value locked (TVL) of ${formatTVL(vault.tvl)}. TVL represents the total amount of ${vault.asset} deposited in this vault.`
          : `${vault.productName} TVL data is currently unavailable. TVL represents the total amount of ${vault.asset} deposited in this vault.`,
    },
    {
      question: `Is the yield from ${vault.productName} sustainable?`,
      answer: `Yield from ${vault.productName} comes from ${vault.apyBreakdown.length > 0 ? vault.apyBreakdown.map((s) => s.source).join(", ") : "the underlying protocol"}. DeFi yields are variable and depend on market conditions, liquidity, and protocol incentives. Past APY is not a guarantee of future returns.`,
    },
    {
      question: `How stable is the APY for ${vault.productName}?`,
      answer:
        vault.apy24h > 0 && vault.apy30d > 0
          ? `${vault.productName} currently shows a 24-hour APY of ${formatAPY(vault.apy24h)} compared to a 30-day average of ${formatAPY(vault.apy30d)}. ${Math.abs(vault.apy24h - vault.apy30d) < 1 ? "The APY has been relatively consistent over this period." : "There is notable variation between the short-term and longer-term rate, which is common in DeFi yield sources."}`
          : `APY stability data for ${vault.productName} is currently limited. DeFi yields are variable and fluctuate based on supply, demand, and protocol incentives.`,
    },
  ];
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vault = await getVaultBySlug(slug);
  if (!vault) notFound();

  const history = await getVaultHistory(vault.contractAddress);

  // FAQ items for JSON-LD: pull from the same builders that
  // ProductPageBody uses so the schema in <head> matches what
  // the page renders. answerText is the plain-string version of
  // each answer (Q3 has an inline link in JSX; the schema gets a
  // flat string instead).
  const holdersMap = await getHoldersMap();
  const holderCount =
    holdersMap[vault.contractAddress.toLowerCase()] ?? null;
  const typedFaq =
    vault.vaultType === "Autopilot"
      ? buildAutopilotFaqItems(vault, history, holderCount)
      : buildAutocompounderFaqItems(vault, history, holderCount);
  const faqItems: FaqItem[] = typedFaq.map((it) => ({
    question: it.question,
    answer: it.answerText,
  }));

  return (
    <>
      <ProductSchemas vault={vault} history={history} />
      <FaqSchema items={faqItems} />
      <ProductPageBody vault={vault} />
    </>
  );
}
