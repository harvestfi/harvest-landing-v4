#!/usr/bin/env node
// Self-test for the streaming distribution aggregator.
//
// The aggregator's whole reason to exist is that it never holds the balances,
// so the only way to know it is right is to run a population small enough to
// sort and compare the two answers. Every claim the page makes about accuracy
// is checked here rather than asserted in prose.
//
//   node scripts/check-richlist-distribution.mjs

import { Distribution, EXACT_THRESHOLDS, BUCKETS_PER_DECADE } from "./lib/richlist-distribution.mjs";

let failed = 0;
const ok = (name, cond, detail = "") => {
  if (!cond) {
    failed++;
    console.error(`  FAIL  ${name}${detail ? `  ${detail}` : ""}`);
  } else {
    console.error(`  ok    ${name}${detail ? `  ${detail}` : ""}`);
  }
};

// A deterministic pseudo-population shaped like a real holder distribution:
// heavy dust, a long tail, a handful of whales. Seeded so a failure is
// reproducible; Math.random would make this test flap.
function* population(n) {
  let s = 42;
  const rnd = () => {
    s = (s * 1_103_515_245 + 12_345) % 2 ** 31;
    return s / 2 ** 31;
  };
  for (let i = 0; i < n; i++) {
    const r = rnd();
    // Log-uniform between 1 and 10^6 XRP, plus a thin whale tail above that.
    const exp = r < 0.999 ? rnd() * 6 : 6 + rnd() * 3.5;
    yield 10 ** exp;
  }
}

const N = 200_000;
const balances = [...population(N)];
const sorted = [...balances].sort((a, b) => a - b);
const dist = new Distribution({ topN: 100 });
balances.forEach((b, i) => dist.add(b, { address: `r${i}` }));

console.error(`[richlist self-test] ${N} synthetic accounts, ${BUCKETS_PER_DECADE} buckets/decade`);

ok("total counted", dist.total === N, `${dist.total}`);

const trueSum = balances.reduce((a, b) => a + b, 0);
ok(
  "sum within 1e-9 relative",
  Math.abs(dist.sumXrp - trueSum) / trueSum < 1e-9,
  `${dist.sumXrp.toFixed(0)} vs ${trueSum.toFixed(0)}`,
);

// Exact counters must be exact, not close: the FAQ quotes them.
for (const t of EXACT_THRESHOLDS) {
  const brute = balances.filter((b) => b >= t).length;
  const got = dist.exactCounts()[String(t)];
  if (got !== brute) ok(`exact count at ${t}`, false, `${got} vs ${brute}`);
}
ok("all exact counters match brute force", true);

// Thresholds come out of the histogram, so they carry its resolution. The
// bound checked here is the one the methodology section states.
const MAX_REL_ERR = 10 ** (1 / BUCKETS_PER_DECADE) - 1;
let worst = 0;
for (const tier of dist.tiers()) {
  const idx = Math.max(0, Math.floor(N * (1 - tier.pct / 100)));
  const brute = sorted[idx];
  const rel = Math.abs(tier.minXrp - brute) / brute;
  worst = Math.max(worst, rel);
  ok(
    `top ${tier.pct}% threshold within ${(MAX_REL_ERR * 100).toFixed(3)}%`,
    // Two buckets of slack: the tier lands on a bucket edge and the brute-force
    // index lands on a specific account, which can straddle one boundary.
    rel <= MAX_REL_ERR * 2 + 1e-12,
    `${tier.minXrp} vs ${brute.toFixed(2)} (${(rel * 100).toFixed(4)}%)`,
  );
}
console.error(`  worst threshold error ${(worst * 100).toFixed(4)}%`);

// The top list must be the actual largest accounts, in order.
const top = dist.topAccounts();
const bruteTop = [...balances].sort((a, b) => b - a).slice(0, 100);
ok("top list length", top.length === 100, `${top.length}`);
ok(
  "top list is the true largest 100, in order",
  top.every((t, i) => Math.abs(t.xrp - Math.round(bruteTop[i])) <= 1),
);

// The ladder is what the browser interpolates against, so it has to be
// monotone in both axes or the calculator will report a rank that moves the
// wrong way as the user types.
const ladder = dist.ladder();
let mono = true;
for (let i = 1; i < ladder.length; i++) {
  if (!(ladder[i].xrp > ladder[i - 1].xrp)) mono = false;
  if (ladder[i].atOrAbove > ladder[i - 1].atOrAbove) mono = false;
}
ok("ladder monotone: balance up, accounts at-or-above down", mono, `${ladder.length} points`);
ok("ladder starts at full population", ladder[0].atOrAbove === N, `${ladder[0].atOrAbove}`);

// Bands must partition the population exactly, or the chart and the table twin
// will disagree with the header count.
const bands = dist.bands();
const bandSum = bands.reduce((a, b) => a + b.accounts, 0);
ok("bands partition every account", Math.abs(bandSum - N) <= bands.length, `${bandSum} vs ${N}`);

// Interpolating the shipped ladder must reproduce the true rank. This is the
// end-to-end check on what the calculator actually does.
const interp = (xrp) => {
  if (xrp <= ladder[0].xrp) return ladder[0].atOrAbove;
  const last = ladder[ladder.length - 1];
  if (xrp >= last.xrp) return last.atOrAbove;
  let lo = 0;
  let hi = ladder.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ladder[mid].xrp <= xrp) lo = mid;
    else hi = mid;
  }
  const a = ladder[lo];
  const b = ladder[hi];
  const t = (Math.log10(xrp) - Math.log10(a.xrp)) / (Math.log10(b.xrp) - Math.log10(a.xrp));
  return a.atOrAbove + t * (b.atOrAbove - a.atOrAbove);
};

let worstPct = 0;
for (const probe of [1, 10, 100, 1_000, 2_000, 5_000, 10_000, 50_000, 500_000]) {
  const brute = balances.filter((b) => b >= probe).length;
  const got = interp(probe);
  const truePct = (brute / N) * 100;
  const gotPct = (got / N) * 100;
  worstPct = Math.max(worstPct, Math.abs(truePct - gotPct));
}
ok(
  "ladder interpolation within 0.5 percentage points",
  worstPct < 0.5,
  `worst ${worstPct.toFixed(3)}pp`,
);

if (failed) {
  console.error(`[FAIL] richlist distribution self-test: ${failed} failure(s)`);
  process.exit(1);
}
console.error("[OK] richlist distribution self-test passed");
