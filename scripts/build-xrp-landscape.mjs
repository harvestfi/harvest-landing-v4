#!/usr/bin/env node
// Landscape TVL aggregator for /report/xrp-yield-ranking.
//
// WHY: the report tracks the whole XRP-denominated DeFi yield landscape, and we
// want one honest "total TVL over time" series showing how that landscape grew.
// No single feed carries it, so we stitch the best XRP-SPECIFIC series per venue:
//   - Per-pool daily TVL from DeFiLlama /chart (already in data/xrp-yield.json's
//     `history[].tvl`, backfilled to inception) for the pool-indexed venues
//     (Aerodrome, Moonwell, Kinetic, SparkDEX, Mystic).
//   - Protocol-level Flare TVL from DeFiLlama for Upshift, whose entire Flare
//     presence IS its XRP vaults (earnXRP + mXRPY) — the /yields endpoint does
//     not break the pool out, but /protocol/upshift chainTvls.Flare does, back
//     to inception. This is the single biggest venue (~$45M), so without it the
//     aggregate badly understates the landscape.
//   - Protocol-level Flare + Base TVL for Spectra, whose XRP-family PT/LP markets
//     on those chains are its presence there (using protocol level also avoids
//     double-counting the same market's PT and LP, which the per-product rows
//     would otherwise sum twice).
// Venues without any daily series (e.g. Superform's tiny $0.3M) are folded in at
// their current snapshot from their first indexed day — immaterial to the shape.
//
// Methodology is mixed (per-pool + protocol-level) but non-overlapping: the
// protocol-level venues (Upshift, Spectra) are disjoint from the pool-indexed
// ones, so nothing is counted twice. The series is written to
// data/xrp-yield.json as `landscape` for the page to render with no network at
// build/render time. Runs after fetch-xrp-yield + apply-xrp-overrides.
//
// Requires network (DeFiLlama, unauthenticated). In the sandbox, run with
// NODE_USE_ENV_PROXY=1 so Node's fetch honours the agent proxy.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { freezeStampIfUnchanged } from "./lib/snapshot-stamp.mjs";

const ROOT = process.cwd();
const DATA_FILE = join(ROOT, "data", "xrp-yield.json");

async function getJson(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(45_000),
        headers: { accept: "application/json" },
      });
      if (r.ok) return await r.json();
      console.error(`[landscape] ${url} -> HTTP ${r.status}`);
    } catch (e) {
      console.error(`[landscape] ${url} -> ${e.message ?? e}`);
    }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return null;
}

const dstr = (unixSec) => new Date(unixSec * 1000).toISOString().slice(0, 10);

// A DeFiLlama protocol's per-day {d, tvl} for one or more chains, summed.
// Each chain is first collapsed to ONE value per calendar day (last timestamp
// wins — DeFiLlama sometimes emits two rows for the current day), THEN chains
// are summed per day. Summing raw rows would double-count those duplicate days.
async function protocolChainSeries(slug, chains) {
  const doc = await getJson(`https://api.llama.fi/protocol/${slug}`);
  const ct = doc?.chainTvls ?? {};
  const total = new Map();
  for (const chain of chains) {
    const rows = ct[chain]?.tvl;
    if (!Array.isArray(rows)) continue;
    const perDay = new Map();
    for (const r of rows) {
      if (!Number.isFinite(r?.totalLiquidityUSD)) continue;
      perDay.set(dstr(r.date), r.totalLiquidityUSD); // overwrite → last wins
    }
    for (const [d, v] of perDay) total.set(d, (total.get(d) ?? 0) + v);
  }
  return [...total.entries()]
    .map(([d, tvl]) => ({ d, tvl: Math.round(tvl) }))
    .sort((a, b) => (a.d < b.d ? -1 : 1));
}

const data = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
const pools = Array.isArray(data.pools) ? data.pools : [];

// 1) Pool-indexed venues: reuse the per-pool tvl history already in the file.
const isLlamaPool = (p) =>
  typeof p.llamaUrl === "string" && /^[0-9a-f-]{36}$/i.test(String(p.id || ""));
const venueSeries = [];
for (const p of pools) {
  if (!isLlamaPool(p)) continue;
  const hist = (p.history || [])
    .filter((h) => h && h.d && Number.isFinite(h.tvl))
    .map((h) => ({ d: h.d, tvl: h.tvl }));
  if (hist.length >= 2)
    venueSeries.push({ venue: p.platform || p.venueSlug, kind: "pool", hist });
}

