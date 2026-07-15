#!/usr/bin/env node
// One-off: re-apply data/xrp-venues.json curated deep-links to the EXISTING
// data/xrp-yield.json snapshot, offline (no DeFiLlama call). Use after editing
// the curated registry so the committed snapshot reflects the new links right
// away, without waiting for the hourly fetch. Also embeds the curated `venues`
// list into the snapshot so the report's info section can read it.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadVenues, applyOverrides } from "./apply-xrp-overrides.mjs";

const ROOT = process.cwd();
const OUT_FILE = join(ROOT, "data", "xrp-yield.json");

const data = JSON.parse(readFileSync(OUT_FILE, "utf-8"));
const venues = loadVenues(ROOT);
const applied = applyOverrides(data.pools, venues);
data.venues = venues;

writeFileSync(OUT_FILE, JSON.stringify(data, null, 2), "utf-8");
console.log(`[xrp-overrides] applied ${applied} curated link override(s); embedded ${venues.length} venues -> data/xrp-yield.json`);
