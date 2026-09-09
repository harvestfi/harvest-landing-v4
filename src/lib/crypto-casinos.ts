export type KycPolicy = "none" | "withdrawal" | "always";
export type WithdrawalSpeed =
  | "instant"
  | "under 1 hour"
  | "1-24 hours"
  | "over 24 hours";

export interface CasinoClaims {
  noKyc: boolean;
  vpnFriendly: boolean;
  instantWithdrawal: boolean;
  provablyFair: boolean;
  noWagering: boolean;
  rakeback: boolean;
  cashback: boolean;
}

export interface FieldSource {
  url: string;
  readOn: string;
}

export const UNCONFIRMED = "unconfirmed" as const;

export type ComplaintRecord =
  | "none-found"
  | "clean"
  | "withdrawal-pattern";

export interface CasinoVerified {
  licence: { authority: string; number: string | null } | null;
  kyc: KycPolicy | null;
  withdrawal: WithdrawalSpeed | null;
  provablyFair: boolean | null;
  withdrawalNote?: string | null;
  wagering: number | null;
  wageringDays?: number | null;
  capUsd?: number | null;
  wageringBasisUsd?: number | null;
  stageOneUsd?: number | null;
  wageringBasis?: "bonus" | "deposit-and-bonus" | "bonus-unconfirmed" | null;
  complaints?: ComplaintRecord | null;
  chains: string[] | null;
  payoutCoins?: string[] | null;
  gameTypes?: string[] | null;
  games: number | null;
  restricted: string[] | null;
}

export interface Casino {
  slug: string;
  name: string;
  sources?: Partial<
    Record<keyof CasinoVerified, FieldSource | typeof UNCONFIRMED>
  >;
  url: string | null;
  dealStatus?: "live" | "in-progress" | "stuck" | "none" | null;
  dealNote?: string | null;
  order: number;
  bonusClaim: string | null;
  claims: string[];
  claimed: CasinoClaims;
  verified: CasinoVerified;
  operator?: string | null;
  minDeposit?: string | null;
  bonusMinDeposit?: string | null;
  termsNote?: string | null;
  lastChecked: string | null;
  notes?: string | null;
}

export interface CasinoData {
  generatedAt: string | null;
  casinos: Casino[];
}

const EVIDENCE_POINTS = {
  wagering: 20,
  licenceWithNumber: 15,
  withdrawal: 15,
  kyc: 10,
  chains: 10,
  provablyFair: 10,
  complaints: 10,
} as const;

const WITHDRAWAL_MOD: Record<WithdrawalSpeed, number> = {
  instant: 5,
  "under 1 hour": 0,
  "1-24 hours": 0,
  "over 24 hours": -5,
};

const COMPLAINT_MOD: Record<ComplaintRecord, number> = {
  clean: 0,
  "none-found": 0,
  "withdrawal-pattern": -20,
};

export const CHECK_FIELDS: (keyof CasinoVerified)[] = [
  "licence",
  "kyc",
  "withdrawal",
  "provablyFair",
  "wagering",
  "chains",
  "games",
  "complaints",
];

export const CHECK_TOTAL = CHECK_FIELDS.length;

export function checkedCount(c: Casino): number {
  return CHECK_FIELDS.filter((f) => c.verified[f] != null).length;
}

export const MIN_CHECKED_TO_SCORE = 3;

export function isVerified(c: Casino): boolean {
  return checkedCount(c) >= MIN_CHECKED_TO_SCORE;
}

export function casinoScore(c: Casino): number | null {
  if (!isVerified(c)) return null;
  const v = c.verified;
  let s = 0;

  if (v.wagering != null) s += EVIDENCE_POINTS.wagering;
  if (v.licence?.number) s += EVIDENCE_POINTS.licenceWithNumber;
  if (v.withdrawal) s += EVIDENCE_POINTS.withdrawal;
  if (v.kyc) s += EVIDENCE_POINTS.kyc;
  if (v.chains?.length) s += EVIDENCE_POINTS.chains;
  if (v.provablyFair != null) s += EVIDENCE_POINTS.provablyFair;
  if (v.complaints) s += EVIDENCE_POINTS.complaints;

  const wr = v.wagering;
  if (wr != null) {
    if (wr <= 20) s += 10;
    else if (wr <= 40) s += 5;
    else if (wr > 50) s -= 5;
  }
  if (v.withdrawal) s += WITHDRAWAL_MOD[v.withdrawal] ?? 0;
  if (v.complaints) s += COMPLAINT_MOD[v.complaints] ?? 0;

  return Math.min(100, Math.max(0, Math.round(s)));
}

