import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/constants";
import { loadStockData } from "@/lib/tokenized-stocks";
import { TokenizedStocksBody, STOCKS_URL } from "@/components/tokenized-stocks-body";
import "../_styles/asset-hub.css";
import "../_styles/report.css";
import "../_styles/usdc-hub.css";
import "../_styles/asset-editorial.css";
import "../_styles/asset-ld.css";

export async function generateMetadata(): Promise<Metadata> {
  const n = loadStockData().vaults.length;
  // Coinbase's product name and its tickers lead the title.
  const title = `Yield on Coinbase Tokenized Stocks: NVDAc, AAPLc, METAc, GOOGLc | ${SITE_NAME}`;
  // No live rate in the snippet: it refreshes daily and a stale figure in a
  // search result is worse than none.
  const description = `Earn yield on Coinbase Tokenized Stocks (NVDAc, AAPLc, METAc, GOOGLc) on Base: ${n} autocompounding carry-trade vaults ranked by APY, with the leverage behind each, fixed-rate markets on top and the risks.`;
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, url: STOCKS_URL, siteName: SITE_NAME, type: "website" },
    alternates: { canonical: STOCKS_URL },
  };
}

export default function TokenizedStocksPage() {
  return <TokenizedStocksBody />;
}
