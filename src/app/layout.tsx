import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Analytics } from "@/components/analytics";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL, OG_BASE_URL } from "@/lib/constants";
import "./globals.css";

// Self-hosted at build time by next/font. Eliminates the render-blocking
// fonts.googleapis.com request the previous globals.css @import was making
// and emits the correct preload + font-display: swap automatically.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});
// Inter Tight is now used only by the brand logo (--logo, weight 600);
// every other heading/display surface uses Inter via --display.
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-inter-tight",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const DEFAULT_TITLE = "Best DeFi Yields: Compare Top APY Rankings | Harvest";
const OG_IMAGE = `${SITE_URL}/icon.png`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffb936",
};

export const metadata: Metadata = {
  metadataBase: new URL(OG_BASE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "DeFi yield",
    "best APY",
    "USDC yield",
    "USDT yield",
    "ETH yield",
    "Bitcoin yield",
    "stablecoin yield",
    "yield farming",
    "Harvest Finance",
    "onchain yield index",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: { index: true, follow: true },
  icons: {
    // Single PNG favicon (H. on the gold tile) for the browser tab,
    // shortcut, and apple-touch icon. /icon.png also backs the JSON-LD
    // logo and the static-page OG fallback.
    icon: [{ url: "/icon.png", type: "image/png", sizes: "any" }],
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: SITE_URL,
    images: [
      {
        url: OG_IMAGE,
        alt: `${SITE_NAME} - DeFi yield index`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@harvest_finance",
    creator: "@harvest_finance",
    images: [OG_IMAGE],
  },
};

const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  description: SITE_DESCRIPTION,
  // Entity-resolution signals: help search + AI answer engines confidently
  // attribute facts to the "Harvest" entity (vs a generic page). foundingDate
  // is the protocol's 2020 launch; knowsAbout enumerates the topics the index
  // is authoritative on; contactPoint + areaServed round out the profile.
  foundingDate: "2020",
  slogan: "Independent onchain DeFi yield index",
  areaServed: "Worldwide",
  knowsAbout: [
    "DeFi yield",
    "yield aggregation",
    "autocompounding vaults",
    "APY",
    "TVL",
    "stablecoin yield",
    "USDC yield",
    "USDT yield",
    "ETH yield",
    "Bitcoin yield",
    "Ethereum",
    "Base",
    "Arbitrum",
    "Polygon",
    "zkSync",
    "HyperEVM",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: `${SITE_URL}/contact`,
  },
  // Entity graph: the official surfaces that all refer to the same
  // Harvest organization. Strengthens E-E-A-T / entity resolution for
  // search and AI answer engines. Official-first, then the high-signal
  // DeFi sources (DefiLlama), then a token aggregator. The canonical home
  // is intentionally omitted - it's already `url` above; sameAs is for the
  // *other* profiles.
  sameAs: [
    "https://app.harvest.finance/",
    "https://x.com/harvest_finance",
    "https://harvestfinance.medium.com/",
    "https://discord.gg/xHXe3tYjPY",
    "https://github.com/harvestfi",
    "https://docs.harvest.finance/",
    "https://defillama.com/protocol/harvest-finance",
    "https://www.coingecko.com/en/coins/harvest-finance",
  ],
};

const WEBSITE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Google tag (gtag.js) */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-EJMXWBVX4R"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-EJMXWBVX4R');`,
          }}
        />
        {/* Pre-paint theme resolver. Runs synchronously before the body
            paints so users on dark mode never see a flash of the light
            theme. Reads the explicit user choice from localStorage and
            falls back to the OS prefers-color-scheme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('harvest-theme');var t=s==='dark'||s==='light'?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSONLD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
        />
        <Header />
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