export const EVIDENCE_MAX = 100;

export const COMPLAINT_LABEL: Record<ComplaintRecord, string> = {
  "none-found": "Searched, no file found",
  clean: "File read, nothing outstanding",
  "withdrawal-pattern": "Withdrawal complaints on record",
};

export const KYC_LABEL: Record<KycPolicy, string> = {
  none: "No KYC",
  withdrawal: "On withdrawal",
  always: "At sign-up",
};

export const CLAIM_LABELS: { key: keyof CasinoClaims; label: string }[] = [
  { key: "noKyc", label: "No KYC" },
  { key: "vpnFriendly", label: "VPN friendly" },
  { key: "instantWithdrawal", label: "Instant withdrawal" },
  { key: "noWagering", label: "No wagering" },
  { key: "provablyFair", label: "Provably fair" },
  { key: "rakeback", label: "Rakeback" },
  { key: "cashback", label: "Cashback" },
];

export interface ParsedBonus {
  pct: number | null;
  cap: number | null;
  unit: "USD" | "EUR" | "BTC" | "ETH" | null;
  paired: boolean;
}

const AMOUNT =
  "(?:\\$\\s*)?(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k|K)?\\s*(USDT|USD|EUR|BTC|ETH)?";

type Amount = { cap: number; unit: NonNullable<ParsedBonus["unit"]> };

function readAmount(num: string, k?: string, unit?: string): Amount | null {
  const n = Number(num.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const mult = k ? 1000 : 1;
  const u = (unit ?? "USD").toUpperCase();
  const norm =
    u === "USDT" || u === "USD" ? "USD" : u === "EUR" ? "EUR" : u === "BTC" ? "BTC" : u === "ETH" ? "ETH" : null;
  if (!norm) return null;
  return { cap: n * mult, unit: norm };
}

export function parseBonus(headline: string | null): ParsedBonus {
  const empty: ParsedBonus = { pct: null, cap: null, unit: null, paired: false };
  if (!headline) return empty;
  const t = headline.replace(/\u00a0/g, " ");

  const paired = new RegExp(
    `(\\d+(?:\\.\\d+)?)\\s*%[^%]{0,60}?up\\s*to\\s*${AMOUNT}`,
    "gi",
  );
  let best: (Amount & { pct: number }) | null = null;
  for (const m of t.matchAll(paired)) {
    const amt = readAmount(m[2], m[3], m[4]);
    if (!amt) continue;
    const pct = Number(m[1]);
    if (!best || pct > best.pct) best = { pct, cap: amt.cap, unit: amt.unit };
  }
  if (best) return { pct: best.pct, cap: best.cap, unit: best.unit, paired: true };

  const pctAll = [...t.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
  const pct = pctAll.length ? Math.max(...pctAll) : null;
  const stand = new RegExp(`(?:up\\s*to\\s*)?${AMOUNT}\\b`, "gi");
  let amt: Amount | null = null;
  for (const m of t.matchAll(stand)) {
    const looksLikeMoney =
      m[0].includes("$") || m[2] != null || m[3] != null || m[1].includes(",");
    if (!looksLikeMoney) continue;
    amt = readAmount(m[1], m[2], m[3]);
    if (amt) break;
  }
  return { pct, cap: amt?.cap ?? null, unit: amt?.unit ?? null, paired: false };
}

export function bonusUsd(p: ParsedBonus): number | null {
  if (p.cap == null) return null;
  if (p.unit === "USD" || p.unit === "EUR") return p.cap;
  return null;
}

export function turnoverUsd(c: Casino): number | null {
  const wr = c.verified.wagering;
  if (wr == null || wr < 0) return null;
  const base = c.verified.wageringBasisUsd ?? capOf(c);
  if (base == null) return null;
  return base * wr;
}

export function capOf(c: Casino): number | null {
  return c.verified.capUsd ?? bonusUsd(parseBonus(c.bonusClaim));
}

export function wageringMath(bonusUsd: number, wagering: number, houseEdgePct: number) {
  const turnover = bonusUsd * wagering;
  const expectedCost = turnover * (houseEdgePct / 100);
  return { turnover, expectedCost, net: bonusUsd - expectedCost };
}
