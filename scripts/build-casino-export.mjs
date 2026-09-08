#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const IN_FILE = join(ROOT, "data", "crypto-casinos.json");
const LOGOS = join(ROOT, "src", "lib", "casino-logos.ts");
const OUT_DIR = join(ROOT, "public", "data", "crypto-casinos");

if (!existsSync(IN_FILE)) {
  console.log("[casino-export] no data/crypto-casinos.json yet; skipping export.");
  process.exit(0);
}

const doc = JSON.parse(readFileSync(IN_FILE, "utf-8"));

const logoSrc = existsSync(LOGOS) ? readFileSync(LOGOS, "utf-8") : "";
const block = logoSrc.slice(
  logoSrc.indexOf("export const CASINO_LOGOS"),
  logoSrc.indexOf("};", logoSrc.indexOf("export const CASINO_LOGOS")),
);
const slugs = new Set(
  [...block.matchAll(/^\s+"?([a-z0-9-]+)"?\s*[,:]/gm)].map((m) => m[1]),
);

const ranked = (doc.casinos ?? []).filter(
  (c) => c && c.url && slugs.has(c.slug),
);

const AMOUNT = "(?:\\$\\s*)?(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k|K)?\\s*(USDT|USD|EUR|BTC|ETH)?";
function headlineCap(claim) {
  if (!claim) return { pct: null, cap: null, unit: null };
  const paired = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*%[^%]{0,60}?up\\s*to\\s*${AMOUNT}`, "gi");
  let best = null;
  for (const m of claim.matchAll(paired)) {
    const n = Number(m[2].replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) continue;
    const u = (m[4] ?? "USD").toUpperCase();
    const unit = u === "USDT" || u === "USD" ? "USD" : u;
    const pct = Number(m[1]);
    if (!best || pct > best.pct) best = { pct, cap: n * (m[3] ? 1000 : 1), unit };
  }
  return best ?? { pct: null, cap: null, unit: null };
}

const source = (c, field) => {
  const s = (c.sources ?? {})[field];
  if (!s) return null;
  if (s === "unconfirmed") return { status: "unconfirmed" };
  return { status: "read", url: s.url, readOn: s.readOn };
};

const rows = ranked.map((c, i) => {
  const parsed = headlineCap(c.bonusClaim);
  const v = c.verified ?? {};
  return {
    rank: i + 1,
    slug: c.slug,
    name: c.name,
    url: c.url,
    commercial: c.dealStatus === "live",
    advertised: {
      headline: c.bonusClaim ?? null,
      matchPct: parsed.pct,
      capUsd: v.capUsd ?? (parsed.unit === "USD" || parsed.unit === "EUR" ? parsed.cap : null),
      capUnit: v.capUsd != null ? "USD" : parsed.unit,
      firstDepositCapUsd: v.stageOneUsd ?? null,
      claims: c.claims ?? [],
    },
    verified: {
      wagering: v.wagering ?? null,
      wageringBasis: v.wageringBasis ?? null,
      wageringDays: v.wageringDays ?? null,
      withdrawal: v.withdrawal ?? null,
      withdrawalNote: v.withdrawalNote ?? null,
      licence: v.licence ?? null,
      operator: c.operator ?? null,
      kyc: v.kyc ?? null,
      depositCoins: v.chains ?? null,
      payoutCoins: v.payoutCoins ?? null,
      gameTypes: v.gameTypes ?? null,
      minDeposit: c.minDeposit ?? null,
      bonusMinDeposit: c.bonusMinDeposit ?? null,
    },
    sources: Object.fromEntries(
      [
        "wagering",
        "wageringDays",
        "withdrawal",
        "withdrawalNote",
        "licence",
        "kyc",
        "chains",
        "payoutCoins",
        "gameTypes",
      ]
        .map((f) => [f, source(c, f)])
        .filter(([, s]) => s != null),
    ),
    termsNote: c.termsNote ?? null,
    lastChecked: c.lastChecked ?? null,
  };
});

mkdirSync(OUT_DIR, { recursive: true });

const generatedAt = new Date().toISOString();

writeFileSync(
  join(OUT_DIR, "index.json"),
  JSON.stringify(
    {
      license: "CC-BY-4.0",
      attribution: "Harvest (harvest.finance)",
      page: "https://harvest.finance/best-crypto-casino-bonus",
      generatedAt,
      scope:
        "Offers and terms as published by each operator, with the URL and date each figure was read. Figures marked unconfirmed came from a supplied list and have not been checked at the venue. No gameplay or withdrawal has been tested.",
      sortRule:
        "Advertised welcome-bonus size: dollar caps first, highest to lowest, then offers capped in BTC or ETH by advertised match percentage, then percentage-only rewards. Commercial arrangements do not affect the order.",
      numberOfItems: rows.length,
      rows,
    },
    null,
    2,
  ),
  "utf-8",
);

const CSV_COLS = [
  ["rank", (r) => r.rank],
  ["slug", (r) => r.slug],
  ["name", (r) => r.name],
  ["url", (r) => r.url],
  ["commercial", (r) => r.commercial],
  ["advertised_headline", (r) => r.advertised.headline],
  ["match_pct", (r) => r.advertised.matchPct],
  ["cap", (r) => r.advertised.capUsd],
  ["cap_unit", (r) => r.advertised.capUnit],
  ["first_deposit_cap_usd", (r) => r.advertised.firstDepositCapUsd],
  ["wagering", (r) => r.verified.wagering],
  ["wagering_basis", (r) => r.verified.wageringBasis],
  ["wagering_days", (r) => r.verified.wageringDays],
  ["withdrawal", (r) => r.verified.withdrawal],
  ["min_deposit", (r) => r.verified.minDeposit],
  ["bonus_min_deposit", (r) => r.verified.bonusMinDeposit],
  ["deposit_coins", (r) => (r.verified.depositCoins ?? []).join(" ")],
  ["payout_coins", (r) => (r.verified.payoutCoins ?? []).join(" ")],
  ["game_types", (r) => (r.verified.gameTypes ?? []).join(" ")],
  ["licence_authority", (r) => r.verified.licence?.authority ?? null],
  ["licence_number", (r) => r.verified.licence?.number ?? null],
  ["operator", (r) => r.verified.operator],
  ["last_checked", (r) => r.lastChecked],
];

const cell = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

writeFileSync(
  join(OUT_DIR, "offers.csv"),
  [
    CSV_COLS.map(([h]) => h).join(","),
    ...rows.map((r) => CSV_COLS.map(([, get]) => cell(get(r))).join(",")),
  ].join("\n") + "\n",
  "utf-8",
);

console.log(
  `[casino-export] wrote index.json + offers.csv (${rows.length} venues) to public/data/crypto-casinos/`,
);
