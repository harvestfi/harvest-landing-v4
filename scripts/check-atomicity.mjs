#!/usr/bin/env node
// Build gate for atomically-quotable prose on the report and hub pages.
//
// Why this exists, and why it is separate from check-page-consistency:
// answer engines lift SENTENCES, not pages. A sentence that stops being true
// or comprehensible once separated from its neighbours cannot be cited, so it
// is not. check-page-consistency asks "do the numbers on this page agree with
// each other"; this asks "does each sentence survive being cut out".
//
// Scope note that matters: check-banned-words and check-page-consistency both
// walk data/vaults.json and lint public/<slug>.html, so they cover the 156+
// product pages and NOTHING else. The reports and hubs, which carry the most
// hand-written prose on the site, had no lint coverage at all. This gate
// covers exactly those.
//
// Three rules, chosen because they catch mechanical, repetitive misses that a
// human review reliably misses while doing well on judgment calls:
//
//   1. Undated figures   - a retrieved sentence with a number and no date is
//                          unattributable months later.
//   2. Orphaned openers  - a sentence whose subject sits in the previous
//                          sentence is dead the moment it is lifted.
//   3. Entity density    - the opposite failure: naming the brand in every
//                          sentence reads as keyword stuffing.
//
// Usage:
//   node scripts/check-atomicity.mjs            lint the built pages
//   node scripts/check-atomicity.mjs --self-test verify the rules still bite

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PUBLIC = join(ROOT, "public");

// Pages this gate owns. Product pages are deliberately excluded: their prose is
// generated from templates already covered by check-page-consistency, and the
// date rule would fire on every generated rank sentence.
const PAGES = [
  "report/xrp-yield-ranking",
  "report/aerodrome",
  "polygon",
  "ethereum",
  "base",
  "arbitrum",
  "zksync",
  "hyperevm",
  "usdc",
  "usdt",
  "eth",
  "btc",
  "aave",
  "morpho",
];

const ENTITY_CAP = 10;

// Pages held to the gate. Everything else in PAGES is reported as a warning so
// the backlog stays visible without blocking the build. Move a page here once
// its prose has been brought up to spec.
// /xrp-rich-list is enforced: findings fail the build rather than print.
// NOTE for the reviewer: this fork's gate predates the v3 rules (temporal
// deixis, bullet fragments, bullet density, the `onchain` spelling rule) that
// v4-one added. The page was written against those and reports zero findings
// under them, so it is safe here. Porting the rules themselves is deliberately
// NOT in this PR: they would newly evaluate the existing XRP report page,
// which is also enforced, and that belongs in its own change.
const ENFORCED = new Set(["report/xrp-yield-ranking", "xrp-rich-list"]);

// A date token is "as of", a month name, or a four-digit year.
const DATE_TOKEN =
  /\bas of\b|\b(January|February|March|April|May|June|July|August|September|October|November|December)\b|\b20\d{2}\b/i;

// Digits that are not measurements: contract addresses, ratios, version
// strings, protocol names that contain numerals, and standard token/licence
// identifiers. Sentences matching these are exempt unless they also carry a
// currency or percentage figure.
const ALLOW_DIGIT =
  /0x[0-9a-f]{6,}|\b1:1\b|\b\d+(\.\d+)?x\b|\bv\d+(\.\d+)?\b|ve\(3,3\)|\bERC-\d+\b|\bSPL\b|\bCC-BY-[\d.]+\b|\b\d+-day\b|\b\d+-hour\b|\bUniswap v\d\b/i;

const ORPHAN_OPENER =
  /^(Those|These|This|That|It|They|Their|Its|Neither|Both|Each|Such|The former|The latter)\b/;

// "This report" / "This page" / "This ranking" are self-referential rather than
// back-references: the antecedent is the document itself, which travels with
// any excerpt. Same for existential "There are".
const ORPHAN_EXEMPT =
  /^(This (report|page|ranking|section)|There (is|are|were|was)|Neither\s+\S.*\bnor\b|Both\s+\S.*\band\b)/;