// 2) Protocol-level venues ONLY where the chain presence is verifiably XRP-only.
// Upshift's entire Flare TVL is its XRP vaults (earnXRP + mXRPY), confirmed by
// the protocol total matching the two products' summed TVL. Spectra is NOT
// included at protocol level: its Base deployment is mostly non-XRP PT markets,
// so /protocol/spectra would massively overcount — Spectra is folded into the
// snapshot remainder below instead.
const upshift = await protocolChainSeries("upshift", ["Flare"]);
if (upshift.length >= 2)
  venueSeries.push({ venue: "Upshift", kind: "protocol:Flare", hist: upshift });

// 3) Snapshot-only remainder: venues with no XRP-clean daily series (Spectra
// XRP markets, Superform). Their current TVL is real and belongs in today's
// total, but we do NOT fabricate a trajectory for it — it is reported as a
// number, not blended into the daily line.
// A Spectra PT and its pool share the same liquidity, so the PT's TVL mirrors
// the pool's — count it once (via the pool) so totals aren't double-counted.
const tvlCounts = (p) => !String(p.venueSlug || p.id || "").startsWith("spectra-pt-");
const coveredVenues = new Set(venueSeries.map((s) => s.venue));
const remainder = pools
  .filter(
    (p) =>
      tvlCounts(p) &&
      !coveredVenues.has(p.platform) &&
      Number.isFinite(p.tvlUsd) &&
      p.tvlUsd > 0,
  )
  .reduce((sum, p) => sum + p.tvlUsd, 0);

if (!venueSeries.length) {
  console.error("[landscape] no venue series; leaving data.landscape untouched.");
  process.exit(0);
}

// Union of all dates; each venue forward-filled from its own inception (it
// contributes 0 before its first indexed day — the landscape did not include it
// yet). The daily line is ONLY the venues with a real XRP-clean series; the
// snapshot remainder is reported alongside, never blended in.
const allDates = [...new Set(venueSeries.flatMap((s) => s.hist.map((h) => h.d)))].sort();
const cursors = venueSeries.map(() => ({ i: 0, last: null }));
const series = allDates.map((d) => {
  let sum = 0;
  venueSeries.forEach((s, k) => {
    const c = cursors[k];
    while (c.i < s.hist.length && s.hist[c.i].d <= d) {
      c.last = s.hist[c.i].tvl;
      c.i++;
    }
    if (c.last != null) sum += c.last;
  });
  return { d, tvl: Math.round(sum) };
});

// Trim the leading near-zero tail so the chart starts where the landscape
// meaningfully exists (>= 1% of current), keeping the ramp visible without a
// long flat run at the axis.
const currentTotal = pools.filter(tvlCounts).reduce((s, p) => s + (p.tvlUsd || 0), 0);
const floor = currentTotal * 0.01;
const startIdx = series.findIndex((p) => p.tvl >= floor);
const trimmed = series.slice(startIdx === -1 ? 0 : startIdx);

const first = trimmed[0];
const peak = trimmed.reduce((m, p) => (p.tvl > m.tvl ? p : m), trimmed[0]);
const last = trimmed[trimmed.length - 1];
const coveragePct = Math.round((last.tvl / currentTotal) * 100);

// Stamp is frozen when the series and coverage are unchanged, so an idle daily
// run leaves the file byte-identical and the report's "Last updated" date does
// not advance on data that did not move. See scripts/lib/snapshot-stamp.mjs.
data.landscape = freezeStampIfUnchanged(data.landscape, {
  generatedAt: new Date().toISOString(),
  note:
    "Daily-indexed XRP-denominated DeFi TVL across venues with a continuous daily series, plus Upshift's Flare vault TVL (protocol-level, its entire Flare presence is XRP). Venues newly switched to on-chain sourcing rebuild their daily series forward from the switch, so they join this line as history accumulates; their current TVL is always in today's total. Sources: on-chain reads (Base and Flare), Spectra and Portals.",
  coverage: venueSeries.map((s) => ({ venue: s.venue, basis: s.kind, points: s.hist.length })),
  indexedShareOfTotalPct: coveragePct,
  snapshotRemainderUsd: Math.round(remainder),
  currentTotalUsd: Math.round(currentTotal),
  start: { d: first.d, tvl: first.tvl },
  peak: { d: peak.d, tvl: peak.tvl },
  latest: { d: last.d, tvl: last.tvl },
  series: trimmed,
});

writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");
console.log(
  `[landscape] ${trimmed.length} days ${first.d}→${last.d} | start $${first.tvl.toLocaleString()} · peak $${peak.tvl.toLocaleString()} (${peak.d}) · latest $${last.tvl.toLocaleString()} (${coveragePct}% of $${Math.round(currentTotal).toLocaleString()} total) | venues: ${venueSeries.map((s) => s.venue).join(", ")} | snapshot remainder $${Math.round(remainder).toLocaleString()}`,
);
