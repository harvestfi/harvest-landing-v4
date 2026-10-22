#!/usr/bin/env node
// Gate: every agent Markdown page agrees with the HTML page it mirrors.
//
// Both are rendered from the same loaders, so a disagreement means one of them
// stopped using them. Checked after export, against what was actually built:
//
//   product pages  24h APY, 30d avg APY, TVL, Holders and Tracked for, against
//                  the labelled values in the page's sidebar
//   ranking pages  the strategies and their order, against the page's ranking
//                  table (the home page renders its first 50)
//
//   node scripts/check-markdown.mjs

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PUBLIC = join(ROOT, "public");
const vaults = JSON.parse(readFileSync(join(ROOT, "data", "vaults.json"), "utf-8"));
const slugs = new Set(vaults.map((v) => v.slug));

const findings = [];
const html = (name) => {
  const f = join(PUBLIC, `${name}.html`);
  return existsSync(f) ? readFileSync(f, "utf-8") : null;
};

// ------------------------------------------------------------- products

// "Avg APY" replaces "30d avg APY" on pages with under 30 days of history.
const SIDEBAR_LABELS = ["24h APY", "30d avg APY", "Avg APY", "TVL", "Holders", "Tracked for"];

const decode = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");

function sidebar(page) {
  const out = {};
  for (const m of page.matchAll(/class="uni-side-label"[^>]*>([^<]+)<\/div><div class="uni-side-(?:headline|value)">([^<]+)<\/div>/g)) {
    out[decode(m[1].trim())] = decode(m[2].trim());
  }
  return out;
}

function keyFigures(md) {
  const out = {};
  const section = md.split("## Key figures")[1]?.split("\n## ")[0] ?? "";
  for (const m of section.matchAll(/^\| ([^|]+) \| ([^|]+) \|$/gm)) out[m[1].trim()] = m[2].trim();
  return out;
}

const mdFiles = readdirSync(PUBLIC).filter((f) => f.endsWith(".md"));
let products = 0;
for (const f of mdFiles) {
  const slug = f.slice(0, -3);
  if (!slugs.has(slug)) continue;
  products++;
  const page = html(slug);
  if (!page) {
    findings.push(`${f}: no ${slug}.html to mirror`);
    continue;
  }
  const side = sidebar(page);
  const figs = keyFigures(readFileSync(join(PUBLIC, f), "utf-8"));
  for (const label of SIDEBAR_LABELS) {
    if (side[label] === undefined && figs[label] === undefined) continue;
    if (side[label] !== figs[label]) {
      findings.push(`${f}: ${label} is "${figs[label] ?? "absent"}", the page shows "${side[label] ?? "absent"}"`);
    }
  }
}

// -------------------------------------------------------------- rankings

// A page that renders a short table above its full index (/eth's top 10)
// repeats its first row where the full index starts; compare that index.
const pageRows = (page) => {
  const rows = [...page.matchAll(/class="hub-row" href="\/([a-z0-9-]+)"/g)].map((m) => m[1]);
  return rows.slice(Math.max(0, rows.lastIndexOf(rows[0])));
};
const mdRows = (md) =>
  [...md.matchAll(/^\| \d+ \|.*\| https:\/\/harvest\.finance\/([a-z0-9-]+) \|$/gm)].map((m) => m[1]);

const RANKINGS = [
  ["index", "index"],
  ...["usdc", "usdt", "eth", "btc", "aave", "morpho", "ethereum", "base", "arbitrum", "polygon", "hyperevm", "zksync"].map((p) => [p, p]),
];
for (const [md, page] of RANKINGS) {
  const mdPath = join(PUBLIC, `${md}.md`);
  const p = html(page);
  if (!existsSync(mdPath) || !p) {
    findings.push(`${md}.md: missing ${!p ? `${page}.html` : "file"}`);
    continue;
  }
  const want = pageRows(p);
  let got = mdRows(readFileSync(mdPath, "utf-8"));
  // The home page paginates; compare what it renders.
  if (md === "index") got = got.slice(0, want.length);
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    const at = got.findIndex((s, i) => s !== want[i]);
    findings.push(
      `${md}.md: ranking differs from ${page}.html (${got.length} vs ${want.length} rows; first difference at row ${at + 1}: ${got[at] ?? "-"} vs ${want[at] ?? "-"})`,
    );
  }
}

if (findings.length) {
  for (const f of findings) console.error(`    [X] ${f}`);
  console.error(`[markdown] ${findings.length} disagreement(s) between .md and .html pages.`);
  process.exit(1);
}
console.log(`[OK] markdown check passed (${products} product pages, ${RANKINGS.length} rankings matched against their HTML)`);
