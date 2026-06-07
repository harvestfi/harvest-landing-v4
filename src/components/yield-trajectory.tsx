import { formatAPY } from "@/lib/format";
import { depositRef, apyToMonthly, fmtEarnings } from "@/lib/contextualize";
import type { FullVaultHistory } from "@/lib/history-api";
import { ProximityNote } from "@/components/proximity-note";

interface Props {
  history: FullVaultHistory;
  productName: string;
  apy24h: number;
  asset: string;
}

function mean(vals: number[]): number {
  return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function YieldTrajectory({ history, productName, asset }: Props) {
  const ref = depositRef(asset);
  const isNativeAsset = asset === "ETH" || asset === "BTC";

  const validApy = history.apyHistory
    .filter((p) => p.apy >= 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (validApy.length < 14) return null;

  // Anchor every window (7/14/30-day, streak, WoW) to the latest
  // indexed reading rather than wall-clock now, so the framing stays
  // consistent with the rest of the page on vaults whose newest
  // reading is a few days stale.
  const now = validApy[validApy.length - 1].timestamp;

  const thirtyDaysAgo = now - 30 * 86400;
  const recent30d = validApy.filter((p) => p.timestamp >= thirtyDaysAgo);
  if (recent30d.length < 7) return null;

  // Current streak: count consecutive days with same direction from latest
  const desc = [...validApy].reverse();
  let streakLen = 1;
  let streakDir: "up" | "down" | "flat" = "flat";
  if (desc.length >= 2) {
    const diff = desc[0].apy - desc[1].apy;
    streakDir = Math.abs(diff) < 0.05 ? "flat" : diff > 0 ? "up" : "down";
    for (let i = 2; i < desc.length; i++) {
      const d = desc[i - 1].apy - desc[i].apy;
      const dir = Math.abs(d) < 0.05 ? "flat" : d > 0 ? "up" : "down";
      if (dir === streakDir) streakLen++;
      else break;
    }
  }
  const streakLabel =
    streakDir === "up" ? "rising" : streakDir === "down" ? "declining" : "flat";
  const streakFrom = desc[Math.min(streakLen - 1, desc.length - 1)].apy;
  const streakTo = desc[0].apy;

  // Days with positive yield out of last 30d
  const daysWithYield = recent30d.filter((p) => p.apy > 0).length;

  // Week-over-week change
  const sevenDaysAgo = now - 7 * 86400;
  const fourteenDaysAgo = now - 14 * 86400;
  const thisWeek = validApy.filter((p) => p.timestamp >= sevenDaysAgo);
  const lastWeek = validApy.filter(
    (p) => p.timestamp >= fourteenDaysAgo && p.timestamp < sevenDaysAgo,
  );
  const thisWeekAvg = mean(thisWeek.map((p) => p.apy));
  const lastWeekAvg = mean(lastWeek.map((p) => p.apy));
  const wow =
    lastWeekAvg > 0 ? ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100 : 0;

  // Best / worst 7-day rolling window within 30d data
  let bestWindow = { start: 0, end: 0, avg: -Infinity };
  let worstWindow = { start: 0, end: 0, avg: Infinity };
  if (recent30d.length >= 7) {
    for (let i = 0; i <= recent30d.length - 7; i++) {
      const window = recent30d.slice(i, i + 7);
      const avg = mean(window.map((p) => p.apy));
      if (avg > bestWindow.avg) {
        bestWindow = {
          start: window[0].timestamp,
          end: window[window.length - 1].timestamp,
          avg,
        };
      }
      if (avg < worstWindow.avg) {
        worstWindow = {
          start: window[0].timestamp,
          end: window[window.length - 1].timestamp,
          avg,
        };
      }
    }
  }

  const sentences: string[] = [];

  // #8 Streak sentence - only meaningful when there's an actual
  // multi-day streak. With streakLen === 1 the "from X to Y" framing
  // collapses to "from X to X" (same number twice), which is exactly
  // what the user flagged: a sentence that says nothing. Skip it and
  // let the next sentence (30-day positive-yield rhythm) carry the
  // section opener.
  if (streakLen >= 2 && streakDir !== "flat") {
    const streakPrefix = `${productName} has been on a ${streakLen}-day ${streakLabel} streak,`;
    let streakSentence = `${streakPrefix} with APY moving from ${formatAPY(streakFrom)} to ${formatAPY(streakTo)} over this period.`;

    const fromMonthly = apyToMonthly(streakFrom, ref.amount);
    const toMonthly = apyToMonthly(streakTo, ref.amount);
    const swing = Math.abs(fromMonthly - toMonthly);
    if (swing >= 1) {
      streakSentence += ` On a ${ref.label} deposit, that's a swing from earning ${fmtEarnings(fromMonthly, asset)}/mo to ${fmtEarnings(toMonthly, asset)}/mo.`;
    }
    sentences.push(streakSentence);
  }

  sentences.push(
    `Over the past 30 days, the vault delivered positive yields on ${daysWithYield} out of ${recent30d.length} days.`,
  );

  // #9 WoW with contextualization
  if (lastWeek.length >= 3 && thisWeek.length >= 3) {
    let wowSentence: string;
    if (Math.abs(wow) > 100) {
      const dir = wow > 0 ? "more than doubled" : "dropped by more than half";
      wowSentence = `Week-over-week, yields have ${dir}.`;
    } else {
      const wowDir = wow >= 0 ? "increased" : "declined";
      wowSentence = `Week-over-week, yields have ${wowDir} by ${Math.abs(wow).toFixed(1)}%.`;
    }

    // Contextualization: monthly dollar shift
    const wowMonthlyShift = apyToMonthly(thisWeekAvg - lastWeekAvg, ref.amount);
    const absShift = Math.abs(wowMonthlyShift);
    if (absShift >= 0.5) {
      const sign = wowMonthlyShift >= 0 ? "+" : "-";
      // fmtEarnings outputs "~$X" — insert sign after ~
      const formatted = fmtEarnings(absShift, asset);
      const signedFormatted = isNativeAsset
        ? `${sign}${formatted}`
        : formatted.replace("~$", `~${sign}$`);
      wowSentence += ` That's a shift of ${signedFormatted}/mo per ${ref.label} deposited.`;
    }

    sentences.push(wowSentence);
  }

  // #10 Best/worst 7-day window with contextualization
  if (bestWindow.avg > -Infinity && worstWindow.avg < Infinity) {
    let windowSentence = `The strongest 7-day period was ${formatDate(bestWindow.start)}-${formatDate(bestWindow.end)} averaging ${bestWindow.avg.toFixed(2)}%, while the weakest was ${formatDate(worstWindow.start)}-${formatDate(worstWindow.end)} at ${worstWindow.avg.toFixed(2)}%.`;

    if (bestWindow.avg - worstWindow.avg >= 2) {
      const highMonthly = apyToMonthly(bestWindow.avg, ref.amount);
      const lowMonthly = apyToMonthly(worstWindow.avg, ref.amount);
      windowSentence += ` On ${ref.label}, that's the difference between earning ${fmtEarnings(highMonthly, asset)} and ${fmtEarnings(lowMonthly, asset)} per month.`;
    }

    sentences.push(windowSentence);
  }

  // Deliberately no "current 24h APY vs its own 30-day average"
  // sentence here: apy24h is a spot estimate from the listing feed
  // while the 30-day average is realized return from the indexer.
  // Comparing the two produced false "X% below its 30-day average"
  // verdicts when the series diverged. The headline already shows the
  // spot number; this section stays within the realized history.

  return (
    <section className="pp-section" id="trajectory">
      <h2>Yield trajectory</h2>
      <div className="about-prose">
        <p>{sentences.join(" ")}</p>
      </div>
      <ProximityNote />
    </section>
  );
}
