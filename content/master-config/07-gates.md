# 07 · The Gates — the self-enforcing safety net

> **Snapshot:** cemented 2026-06-07, prod `main` @ `05fb1ee`. Two deterministic scanners run at the end of `npm run build` (after the pages are emitted). They scan the **rendered** `public/<slug>.html`, so they catch a violation no matter which template produced it — and a violation **fails the deploy build**. This is what lets the project stop re-litigating the same class of bug.

## Build wiring
```
"build": "rm -rf public/_next && node scripts/build-network-tvl.mjs && next build
          && rm -rf public && mv out public
          && node scripts/build-search-index.mjs && node scripts/build-design-system.mjs
          && npm run check-banned-words && npm run check-consistency"
```
Both scanners exit non-zero on a violation → Vercel/CI build fails → nothing ships.

---

## A · `scripts/check-banned-words.mjs` — editorial + forward-looking

- **Scope:** `public/<slug>.html` for every slug in `data/vaults.json` (product pages only; home/hub/legal pages use a different register).
- **Method:** strip `<footer>` (the universal legal disclaimer, which legitimately uses banned words), then `<script>`/`<style>`, then tags → readable text. A **section-aware exemption** allows `deposited` inside `<section id="yield-trajectory">` (the "$1,000 deposited 30 days ago" template) and bans it everywhere else.
- **The blacklist** (each entry is a regex; scope `always` unless noted):

  | Rule | Pattern (gist) |
  |---|---|
  | yield-income noun | `returns? / returning` |
  | invest family | `invest / investing / invested / investment / investor(s)` |
  | deposit family | `deposit(s/ing)` — **exempt inside `#yield-trajectory`** |
  | depositor / re- | `depositor(s)`, `redeposit / reinvest` family |
  | capital | `capital` |
  | outperform | `outperform(s/ed/ing)`, `competes against / goes up against` |
  | brand | `Harvest Finance` (use plain "Harvest" in prose) |
  | recovery | `recovered` |
  | placeholders | `minimal / negligible / nominal returns` |
  | trend framing | `upward/downward trend`, `trending up/down` |
  | soft judgment | `well above / significantly below / far higher / notably ahead / solidly outperforming` |
  | 2nd-person possession | `your (funds\|capital\|deposit\|investment\|earnings\|balance\|returns)` |
  | **forward-looking (YMYL)** | `will/you'll earn` · `guaranteed return/yield/profit/apy` · `expected/projected/forecasted return/yield/...` · `at this rate` |
  | typography | `—` (em dash) |

- **`risk-free` is deliberately NOT banned** — the risk section legitimately says "No DeFi yield strategy is risk-free."
- **Allowlist:** documented false positives only (e.g. `liquidity returns` = verb usage), stripped before matching.

---

## B · `scripts/check-page-consistency.mjs` — numeric / structural + YMYL

- **Scope:** the same rendered pages; strips to text and **glues** the currency/percent boundaries that tag-stripping splits (`$ 1,004 ,` → `$1,004,`, `5.61 %` → `5.61%`) so the numeric patterns match the way a human reads the sentence.
- **Severities:**
  - **`contradiction`** — a sign / ordering / equality failure, true regardless of display rounding. **Must always be zero; hard-fails the build.**
  - **`review`** — a ratio mismatch within rounding noise. Surfaced, non-blocking (unless `--strict`).
- **The checks:**

  | Check | Asserts | Severity |
  |---|---|---|
  | `drawdown.zero-trough` | "bottoming at $0" never appears while current > 0 | contradiction |
  | `drawdown.trough-above-current` / `-above-peak` | trough ≤ current, trough ≤ peak | contradiction |
  | `drawdown.pct-mismatch` | stated drawdown % ≈ (peak−trough)/peak | review |
  | `drawdown.pct-of-peak` | "X% of peak" ≈ current/peak | review |
  | `peak.direction` | "up from"⟺current>first, "down from"⟺current<first | contradiction |
  | `peak.current-above-peak` | current ≤ cited all-time peak | contradiction |
  | `peak.pct-of-peak` | "X% of its all-time peak" ≈ current/peak | review |
  | `range.lo-hi` / `range.avg-outside` | in "ranged from LO to HI, averaging AVG": LO ≤ AVG ≤ HI ≤ ordering | contradiction |
  | `trend.direction` | "increase"⟺recent>early, "decrease"⟺recent<early | contradiction |
  | `trend.pct` | stated %Δ ≈ \|recent−early\|/early | review |
  | `deposit.sign` | "gain"⟺worth ≥ $1,000, "loss"⟺worth < $1,000 | contradiction |
  | `deposit.delta` | \|worth − 1000\| ≈ stated delta | review |
  | `rank.exceeds-total` | every "#N of M" has N ≤ M | contradiction |
  | `rank.higher-count` | "N strategies delivering higher APY" == rank − 1 | contradiction |
  | `rank.cross-section` | Market-rank stat == Performance-Overview rank/total | contradiction |
  | `tvl.current-disagree` | every "current TVL" rendering is byte-identical | contradiction |
  | `age.disagree` | every day-count is within 1 of "Tracked for N days" | contradiction |
  | `leak.null-or-nan` | no `$NaN` / `NaN%` / `undefined` / `Invalid Date` / `Infinity` | contradiction |
  | `scope.missing-signal` | a page that makes a population comparison carries a scope signal | contradiction |
  | `bench.higher-count` / `lower-count` | benchmarking "{above} higher; {below} lower" reconcile with rank/total | contradiction |
  | `bench.sign` | "vs. Average" stat sign matches "X% higher/lower than the cohort average" | contradiction |
  | `bench.magnitude` | "vs. Average" magnitude matches the closing % | review |

- **Helpers:** `parseMoney` (`$0`/`$119`/`$1,004`/`$85K`/`$1.9M`/`$2.0B` → number; thousands-comma only, never a trailing sentence comma), `parsePct` (`"<1"` → 0.5). Tolerances are display-aware: ±2 on integer percentages, **string-equality** for "current TVL" agreement (both come from `formatTVL` of the same value).
- **Run modes:** `node scripts/check-page-consistency.mjs` (report), `--json` (machine output), `--strict` (also fail on `review`).

---

## C · How to extend safely (when you add a section or template)
1. Author the template per the conventions in **03 — Section Specs** and **04 — Editorial & YMYL Rulebook**.
2. If the template emits a number that relates to another number on the page, **add a check**:
   - sign / ordering / equality relationship → `contradiction`;
   - ratio / magnitude relationship (subject to display rounding) → `review`.
3. If the template makes any population comparison, ensure a scope signal is present in the same section.
4. Verify against a clean build — `npm run build` must end with **both gates at 0 findings**. The current snapshot is `0 violations / 0 findings across 156 product pages`.

### Why scan rendered HTML, not source strings
A page is assembled from ~8 independent builders. Checking source string literals would miss contradictions that only emerge once the numbers are substituted and the sections sit side by side. Scanning the emitted HTML is the only place where "does sentence X agree with sentence Y and with the grid" is decidable — so that is where the gate lives.
