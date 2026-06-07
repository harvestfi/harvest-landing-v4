#!/usr/bin/env node
/**
 * Post-build data-consistency check for single product pages.
 *
 * Sibling to check-banned-words.mjs. Where that lints editorial word
 * choice, this asserts that the GENERATED numbers on a product page do
 * not contradict each other or the data they derive from. It is the
 * internal, deterministic replacement for the ad-hoc external "data
 * audit" passes: it scans every rendered public/<slug>.html, strips it
 * to readable text, extracts the numeric claims, and flags any sentence
 * whose own numbers are inconsistent (e.g. "100% drawdown ... bottoming
 * at $0" on a live vault, "up from $2.0M" when the value fell, a rank
 * above the cohort size) or that disagrees with the canonical values
 * shown elsewhere on the same page (current TVL, days-tracked, the
 * asset-cohort rank).
 *
 * Two severities:
 *   - contradiction: sign / ordering / equality failures that hold
 *     regardless of display rounding. These must always be zero.
 *   - review: ratio mismatches beyond a rounding tolerance; usually a
 *     real bug, occasionally display-rounding noise, so surfaced apart.
 *
 * Usage:
 *   node scripts/check-page-consistency.mjs            # human report
 *   node scripts/check-page-consistency.mjs --json     # machine output
 *   node scripts/check-page-consistency.mjs --strict   # fail on review too
 *
 * Exits 0 if no contradictions (and, with --strict, no review items),
 * non-zero otherwise. Intended to be wired into `npm run build` after
 * the pages are emitted, the same way banned-words is.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const VAULTS_JSON = path.join(ROOT, "data", "vaults.json");

const ARGV = new Set(process.argv.slice(2));
const JSON_OUT = ARGV.has("--json");
const STRICT = ARGV.has("--strict");

// ---------- HTML -> readable, matching-friendly text ----------------------

function stripFooter(html) {
  // The footer renders site-wide and carries aggregate figures
  // ("$8.7M tracked TVL", "112 active strategies") that would collide
  // with per-vault extraction. Drop it, like the banned-word check.
  return html.replace(/<footer\b[\s\S]*?<\/footer>/gi, " ");
}

function toText(html) {
  let t = stripFooter(html);
  t = t.replace(/<script\b[\s\S]*?<\/script>/gi, " ");
  t = t.replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = t
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
  t = t.replace(/\s+/g, " ").trim();
  // Tag-stripping inserts spaces where value <span>s were, so a figure
  // emitted as "~$<span>1,004</span>," reads "~$ 1,004 ,". Glue the
  // currency/percent/comma boundaries back so the numeric patterns
  // below match the way a human reads the sentence.
  t = t
    .replace(/\$\s+/g, "$")
    .replace(/\s+%/g, "%")
    .replace(/\s+,/g, ",")
    .replace(/#\s+/g, "#");
  return t;
}

// ---------- parsers -------------------------------------------------------

// A rendered money token: "$0", "$119", "$1,004", "$85K", "$1.9M",
// "$2.0B". Deliberately does NOT consume a trailing "." or "," so the
// value captured before sentence punctuation ("stands at $85K,") is the
// number alone, not "$85K," — otherwise string-equality agreement
// checks compare "$85K," against "$85K" and report a phantom mismatch.
const MONEY = "\\$\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?[KMB]?";

function parseMoney(s) {
  if (s == null) return NaN;
  const m = String(s).trim().match(/^\$?\s*([\d,]*\.?\d+)\s*([KMB])?$/i);
  if (!m) return NaN;
  let n = parseFloat(m[1].replace(/,/g, ""));
  const suf = (m[2] || "").toUpperCase();
  if (suf === "K") n *= 1e3;
  else if (suf === "M") n *= 1e6;
  else if (suf === "B") n *= 1e9;
  return n;
}

function parsePct(s) {
  if (s === "<1") return 0.5;
  const n = parseFloat(String(s).replace(/[%,]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

// Reconstruct the true-value interval a displayed token could stand for,
// given the rounding formatTVL applies ($X.XB/$X.XM to one decimal, $XK
// and sub-$1K to integer). The ratio checks use these so they flag a
// stated figure only when it is impossible for ANY true values behind the
// rounded numbers shown, never mere display rounding (e.g. "$11K"->"$5K"
// prints a 52% drawdown even though those two rounded tokens alone divide
// to 55%).
function moneyInterval(token) {
  const t = String(token).trim();
  const suffix = /([KMB])$/i.exec(t)?.[1]?.toUpperCase();
  const num = parseFloat(t.replace(/[$,]/g, "").replace(/[KMB]$/i, ""));
  if (!Number.isFinite(num)) return null;
  const half = suffix === "B" ? 0.05e9 : suffix === "M" ? 0.05e6 : suffix === "K" ? 0.5e3 : 0.5;
  const scale = suffix === "B" ? 1e9 : suffix === "M" ? 1e6 : suffix === "K" ? 1e3 : 1;
  return [Math.max(0, num * scale - half), num * scale + half];
}
// Interval a stated percentage covers, given it was rounded to `decimals`.
function pctInterval(value, decimals) {
  const half = 0.5 * Math.pow(10, -decimals);
  return [value - half, value + half];
}
function intersects(a, b) {
  return a[0] <= b[1] + 1e-9 && b[0] <= a[1] + 1e-9;
}

function snippet(text, idx, len, pad = 75) {
  const a = Math.max(0, idx - pad);
  const b = Math.min(text.length, idx + len + pad);
  return (
    (a > 0 ? "…" : "") +
    text.slice(a, b).trim() +
    (b < text.length ? "…" : "")
  );
}

// Match all occurrences of a (non-global) regex, returning match + index.
function* allMatches(text, re) {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m;
  while ((m = g.exec(text)) !== null) {
    yield m;
    if (g.lastIndex === m.index) g.lastIndex++;
  }
}

// ---------- the invariant catalog -----------------------------------------
// Every check takes the page text and a `report(sev, check, msg, idx, len)`
// sink. Checks are intentionally small and independent so the catalog can
// grow without entanglement.

function checkDrawdown(text, report) {
  // "TVL experienced a {D}% drawdown from its {peak} peak, bottoming at
  //  {trough} over {n} days. It currently stands at {cur}, {p}% of the
  //  peak value."
  const re = new RegExp(
    `(\\d+(?:\\.\\d+)?)% drawdown from its (${MONEY}) peak, bottoming at (${MONEY})(?: over \\d+ days?)?\\. It currently stands at (${MONEY}), (<1|\\d+)% of the peak value`,
  );
  for (const m of allMatches(text, re)) {
    const [, dStr, peakStr, troughStr, curStr, pStr] = m;
    const d = parsePct(dStr);
    const peak = parseMoney(peakStr);
    const trough = parseMoney(troughStr);
    const cur = parseMoney(curStr);
    const p = parsePct(pStr);
    const at = m.index;
    const len = m[0].length;
    // Zero-floor: a $0 trough on a vault that is currently non-empty is
    // an indexer dropout rendered as a real "total loss".
    if (trough === 0 && cur > 0) {
      report("contradiction", "drawdown.zero-trough",
        `"bottoming at ${troughStr}" but currently ${curStr} (> 0): a dropped reading is being shown as a 100% loss`,
        at, len);
    }
    if (Number.isFinite(trough) && Number.isFinite(cur) && trough > cur) {
      report("contradiction", "drawdown.trough-above-current",
        `trough ${troughStr} is above current ${curStr}`, at, len);
    }
    if (Number.isFinite(trough) && Number.isFinite(peak) && trough > peak) {
      report("contradiction", "drawdown.trough-above-peak",
        `trough ${troughStr} is above peak ${peakStr}`, at, len);
    }
    // Drawdown % must reconcile with peak/trough (rounding-aware).
    const Pi = moneyInterval(peakStr), Ti = moneyInterval(troughStr), Ci = moneyInterval(curStr);
    if (Pi && Ti && Pi[0] > 0) {
      const ddRange = [
        Math.max(0, ((Pi[0] - Ti[1]) / Pi[0]) * 100),
        Math.max(0, ((Pi[1] - Ti[0]) / Pi[1]) * 100),
      ];
      // formatDrawdownPct shows min(round(dd), 99) for a positive trough
      // and reserves 100 for a true-zero trough, so a stated 99/100 is
      // valid whenever the achievable drawdown actually reaches it (a
      // $44K->$94 fall is 99.8%, clamped to "99"); below 99 it must
      // round-match. This still flags an unreachable 99 (e.g. $62K->$2K
      // tops out at ~97.6% because the trough is too large).
      const ddOk = d >= 99
        ? ddRange[1] >= d - 0.5
        : intersects(pctInterval(d, 0), ddRange);
      if (!ddOk)
        report("review", "drawdown.pct-mismatch",
          `stated ${dStr} drawdown is outside [${ddRange[0].toFixed(0)},${ddRange[1].toFixed(0)}]% for ${peakStr}->${troughStr}`,
          at, len);
    }
    // "% of peak" must reconcile with current/peak (rounding-aware).
    if (Pi && Ci && Pi[0] > 0) {
      const range = [(Ci[0] / Pi[1]) * 100, (Ci[1] / Pi[0]) * 100];
      const stated = pStr === "<1" ? [0, 1] : pctInterval(p, 0);
      if (!intersects(stated, range))
        report("review", "drawdown.pct-of-peak",
          `stated ${pStr}% of peak is outside [${range[0].toFixed(0)},${range[1].toFixed(0)}]% for ${curStr}/${peakStr}`,
          at, len);
    }
  }
}

function checkPeakNarrative(text, report) {
  // Narrative A (near peak): "currently sits at {cur}, up from {first}
  //  at the start of tracking."
  const reDir = new RegExp(
    `currently sits at (${MONEY}), (up from|down from) (${MONEY}) at the start of tracking`,
  );
  for (const m of allMatches(text, reDir)) {
    const [, curStr, dir, firstStr] = m;
    const cur = parseMoney(curStr);
    const first = parseMoney(firstStr);
    if (Number.isFinite(cur) && Number.isFinite(first)) {
      if (dir === "up from" && cur < first) {
        report("contradiction", "peak.direction",
          `"up from ${firstStr}" but current ${curStr} is lower`, m.index, m[0].length);
      }
      if (dir === "down from" && cur > first) {
        report("contradiction", "peak.direction",
          `"down from ${firstStr}" but current ${curStr} is higher`, m.index, m[0].length);
      }
    }
  }
  // Narrative B (past peak): "currently sits at {cur}, which is {p}% of
  //  its all-time peak of {peak} reached on {date}."
  const rePeak = new RegExp(
    `currently sits at (${MONEY}), which is (<1|\\d+)% of its all-time peak of (${MONEY})`,
  );
  for (const m of allMatches(text, rePeak)) {
    const [, curStr, pStr, peakStr] = m;
    const cur = parseMoney(curStr);
    const p = parsePct(pStr);
    const peak = parseMoney(peakStr);
    if (Number.isFinite(cur) && Number.isFinite(peak)) {
      if (cur > peak) {
        report("contradiction", "peak.current-above-peak",
          `current ${curStr} exceeds the cited all-time peak ${peakStr}`, m.index, m[0].length);
      }
      const Ci = moneyInterval(curStr), Pi = moneyInterval(peakStr);
      if (Ci && Pi && Pi[0] > 0) {
        const range = [(Ci[0] / Pi[1]) * 100, (Ci[1] / Pi[0]) * 100];
        const stated = pStr === "<1" ? [0, 1] : pctInterval(p, 0);
        if (!intersects(stated, range))
          report("review", "peak.pct-of-peak",
            `stated ${pStr}% of peak is outside [${range[0].toFixed(0)},${range[1].toFixed(0)}]% for ${curStr}/${peakStr}`,
            m.index, m[0].length);
      }
    }
  }
}

function checkApyRanges(text, report) {
  // "ranged from {lo}% to {hi}%, averaging {avg}%"
  for (const m of allMatches(text,
    /ranged from (\d+(?:\.\d+)?)% to (\d+(?:\.\d+)?)%, averaging (\d+(?:\.\d+)?)%/)) {
    const lo = parsePct(m[1]), hi = parsePct(m[2]), avg = parsePct(m[3]);
    if (lo > hi) report("contradiction", "range.lo-hi", `low ${m[1]}% > high ${m[2]}%`, m.index, m[0].length);
    if (avg < lo - 0.05 || avg > hi + 0.05)
      report("contradiction", "range.avg-outside", `average ${m[3]}% outside [${m[1]}%, ${m[2]}%]`, m.index, m[0].length);
  }
  // "averaged {avg}%, ranging from {lo}% to {hi}%" (lifetime)
  for (const m of allMatches(text,
    /averaged (\d+(?:\.\d+)?)%, ranging from (\d+(?:\.\d+)?)% to (\d+(?:\.\d+)?)%/)) {
    const avg = parsePct(m[1]), lo = parsePct(m[2]), hi = parsePct(m[3]);
    if (lo > hi) report("contradiction", "range.lo-hi", `low ${m[2]}% > high ${m[3]}%`, m.index, m[0].length);
    if (avg < lo - 0.05 || avg > hi + 0.05)
      report("contradiction", "range.avg-outside", `lifetime average ${m[1]}% outside [${m[2]}%, ${m[3]}%]`, m.index, m[0].length);
  }
}

function checkEarlyRecent(text, report) {
  // "moved from an early average of {e}% to a recent average of {r}%, a
  //  {p}% increase/decrease"
  const re = /from an early average of (\d+(?:\.\d+)?)% to a recent average of (\d+(?:\.\d+)?)%, a (\d+(?:\.\d+)?)% (increase|decrease)/;
  for (const m of allMatches(text, re)) {
    const e = parsePct(m[1]), r = parsePct(m[2]), p = parsePct(m[3]), dir = m[4];
    if (dir === "increase" && r < e)
      report("contradiction", "trend.direction", `"increase" but recent ${m[2]}% < early ${m[1]}%`, m.index, m[0].length);
    if (dir === "decrease" && r > e)
      report("contradiction", "trend.direction", `"decrease" but recent ${m[2]}% > early ${m[1]}%`, m.index, m[0].length);
    // Magnitude reconciliation, rounding-aware: early/recent print to 2dp,
    // the change to 1dp, so recompute the achievable range from the
    // 2dp intervals and flag only a stated change outside it.
    const Ei = pctInterval(e, 2), Ri = pctInterval(r, 2);
    let lo, hi;
    if (dir === "decrease") {
      lo = Ei[0] > 0 ? ((Ei[0] - Ri[1]) / Ei[0]) * 100 : 0;
      hi = Ei[1] > 0 ? ((Ei[1] - Ri[0]) / Ei[1]) * 100 : 0;
    } else {
      lo = Ei[1] > 0 ? ((Ri[0] - Ei[1]) / Ei[1]) * 100 : 0;
      hi = Ei[0] > 0 ? ((Ri[1] - Ei[0]) / Ei[0]) * 100 : 0;
    }
    if (!intersects(pctInterval(p, 1), [Math.min(lo, hi), Math.max(lo, hi)]))
      report("review", "trend.pct",
        `stated ${m[3]}% ${dir} outside [${Math.min(lo, hi).toFixed(1)},${Math.max(lo, hi).toFixed(1)}]% for ${m[1]}%->${m[2]}%`,
        m.index, m[0].length);
  }
}

function checkDepositGrowth(text, report) {
  // "$1,000 deposited ... would now be worth ~${v}, a realized
  //  share-price {gain|loss} of ~${d}"
  const re = /would now be worth ~\$([\d,]+), a realized share-price (gain|loss) of ~\$([\d,]+)/;
  for (const m of allMatches(text, re)) {
    const v = parseFloat(m[1].replace(/,/g, ""));
    const word = m[2];
    const d = parseFloat(m[3].replace(/,/g, ""));
    if (word === "gain" && v < 1000)
      report("contradiction", "deposit.sign", `"gain" but worth ~$${m[1]} (< $1,000)`, m.index, m[0].length);
    if (word === "loss" && v > 1000)
      report("contradiction", "deposit.sign", `"loss" but worth ~$${m[1]} (> $1,000)`, m.index, m[0].length);
    const expected = Math.abs(v - 1000);
    if (Math.abs(expected - d) > 1)
      report("review", "deposit.delta", `worth ~$${m[1]} implies ~$${expected} ${word}, stated ~$${m[3]}`, m.index, m[0].length);
  }
}

function checkRanks(text, report) {
  // Asset-cohort rank from the Performance Overview opener.
  let assetRank = null, assetTotal = null;
  const reMonitor = /ranks #(\d+) among the (\d+) \w+(?:\.\w+)? vaults we monitor(?:, with (\d+) strateg\w+ currently delivering higher APY)?/;
  for (const m of allMatches(text, reMonitor)) {
    const rank = +m[1], total = +m[2];
    assetRank = rank; assetTotal = total;
    if (rank > total)
      report("contradiction", "rank.exceeds-total", `ranks #${rank} of ${total}`, m.index, m[0].length);
    if (m[3] != null && +m[3] !== rank - 1)
      report("contradiction", "rank.higher-count", `#${rank} but says ${m[3]} delivering higher APY (expected ${rank - 1})`, m.index, m[0].length);
  }
  // Market-benchmarking "Market rank #N / M" must match the opener.
  for (const m of allMatches(text, /Market rank #(\d+) ?\/ ?(\d+)/)) {
    const rank = +m[1], total = +m[2];
    if (rank > total)
      report("contradiction", "rank.exceeds-total", `Market rank #${rank} / ${total}`, m.index, m[0].length);
    if (assetRank != null && (rank !== assetRank || total !== assetTotal))
      report("contradiction", "rank.cross-section",
        `Market rank #${rank}/${total} disagrees with overview #${assetRank}/${assetTotal}`, m.index, m[0].length);
  }
  // Any "#N of M" / "#N / M by TVL" anywhere: rank within bounds.
  for (const m of allMatches(text, /#(\d+) of (\d+)(?: by TVL)?/)) {
    const rank = +m[1], total = +m[2];
    if (rank > total)
      report("contradiction", "rank.exceeds-total", `#${rank} of ${total}`, m.index, m[0].length);
  }
}

function checkCurrentTvlAgreement(text, report) {
  // Every figure the page calls the current TVL should render identically
  // (all come from the same listing value through formatTVL). Compare the
  // rendered money tokens as strings.
  const found = [];
  const push = (label, re) => {
    const m = text.match(re);
    if (m) found.push({ label, val: m[1] });
  };
  push("grid Current TVL", new RegExp(`Current TVL (${MONEY})`));
  push("narrative 'sits at'", new RegExp(`Total value locked currently sits at (${MONEY})`));
  push("drawdown 'stands at'", new RegExp(`It currently stands at (${MONEY}),`));
  if (found.length >= 2) {
    const base = found[0].val;
    for (const f of found.slice(1)) {
      if (f.val !== base) {
        report("contradiction", "tvl.current-disagree",
          `current TVL shown as ${found[0].val} (${found[0].label}) and ${f.val} (${f.label})`,
          text.indexOf(f.val), f.val.length);
      }
    }
  }
}

function checkDaysTracked(text, report) {
  const ages = [];
  const grab = (label, re) => {
    for (const m of allMatches(text, re)) ages.push({ label, n: +m[1], idx: m.index, len: m[0].length });
  };
  grab("Tracked for", /Tracked for (\d+) days/);
  grab("live for", /live for (\d+) days/);
  grab("launch N days ago", /at launch \((\d+) days ago\)/);
  grab("CAGR over N days", /over (\d+) days, growing from/);
  grab("Lifetime avg (Nd)", /Lifetime avg \((\d+)d\)/);
  if (ages.length >= 2) {
    const canon = ages.find((a) => a.label === "Tracked for")?.n ?? ages[0].n;
    for (const a of ages) {
      if (Math.abs(a.n - canon) >= 2) {
        report("review", "age.disagree",
          `"${a.label}" says ${a.n} days vs ${canon} elsewhere`, a.idx, a.len);
      }
    }
  }
}

const CHECKS = [
  checkDrawdown,
  checkPeakNarrative,
  checkApyRanges,
  checkEarlyRecent,
  checkDepositGrowth,
  checkRanks,
  checkCurrentTvlAgreement,
  checkDaysTracked,
];

// ---------- self-test (recall + precision) --------------------------------
// So the gate cannot silently lose its teeth (a loosened tolerance, a
// broken regex). Each case is a synthetic sentence that must trip a
// specific check, or must stay clean. Run with --self-test.
const SELF_TESTS = [
  { name: "zero-trough on a live vault",
    text: "TVL experienced a 100% drawdown from its $378K peak, bottoming at $0 over 192 days. It currently stands at $85K, 22% of the peak value.",
    expect: "drawdown.zero-trough" },
  { name: "'up from' when the value fell",
    text: "Total value locked currently sits at $1.9M, up from $2.0M at the start of tracking. The vault has been live for 271 days.",
    expect: "peak.direction" },
  { name: "rank exceeds cohort size",
    text: "This vault's 3.99% APY ranks #65 among the 62 USDC vaults we monitor, with 64 strategies currently delivering higher APY.",
    expect: "rank.exceeds-total" },
  { name: "average outside its own range",
    text: "Over the past 30 days, APY has ranged from 5.00% to 8.00%, averaging 12.00%.",
    expect: "range.avg-outside" },
  { name: "deposit gain/loss sign flip",
    text: "$1,000 deposited 30 days ago would now be worth ~$980, a realized share-price gain of ~$20 over that period.",
    expect: "deposit.sign" },
  { name: "unreachable 99% (trough too large)",
    text: "TVL experienced a 99% drawdown from its $62K peak, bottoming at $2K over 528 days. It currently stands at $2K, 3% of the peak value.",
    expect: "drawdown.pct-mismatch" },
  { name: "legit clamped 99% (tiny non-zero trough) is clean",
    text: "TVL experienced a 99% drawdown from its $44K peak, bottoming at $94 over 910 days. It currently stands at $120, <1% of the peak value.",
    expect: null },
  { name: "display rounding is not a contradiction",
    text: "TVL experienced a 52% drawdown from its $11K peak, bottoming at $5K over 43 days. It currently stands at $5K, 48% of the peak value.",
    expect: null },
];

function runSelfTest() {
  let failed = 0;
  for (const tc of SELF_TESTS) {
    const hits = [];
    const report = (_sev, check) => hits.push(check);
    for (const c of CHECKS) c(tc.text, report);
    const ok = tc.expect ? hits.includes(tc.expect) : hits.length === 0;
    if (ok) {
      console.log(`  ok    ${tc.name}`);
    } else {
      failed++;
      console.error(`  FAIL  ${tc.name}`);
      console.error(`        expected ${tc.expect ?? "no findings"}, got [${hits.join(", ") || "none"}]`);
    }
  }
  console.log(
    failed === 0
      ? `\n[OK] self-test passed (${SELF_TESTS.length} cases)`
      : `\n[FAIL] ${failed} self-test case(s) failed`,
  );
  process.exit(failed ? 1 : 0);
}

// ---------- driver --------------------------------------------------------

async function loadProductSlugs() {
  const raw = await fs.readFile(VAULTS_JSON, "utf8");
  const vaults = JSON.parse(raw);
  return vaults.map((v) => v.slug).filter((s) => typeof s === "string" && s.length > 0);
}

async function main() {
  if (ARGV.has("--self-test")) return runSelfTest();
  const t0 = Date.now();
  const slugs = await loadProductSlugs();
  const pages = [];
  let scanned = 0;
  let contradictions = 0;
  let reviews = 0;

  for (const slug of slugs) {
    let html;
    try {
      html = await fs.readFile(path.join(PUBLIC_DIR, `${slug}.html`), "utf8");
    } catch {
      continue; // listed but not rendered; not this check's concern
    }
    scanned++;
    const text = toText(html);
    const findings = [];
    const report = (sev, check, msg, idx, len) => {
      findings.push({ sev, check, msg, snip: snippet(text, idx, len) });
      if (sev === "contradiction") contradictions++;
      else reviews++;
    };
    for (const c of CHECKS) c(text, report);
    if (findings.length) pages.push({ slug, findings });
  }

  const ms = Date.now() - t0;

  if (JSON_OUT) {
    console.log(JSON.stringify({ scanned, contradictions, reviews, ms, pages }, null, 2));
  } else {
    if (pages.length === 0) {
      console.log(`[OK] consistency check passed (${scanned} product pages scanned, 0 findings, ${ms}ms)`);
    } else {
      const byCheck = {};
      for (const p of pages)
        for (const f of p.findings) byCheck[f.check] = (byCheck[f.check] || 0) + 1;
      console.error(
        `\n[CONSISTENCY] ${contradictions} contradiction(s) + ${reviews} review item(s) across ${pages.length} page(s) (${scanned} scanned, ${ms}ms)\n`,
      );
      console.error("By check:");
      for (const [k, v] of Object.entries(byCheck).sort((a, b) => b[1] - a[1]))
        console.error(`  ${String(v).padStart(3)}  ${k}`);
      console.error("");
      for (const p of pages) {
        console.error(`  ${p.slug}.html`);
        for (const f of p.findings) {
          console.error(`    [${f.sev === "contradiction" ? "X" : "?"}] ${f.check}: ${f.msg}`);
          console.error(`        ${f.snip}`);
        }
        console.error("");
      }
    }
  }

  const fail = contradictions > 0 || (STRICT && reviews > 0);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error("Consistency check crashed:", err);
  process.exit(2);
});
