import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIELDS = [
  "licence",
  "kyc",
  "withdrawal",
  "withdrawalNote",
  "provablyFair",
  "wagering",
  "wageringDays",
  "chains",
  "payoutCoins",
  "gameTypes",
  "games",
  "complaints",
];

const NOT_A_SOURCE = [
  /(^|\.)google\./i,
  /(^|\.)bing\.com$/i,
  /(^|\.)duckduckgo\.com$/i,
  /(^|\.)pokerstrategy\.com$/i,
  /(^|\.)cryptopolitan\.com$/i,
  /(^|\.)mexc\.com$/i,
  /lucky-rollers\.nz$/i,
];

const data = JSON.parse(
  readFileSync(join(process.cwd(), "data", "crypto-casinos.json"), "utf-8"),
);
const casinos = Array.isArray(data.casinos) ? data.casinos : [];

const findings = [];
let sourced = 0;
let unconfirmed = 0;

for (const c of casinos) {
  const v = c.verified ?? {};
  const sources = c.sources ?? {};

  for (const f of FIELDS) {
    if (v[f] == null) {
      if (sources[f]) {
        findings.push(`${c.slug}: source for "${f}" but no value`);
      }
      continue;
    }
    const s = sources[f];
    if (!s) {
      findings.push(`${c.slug}: "${f}" has a value and no source`);
      continue;
    }
    if (s === "unconfirmed") {
      unconfirmed += 1;
      continue;
    }
    if (typeof s !== "object" || !s.url || !s.readOn) {
      findings.push(`${c.slug}: source for "${f}" needs both url and readOn`);
      continue;
    }
    let host;
    try {
      host = new URL(s.url).hostname;
    } catch {
      findings.push(`${c.slug}: source for "${f}" is not a URL: ${s.url}`);
      continue;
    }
    const bad = NOT_A_SOURCE.find((re) => re.test(host));
    if (bad) {
      findings.push(`${c.slug}: "${f}" cites ${host}, which is not evidence`);
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.readOn)) {
      findings.push(`${c.slug}: readOn for "${f}" is not a date: ${s.readOn}`);
      continue;
    }
    if (s.readOn > new Date().toISOString().slice(0, 10)) {
      findings.push(`${c.slug}: readOn for "${f}" is in the future`);
      continue;
    }
    sourced += 1;
  }
}

const total = casinos.length * FIELDS.length;
if (findings.length) {
  console.log("");
  for (const f of findings) console.log(`    [X] ${f}`);
  console.log(
    `\n[EVIDENCE] ${findings.length} finding(s). A verified value needs a source, or the literal "unconfirmed".`,
  );
  process.exit(1);
}

console.log(
  `[OK] evidence check passed (${sourced} sourced, ${unconfirmed} unconfirmed, of ${total} possible cells)`,
);