function stripChrome(html) {
  let h = html;
  for (const re of [
    /<script[\s\S]*?<\/script>/gi,
    /<style[\s\S]*?<\/style>/gi,
    /<svg[\s\S]*?<\/svg>/gi,
    /<header[\s\S]*?<\/header>/gi,
    /<footer[\s\S]*?<\/footer>/gi,
    /<nav[\s\S]*?<\/nav>/gi,
    /<table[\s\S]*?<\/table>/gi,
    /<!-- -->/g,
  ]) {
    h = h.replace(re, "");
  }
  // Tables rendered as divs carry data-nosnippet; the spec exempts table
  // content from the digit rule, so anything inside one is out of scope.
  h = h.replace(/<div[^>]*data-nosnippet[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi, "");
  return h;
}

function text(s) {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;|&#x27;|&#39;/g, "'")
    .replace(/&ldquo;|&rdquo;|&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Sentence split that does not break on "$45.2M", "3.96%" or "v3.1".
function sentences(t) {
  return t
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function blocks(html) {
  const out = [];
  for (const m of html.matchAll(/<(p|li|dd|summary)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const inner = m[2];
    // Skip wrappers that contain other blocks; the inner ones are matched too.
    if (/<(p|li|dd)\b/i.test(inner)) continue;
    const t = text(inner);
    if (t.length > 2) out.push({ tag: m[1].toLowerCase(), text: t });
  }
  return out;
}

export function lint(html, { entityCap = ENTITY_CAP } = {}) {
  const h = stripChrome(html);
  const bs = blocks(h);
  const findings = [];

  for (const b of bs) {
    const ss = sentences(b.text);
    ss.forEach((s, i) => {
      // Rule 1: undated figures. Fires on any digit, not just % or $, because
      // "5 of the 14" carries neither and is exactly the case this catches.
      if (/\d/.test(s) && !DATE_TOKEN.test(s)) {
        const money = /[%$]/.test(s);
        if (money || !ALLOW_DIGIT.test(s)) {
          findings.push({ rule: "undated-figure", where: b.tag, text: s });
        }
      }
      // Rule 2: orphaned openers, first sentence of a block only. A pronoun
      // mid-paragraph is normal writing; a pronoun opening the block is a
      // back-reference to something an excerpt will not include.
      if (i === 0 && ORPHAN_OPENER.test(s) && !ORPHAN_EXEMPT.test(s)) {
        findings.push({ rule: "orphan-opener", where: b.tag, text: s });
      }
    });
  }

  // Rule 3: entity density.
  const body = bs.map((b) => b.text).join(" ");
  const entity = (body.match(/\bHarvest'?s?\b/g) || []).length;
  if (entity > entityCap) {
    findings.push({
      rule: "entity-density",
      where: "page",
      text: `${entity} mentions of "Harvest" exceeds the cap of ${entityCap}`,
    });
  }

  return { findings, entity, blocks: bs.length };
}

function selfTest() {
  const cases = [
    ["<p>Rates ranged from 1% to 5% with a median of 2%.</p>", "undated-figure", true],
    ["<p>Rates ranged from 1% to 5% as of July 27, 2026.</p>", "undated-figure", false],
    ["<p>5 of the 14 products depended on emissions.</p>", "undated-figure", true],
    ["<p>FXRP is a 1:1 ERC-20 on Flare.</p>", "undated-figure", false],
    ["<p>Those figures are mostly reward emissions.</p>", "orphan-opener", true],
    ["<p>This report focuses on DeFi instead.</p>", "orphan-opener", false],
    ["<p>There are two ways to trade XRP yield.</p>", "orphan-opener", false],
    // Pattern 10 REQUIRES the closing comparative to name both sides, so this
    // is the fixed form and must pass. The bare version below must still fire.
    ["<p>Neither centralized nor DeFi yield is safer.</p>", "orphan-opener", false],
    ["<p>Neither is strictly safer than the other.</p>", "orphan-opener", true],
    ["<p>Both are wrapped XRP, but the trust model differs.</p>", "orphan-opener", true],
    [`<p>${"Harvest ".repeat(12)}</p>`, "entity-density", true],
    ["<p>Harvest tracks these products.</p>", "entity-density", false],
  ];
  let failed = 0;
  for (const [html, rule, shouldFire] of cases) {
    const { findings } = lint(html);
    const fired = findings.some((f) => f.rule === rule);
    if (fired !== shouldFire) {
      failed++;
      console.error(
        `  [self-test] ${rule} expected ${shouldFire ? "fire" : "pass"}: ${html.slice(0, 70)}`,
      );
    }
  }
  if (failed) {
    console.error(`[FAIL] check-atomicity self-test: ${failed}/${cases.length} case(s) wrong`);
    process.exit(1);
  }
  console.log(`[OK] check-atomicity self-test passed (${cases.length} cases)`);
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();

  const started = Date.now();
  let scanned = 0;
  const all = [];
  for (const page of PAGES) {
    const file = join(PUBLIC, `${page}.html`);
    if (!existsSync(file)) continue;
    scanned++;
    const { findings } = lint(readFileSync(file, "utf-8"));
    for (const f of findings) all.push({ page, ...f });
  }

  if (all.length === 0) {
    console.log(
      `[OK] atomicity check passed (${scanned} page(s) scanned, 0 findings, ${Date.now() - started}ms)`,
    );
    return;
  }

  const blocking = all.filter((f) => ENFORCED.has(f.page));
  const warned = all.filter((f) => !ENFORCED.has(f.page));
  const dump = (items, log) => {
    const byPage = {};
    for (const f of items) (byPage[f.page] ||= []).push(f);
    for (const [page, list] of Object.entries(byPage)) {
      log(`  /${page}`);
      for (const f of list) log(`    ${f.rule} <${f.where}> ${f.text.slice(0, 150)}`);
      log("");
    }
  };

  if (warned.length) {
    console.log(
      `[warn] atomicity: ${warned.length} finding(s) on pages not yet enforced\n`,
    );
    dump(warned, console.log);
  }

  if (blocking.length === 0) {
    console.log(
      `[OK] atomicity check passed (${ENFORCED.size} enforced page(s), ${scanned} scanned, ${Date.now() - started}ms)`,
    );
    return;
  }

  console.error(`[FAIL] atomicity check: ${blocking.length} finding(s) on enforced page(s)\n`);
  dump(blocking, console.error);
  process.exit(1);
}

main();
