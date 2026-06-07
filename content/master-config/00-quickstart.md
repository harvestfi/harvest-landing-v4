# 00 · Master Config — Quickstart & File Map

> **Snapshot:** cemented 2026-06-07, prod `main` @ `05fb1ee`. This pack is a point-in-time, authoritative record of the Harvest single-product-page generation engine — enough for a fresh AI or engineer to rebuild every section to identical, regression-free output.

## What this is
The product pages under `/[slug]` are **template-generated from indexed onchain data** (no free-form generation). This pack documents the data, the sections, the exact copy templates, the editorial/YMYL rules, the canonical-value discipline that keeps sections consistent, the full log of bugs we fixed, and the two build gates that prevent regression.

## Read order
- **Rebuilding from scratch:** 00 → 01 (data) → 02 (anatomy) → 03 (section specs) → 04 (editorial) → 05 (canonical) → 08 (SEO). Then 06 (regression log) + 07 (gates) for the guardrails.
- **"Just the rules":** 04 + 07.
- **"Why is the code shaped this way":** 06.

## The pack
| File | Contents |
|---|---|
| `00` | this — quickstart + file map |
| `01` | data model & sources (the 3 JSON files, loading, guards, freshness) |
| `02` | page anatomy (render order + component map + conditional matrix) |
| `03` | section specs (every section's exact templates + thresholds, per vault type) |
| `04` | editorial & YMYL rulebook |
| `05` | canonical values & cross-section consistency |
| `06` | regression log (every failure mode we fixed) |
| `07` | the gates (the two build-failing scanners) |
| `08` | SEO, structured data, indexing |
| `MASTER` | all of the above concatenated into one file |

## Repo file map
| Concern | Files |
|---|---|
| Route, metadata, JSON-LD | `src/app/[slug]/page.tsx`, `src/lib/jsonld.ts`, `src/lib/seo.ts` |
| Page body + vault-type dispatch | `src/components/product-page-body.tsx` |
| About | `src/lib/{autopilot,autocompounder,lp-pair}-about.ts` |
| Performance Overview + Yield trajectory | `src/lib/autopilot-sections.ts`; `src/components/vault-commentary.tsx`, `yield-trajectory.tsx` |
| Market benchmarking + Ecosystem | `src/components/market-sections.tsx` |
| Strategy stability | `src/components/vault-stability-card.tsx` |
| Long-term performance | `src/components/historical-narrative.tsx` |
| Historical statistics | `src/components/historical-stats.tsx` |
| Historical Data table | `src/components/vault-history-table.tsx` |
| FAQ | `src/lib/{autopilot,autocompounder,lp-pair}-faq.tsx`; `src/components/vault-faq.tsx` |
| Proximity buffer | `src/components/proximity-note.tsx` |
| Shared formatting / contextualisation | `src/lib/format.ts`, `src/lib/contextualize.ts` |
| Data + guards | `src/lib/data.ts`, `history-api.ts`, `freshness.ts`, `admin-rules.ts` |
| Canonical name / LP | `src/lib/lp-pair.ts` |
| Editorial rules (canonical) | `AGENTS.md` |
| Gates | `scripts/check-banned-words.mjs`, `scripts/check-page-consistency.mjs` |
| Data files | `data/vaults.json`, `data/history.json`, `data/holders.json` |

## Build pipeline
```
npm run build =
  build-network-tvl  →  next build (static export)  →  mv out public
  →  build-search-index  →  build-design-system
  →  check-banned-words  →  check-consistency
```
Both gates must pass or the build (and the deploy) fails. **Snapshot state: 0 violations / 0 findings across 156 product pages.**

## Rebuild-from-scratch recipe
1. **Data layer (01):** the three JSON files, the loaders + fallbacks, the quality guards (`sanitizeTvlSeries`, `isErraticTvl`, `hasSharePriceDiscontinuity`, `apy>=0`, `value>0`), and `freshness`.
2. **Dispatch (02):** route → `ProductPageBody` → vault-type variant (Autopilot / single-asset Autocompounder / LP-pair / OnlyBoost).
3. **Sections (03):** implement each section, honouring every threshold + suppression rule + the **canonical values (05)** so nothing contradicts.
4. **Voice + SEO (04, 08):** apply the editorial/YMYL rules and the structured-data framing.
5. **Gates (07):** port both scanners; run against your build; iterate to 0.
6. **Cross-check (06):** every regression-log entry is a trap a naive rebuild falls into — verify each failure mode is absent.

**Acceptance test:** doc 07's gates report 0 findings, and none of doc 06's failure modes are present.
