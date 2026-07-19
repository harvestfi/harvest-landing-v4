import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  ogImageResponse,
  loadOgFonts,
  OG_SIZE,
  OG_CONTENT_TYPE,
} from "@/lib/og-template";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "XRP Yield Ranking — where XRP actually earns, by Harvest";

// Read the current snapshot for the stat row (build-time, Node). Falls back to
// sensible defaults so the card never fails to render between snapshots.
function stats() {
  try {
    const f = join(process.cwd(), "data", "xrp-yield.json");
    if (!existsSync(f)) return null;
    const d = JSON.parse(readFileSync(f, "utf-8"));
    return d?.stats ?? null;
  } catch {
    return null;
  }
}

export default async function Og() {
  const [s, fonts] = await Promise.all([stats(), loadOgFonts()]);
  const venues = s?.venues ?? 14;
  const chains = s?.chains?.length ?? 2;
  const median = typeof s?.medianApy === "number" ? `${s.medianApy.toFixed(2)}%` : "—";

  return ogImageResponse(
    {
      brand: "Harvest",
      eyebrow: "XRP Yield Report",
      headline: "XRP Yield Ranking",
      sub: `Where XRP actually earns. ${venues} curated DeFi products across ${chains} networks — lending, vaults, fixed-rate Principal Tokens and liquidity pools — ranked by real 30-day rate.`,
      stats: [
        { label: "Products", value: String(venues) },
        { label: "Networks", value: String(chains) },
        { label: "Median rate", value: median, accent: true },
      ],
      footer: "harvest.finance",
    },
    fonts,
  );
}
