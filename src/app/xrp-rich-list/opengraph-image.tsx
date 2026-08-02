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
export const alt = "XRP Rich List: top holders, balance distribution and a percentile calculator, by Harvest";

// The three figures the card carries are the three the page is asked for:
// what it takes to be in the top 1%, how many funded accounts there are, and
// what share the largest hundred hold. Read from the snapshot at build time,
// so the card and the page can never quote different numbers.
//
// Every one of them degrades to a dash rather than to a guess. A social card
// showing a plausible-but-wrong threshold is worse than one showing none, on a
// page whose entire pitch is that its figures are checkable.
function snapshot() {
  try {
    const f = join(process.cwd(), "data", "xrp-richlist.json");
    if (!existsSync(f)) return null;
    return JSON.parse(readFileSync(f, "utf-8"));
  } catch {
    return null;
  }
}

const compactXrp = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
};

const compactAccounts = (n: number): string =>
  Number.isFinite(n) && n > 0 ? `${(n / 1_000_000).toFixed(1)}M` : "—";

export default async function Og() {
  const [d, fonts] = await Promise.all([snapshot(), loadOgFonts()]);

  const t1 = d?.tiers?.find((t: { pct: number }) => t.pct === 1);
  const top1 = t1?.minXrp != null ? compactXrp(t1.minXrp) : "—";
  const accounts = d?.accounts != null ? compactAccounts(d.accounts) : "—";
  const conc =
    typeof d?.concentration?.top100PctOfXrp === "number"
      ? `${d.concentration.top100PctOfXrp.toFixed(1)}%`
      : "—";

  return ogImageResponse(
    {
      brand: "Harvest",
      eyebrow: "XRP Rich List",
      headline: "XRP Rich List",
      sub: "Every funded XRP Ledger account, read straight from the ledger. See the largest holders, the balance needed for each percentile tier, and where your own balance ranks. No wallet connection and no address.",
      stats: [
        { label: "Top 1% needs", value: `${top1} XRP`, accent: true },
        { label: "Funded accounts", value: accounts },
        { label: "Held by top 100", value: conc },
      ],
      footer: "harvest.finance/xrp-rich-list",
    },
    fonts,
  );
}
