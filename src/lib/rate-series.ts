// Daily APY series for the rate spark table: one reading per UTC day per
// strategy over a shared window, built from the history file the rest of the
// page reads. A day with no reading is null, so a young vault draws a shorter
// line instead of an invented one.
import type { YieldVault } from "./types";
import type { FullVaultHistory } from "./data";
import { bare, displayVenue } from "./long-hub";

export interface RateSeriesRow {
  id: string;
  label: string;
  sublabel: string;
  href: string;
  /** APY in percent per day of the window, null where nothing was read. */
  values: (number | null)[];
}

export interface RateSeries {
  /** UTC midnight of each day in the window, oldest first, in ms. */
  days: number[];
  rows: RateSeriesRow[];
}

const DAY = 86_400_000;

export function rateSeries(
  vaults: YieldVault[],
  history: Record<string, FullVaultHistory> | null,
  asOfIso: string,
  windowDays = 90,
): RateSeries {
  const end = Math.floor(Date.parse(asOfIso) / DAY) * DAY;
  const days = Array.from({ length: windowDays }, (_, i) => end - (windowDays - 1 - i) * DAY);
  const first = days[0];
  const rows = vaults.map((v) => {
    const h = history?.[v.contractAddress] ?? history?.[v.contractAddress.toLowerCase()];
    const values: (number | null)[] = new Array(windowDays).fill(null);
    // Last reading of each day wins.
    const pts = [...(h?.apyHistory ?? [])]
      .filter((p) => Number.isFinite(p.apy) && p.apy >= 0)
      .sort((a, b) => a.timestamp - b.timestamp);
    for (const p of pts) {
      const k = Math.floor((Math.floor((p.timestamp * 1000) / DAY) * DAY - first) / DAY);
      if (k >= 0 && k < windowDays) values[k] = Math.round(p.apy * 10000) / 10000;
    }
    // The last day shows the rate the page ranks on.
    values[windowDays - 1] = v.apy24h;
    return {
      id: v.slug,
      label: bare(v),
      sublabel: `${v.chain} · ${displayVenue(v)}`,
      href: `/${v.slug}`,
      values,
    };
  });
  return { days, rows };
}
