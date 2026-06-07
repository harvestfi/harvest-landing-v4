#!/usr/bin/env node
/**
 * Post-build banned-word check.
 *
 * Scope: single product pages only (public/<slug>.html where <slug>
 * matches a vault in data/vaults.json). These are the editorial
 * surface where the word blacklist applies. Home, hub, admin,
 * legal, and content pages (about, methodology) use different copy
 * registers; the spec does not extend the blacklist to them, and
 * the legal disclaimer in the footer (which renders site-wide)
 * legitimately contains words we ban in product-page prose.
 *
 * The footer block is stripped from the product page text before
 * matching so the universal legal disclaimer ("past performance
 * does not guarantee future returns", "investment, financial, legal
 * advice") doesn't trigger.
 *
 * Section-aware exemption: the `deposited` rule is allowed inside
 * `<section id="yield-trajectory">` (the curated "$1,000 deposited
 * N days ago" template) and banned everywhere else on the page.
 *
 * Usage:
 *   node scripts/check-banned-words.mjs
 *
 * Exits 0 if clean, non-zero on any violation. Wired into
 * `npm run build` so Vercel deploys fail on regressions.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const VAULTS_JSON = path.join(ROOT, "data", "vaults.json");

// Single source of truth. Each entry is a regex. The `scope` field
// controls section-aware exemptions; see the file header.
const BANNED = [
  { name: "returns / return / returning (yield-income noun)", regex: /\b(returns?|returning)\b/i, scope: "always" },
  { name: "invest / investment / investor", regex: /\b(invest|investing|invested|investment|investor|investors)\b/i, scope: "always" },
  { name: "deposit / deposits / depositing", regex: /\b(deposit|deposits|depositing)\b/i, scope: "always" },
  { name: "depositor / depositors", regex: /\b(depositor|depositors)\b/i, scope: "always" },
  { name: "deposited (yield-trajectory exemption)", regex: /\bdeposited\b/i, scope: "except-yield-trajectory" },
  { name: "redeposit / reinvest family", regex: /\b(redeposit|redepositing|redeposits|reinvest|reinvesting|reinvests)\b/i, scope: "always" },
  { name: "capital", regex: /\bcapital\b/i, scope: "always" },
  { name: "outperform family", regex: /\b(outperform|outperforms|outperformed|outperforming)\b/i, scope: "always" },
  { name: "competes against / goes up against", regex: /\b(competes against|goes up against)\b/i, scope: "always" },
  { name: "Harvest Finance (use plain 'Harvest' in prose)", regex: /\bHarvest Finance\b/, scope: "always" },
  { name: "recovered", regex: /\brecovered\b/i, scope: "always" },
  { name: "minimal / negligible / nominal returns placeholders", regex: /\b(minimal|negligible|nominal) returns\b/i, scope: "always" },
  { name: "trend framing", regex: /\b(upward trend|downward trend|trending up|trending down)\b/i, scope: "always" },
  { name: "soft-judgment phrasing", regex: /\b(well above|significantly below|far higher|notably ahead|solidly outperforming)\b/i, scope: "always" },
  { name: "second-person possession", regex: /\byour (funds|capital|deposit|investment|earnings|balance|returns)\b/i, scope: "always" },
  // Forward-looking / deterministic financial phrasing (YMYL). The copy
  // engine is observational by design ("would earn", "realised yield",
  // "not a forward guarantee"); these patterns make that permanent by
  // failing the build on any predictive or guaranteed-return claim. Kept
  // narrow on purpose: "risk-free" is NOT banned because the risk section
  // legitimately states "No DeFi yield strategy is risk-free."
  { name: "forward-looking: will/you'll earn", regex: /\b(?:will|you'll|you\s+will)\s+earn\b/i, scope: "always" },
  { name: "forward-looking: guaranteed return/yield", regex: /\bguarantee[ds]?\s+(?:returns?|yields?|profits?|apy|gains?)\b/i, scope: "always" },
  { name: "forward-looking: expected/projected return", regex: /\b(?:expected|projected|forecasted)\s+(?:returns?|yields?|apy|profits?|gains?)\b/i, scope: "always" },
  { name: "forward-looking: 'at this rate' projection", regex: /\bat this rate\b/i, scope: "always" },
  { name: "em dash", regex: /—/, scope: "always" },
];

// Phrases that contain banned tokens by accident (verb usage, fixed
// idioms). Stripped from the searchable text before the BANNED list
// runs. Keep this list short and conservative; each entry is a
// documented false positive, not a way to slip prose past the lint.
const PHRASE_ALLOWLIST = [
  /liquidity returns/gi, // verb usage in withdrawal-availability clause
];

async function loadProductSlugs() {
  const raw = await fs.readFile(VAULTS_JSON, "utf8");
  const vaults = JSON.parse(raw);
  return new Set(
    vaults
      .map((v) => v.slug)
      .filter((s) => typeof s === "string" && s.length > 0),
  );
}

// Strip <script> and <style> blocks, then the footer (universal
// legal disclaimer that doesn't follow product-page copy rules),
// then HTML tags, then decode entities, then collapse whitespace.
// The result is what a human would read on the page minus the
// global footer.
function stripFooter(html) {
  return html.replace(/<footer\b[\s\S]*?<\/footer>/gi, " ");
}

function stripHtml(html) {
  let text = html.replace(/<script\b[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function splitYieldTrajectory(html) {
  const re = /<section\b[^>]*\bid=["']yield-trajectory["'][^>]*>([\s\S]*?)<\/section>/i;
  const match = html.match(re);
  if (!match) {
    return { yieldText: "", restText: stripHtml(html) };
  }
  const yieldText = stripHtml(match[1]);
  const rest = html.slice(0, match.index) + html.slice(match.index + match[0].length);
  return { yieldText, restText: stripHtml(rest) };
}

function applyAllowlist(text) {
  let out = text;
  for (const phrase of PHRASE_ALLOWLIST) {
    out = out.replace(phrase, " ");
  }
  return out;
}

function contextSnippet(text, matchIndex, matchLen, padding = 60) {
  const start = Math.max(0, matchIndex - padding);
  const end = Math.min(text.length, matchIndex + matchLen + padding);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return prefix + text.slice(start, end).trim() + suffix;
}

function checkText(text, rule) {
  const violations = [];
  const cleaned = applyAllowlist(text);
  const flags = rule.regex.flags.includes("g")
    ? rule.regex.flags
    : rule.regex.flags + "g";
  const globalRe = new RegExp(rule.regex.source, flags);
  let m;
  while ((m = globalRe.exec(cleaned)) !== null) {
    violations.push({
      word: m[0],
      snippet: contextSnippet(cleaned, m.index, m[0].length),
    });
    if (globalRe.lastIndex === m.index) globalRe.lastIndex++;
  }
  return violations;
}

async function main() {
  const t0 = Date.now();
  const slugs = await loadProductSlugs();
  const fileReports = [];
  let totalViolations = 0;
  let filesScanned = 0;

  for (const slug of slugs) {
    const filename = `${slug}.html`;
    const full = path.join(PUBLIC_DIR, filename);
    let html;
    try {
      html = await fs.readFile(full, "utf8");
    } catch {
      // Vault listed in data but not rendered (e.g. filtered by
      // editorial rule). Not an error for the lint pass.
      continue;
    }
    filesScanned++;
    // Strip footer once at the HTML level so it never appears in
    // either yield-trajectory or rest.
    const product = stripFooter(html);
    const { yieldText, restText } = splitYieldTrajectory(product);

    const violations = [];
    for (const rule of BANNED) {
      if (rule.scope === "except-yield-trajectory") {
        const hits = checkText(restText, rule);
        for (const h of hits) {
          violations.push({ rule: rule.name, ...h, section: "outside yield-trajectory" });
        }
      } else {
        const hits = [
          ...checkText(yieldText, rule),
          ...checkText(restText, rule),
        ];
        for (const h of hits) {
          violations.push({ rule: rule.name, ...h, section: "any" });
        }
      }
    }

    if (violations.length > 0) {
      fileReports.push({ filename, violations });
      totalViolations += violations.length;
    }
  }

  if (totalViolations === 0) {
    const ms = Date.now() - t0;
    console.log(
      `[OK] banned-word check passed (${filesScanned} product pages scanned, 0 violations, ${ms}ms)`,
    );
    process.exit(0);
  }

  console.error(
    `\n[BANNED-WORD] ${totalViolations} violation(s) across ${fileReports.length} product page(s):\n`,
  );
  for (const report of fileReports) {
    console.error(`  ${report.filename}`);
    for (const v of report.violations) {
      console.error(`    rule: ${v.rule}`);
      console.error(`    match: "${v.word}"`);
      console.error(`    context: ${v.snippet}`);
      console.error(`    section: ${v.section}`);
      console.error("");
    }
  }
  console.error(
    `Fix: remove or rephrase the matched text. The 'deposited' rule has a narrow exemption inside the Yield trajectory section (source: src/lib/autopilot-sections.ts).`,
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("Banned-word check crashed:", err);
  process.exit(2);
});
