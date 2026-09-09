import { statSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { isRanked, loadCasinos } from "@/lib/crypto-casinos-data";
import { FAQS, bonusHeadline } from "@/lib/crypto-casinos-copy";
import { CasinosBody } from "@/components/casinos/casinos-body";
import { getLiveVaults } from "@/lib/data";
import { LOW_LIQUIDITY_TVL_THRESHOLD } from "@/lib/admin-rules";
import {
  articleSchema,
  breadcrumbSchema,
  faqPageSchema,
  reportDatasetSchema,
  reportItemListSchema,
  reportWebPageSchema,
} from "@/lib/jsonld";
import { SITE_AUTHOR } from "@/lib/author";
import "../_styles/home.css";
import "../_styles/report.css";
import "../_styles/crypto-casinos.css";

const PAGE_URL = `${SITE_URL}/best-crypto-casino-bonus`;

const PUBLISHED = "2026-09-08";

function dataModifiedIso(): string {
  try {
    return statSync(join(process.cwd(), "data", "crypto-casinos.json"))
      .mtime.toISOString()
      .slice(0, 10);
  } catch {
    return PUBLISHED;
  }
}

export interface HarvestRow {
  slug: string;
  asset: string;
  name: string;
  chain: string;
  apy: number;
  tvl: number;
}

async function harvestStables(): Promise<HarvestRow[]> {
  try {
    const vaults = await getLiveVaults();
    return vaults
      .filter(
        (v) =>
          v.asset === "USDC" &&
          v.tvl >= LOW_LIQUIDITY_TVL_THRESHOLD &&
          v.chain !== "zkSync",
      )
      .sort((a, b) => b.apy24h - a.apy24h)
      .slice(0, 6)
      .map((v) => ({
        slug: v.slug,
        asset: v.asset,
        name: v.productName.replace(new RegExp(`^${v.asset}\\s+`), ""),
        chain: v.chain,
        apy: v.apy24h,
        tvl: v.tvl,
      }));
  } catch {
    return [];
  }
}

function dataUpdatedAt(): string {
  try {
    const mtime = statSync(join(process.cwd(), "data", "vaults.json")).mtime;
    return mtime.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    });
  } catch {
    return "";
  }
}

export function generateMetadata(): Metadata {
  const ranked = loadCasinos().casinos.filter(isRanked);
  const { compact, full, sites } = bonusHeadline(ranked);
  const TITLE = `Best Crypto Casino Bonus 2026: ${compact} Across ${sites} Sites`;
  const DESCRIPTION = `${full} in welcome bonuses across ${sites} crypto casinos, ranked by offer size. Compare wagering, deposits and payout terms, then price your own bonus.`;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: PAGE_URL,
      siteName: SITE_NAME,
      type: "website",
    },
  };
}

export default async function CryptoCasinosPage() {
  const { casinos } = loadCasinos();
  const ranked = casinos.filter(isRanked);

  const { compact, full, sites } = bonusHeadline(ranked);
  const TITLE = `Best Crypto Casino Bonus 2026: ${compact} Across ${sites} Sites`;
  const DESCRIPTION = `${full} in welcome bonuses across ${sites} crypto casinos, ranked by offer size. Compare wagering, deposits and payout terms, then price your own bonus.`;
  const modified = dataModifiedIso();

  const jsonLd: object[] = [
    breadcrumbSchema([
      { name: "Home", url: SITE_URL },
      { name: "Best Crypto Casino Bonus", url: PAGE_URL },
    ]),
    reportWebPageSchema({
      name: TITLE,
      url: PAGE_URL,
      description: DESCRIPTION,
      datePublished: PUBLISHED,
      dateModified: modified,
    }),
    articleSchema({
      title: TITLE,
      description: DESCRIPTION,
      url: PAGE_URL,
      datePublished: PUBLISHED,
      dateModified: modified,
      author: SITE_AUTHOR,
    }),
    reportDatasetSchema({
      name: "Crypto casino welcome bonuses, ranked by offer size",
      description:
        "Advertised welcome bonuses, cashback and rakeback at tracked crypto casinos, with the playthrough each attaches, the qualifying deposit, published withdrawal wording, payout coins and lobby categories. Each verified figure carries the operator URL it was read from and the date, or is marked unconfirmed.",
      url: PAGE_URL,
      dateModified: modified,
      numberOfItems: ranked.length,
      keywords: [
        "crypto casino",
        "welcome bonus",
        "wagering requirement",
        "playthrough",
        "no KYC",
        "bitcoin casino",
      ],
      sources: ranked
        .flatMap((c) =>
          Object.values(c.sources ?? {})
            .filter((x): x is { url: string; readOn: string } =>
              typeof x === "object" && x != null && "url" in x,
            )
            .map((x) => x.url),
        )
        .filter((u, i, a) => a.indexOf(u) === i),
      distribution: [
        { format: "application/json", url: `${SITE_URL}/data/crypto-casinos/index.json` },
        { format: "text/csv", url: `${SITE_URL}/data/crypto-casinos/offers.csv` },
      ],
    }),
    faqPageSchema(FAQS),
  ];
  if (ranked.length > 0) {
    jsonLd.push(
      reportItemListSchema(
        ranked.map((c) => ({ name: c.name, url: `${PAGE_URL}#${c.slug}` })),
        PAGE_URL,
      ),
    );
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CasinosBody harvest={await harvestStables()} dataUpdated={dataUpdatedAt()} />
    </>
  );
}
