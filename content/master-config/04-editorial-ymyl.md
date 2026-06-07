# 04 · Editorial & YMYL Rulebook

> **Snapshot:** cemented 2026-06-07, prod `main` @ `05fb1ee`. The voice rules that keep the copy accurate, unfalsifiable, and safe under Google's YMYL (Your Money or Your Life) quality bar. `AGENTS.md` (repo root) is the canonical source; this restates it plus the YMYL layer. The mechanical parts are **enforced by the gates** (doc 07).

## 1 · No em dash
`—` (U+2014) is banned in **all user-facing content** — titles, headings, body, table cells, tooltips, FAQ, meta. Use a comma, period, colon, or `" - "` (spaced hyphen). Code comments and commit messages are exempt. **Gate:** banned-words `em dash`.

## 2 · Coverage & overstatement (unfalsifiability)
Any sentence comparing the product to a **population** (rankings, market/network averages, "the ecosystem", outperformance %, "X of Y strategies", "highest-yielding", "most established") must signal that the population is **what we track**, not the whole market.
- **Signal once per section**, not every sentence; then "the cohort", "that set", "them", "the network average" may be used unqualified.
- **Vary the phrasing:** "we monitor", "we follow", "we currently track", "in our index", "the strategies we monitor", "across the products we follow", "the cohort", "in that set". Don't stack "tracked tracked tracked".
- **Always ≥ 1 signal per comparison section** (so a reader landing on that section alone understands the population).
- **Exempt:** labels, table headers, pills, tile captions, tags (1–3 word UI strings) — may use "tracked" as a short qualifier without softening.
- **Not applied to:** general SEO/marketing meta ("Best DeFi yields"), nor factual single-vault statements (current APY, TVL, share price, days tracked).
- **Goal — unfalsifiability:** if someone produces a vault we don't index, the copy must still read as accurate.
- **Gate:** consistency `scope.missing-signal`.

## 3 · Observational, never forward-looking (the YMYL core)
- **Template substitution only** — "do not paraphrase". There is no free-form generation at render time, so a page **cannot hallucinate**; it can only mis-compute (caught by the consistency gate) or overstate (caught by rule 2).
- **Forbidden:** `will earn`, `you'll/you will earn`, `guaranteed return/yield`, `expected/projected/forecasted return`, `at this rate`, and any predictive/forecast framing.
- **Required framing:** "would earn", "realised yield", "realized share-price gain", "The figures reflect the realised yield over the trailing window; they are not a forward guarantee", "is not a forecast".
- **`risk-free` is allowed only in the debunking sense** — "No DeFi yield strategy is risk-free." (It is deliberately NOT in the blacklist.)
- **Gate:** banned-words forward-looking patterns.

## 4 · Tone, person, word choice
- Third-person, impersonal, numerate. **No promotional intensifiers** ("well above", "far higher", "notably ahead", "solidly outperforming").
- **No second-person possession** ("your funds / capital / earnings / deposit / balance / returns").
- **Neutral rank framing** — never "outperforming X%" or "competes against".
- **"Harvest"**, never "Harvest Finance", in prose (legal pages + copyright exempt).
- Prefer **"yield / gain / income stream"** over the noun "returns"; **"position / holdings / supply"** over "deposit / capital". (The word `deposited` is allowed *only* inside the Yield-trajectory section.)
- No "minimal/negligible/nominal returns" placeholders — always render a quantitative gain in the underlying unit.
- No "upward/downward trend" framing — state endpoints + delta neutrally.

## 5 · Proximity buffers
A muted micro-copy line sits under the dollar-figure analytics blocks (Performance Overview, Yield trajectory):
> Historical indexer data. Past onchain performance is not a predictive forecast.

Rendered by `ProximityNote` (`.pp-proximity-note`, `--uni-ink-3`). **One per block, not per number** — over-hedging (prefixing every figure with "hypothetical") reads as anxious and *hurts* Trustworthiness. The single page-level footnote + one local buffer per analytics section is the calibrated amount.

## 6 · Schema framing
`FinancialProduct` + `Dataset` JSON-LD descriptions name the engine and frame the site as an **analytics / indexer tool** ("… indexed by Harvest from onchain vault-contract events … not financial advice") to steer Google's classifier toward "data tool" and away from "financial advisory". See doc 08.

## 7 · Numbers are exempt from softening
Factual single-vault figures (current APY, TVL, share price, days tracked) are stated plainly. The coverage rule (2) applies to *comparisons*, not to a vault's own current facts.

---

### The one-line summary
**Observe, don't predict. Compare only against "what we track". State a vault's own numbers plainly. Never an em dash.** Everything mechanical in here is a build-failing gate — so the rules can't quietly erode as the product grows.
