import { capOf, parseBonus, turnoverUsd, type Casino } from "@/lib/crypto-casinos";

export const money = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
    : `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];

export const spellOut = (n: number, cap = false) => {
  const w = WORDS[n] ?? String(n);
  return cap ? w.charAt(0).toUpperCase() + w.slice(1) : w;
};

export const LEAD = (ranked: number) =>
  `Welcome bonuses, cashback and rakeback from ${ranked} crypto casinos, ranked by the size of the offer.`;

export const BYLINE = (ranked: number) => `${ranked} casinos compared`;

export const RANKING_INTRO =
  "Start with the offer, then check how it works: the deposit required to qualify, the games that count toward wagering, and the conditions for withdrawal. Expand an offer for the details, or select Play now to visit the casino.";

export const DISCLOSURE_SHORT =
  "We may earn a commission when you register through a Play Now link. No casino has paid for its position.";

export const LEGAL_SHORT =
  "18+. Country restrictions apply, and most listed casinos exclude US players.";

export const LEAVE_SITE_BODY = (name: string) =>
  `${name} is a third-party gambling site. Harvest does not run it, hold your balance or process your withdrawal, and every game there has a house edge, so the expected result of continued play is a loss. This link is commercial and may pay us. Check the law where you live and read the bonus terms before you deposit.`;

export const HARVEST_INTRO = [
  "Once your casino withdrawal reaches your wallet, Harvest compares USDC and USDT strategies across DeFi in one place: how each earns its yield, how its rate has moved, and what to expect on the way in and out.",
];

export const HARVEST_SELECTION = (floor: string) =>
  `The selection below highlights USDC strategies tracked by Harvest, each holding at least ${floor} in total deposits.`;

export const APY_NOTE =
  "Annualized yield based on the latest 24 hours of data. Rates change over time.";

export const HARVEST_RISK =
  "Explore the full comparison to see more strategies and their recent rate history. DeFi strategies carry smart-contract, liquidity and stablecoin risks, including the possibility of losing deposited funds. Our risk framework explains what to consider when comparing them.";

export const SORT_RULE =
  "Offers with dollar caps appear first, highest to lowest. Offers capped in BTC or ETH follow, ordered by their advertised match percentage. Percentage-only rewards appear last. Offer descriptions and feature labels reflect each operator’s published claims.";

export interface SummaryPoint {
  lead: string;
  rest: string;
}

export function summaryPoints(casinos: Casino[]): SummaryPoint[] {
  const out: SummaryPoint[] = [];

  const capped = casinos
    .filter((c) => offerKinds(c).includes("welcome") && capOf(c) != null)
    .map((c) => ({ c, cap: capOf(c) as number }))
    .sort((a, b) => b.cap - a.cap);

  if (capped.length > 0) {
    out.push({
      lead: money(capped.reduce((a, x) => a + x.cap, 0)),
      rest: `of advertised welcome bonuses across ${casinos.length} tracked crypto casinos.`,
    });
    const top = capped[0];
    out.push({
      lead: OFFERS[top.c.slug]?.headline ?? money(top.cap),
      rest: `is the largest single offer, at ${top.c.name}.`,
    });
  }

  const instant = casinos.filter((c) => c.claimed.instantWithdrawal).length;
  if (instant > 0) {
    out.push({
      lead: `${spellOut(instant, true)} crypto casinos`,
      rest: "advertise instant withdrawals.",
    });
  }

  const played = casinos
    .filter((c) => (c.verified.wagering ?? 0) > 0)
    .map((c) => c.verified.wagering as number)
    .sort((a, b) => a - b);
  if (played.length > 1) {
    out.push({
      lead: `${played[0]}× to ${played[played.length - 1]}×`,
      rest: "playthroughs, priced for every offer in the comparison below.",
    });
  }

  const tally = new Map<string, number>();
  for (const c of casinos) {
    for (const coin of c.verified.chains ?? []) {
      tally.set(coin, (tally.get(coin) ?? 0) + 1);
    }
  }
  const PREFERRED = ["BTC", "ETH", "USDT", "USDC", "SOL", "LTC"];
  const rank = (coin: string) => {
    const i = PREFERRED.indexOf(coin);
    return i === -1 ? PREFERRED.length : i;
  };
  const common = [...tally.entries()]
    .sort(
      (a, b) => b[1] - a[1] || rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]),
    )
    .slice(0, 4)
    .map(([coin]) => coin);
  if (common.length === 4) {
    out.push({
      lead: "Get started",
      rest: `with ${common.slice(0, 3).join(", ")}, ${common[3]} and more.`,
    });
  }

  return out;
}

const SEO_MIN_TOTAL_USD = 160_000;
const SEO_MIN_SITES = 15;

export function bonusHeadline(casinos: Casino[]): {
  compact: string;
  full: string;
  sites: string;
} {
  const total = bonusTotalUsd(casinos);
  const usd = total >= SEO_MIN_TOTAL_USD
    ? SEO_MIN_TOTAL_USD
    : Math.floor(total / 10_000) * 10_000;
  return {
    compact: `$${usd / 1000}K+`,
    full: `$${usd.toLocaleString("en-US")}+`,
    sites:
      casinos.length >= SEO_MIN_SITES
        ? `${SEO_MIN_SITES}+`
        : String(casinos.length),
  };
}

export function bonusTotalUsd(casinos: Casino[]): number {
  return casinos
    .filter((c) => offerKinds(c).includes("welcome"))
    .reduce((a, c) => a + (capOf(c) ?? 0), 0);
}

export const WAGERING_INTRO = [
  "When you’re comparing welcome bonuses, it helps to look at the wagering requirement alongside the amount on offer. A $100 bonus with a 40x requirement on bonus funds means placing $4,000 in qualifying bets before you can withdraw the bonus and eligible winnings.",
  "The table below puts every listed bonus alongside its wagering requirement at the full advertised cap, so the offers can be compared on the same basis. Your own requirement will depend on the bonus you receive and the terms attached to it.",
];

export const WAGERING_AFTER = [
  "The wagering total adds up your qualifying bets throughout play. The same funds can contribute to several bets, while wins and losses change your available balance along the way. Each offer also has its own rules about which games count and how long you have to complete the requirement.",
  "The calculator above prices one offer against a deposit you choose. The table here does the same arithmetic across every offer at once, at the full advertised cap, so the requirements can be compared side by side.",
];

export const CALC_INTRO =
  "Enter what you plan to deposit, pick a casino, and see the bonus that deposit earns at the advertised match. The result also carries the playthrough attached to it: the qualifying bets the terms ask for, and what that volume is likely to cost. It opens on the offer asking the least playthrough per unit of bonus.";

export const BONUS_STAGES: Record<string, string> = {
  "wild-io": "first deposit stage of a three-deposit package",
  "bc-game": "advertised total across four match bonuses",
};

export type OfferKind = "welcome" | "cashback" | "rakeback";

export const OFFER_FILTERS: { key: OfferKind | "all"; label: string }[] = [
  { key: "all", label: "All offers" },
  { key: "welcome", label: "Welcome bonuses" },
  { key: "cashback", label: "Cashback" },
  { key: "rakeback", label: "Rakeback" },
];

export interface OfferCopy {
  kinds: OfferKind[];
  type: string;
  headline: string;
  support: string | null;
}

export const OFFERS: Record<string, OfferCopy> = {
  "lucky-rollers": {
    kinds: ["welcome", "cashback"],
    type: "Welcome bonus",
    headline: "Up to 30,000 USDT",
    support: "100% match, 100 free spins and one free bet",
  },
  "betpanda-io": {
    kinds: ["welcome", "cashback"],
    type: "Welcome bonus",
    headline: "Up to 1 BTC",
    support: "100% match, with 10% weekly cashback",
  },
  "coin-casino": {
    kinds: ["welcome"],
    type: "Welcome bonus",
    headline: "Up to $30,000",
    support: "200% match on the qualifying deposit",
  },
  "hyper-lucky": {
    kinds: ["cashback"],
    type: "Cashback",
    headline: "20% daily cashback",
    support: "Advertised up to $10,000, with 100 free spins",
  },
  casinopunkz: {
    kinds: ["welcome", "cashback"],
    type: "Welcome bonus",
    headline: "Up to 20,000 USDT",
    support: "Advertised alongside 15% cashback",
  },
  thrill: {
    kinds: ["rakeback", "cashback"],
    type: "Rakeback",
    headline: "Up to 70% rakeback",
    support:
      "Advertised alongside 10% cashback. Calculated from eligible wagers and each game’s house edge",
  },
  "bc-game": {
    kinds: ["welcome"],
    type: "Welcome package",
    headline: "Up to $4,000",
    support: "Four match bonuses across four deposits, with 400 free spins",
  },
  "wild-io": {
    kinds: ["welcome", "cashback"],
    type: "Welcome package",
    headline: "Up to $5,000",
    support:
      "350% across three deposits, capped at $1,000, $1,000 and $3,000, with 200 free spins",
  },
  cybet: {
    kinds: ["welcome"],
    type: "Welcome bonus",
    headline: "Up to $1,000",
    support: "100% match and 50 free spins",
  },
  "betplay-io": {
    kinds: ["welcome", "cashback", "rakeback"],
    type: "Welcome bonus",
    headline: "Up to 5,000 USDT",
    support: "100% match",
  },
  "lucky-block": {
    kinds: ["welcome"],
    type: "Welcome bonus",
    headline: "Up to $25,000",
    support: "200% match and 50 free spins",
  },
  betninja: {
    kinds: ["welcome"],
    type: "Welcome bonus",
    headline: "Up to $2,500",
    support: "100% match and 100 free spins",
  },
  betfury: {
    kinds: ["welcome"],
    type: "Welcome package",
    headline: "Up to $10,500",
    support: "590% advertised across three welcome bonuses, with 225 free spins",
  },
  "7bit-casino": {
    kinds: ["welcome", "cashback"],
    type: "Welcome bonus",
    headline: "Up to $5,400",
    support: "325% advertised match and 250 free spins",
  },
  "golden-panda": {
    kinds: ["welcome", "cashback"],
    type: "Welcome package",
    headline: "Up to $5,000",
    support: "200% match and 50 free spins, alongside 10% weekly cashback",
  },
  "crypto-games": {
    kinds: ["welcome"],
    type: "Welcome bonus",
    headline: "Up to $20,000",
    support: "200% advertised match",
  },
  coinpoker: {
    kinds: ["welcome"],
    type: "Welcome bonus",
    headline: "Up to $2,000",
    support: "150% advertised match",
  },
  casinok: {
    kinds: ["welcome", "cashback"],
    type: "Welcome bonus",
    headline: "Up to $6,000",
    support: "300% match and 777 free spins, alongside 10% cashback",
  },
  "block-spins": {
    kinds: ["welcome", "cashback"],
    type: "Welcome bonus",
    headline: "Up to $1,000",
    support: "100% match, advertised with up to 15% cashback",
  },
  rakebit: {
    kinds: ["rakeback", "cashback"],
    type: "Rakeback",
    headline: "Up to $1,000 rakeback",
    support: "100% rakeback, advertised with cashback up to 25%",
  },
  "wsm-casino": {
    kinds: ["welcome", "cashback"],
    type: "Welcome bonus",
    headline: "Up to $25,000",
    support: "200% match and 50 free spins",
  },
};

export function keyDetails(c: Casino): string[] {
  const out: string[] = [];
  const w = c.verified.withdrawalNote ?? c.verified.withdrawal;
  if (w) out.push(`Published withdrawal time: ${w}`);
  const wr = c.verified.wagering;
  if (wr === 0) {
    out.push(
      offerKinds(c).includes("cashback") && !offerKinds(c).includes("welcome")
        ? "No wagering on the cashback, as advertised"
        : "No wagering requirement",
    );
  } else if (wr != null) {
    out.push(`${wr}× wagering`);
  }
  if (c.verified.wageringDays != null) {
    out.push(`${c.verified.wageringDays} days to complete the wagering`);
  }
  if (c.bonusMinDeposit) {
    out.push(`${c.bonusMinDeposit} minimum bonus deposit`);
  } else if (c.minDeposit) {
    out.push(`${c.minDeposit} minimum crypto deposit`);
  }
  const coins = c.verified.payoutCoins;
  if (coins?.length) {
    out.push(
      coins.length <= 6
        ? `Crypto payouts: ${andList(coins)}`
        : `Payouts in ${coins.length} coins`,
    );
  }
  if (c.verified.gameTypes?.length) {
    out.push(c.verified.gameTypes.slice(0, 3).join(" · "));
  }
  return out.slice(0, 4);
}

function andList(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function offerKinds(c: Casino): OfferKind[] {
  const known = OFFERS[c.slug];
  if (known) return known.kinds;
  const kinds: OfferKind[] = [];
  if (capOf(c) != null) kinds.push("welcome");
  if (c.claimed.cashback) kinds.push("cashback");
  if (c.claimed.rakeback) kinds.push("rakeback");
  return kinds;
}

export interface TurnoverRow {
  slug: string;
  name: string;
  cap: number;
  basisUsd: number;
  wagering: number;
  turnover: number;
  minDeposit: string | null;
  note: string | null;
  cashback: boolean;
  unit: "USD" | "USDT";
  basis: "bonus" | "deposit-and-bonus" | "bonus-unconfirmed";
  stageOne: number | null;
}

function cashbackHeadline(c: Casino): boolean {
  const claim = c.bonusClaim;
  if (!claim || c.verified.capUsd != null) return false;
  const cap = parseBonus(claim).cap;
  if (cap == null) return false;
  const forms = [cap.toLocaleString("en-US"), String(cap), `${cap / 1000}k`];
  const seg = claim.split("+").find((s) => forms.some((f) => s.includes(f)));
  return seg != null && /\b(cash\s?back|rake\s?back)\b/i.test(seg);
}

export const BASIS_LABEL: Record<TurnoverRow["basis"], string> = {
  bonus: "on bonus funds, per the terms",
  "deposit-and-bonus": "on deposit plus bonus, per the terms",
  "bonus-unconfirmed": "on bonus funds; the terms do not state the basis",
};

export const amount = (n: number, unit: TurnoverRow["unit"]) => {
  const digits = n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return unit === "USDT" ? `${digits} USDT` : `$${digits}`;
};

function capUnit(c: Casino): TurnoverRow["unit"] {
  if (c.verified.capUsd != null) return "USD";
  return /USDT/i.test(c.bonusClaim ?? "") ? "USDT" : "USD";
}

export function turnoverRows(casinos: Casino[]): TurnoverRow[] {
  return casinos
    .map((c) => {
      const cap = capOf(c);
      const t = turnoverUsd(c);
      const wr = c.verified.wagering;
      if (cap == null || t == null || wr == null) return null;
      return {
        slug: c.slug,
        name: c.name,
        cap,
        basisUsd: c.verified.wageringBasisUsd ?? cap,
        wagering: wr,
        turnover: t,
        minDeposit: c.minDeposit ?? null,
        note: c.termsNote ?? null,
        cashback: cashbackHeadline(c),
        unit: capUnit(c),
        basis: c.verified.wageringBasis ?? "bonus-unconfirmed",
        stageOne: c.verified.stageOneUsd ?? null,
      };
    })
    .filter((r): r is TurnoverRow => r != null)
    .sort((a, b) => a.turnover - b.turnover);
}

export interface CalcOfferSeed {
  slug: string;
  name: string;
  rank: number;
  matchPct: number;
  capUsd: number;
  packageUsd: number | null;
  unit: "USD" | "USDT";
  wagering: number | null;
  wagersDeposit: boolean;
  minDeposit: string | null;
  url: string;
  attributed: boolean;
}

export const CALC_DEFAULT_DEPOSIT = 100;

export function bestTermsSlug(
  offers: CalcOfferSeed[],
  deposit: number,
): string | null {
  let best: { slug: string; cost: number; rank: number } | null = null;
  for (const o of offers) {
    if (o.wagering == null || o.wagering <= 0) continue;
    const bonus = Math.min((deposit * o.matchPct) / 100, o.capUsd);
    if (bonus <= 0) continue;
    const base = o.wagersDeposit ? deposit + bonus : bonus;
    const cost = (o.wagering * base) / bonus;
    if (!best || cost < best.cost || (cost === best.cost && o.rank < best.rank)) {
      best = { slug: o.slug, cost, rank: o.rank };
    }
  }
  return best?.slug ?? null;
}

export function calcOffers(casinos: Casino[]): CalcOfferSeed[] {
  const out: CalcOfferSeed[] = [];
  casinos.forEach((c, i) => {
    if (!c.url) return;
    if (!offerKinds(c).includes("welcome")) return;
    const parsed = parseBonus(c.bonusClaim);
    const pct = parsed.pct;
    const cap = capOf(c);
    if (pct == null || pct <= 0 || cap == null) return;
    if (!parsed.paired && c.verified.capUsd == null) return;
    const stage = c.verified.stageOneUsd ?? null;
    out.push({
      slug: c.slug,
      name: c.name,
      rank: i + 1,
      matchPct: pct,
      capUsd: stage ?? cap,
      packageUsd: stage != null ? cap : null,
      unit:
        c.verified.capUsd == null && /USDT/i.test(c.bonusClaim ?? "")
          ? "USDT"
          : "USD",
      wagering: c.verified.wagering,
      wagersDeposit: c.verified.wageringBasis === "deposit-and-bonus",
      minDeposit: c.minDeposit ?? null,
      url: c.url,
      attributed: c.dealStatus === "live",
    });
  });
  return out;
}

export const PAYMENTS_INTRO = [
  "Start with the currencies you already hold and the payment options available in the casino’s cashier. A useful comparison includes the supported network, the minimum deposit, withdrawal limits and the fees quoted for your transfer.",
  "USDC and USDT are designed to track the US dollar, which can make balances easier to compare in dollar terms, although their market prices can move away from that target. With assets such as BTC and ETH, the dollar value of your balance also changes with the market.",
];

export const PAYMENT_CHECKS: { option: string; check: string }[] = [
  {
    option: "USDC or USDT",
    check:
      "Confirm the exact network supported for both deposits and withdrawals. Compare the quoted fees and minimum amounts for that network.",
  },
  {
    option: "Bitcoin (BTC)",
    check:
      "Check the wallet’s transaction fee and the casino’s required confirmations before the deposit becomes available.",
  },
  {
    option: "Ethereum (ETH)",
    check:
      "Confirm whether the cashier supports Ethereum mainnet or another specified network. Check the fee for the route you intend to use.",
  },
  {
    option: "XRP",
    check:
      "Check whether the deposit instructions include a destination tag, which helps the operator assign the payment to your account.",
  },
  {
    option: "Other supported coins",
    check:
      "For options such as SOL, LTC, BCH, DOGE or TRX, check the cashier’s deposit and withdrawal conditions individually.",
  },
];

export const WITHDRAWAL_TIMES = [
  "A withdrawal involves the casino processing your request and the payment settling on the chosen network. When an operator advertises “instant withdrawals”, check whether that describes approval, sending the transaction or arrival in your wallet.",
  "Before sending funds, match the coin and network shown in the cashier with those selected in your wallet. Include any required tag or memo, and check the minimum amount and quoted fee.",
];

export const NETWORK_CHOICE = [
  "When a coin is available on several networks, the network you select is part of the payment instructions. Start in the casino’s cashier, choose your asset and network, then use the same combination in your sending wallet. For example, a USDC deposit configured for Base should be sent as USDC on Base.",
  "Copy the deposit address from the cashier and include any required destination tag or memo. Check the minimum deposit and quoted fee before confirming the transfer.",
  "If you have already sent funds using a different network, contact the operator through its official support channel with the transaction hash, asset and network used. Recovery depends on the receiving platform and the transfer involved, and may be unavailable.",
];

export const PAYMENT_SOURCES: { label: string; url: string }[] = [
  { label: "Ethereum fees", url: "https://ethereum.org/developers/docs/gas/" },
  {
    label: "USDC networks",
    url: "https://developers.circle.com/stablecoins/usdc-contract-addresses",
  },
  {
    label: "XRP destination tags",
    url: "https://xrpl.org/docs/concepts/transactions/source-and-destination-tags",
  },
  {
    label: "recovering an unsupported transfer",
    url: "https://help.coinbase.com/en/coinbase/trading-and-funding/sending-or-receiving-cryptocurrency/recover-unsupported-crypto",
  },
];

export const REGISTER_SOURCE = {
  label: "Register of gambling businesses",
  url: "https://www.gamblingcommission.gov.uk/public-register/businesses",
};

export const RG_SOURCES: { label: string; url: string }[] = [
  {
    label: "GambleAware advice",
    url: "https://www.gambleaware.org/advice/for-your-gambling/advice-to-consider-if-you-re-gambling/",
  },
  {
    label: "GamCare on self-exclusion",
    url: "https://www.gamcare.org.uk/self-help/self-exclusion/",
  },
];

export const BONUS_TERMS: { name: string; body: string }[] = [
  {
    name: "Wagering requirement",
    body: "Also called playthrough, this sets the qualifying betting volume required to clear the bonus. Check the multiplier and whether it applies to the bonus alone or to your deposit as well.",
  },
  {
    name: "Qualifying deposit",
    body: "Check the amount needed to activate the offer and how the bonus scales with your deposit. A package spread across several deposits may have a separate minimum, match percentage and cap for each stage.",
  },
  {
    name: "Eligible games and contribution",
    body: "The terms specify which games count towards wagering and how much each bet contributes. At a 20% contribution rate, a $10 bet adds $2 towards the requirement. Excluded games contribute nothing and may also be prohibited while the bonus is active.",
  },
  {
    name: "Maximum bet",
    body: "Some offers limit the stake per spin, hand or round while bonus funds are active. Check the limit for your currency and the consequences of exceeding it.",
  },
  {
    name: "Time limit",
    body: "Look for both the activation deadline and the time allowed to complete wagering. Free spins and their winnings may have separate expiry rules.",
  },
  {
    name: "Withdrawal conditions",
    body: "Check whether the bonus itself becomes withdrawable, whether bonus-related winnings have a cashout cap and what happens if you request a withdrawal before completing the requirement.",
  },
];

export const BONUS_TERMS_INTRO =
  "A welcome offer becomes easier to compare once you know how the bonus is credited, which bets count and what you can withdraw afterwards. These are the terms that have the biggest effect on how an offer works.";

export const BONUS_TERMS_CLOSE =
  "Consider these terms together when comparing offers. The bonus that fits your intended deposit, preferred games and planned playing time deserves a closer look than the headline amount alone can provide.";

export const GAMES_INTRO =
  "Crypto casino lobbies bring together familiar games such as slots, blackjack and roulette with formats such as Crash, Mines and Plinko. The mix varies by operator, so the games available can be as useful a comparison point as the welcome offer.";

export const GAME_TYPES: { type: string; body: string }[] = [
  { type: "Slots", body: "Reel-based games with features such as free spins, multipliers and bonus rounds." },
  { type: "Live casino", body: "Games hosted by live dealers, including versions of blackjack, roulette and baccarat." },
  { type: "Table games", body: "Software-based versions of casino classics, with rules and betting limits that vary by title." },
  { type: "Crash games", body: "Multiplier games in which a payout depends on cashing out before the round ends." },
  { type: "Mines, Plinko and Dice", body: "Formats built around grid selections, falling-ball outcomes or numerical results. Operators may group these under “Originals” or “Instant games.”" },
  { type: "Jackpot games", body: "Titles with an additional jackpot prize, which may be fixed or progressive." },
];

export const GAMES_CLOSE =
  "A game appearing in the lobby tells you it is available to play. Its eligibility for a particular bonus is a separate condition: some games count fully toward wagering, some contribute less, and others are excluded.";

export const GAME_SOURCES: { label: string; url: string }[] = [
  { label: "Pragmatic Play’s game categories", url: "https://www.pragmaticplay.com/en/games/" },
  { label: "Stake’s game documentation", url: "https://stake.com/provably-fair/game-events" },
];

export const BONUS_EXAMPLES_INTRO =
  "A deposit match, free spins and cashback reward different kinds of qualifying activity. These examples show how the arithmetic works; the amounts are illustrations, not offers from a particular casino.";

export const BONUS_EXAMPLES: { type: string; example: string }[] = [
  { type: "Deposit match", example: "A 100% match on a qualifying $100 deposit adds $100 in bonus funds." },
  { type: "Free spins", example: "Twenty free spins at $0.10 per spin provide $2 in spin stakes. Any winnings depend on the results and the promotion’s terms." },
  { type: "Cashback", example: "An offer paying 10% of eligible net losses would award $20 on $200 of qualifying losses." },
  { type: "Rakeback", example: "An offer returning 20% of eligible rake would award $2 on a $10 rake amount." },
  { type: "Reload bonus", example: "A 50% match on a qualifying $100 deposit from an existing player adds $50 in bonus funds." },
];

export const BONUS_EXAMPLES_CLOSE =
  "The reward’s calculation and its withdrawal conditions are separate parts of the offer. Cashback may carry wagering requirements, and rakeback can use an operator-defined calculation base. The offer details explain which rules apply.";

export const AVAILABILITY = [
  "The rules for online casino gambling depend on your location, the operator and the services it offers. Before registering, check the applicable minimum age and whether the casino is authorized to serve players where you will be playing.",
  "You should also check the operator’s country restrictions and the eligibility rules for the specific promotion. Account access and welcome-bonus eligibility may have different conditions.",
  "A licence applies within a particular regulatory framework. Using cryptocurrency as a payment method leaves the underlying gambling rules in place, so confirm local requirements through your gambling regulator or another official government source.",
];

export const CHOOSING_INTRO =
  "A useful casino review should help you understand who operates the site, how its offers work and what happens when you request a withdrawal. These four areas give you a practical starting point.";

export const CHOOSING: { name: string; body: string }[] = [
  {
    name: "Operator and licence details",
    body: "Look for the company name, licensing authority and licence reference. Where a public register is available, check that the record is current and corresponds to the business and domain you are considering.",
  },
  {
    name: "Clear payment and bonus terms",
    body: "Find the deposit minimums, withdrawal limits, verification requirements and bonus conditions. If an important term is unclear, ask support for a written explanation before funding the account.",
  },
  {
    name: "Information about the games",
    body: "Look for named game providers, published rules and information about how results are generated or tested. For games offering provably fair verification, check which titles are covered and how to use the verification tool.",
  },
  {
    name: "How complaints are handled",
    body: "Read recent, detailed reports about the exact casino and domain. Look at the operator’s response and whether the issue was resolved, as well as the original allegation. The published complaints procedure should explain how to raise a dispute and any available escalation route.",
  },
];

export const CHOOSING_CLOSE =
  "Where an important detail remains unresolved, keep it open in your assessment while you compare other options.";

export const RG_INTRO = [
  "Decide how much money and time you are comfortable spending before starting a session. Keep that budget separate from essential expenses, and take a break when you reach your limit. Trying to recover losses through further play can increase what you lose.",
  "Check the account’s responsible gambling settings for the tools available:",
];

export const RG_TOOLS: { name: string; body: string }[] = [
  { name: "Deposit and loss limits", body: "help cap how much you can add or lose over a defined period." },
  { name: "Wagering limits", body: "cap the total amount you stake during that period." },
  { name: "Session reminders", body: "help you keep track of time and, where provided, spending." },
  { name: "Time-outs", body: "let you pause access for a chosen period." },
  { name: "Self-exclusion", body: "provides a longer restriction on gambling access. Check which websites or operators it covers and the conditions that apply." },
];

export const RG_SUPPORT =
  "If gambling is becoming difficult to manage, support services can help you explore a break, blocking tools, self-exclusion or treatment. You can also contact them if you are concerned about someone else.";

export const RG_CHECKED = "September 7, 2026";

export const FAQS: { q: string; a: string }[] = [
  { q: "What is a crypto casino?", a: "A crypto casino is an online casino that accepts cryptocurrency for deposits and withdrawals. You fund your account using a supported coin and network, then play the games available through the site. The cashier lists payment options, minimum amounts and withdrawal conditions, including any verification requirements. Once a withdrawal is processed, the funds are sent to an eligible wallet address." },
  { q: "How does provably fair work?", a: "Provably fair games let you check how a recorded result was generated. In a common setup, the casino publishes a cryptographic commitment to its secret input before play. That input is combined with a player-controlled input and a bet number to calculate the outcome. Once the secret input is revealed, often after you rotate your seed settings, a verification tool lets you reproduce the calculation and compare it with the recorded result. When comparing casinos, look for an explanation of which games support verification and where to find the tool. The feature helps you inspect game results; the game’s house edge, the operator’s licence and its withdrawal practices are separate parts of your assessment." },
  { q: "Are crypto casinos legal?", a: "Crypto casino legality depends on where you live, not on the payment method. Online gambling is licensed in some jurisdictions, restricted to state operators in others, and prohibited in several. Most crypto casinos hold an offshore licence and block a list of countries at sign-up. Check the law where you live before you play, and check that list before you register." },
  { q: "Why does a bonus with a high wagering requirement cost money?", a: "A playthrough requirement obliges a multiple of the bonus to be wagered before any of it can be withdrawn, and every one of those wagers meets the game's house edge, so the turnover has an expected cost. A 200% bonus at 60x playthrough can be worth less than a 50% bonus at 20x once that cost is priced, which is what the calculator on this page works out." },
  { q: "Which crypto casinos do not require KYC?", a: "Some venues take no identity documents at sign-up and ask only above a withdrawal threshold; others ask for nothing at all. The policy is the operator's choice and it changes without notice, which is why each row here records the threshold and the date the terms were read. A venue advertising no KYC can still request documents on a large withdrawal." },
  { q: "What happens if I send crypto on the wrong network?", a: "The funds are usually gone. USDT exists as a separate token on Ethereum, Tron, BSC, Solana and Polygon, and sending the Ethereum version to a Tron address puts it somewhere neither you nor the casino can reach. Check the network on both sides before confirming, every time." },
  { q: "How is this page ranked?", a: "By advertised welcome-bonus size, dollar caps first, then offers capped in BTC or ETH ordered by their advertised match percentage, with percentage-only rewards last. That is a rule about the advertising and not about which casino is safer or cheaper to clear. What we have read off each operator\u2019s own terms is shown in its offer details, and it never moves a row." },
  { q: "Does Harvest get paid?", a: "Yes, potentially. Harvest may earn a commission when you register through a Play Now link. That payment does not change the sort order, which follows the rule printed above the comparison, and it does not change what we record from an operator\u2019s published terms. No casino has paid for its position here." },
  { q: "What is a good wagering requirement?", a: "The multiplier alone does not settle it. What matters alongside it is whether the playthrough applies to the bonus or to the deposit plus the bonus, which games count and at what rate, and how long you have. A 20x requirement on a base that includes your deposit, clearable only on slots, can oblige more turnover than a 40x on the bonus alone." },
];

export const DISCLOSURE = [
  "Harvest compares published casino offers and reviews the supporting terms where available. Source links and review dates appear in the offer details. Withdrawal times and feature descriptions reflect operators’ published information. This comparison covers offer research; we have not tested gameplay or withdrawals.",
  "The wagering totals and calculator estimates are our calculations, with their assumptions shown alongside the results. Offers can change, so refer to the source date when assessing how recently a detail was reviewed.",
  "Harvest may earn a commission when you register through a Play Now link. Our commercial relationship is disclosed above the comparison.",
];

export const PARTNER_LINE = "Are you operating a crypto casino? Get in touch:";

export const PARTNER_EMAIL = "marketing@harvest.finance";

export interface VenueReview {
  slug: string;
  title: string;
  image?: { src: string; alt: string; credit?: string };
  intro: string;
  features: { label: string; value: string }[];
  sections: { h: string; body: string[] }[];
  termsUrl: string;
  termsLabel?: string;
  scope: (readOn: string) => string;
}

export const LUCKY_ROLLERS_REVIEW: VenueReview = {
  slug: "lucky-rollers",
  title: "Lucky Rollers review: welcome bonus, cashback and crypto payouts",
  image: {
    src: "https://i.imgur.com/I3FQeji.png",
    alt: "Lucky Rollers",
  },
  intro:
    "Lucky Rollers combines a welcome package advertised at up to 30,000 USDT with weekly cashback and a choice of crypto payout currencies. The welcome bonus and cashback have different wagering conditions, so it helps to consider each reward separately.",
  features: [
    { label: "Welcome offer", value: "Up to 30,000 USDT, plus 100 free spins and a free bet" },
    { label: "Deposit match", value: "100%, as advertised" },
    { label: "Welcome-bonus wagering", value: "40×" },
    {
      label: "Weekly cashback",
      value: "Paid on Mondays, with no additional wagering on the credited cashback",
    },
    { label: "Minimum crypto deposit", value: "5 USDT" },
    {
      label: "Crypto payouts",
      value: "BTC, ETH, USDT, USDC, XRP and SOL among the listed currencies",
    },
    { label: "Withdrawal processing", value: "Advertised as instant" },
  ],
  sections: [
    {
      h: "How the welcome bonus works",
      body: [
        "A 100% match adds one unit of bonus funds for each qualifying unit deposited, up to the applicable cap. For example, a qualifying 100 USDT deposit at that rate would receive 100 USDT in bonus funds.",
        "The advertised 40× wagering requirement determines how much qualifying play is needed to clear the bonus. Applied to a 100 USDT bonus alone, that would mean 4,000 USDT in qualifying bets. If the requirement includes the deposit as well, the same example would involve 8,000 USDT. The wagering basis remains an outstanding detail in our review.",
        "The cashier’s 5 USDT minimum describes the amount needed to fund an account. Bonus eligibility can have a separate deposit threshold, so these amounts should be considered individually.",
      ],
    },
    {
      h: "What weekly cashback adds",
      body: [
        "Lucky Rollers’ published cashback information describes Monday payments with no additional wagering requirement on the credited reward. That gives the cashback a different structure from the welcome bonus, which carries the advertised 40× requirement.",
        "The amount received depends on the promotion’s calculation rules. Its percentage, qualifying activity and payout cap are the remaining details needed to put a value on this part of the offer.",
      ],
    },
    {
      h: "Crypto payouts and withdrawal processing",
      body: [
        "The listed payout currencies include Bitcoin, Ethereum, USDT, USDC, XRP and Solana. This gives players a choice between dollar-linked stablecoins and other crypto assets when withdrawing an eligible balance.",
        "Lucky Rollers advertises instant withdrawals. Our review records that published claim; we have not completed a withdrawal test. Approval requirements and settlement on the selected network can affect when funds reach your wallet.",
      ],
    },
    {
      h: "Harvest’s assessment",
      body: [
        "The welcome package offers several rewards, while the weekly cashback has a simpler published wagering condition. For comparing the welcome bonus, the most useful next detail is the exact basis of its 40× requirement.",
        "We could not establish the operating company or licence from the pages reviewed. We would want those details confirmed before recommending Lucky Rollers.",
      ],
    },
  ],
  termsUrl: "https://luckyrollers.io/terms-and-conditions",
  termsLabel: "Read the published terms",
  scope: (readOn) =>
    `Review scope: Published terms and promotion information dated ${readOn}. This review covers the advertised offer; hands-on gameplay and withdrawal testing are outside its scope.`,
};

export const VENUE_REVIEWS: VenueReview[] = [LUCKY_ROLLERS_REVIEW];
