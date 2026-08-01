# `/xrp-rich-list` — Page Dossier

Technical documentation of one page, written so another agent can verify its
readiness without reading the repository. Every figure, tag, schema and count
below was extracted from the built HTML and the source tree, not asserted from
memory. Where something is wrong, it says so.

**Snapshot of state:** branch `claude/xrp-rich-list-seo` (PR #88), which is
`main` plus the SEO work. Two further PRs are open against this page and are
listed in §12. Ledger snapshot 105,990,370, closed 2026-08-01T03:57:01Z.

---

## 0. What the page is, and what it is for

A live XRP Ledger holder distribution, built as a tool rather than an article.
It answers "how much XRP do I need to be in the top 1%", "who holds the most
XRP", and "where does my balance rank", from a single validated ledger read
directly over JSON-RPC.

The load-bearing decision: on this SERP the two results that earn traffic are
both live tools, and the high-authority articles above them collect nothing.
So the page leads with a calculator and a threshold table, and the prose exists
to explain them rather than to carry the page.

**Scope boundary.** `/report/xrp-yield-ranking` owns the yield vocabulary.
Nothing in this page's title, H1, meta description or any H2 competes with it.
Yield appears in exactly two places: one column of the threshold table, and the
bridge section, both of which link down to that report.

---

## 1. Technology

| | |
|---|---|
| Framework | Next.js 16.2.3, App Router |
| Rendering | `output: "export"` — fully static, no server at runtime |
| React | 19.2.4 |
| TypeScript | ^5, `tsc --noEmit` clean |
| Styling | Plain CSS with custom properties. Tailwind v4 is installed but **shadcn is not**: no `components.json`, no `components/ui`, no `cn()`. Component *layouts* borrowed from 21st.dev were reproduced against the `--uni-*` token set rather than pasted. |
| Images | `images: { unoptimized: true }` (required by static export) |
| Charting | **No library.** The distribution chart is hand-rolled SVG. `recharts` is not installed. |
| Animation | **No library.** The stat-card tilt is two CSS custom properties. `framer-motion` is not installed. |
| Runtime deps | 5 total for the whole site |
| Node | v22 |

**No client-side data fetching anywhere on this page.** Every figure is
inlined at build time. The three client components exist for interaction only:

| File | Lines | Boundary |
|---|---|---|
| `src/app/xrp-rich-list/page.tsx` | 1279 | server |
| `src/app/xrp-rich-list/opengraph-image.tsx` | 70 | server (build-time PNG) |
| `src/app/xrp-rich-list/twitter-image.tsx` | 3 | re-export |
| `src/app/_styles/rich-list.css` | 1794 | — |
| `src/components/richlist/top-accounts-table.tsx` | 263 | **client** (filters, pager) |
| `src/components/richlist/percentile-calculator.tsx` | 297 | **client** (the calculator) |
| `src/components/richlist/distribution-chart.tsx` | 247 | server |
| `src/components/richlist/stat-cards.tsx` | 78 | **client** (pointer tilt) |
| `src/lib/xrp-richlist.ts` | 262 | server |

Built page weight: **289 KB** of HTML, 4 stylesheets, 3 preloaded fonts.

---

## 2. Head and identity

| Tag | Value |
|---|---|
| `<title>` | XRP Rich List: Top Holders and Your Rank \| Harvest |
| `description` | Live XRP rich list calculator and holder distribution. See the top 1%, 10% and 25% thresholds and find where your balance ranks, read from the XRP Ledger. (154 chars) |
| `canonical` | `https://harvest.finance/xrp-rich-list` |
| `robots` | `index, follow` |
| `og:type` | `article` |
| `og:image` | `/xrp-rich-list/opengraph-image` — 1200×630 PNG, generated at build |
| `og:image:alt` | XRP Rich List: top holders, balance distribution and a percentile calculator, by Harvest |
| `article:published_time` | `2026-08-01T03:57:01.000Z` |
| `article:modified_time` | `2026-08-01T03:57:01.000Z` |
| `twitter:card` | `summary_large_image` |
| `twitter:image` | `/xrp-rich-list/twitter-image` |
| `viewport` | `width=device-width, initial-scale=1, viewport-fit=cover` |

**The timestamps are the ledger's close, never the build time.** A modified
time that advances on every deploy teaches a crawler that the field means
nothing, so it is wired to `data.ledgerCloseIso` through `generateMetadata()`.
A build that changes no data does not move it.

**The OG card carries three live figures** read from the snapshot at build
time, so the card cannot quote a number the page disagrees with: what the top
1% takes, how many funded accounts exist, and what share the largest hundred
hold. Each degrades to an em dash rather than to a guess.

**Known-fixed:** the description used to end "Updated hourly." The walk runs
`20 */6 * * *`, four times a day. That claim is gone.

---
## 3. Structured data — eight graphs

Six are emitted by the page, two by the site shell. All eight parse as valid
JSON.

| `@type` | Source | Carries |
|---|---|---|
| `Organization` | shell | publisher identity |
| `WebSite` | shell | `potentialAction` (site search) |
| `BreadcrumbList` | page | Home › XRP Rich List |
| `FAQPage` | page | 11 questions, every answer rendered visibly on the page |
| `Dataset` | page | CC-BY-4.0, `dateModified`, 4 distributions, `isBasedOn: xrpl.org` |
| `WebApplication` | page | the calculator, `FinanceApplication`, price 0 |
| `WebPage` | page | explicit `dateModified` |
| `ItemList` | page | 100 ranked accounts, `ItemListOrderDescending` |

Three deliberate choices an auditor should check rather than assume:

1. **`Dataset.isBasedOn` names `https://xrpl.org` and nothing else.** There is
   no aggregator in the data path, and nothing here credits one. If a future
   change introduces an explorer or an aggregator, this field has to change
   with it.
2. **No `financialProductSchema` anywhere.** Its `provider`/`brand` are
   hardcoded to the Harvest Organization, and emitting it for an XRP Ledger
   account would claim Harvest offers it.
3. **`ItemList` positions are the array index, not the row's `rank` field.**
   See §11 — the shipped snapshot's `rank` values are corrupt, and `position`
   has to be unique and sequential regardless.

The FAQ answers in the schema are byte-identical to the visible `<details>`
copy. Nothing is schema-only.

---

## 4. Document structure

**Heading tree.** One `h1`, fourteen `h2`, one `h3`. No level is skipped.

| Level | `id` | Text |
|---|---|---|
| h1 | — | XRP Rich List & Calculator |
| h2 | — | Summary |
| h2 | `calculator-title` | The XRP Rich List Calculator |
| h2 | — | Enter XRP, then click "Start check" to run the calculator. |
| h2 | `jump` | On this page *(visually hidden, `.rl-sr`)* |
| h2 | `top-accounts` | Top 100 XRP wallets |
| h2 | `thresholds` | XRP rich list 2026: current thresholds |
| h2 | `chart` | How XRP is spread across wallets |
| h3 | — | Funded accounts by balance band |
| h2 | `bands` | Wallets and XRP held, by balance band |
| h2 | `what-it-shows` | What the XRP balance distribution shows |
| h2 | `working-vs-idle` | How much XRP is working rather than sitting idle |
| h2 | `concentration` | What the largest 100 accounts hold |
| h2 | `bridge` | XRP yield sources: where people earn on XRP |
| h2 | `faq` | XRP rich list questions |
| h2 | `methodology` | How this XRP rich list is built |

The year in "XRP rich list 2026" is derived from the snapshot, never
hardcoded, so it rolls over on 1 January without maintenance. No year appears
anywhere in the metadata.

**Semantics and ARIA, counted in the built HTML:**

| | |
|---|---|
| `<section>` | 14, each with `aria-labelledby` pointing at its own heading |
| `<details>` / `<summary>` | 11 / 11 — the FAQ is native, not a JS accordion, so the answers exist without scripts |
| Native `<table>` | 2 (thresholds, balance bands), both with `<caption>`, `scope="col"` ×10, `scope="row"` ×15 |
| ARIA grids | 2 (`role="table"`) — the ranking and the concentration breakdown, built as CSS grids so every row is exactly one line tall |
| `role="row"` / `role="cell"` / `role="columnheader"` | 106 / 716 / 11 |
| `role="status"` + `aria-live="polite"` | 2 — the calculator result and the filter readout |
| `aria-label` / `aria-labelledby` | 14 / 12 |
| `aria-hidden="true"` | 34 (decorative marks only) |
| `<img>` | 10, **zero missing `alt`** |
| `<input>` / `<label>` | 5 / 5 — every control labelled |
| `<dl>` | 5 |
| `data-nosnippet` | 3 — on the ranking and both data tables, so search snippets excerpt the answer-first prose rather than a table fragment |
| `data-lint="chrome"` | 4 — an explicit opt-out from the prose linter for interface chrome (card key/value pairs, a chart legend). Every element carrying it has a prose twin elsewhere on the page. |

The ranking is a CSS grid rather than a `<table>` for a specific reason: a
`<table>` lets one cell with an extra line push its whole row taller, and a
hundred rows of different heights read as a dump rather than as a ranking. It
is still a table semantically — `role="table"` with row/cell/columnheader — so
a screen reader gets the same structure.

---

## 5. Links

**Internal, from this page (28 distinct):** `/`, `/aave`, `/about`,
`/arbitrum`, `/base`, `/btc`, `/contact`, `/disclosures`, `/eth`, `/ethereum`,
`/hyperevm`, `/llms.txt`, `/methodology`, `/morpho`, `/polygon`, `/privacy`,
`/report/aerodrome`, `/report/stablecoin-yield-ranking`,
`/report/xrp-yield-ranking`, `/risk-framework`, `/robots.txt`, `/security`,
`/sitemap.xml`, `/terms`, `/usdc`, `/usdt`, `/xrp-rich-list`, `/zksync`

**In-page anchors (7):** `#calculator`, `#thresholds`, `#top-accounts`,
`#what-it-shows`, `#working-vs-idle`, `#faq`, `#methodology`

**External (4):** Discord, GitHub, Medium, X — all site-shell social links,
all `rel="me noopener"`. **The page body links to no external domain.**

**Inbound links: 182 pages.** This is recent. Until PR #88 the page was an
orphan — nothing on the site linked to it, and its only route into the index
was the sitemap. It is now in the footer's Reports column (hence every built
page), in `llms.txt`, and linked in prose from the XRP yield report.

---

## 6. Data pipeline

```
XRPL public JSON-RPC  ──►  scripts/fetch-xrpl-richlist.mjs  ──►  data/xrp-richlist.json
   (xrpl.ws, s1, s2)          + lib/richlist-distribution.mjs        │
                              + lib/xrpl.mjs                         ├─►  page.tsx (build-time read)
                              + lib/xrpl-labels.mjs                  └─►  scripts/build-richlist-export.mjs
                              + lib/richlist-concentration.mjs              └─►  public/data/xrp-rich-list/*
```

| Script | Lines | Role |
|---|---|---|
| `scripts/fetch-xrpl-richlist.mjs` | 435 | the ledger walk |
| `scripts/lib/richlist-distribution.mjs` | 211 | streaming histogram + top-N |
| `scripts/lib/xrpl.mjs` | 228 | JSON-RPC client, endpoint failover, `ledger_data` paging |
| `scripts/lib/xrpl-labels.mjs` | 207 | label registry + base58check validation |
| `scripts/lib/richlist-concentration.mjs` | 67 | concentration, pinned to `CONCENTRATION_N = 100` |
| `scripts/build-richlist-export.mjs` | 127 | the four public files |
| `scripts/check-xrpl-labels.mjs` | 264 | build gate |

**Cadence:** `20 */6 * * *` (four times a day). The workflow runs a
distribution sanity check, then the walk, then a `--resume` pass if the first
did not finish.

**Method, as the data file states it:** one pass over every `AccountRoot`
object in a single validated ledger. Balances stream into a log-spaced
histogram at **2000 buckets per decade**, which bounds any threshold read off
it at **0.1152%** relative error — a figure the page prints rather than hides.
No explorer rich list and no third-party dataset is involved.

**Why one ledger:** the XRPL closes a new version every three to five seconds.
The walk is pinned to one index so the snapshot describes a state that actually
existed, rather than mixing accounts read seconds apart.

**Current snapshot:**

| | |
|---|---|
| `source` | `xrpl-ledger-walk` |
| `ledgerIndex` | 105,990,370 |
| `ledgerCloseIso` | 2026-08-01T03:57:01Z |
| `generatedAt` | 2026-08-01T04:38:56Z |
| funded accounts | 8,032,344 |
| XRP held | 99,985,544,874 |
| ranked accounts kept | 100 |
| tiers / bands / ladder points | 6 / 9 / 628 |
| XRP/USD | 1.064714, from the Flare FTSOv2 oracle |

The dollar column is priced from the **same oracle the XRP yield report uses**,
so the two pages cannot disagree about what an XRP was worth.

---

## 7. The label registry

Naming an account is the only thing this table does that an explorer does not,
and it is the highest-risk claim on the page: the XRP community checks these,
a wrong attribution is found within the hour, and the cost lands on a page
whose entire pitch is that its numbers are verifiable.

So a label is not a string in a map. It is a claim with a stated evidence
tier, and the build refuses to ship one that cannot say where it came from.
Four tiers, strongest first: `account-domain` (self-declared onchain,
re-verified against the ledger every run), `xrpl-toml`, `published`,
`third-party`.

**Explicitly not a tier: inference from transaction behaviour.** Clustering
heuristics are how wrong labels get made; the validator rejects the tier name
outright so nobody can add one quietly.

**Registry as it stands: 56 labels.**

| | |
|---|---|
| Evidence | `third-party` ×56 |
| Type | exchange 25, company 18, individual 12, protocol 1 |
| Affiliation | ripple 18, ripple-founder 12, none 26 |
| Rendered in the current top 100 | 49 |
| Publishing a domain onchain | **0** |

**This is the weakest the registry is allowed to be.** Every label sits in the
lowest tier, and the page says so in prose rather than presenting the names as
its own finding. Moving even the exchange labels to `xrpl-toml` would be the
single largest credibility upgrade available here.

---
## 8. Machine-readable surface

Four files, CC-BY-4.0, all declared in the `Dataset` node:

| File | Bytes | Contents |
|---|---|---|
| `public/data/xrp-rich-list/index.json` | 85,740 | whole snapshot in one fetch |
| `public/data/xrp-rich-list/top-accounts.csv` | 8,124 | the ranked accounts |
| `public/data/xrp-rich-list/thresholds.csv` | 506 | percentage tiers |
| `public/data/xrp-rich-list/distribution.csv` | 667 | balance bands |

Attribution string carried inside `index.json`: *"Harvest Research,
https://harvest.finance/xrp-rich-list. Read from the XRP Ledger."*

Until PR #88 the `Dataset` node declared only two of the four; the thresholds
and the ranked accounts were downloadable and undeclared.

---

## 9. Build gates

Four gates run on every build. All four are green on this branch.

| Gate | What it enforces here |
|---|---|
| `check-xrpl-labels` | base58check on every address, evidence tier present and valid, `third-party` must name the provider, `account-domain` re-verified against the ledger |
| `check-banned-words` | house vocabulary, em dashes |
| `check-consistency` | null leaks, scope signals, cross-surface agreement |
| `check-atomicity` | the v3 quotability spec |

`/xrp-rich-list` is one of two **enforced** pages under the atomicity gate —
findings fail the build rather than print. The rules it enforces on this page:

| Rule | Catches |
|---|---|
| 1 | a figure in a sentence with no date attached |
| 2 | orphan openers ("This means…") |
| 3 | temporal deixis (`today`, `currently`) beside a figure |
| 5 | orphaned stat cards with no prose twin |
| 7 | entity density cap |
| 11 | `on-chain` in body prose (house rule: `onchain`) |
| 13 | bullet fragments — an `<li>` with no finite verb is a table row |
| 14 | bullet density over 40% of body words |

**The gate has caught real defects, not just style.** During the SEO work it
rejected a sentence in the new whale FAQ reading "Above them, 519 accounts held
10,000,000 XRP or more on the same date." — "the same date" is context a
sentence loses the moment an answer engine lifts it, which is the entire point
of rule 1. It now carries the date itself.

---

## 10. Verification performed

Not asserted — measured, in a real browser (Chromium, Playwright) and by
parsing the built HTML.

**Layout, at 360 / 390 / 414 px and at 1440 px:**

| | |
|---|---|
| Horizontal overflow, page | 0 px at 390 and above |
| Ranking row heights on a phone | 84 px, spread **0** |
| Ranking gutters | 17 / 17 px |
| Band + threshold cell insets | 18 / 18 px |
| Breakdown rows | 46 px, all four |
| Tables scrolling sideways | 0 |
| Jump-nav link colour, light **and** dark scheme | `rgb(25,23,23)` |

**Head and schema:** every tag in §2 and every graph in §3 was parsed out of
`public/xrp-rich-list.html`.

**Content:** a full in-order DOM walk of the built page reconciles against the
HTML element-by-element — h1 1/1, h2 14/14, h3 1/1, p 66/66, dt 20/20, dd
20/20, summary 11/11, caption 2/2, th 25/25, td 60/60, 100 ranking rows, 4
tables. The rendered copy is attached separately.

---

## 11. Known defects

**1. The `rank` field in the shipped snapshot is corrupt. Live on `main` now.**

```
rows 100 · duplicate ranks 16 · descending-order breaks 14
first nine ranks: 1, 1, 2, 3, 4, 5, 6, 8, 7
```

The array is correctly sorted by balance; only the `rank` values are scrambled,
which is what makes it easy to miss. Cause: a checkpoint stored
`topAccounts()`, which stamps a positional rank onto every entry; a resumed run
restored those entries with the rank from the *partial* walk still attached,
and `{ rank: i + 1, ...a }` let the spread put the stale value back over the
fresh one. The hourly job runs a plain pass then a `--resume` pass, so this
fires whenever the first pass does not finish.

Fixed in **PR #85**, not yet merged. The `ItemList` schema on this branch
sidesteps it by using the array index for `position`.

**2. The ledger walk is fragile against public nodes.** A full walk needs ~13
minutes of consistent access to one ledger's state tree. `xrpl.ws` advertises
`complete_ledgers` up to the validated tip and then answers `lgrNotFound` for
that same tip. PR #85 pins walks 50 ledgers back and retries harder, which
moved the failure point from one minute in to eight, but four consecutive
attempts still failed and the last died on `markerDoesNotExist` — a marker
expires with the ledger's state tree and no retry recovers it. **The real fix
is a provider with a stable state window.** That is a spend decision.

**3. Every label is `third-party`.** See §7.

**4. 10 px of horizontal overflow at 360 px.** It is the site header's theme
toggle, identical on `/usdc` and `/about`, so it belongs to the shell rather
than to this page.

**5. The ranking shows 100 rows and pages at 100.** The pager is built and
tested against a real 500-row snapshot but has never shipped one, because of
defect 2. The page reads its depth from the data, so the pager appears on its
own once a deeper walk lands.

---

## 12. Open pull requests against this page

| PR | Scope | State |
|---|---|---|
| **#85** | ledger walk: rank corruption, `lgrNotFound` aborts (`scripts/` only) | open |
| **#87** | mobile table edges and row heights, grey jump nav (`rich-list.css` only) | open |
| **#88** | this branch: OG card, ItemList + WebPage schema, orphan fix | open |

They touch disjoint files and can merge in any order. **#85 is the urgent one**
— it is the only one fixing data that is currently wrong in production.

---

## 13. Questions for the auditor

1. **Is `ItemList` of 100 wallet addresses the right call?** It matches query
   intent exactly ("xrp rich list" wants a ranked list) and every entry is
   visible page content, so it is not thin-content markup. But it is 100
   `ListItem` nodes on a page already carrying seven other graphs. Worth
   capping?
2. **`article` vs `Dataset` as the primary type.** The page is now
   `og:type: article` with `WebPage` + `Dataset` + `ItemList`. Is a page that
   is fundamentally a data table better served declaring itself an article?
3. **`data-nosnippet` on the ranking.** It keeps snippets on the answer-first
   prose, but it also hides the page's single most distinctive asset from the
   SERP. Correct trade?
4. **The label registry sits entirely in the weakest evidence tier.** Is
   shipping 49 `third-party` names, disclosed as such, better than shipping
   none until they can be upgraded to `xrpl-toml`?
5. **The concentration cohort is pinned at 100** while the ranking can page
   deeper. When a 500-row snapshot lands, should "what the largest 100 accounts
   hold" stay at 100, or follow the table?

---

## Appendix A — structured data, verbatim

Organization and WebSite (site shell) omitted. `ItemList` and `FAQPage` truncated where noted.

#### `BreadcrumbList`

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://harvest.finance"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "XRP Rich List"
    }
  ]
}
```

#### `FAQPage`

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Is there an XRP rich list?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. The XRP Ledger is public, so every account balance can be read directly from it. This page reads all 8,032,344 fund …"
      }
    },
    {
      "@type": "Question",
      "name": "How many XRP do you need to be in the top 1%?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "A balance of 44,926 XRP put an account in the top 1% of funded XRP Ledger accounts as of August 1, 2026. That tier held  …"
      }
    },
    {
      "@type": "Question",
      "name": "How many XRP holders have 10,000 or more?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "338,642 funded XRP Ledger accounts held at least 10,000 XRP as of August 1, 2026, out of 8,032,344 funded accounts in to …"
      }
    },
    {
      "@type": "Question",
      "name": "How many people own 20,000 XRP?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "183,551 funded XRP Ledger accounts held at least 20,000 XRP as of August 1, 2026. Accounts are not people: one person ca …"
      }
    },
    {
      "@type": "Question",
      "name": "How many XRP Ledger accounts are there?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "8,032,344 accounts were funded on the XRP Ledger as of August 1, 2026. An account cannot exist on the ledger without mee …"
      }
    },
    {
      "@type": "Question",
      "name": "Who owns the most XRP?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The largest single XRP Ledger account held 5.00bn XRP as of August 1, 2026, which is 5.0% of the XRP in funded accounts. …"
      }
    },
    {
      "@type": "Question",
      "name": "Is XRP ownership concentrated?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The top 1% of funded XRP Ledger accounts held 92% of the XRP in those accounts as of August 1, 2026. The top 50% held ov …"
      }
    },
    {
      "@type": "Question",
      "name": "How is the XRP rich list calculated?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Every AccountRoot object in one validated XRP Ledger is read over public JSON-RPC, and the balances are aggregated as th …"
      }
    },
    {
      "@type": "Question",
      "name": "Does holding more XRP change what a balance can do onchain?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "A larger balance does not change the rules of the ledger, and the XRP Ledger has no native staking and pays no protocol  …"
      }
    },
    {
      "@type": "Question",
      "name": "What counts as an XRP whale?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "There is no official threshold, so the honest answer is a distribution rather than a number. 2,041 of the 8,032,344 fund …"
      }
    },
    {
      "@type": "Question",
      "name": "Can I see my own wallet's rank?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Enter a balance in the calculator on this page and it returns the position that balance holds among all 8,032,344 funded …"
      }
    }
  ]
}
```

#### `Dataset`

```json
{
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": "XRP Ledger holder distribution dataset",
  "description": "Balance distribution across all 8,032,344 funded XRP Ledger accounts, with tier thresholds, decade bands and the largest 100 accounts, read from ledger 105,990,370.",
  "url": "https://harvest.finance/xrp-rich-list",
  "creator": {
    "@type": "Organization",
    "name": "Harvest",
    "url": "https://harvest.finance"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Harvest",
    "url": "https://harvest.finance"
  },
  "dateModified": "2026-08-01T03:57:01.000Z",
  "isBasedOn": [
    "https://xrpl.org"
  ],
  "size": "8032344 venues",
  "keywords": [
    "XRP",
    "XRPL",
    "rich list",
    "holder distribution",
    "wallet balances"
  ],
  "isAccessibleForFree": true,
  "license": "https://creativecommons.org/licenses/by/4.0/",
  "distribution": [
    {
      "@type": "DataDownload",
      "encodingFormat": "application/json",
      "contentUrl": "https://harvest.finance/data/xrp-rich-list/index.json"
    },
    {
      "@type": "DataDownload",
      "encodingFormat": "text/csv",
      "contentUrl": "https://harvest.finance/data/xrp-rich-list/distribution.csv"
    },
    {
      "@type": "DataDownload",
      "encodingFormat": "text/csv",
      "contentUrl": "https://harvest.finance/data/xrp-rich-list/thresholds.csv"
    },
    {
      "@type": "DataDownload",
      "encodingFormat": "text/csv",
      "contentUrl": "https://harvest.finance/data/xrp-rich-list/top-accounts.csv"
    }
  ]
}
```

#### `WebApplication`

```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "XRP rich list calculator",
  "url": "https://harvest.finance/xrp-rich-list#calculator",
  "applicationCategory": "FinanceApplication",
  "operatingSystem": "Any",
  "browserRequirements": "Requires JavaScript for the balance lookup",
  "description": "Enter an XRP balance and see its percentile against every funded XRP Ledger account. No wallet connection and no address.",
  "isAccessibleForFree": true,
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "author": {
    "@type": "Organization",
    "name": "Harvest Research",
    "url": "https://harvest.finance/about"
  }
}
```

#### `WebPage`

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "XRP Rich List",
  "url": "https://harvest.finance/xrp-rich-list",
  "description": "Live XRP rich list calculator and holder distribution. See the top 1%, 10% and 25% thresholds and find where your balance ranks, read from the XRP Ledger.",
  "dateModified": "2026-08-01T03:57:01.000Z",
  "isBasedOn": "https://harvest.finance/methodology",
  "publisher": {
    "@type": "Organization",
    "name": "Harvest",
    "url": "https://harvest.finance"
  }
}
```

#### `ItemList`

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Largest XRP Ledger accounts as of August 1, 2026",
  "description": "The 100 XRP Ledger accounts holding the most XRP, spendable and escrowed together, read from ledger 105,990,370.",
  "url": "https://harvest.finance/xrp-rich-list#top-accounts",
  "itemListOrder": "https://schema.org/ItemListOrderDescending",
  "numberOfItems": 100,
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Ripple"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Ripple"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Ripple"
    },
    "… 97 more, one per ranked account"
  ]
}
```


---

## Appendix B — full rendered copy

Complete in-order extraction of the built page: every heading, paragraph, list, table row and FAQ answer, in document order. Nothing below is added by the extractor.

---

# XRP Rich List & Calculator

Updated August 1, 2026 at 03:57 UTC

## Summary

- The largest holding attributed to an individual rather than to a company or a trading venue was 500,000,001 XRP as of August 1, 2026, worth about $532,357,001 at 1.0647 US dollars per XRP on that date.
- 8,032,344 XRP addresses were funded on the XRP Ledger as of August 1, 2026, controlling 99.99bn XRP between them.
- To sit in the top 1% of XRP holders an account needed at least 44,926 XRP as of August 1, 2026.

## The XRP Rich List Calculator

Enter your XRP balance to see where you rank on the rich list.

Free to use

No address or wallet needed.

Measured against over 8M XRP accounts

Checked against all 8,032,344 funded XRP accounts as of August 1, 2026.

## Enter XRP, then click “Start check” to run the calculator.

No wallet connection. No address. Just a number, and an approximation is fine. The calculation runs in your browser against XRP Ledger data and nothing you type is sent anywhere.

Your position on the rich list appears here once the check runs.

## On this page

_Largest accounts_

## Top 100 XRP wallets

The 100 largest funded XRP Ledger accounts as of August 1, 2026, read from ledger 105,990,370 and ranked on the XRP each one controls.

| # | Account | XRP | In escrow | Value | Name | Share |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | rB3WNZc45gxzW31zxfXdkx8HusAhoqscPn | 5.00bn | 5.00bn | $5.32bn | Ripple | 5.00% |
| 1 | r9UUEXn3cx2seufBkDa8F86usfjWM6HiYp | 5.00bn | 5.00bn | $5.32bn | Ripple | 5.00% |
| 2 | rDdXiA3M4mYTQ4cFpWkVXfc2UaAXCFWeCK | 5.00bn | 5.00bn | $5.32bn | Ripple | 5.00% |
| 3 | rKwJaGmB5Hz24Qs2iyCaTdUuL1WsEXUWy5 | 5.00bn | 5.00bn | $5.32bn | Ripple | 5.00% |
| 4 | rKDvgGUsNPZxsgmoemfrgXPS2Not4co2op | 5.00bn | 5.00bn | $5.32bn | Ripple | 5.00% |
| 5 | rN8pqRwLYuuvY7pUHurybPC8P6rLqVsu6o | 5.00bn | 5.00bn | $5.32bn | Ripple | 5.00% |
| 6 | rPyCQm8E5j78PDbrfKF24fRC7qUAk1kDMZ | 1.84bn | — | $1.96bn | Bithumb | 1.84% |
| 8 | rJ9Ey7HbscSECamgDRzvw5wrVbFUgaUDt7 | 1.80bn | — | $1.92bn | Unnamed | 1.80% |
| 7 | rs8ZPbYqgecRcDzQpJYAMhSxSi5htsjnza | 1.67bn | — | $1.78bn | Binance | 1.67% |
| 10 | r9NpyVfLfUG8hatuCCHKzosyDtKnBdsEN3 | 1.50bn | 1.00bn | $1.60bn | Ripple | 1.50% |
| 8 | rMhkqz3DeU7GUUJKGZofusbrTwZe6bDyb1 | 1.50bn | 1.00bn | $1.60bn | Ripple | 1.50% |
| 9 | rsXT3AQqhHDusFs3nQQuwcA1yXRLZJAXKw | 1.48bn | — | $1.57bn | Uphold | 1.48% |
| 10 | rDxJNbV23mu9xsWoQHoBqZQvc77YcbJXwb | 1.42bn | — | $1.51bn | UPbit | 1.42% |
| 11 | rMQ98K56yXJbDGv49ZSmW51sLn94Xe1mu1 | 1.33bn | — | $1.42bn | Ripple | 1.33% |
| 12 | rKveEyR1SrkWbJX214xcfH43ZsoGMb3PEv | 816.4M | — | $869M | Ripple | 0.82% |
| 13 | rw7m3CtVHwGSdhFjV4MyJozmZJv3DYQnsA | 577.3M | — | $615M | bitbank | 0.58% |
| 17 | r99QSej32nAcjQAri65vE5ZXjw6xpUQ2Eh | 555.2M | — | $591M | Coincheck | 0.56% |
| 14 | rfL1mn4VTCoHdhHhHMwqpShCFUaDBRk6Z5 | 500.0M | — | $532M | UPbit | 0.50% |
| 19 | rwa7YXssGVAL9yPKw6QJtCen2UqZbRQqpM | 500.0M | — | $532M | UPbit | 0.50% |
| 15 | rNcAdhSLXBrJ3aZUq22HaNtNEPpB5fR8Ri | 500.0M | — | $532M | UPbit | 0.50% |
| 16 | r4G689g4KePYLKkyyumM1iUppTP4nhZwVC | 500.0M | — | $532M | UPbit | 0.50% |
| 17 | rLgn612WAgRoZ285YmsQ4t7kb8Ui3csdoU | 500.0M | — | $532M | UPbit | 0.50% |
| 18 | rs48xReB6gjKtTnTfii93iwUhjhTJsW78B | 500.0M | — | $532M | UPbit | 0.50% |
| 19 | rJWbw1u3oDDRcYLFqiWFjhGWRKVcBAWdgp | 500.0M | — | $532M | UPbit | 0.50% |
| 20 | rMNUAfSz2spLEbaBwPnGtxTzZCajJifnzH | 500.0M | — | $532M | UPbit | 0.50% |
| 21 | r38a3PtqW3M7LRESgaR4dyHjg3AxAmiZCt | 500.0M | — | $532M | UPbit | 0.50% |
| 27 | rJo4m69u9Wd1F8fN2RbgAsJEF6a4hW1nSi | 500.0M | — | $532M | UPbit | 0.50% |
| 22 | rDfrrrBJZshSQDvfT2kmL9oUBdish52unH | 500.0M | — | $532M | chrislarsen | 0.50% |
| 23 | rD6tdgGHG7hwGTA6P39aE7W89fbqxXRjzk | 500.0M | — | $532M | chrislarsen | 0.50% |
| 24 | r476293LUcDqtjiSGJ5Dh44J1xBCDWeX3 | 500.0M | — | $532M | chrislarsen | 0.50% |
| 25 | rEvwSpejhGTbdAXbxRTpGAzPBQkBRZxN5s | 479.9M | — | $511M | eToro | 0.48% |
| 26 | rwshjBngGqMRJgGYvEJXGMkg5DS2GX3U3q | 470.2M | — | $501M | Unnamed | 0.47% |
| 27 | r44CNwMWyJf4MEA1eHVMLPTkZ1LSv4Bzrv | 450.0M | — | $479M | chrislarsen | 0.45% |
| 34 | r4jcgkWV5o9smpoUuSwSc7JBWAC7bke4GB | 443.1M | — | $472M | Unnamed | 0.44% |
| 35 | rH5wodHpZzeXBAWE36nMoRXGqeEjSdbzWU | 406.0M | — | $432M | Unnamed | 0.41% |
| 28 | rpPcmcGQ5iTXDc5zF5owxwTifkTs1qYrA6 | 384.8M | — | $410M | Unnamed | 0.38% |
| 29 | rB1kVfLSxpXCw7sLCBcm5LFZYzkS6xmwSK | 335.7M | — | $357M | Unnamed | 0.34% |
| 38 | rE5LDXksLZHsRgGUgqu7NiTSDd5zFz7rsW | 333.9M | — | $356M | Unnamed | 0.33% |
| 30 | rKNwXQh9GMjaU8uTqKLECsqyib47g5dMvo | 331.0M | — | $352M | Crypto.com | 0.33% |
| 40 | rJpj1Mv21gJzsbsVnkp1U4nqchZbmZ9pM5 | 325.8M | — | $347M | Binance (XRP-BF2 Reserve) | 0.33% |
| 41 | rN3t4Epm69GXM1Bx42Ne1opfai7eUvmopY | 317.2M | — | $338M | Unnamed | 0.32% |
| 31 | rPoJNiCk7XSFLR28nH2hAbkYqjtMC3hK2k | 300.2M | — | $320M | chrislarsen | 0.30% |
| 32 | rNASJdZjY9dToHnNURi3HAUku3duPwbtD1 | 300.0M | 300.0M | $319M | Ripple | 0.30% |
| 33 | rDKw32dPXHfoeGoD3kVtm76ia1WbxYtU7D | 298.8M | — | $318M | Coinone | 0.30% |
| 34 | rhREXVHV938ToGkdJQ9NCYEY4x8kSEtjna | 282.5M | — | $301M | chrislarsen | 0.28% |
| 35 | rBntsdo3fAS5sb3pqe7LvvxTS8qngFYAe1 | 250.8M | — | $267M | Unnamed | 0.25% |
| 36 | rstryhbE73v18SnJ3R8j1FSNYFWCSdELEd | 242.5M | — | $258M | Unnamed | 0.24% |
| 37 | rfCKgAfaY2GaRFyCrwoF6BAhsEyLuWp37N | 237.0M | — | $252M | Unnamed | 0.24% |
| 38 | rN1yT2hkfMt89CJVsXdvnKqRJbqm7TC8uo | 225.1M | — | $240M | Unnamed | 0.23% |
| 39 | rprAu33H7PLUc24EYiMcD3HKcZG18PFkzQ | 212.1M | — | $226M | Unnamed | 0.21% |
| 40 | ragKXjY7cBTXUus32sYHZVfkY46Nt2Q829 | 200.0M | — | $213M | ahbritto | 0.20% |
| 41 | rG2eEaeiJou6cVQ3KtX7XMNwGhuW99xmHP | 200.0M | — | $213M | ahbritto | 0.20% |
| 42 | rsF9cc6gniHLTR2Jng29ng21ez7L9PpmPt | 200.0M | — | $213M | ahbritto | 0.20% |
| 43 | rJ5EJYsW6Vkeruj1LAmQYq3VP7QUQKBH1W | 200.0M | — | $213M | ahbritto | 0.20% |
| 44 | rsXNUCJkXeyFuGHyfRnuWPita2ns32upBD | 200.0M | — | $213M | ahbritto | 0.20% |
| 45 | rQKZSMgmBJvv3FvWj1vuGjUXnegTqJc25z | 200.0M | — | $213M | ahbritto | 0.20% |
| 57 | rhtufNsYfrozs4GvSq4HMYcR9y3dg8FWdC | 195.0M | — | $208M | Ripple | 0.20% |
| 46 | rhWVCsCXrkwTeLBg6DyDr7abDaHz3zAKmn | 191.5M | — | $204M | bitFlyer | 0.19% |
| 47 | rP8GfS4Ku43STM9kHEoKeWVvhV1E525zfo | 180.1M | — | $192M | Unnamed | 0.18% |
| 60 | rN4GiawFXbgMNtW12mVH4p7CWQDzXsRB5k | 178.5M | — | $190M | Unnamed | 0.18% |
| 48 | rpLru1mHkBEgmE6zw2gXP2HcSyHg3hCt69 | 174.9M | — | $186M | Unnamed | 0.17% |
| 49 | rEq4b7nbL2ep44Fgk9bPwpynGRjyESpf5B | 169.6M | — | $181M | Unnamed | 0.17% |
| 63 | rHJgQ4Cbg7vACGVuGusaKfmr2nheCRefBS | 164.1M | — | $175M | Unnamed | 0.16% |
| 50 | rHjxBjzGcZKkPUwqrgaPYrk53PtLTXp23K | 160.0M | — | $170M | Unnamed | 0.16% |
| 51 | rH4nomQDy64MG5QGJngNS9cgGCdTFrGqLE | 160.0M | — | $170M | Unnamed | 0.16% |
| 52 | r4AUYDBeV8YaLDZwuXG28CQgZ8XrThy8F2 | 155.3M | — | $165M | Unnamed | 0.16% |
| 67 | rP3mUZyCDzZkTSd1VHoBbFt8HGm8fyq8qV | 151.6M | — | $161M | Binance | 0.15% |
| 53 | rDzukHGHcJRH5CqUBfo18p8ySGaciD2cyz | 150.5M | — | $160M | Unnamed | 0.15% |
| 54 | rfkXSaCZKTg1EZzec2rLDyrWHxRVJdtVXj | 148.2M | 140.0M | $158M | Unnamed | 0.15% |
| 55 | rBWEYyxPZkDPgBZEj73vgxi8xrNY22pnM7 | 148.1M | — | $158M | Unnamed | 0.15% |
| 56 | raLybBkX8HMsFG4EJGnTsBiNhnJS1Lqwmn | 146.6M | — | $156M | Unnamed | 0.15% |
| 57 | rBEc94rUFfLfTDwwGN7rQGBHc883c2QHhx | 145.6M | — | $155M | Uphold | 0.15% |
| 58 | rGMiNvZB2kcoXHv81BFRvaAkrSsiy9bQ9j | 135.3M | — | $144M | Unnamed | 0.14% |
| 59 | rEbXa31msPbPDZgmLMKH7CaKaf7VipoLBo | 126.4M | — | $135M | Binance | 0.13% |
| 75 | rLUrobvcPHmbRVgzgGA6Vsp7Eu7yBQpEQe | 126.0M | — | $134M | Unnamed | 0.13% |
| 60 | rJEvHUWgE5eb3R3p8cSaFHqh8Q2mUZqzsp | 124.1M | — | $132M | Unnamed | 0.12% |
| 61 | rMWqYat3nJXSLoyqB5tUsfYp6KLgoMHXTN | 120.3M | — | $128M | Unnamed | 0.12% |
| 62 | rMXWrmn3FpmA65UPyzDTez4Jt29NeqkKes | 119.1M | — | $127M | Unnamed | 0.12% |
| 63 | rGzwBVxutLLaxfeE4mJWrxHX1SMRxjo7Am | 109.6M | — | $117M | Unnamed | 0.11% |
| 64 | rLwSuYoPbDU3Y58tfXbuqFTq6Fmsx4f3KZ | 107.8M | — | $115M | Unnamed | 0.11% |
| 65 | rG71mF18FKc6sWfCyfYiPHax1GwBNfqGFQ | 106.4M | — | $113M | Unnamed | 0.11% |
| 66 | rsyDbFZwxUqXEzwknqzCvYxk2davoQCUDC | 106.4M | — | $113M | Unnamed | 0.11% |
| 67 | rE84wNj2fKZtiH3KCF77mZeUg5fypjPasw | 106.4M | — | $113M | Unnamed | 0.11% |
| 68 | rLGbi542GmWboteyBAdBaRj65wBLkmDis9 | 106.3M | — | $113M | Unnamed | 0.11% |
| 69 | rsnnbMctkVJiXdV6aPMRPeaEu2uAnq3rEK | 103.7M | — | $110M | Unnamed | 0.10% |
| 70 | rLjYpsikc5dPhGCt5f5FiUeKyCobX8eRSe | 103.0M | — | $110M | Unnamed | 0.10% |
| 87 | rH1dGoeLbKbf2HNv22Ryhx9ATf87M1hQKA | 102.7M | — | $109M | Unnamed | 0.10% |
| 71 | rwTTsHVUDF8Ub2nzV2oAeWxfJzUvobXLEf | 101.6M | — | $108M | Bitget Global | 0.10% |
| 72 | rQUwf3NHvHAahqgNqFuUs1gmk3zMUZ7U36 | 101.2M | — | $108M | Unnamed | 0.10% |
| 73 | rwv782tjrgjP9uJELdqjKGv4vimG3S2xPC | 100.0M | — | $106M | Unnamed | 0.10% |
| 74 | rMhxHiUJ8ZRwHo33ewFxenXbbLpJKUWTZu | 100.0M | — | $106M | Unnamed | 0.10% |
| 75 | rJG9bM9BDUUJUUb7oiB57JzNPs6KpiqYBz | 100.0M | — | $106M | Unnamed | 0.10% |
| 76 | rHUmXWK8qFi9YXHvDsHAqCTGBrAZZy4AcQ | 100.0M | — | $106M | Unnamed | 0.10% |
| 77 | rhZ3WttpasyespM1MLPwJ5SZ846btucomJ | 100.0M | — | $106M | Unnamed | 0.10% |
| 78 | rEbKBkgKSQgm5x8PycZc5VjdCVTmqYfcY1 | 100.0M | — | $106M | Unnamed | 0.10% |
| 79 | rH4P2rGgpMnAGz7Ci98aBrwAyEAidcVrzx | 99.8M | — | $106M | Unnamed | 0.10% |
| 80 | r3J6NonjpTE3ZNVhuP9TWAmATCWU6Z4Zc | 99.1M | — | $106M | Unnamed | 0.10% |
| 81 | r9VAmxasm7sgmkkKWSDuZzjh6ZUPCF8JnX | 99.1M | — | $105M | Unnamed | 0.10% |
| 82 | rQLrus89AvwQWBVWbCL1KAKc49qBEyUnLJ | 98.7M | — | $105M | Unnamed | 0.10% |
| 83 | rUTk3earuCTw24JqVrJjTd5aPK45wgt1ry | 98.5M | — | $105M | Unnamed | 0.10% |

Showing 100 of 100 accounts, holding 64.43bn XRP between them, or 64.44% of all XRP in funded accounts as of August 1, 2026.

49 of the 100 ranked accounts carry a name as of August 1, 2026. Not one of them publishes a domain onchain, which is the only identity an account can declare about itself.

Naming an account from how it transacts would be a guess, so this page names an account only against a source it can show.

An account is ranked on its spendable balance plus anything it holds in onchain escrow, which is why an account with a few hundred XRP spendable can sit near the top.

Dollar values use 1.0647 US dollars per XRP as of August 1, 2026, read from Flare FTSOv2 XRP/USD oracle. They move with the price and the XRP amounts beside them do not.

Share of supply is measured against all XRP in funded accounts as of August 1, 2026. The escrow column is the part of each balance locked onchain on that date rather than a figure on top of it.

Every name in the table is attributed by XRPSCAN rather than established by this page.

_Distribution_

## XRP rich list 2026: current thresholds

The minimum to sit in the top 1% of funded XRP Ledger accounts was 44,926 XRP as of August 1, 2026, against 2,150 XRP for the top 10% and 20 XRP for the top 50%.

A tier threshold is the smallest amount of XRP that placed an account in that percentage of all 8,032,344 funded accounts as of August 1, 2026. An account is measured on what it controls, which is its spendable balance plus anything it holds in onchain escrow.

**XRP rich list thresholds by percentage tier, as of August 1, 2026**

| Percentage tier | Minimum XRP controlled | Accounts at or above | That tier alone | Cumulative share of XRP |
| --- | --- | --- | --- | --- |
| Top 0.1% | 276,058 | 8,038 | 85% | 85% |
| Top 1% | 44,926 | 80,324 | 6.6% | 92% |
| Top 5% | 7,499 | 402,512 | 5.6% | 97% |
| Top 10% | 2,150 | 803,614 | 1.7% | 99.0% |
| Top 25% | 110.3 | 2,008,182 | 0.86% | 99.9% |
| Top 50% | 20 | 4,229,490 | 0.08% | over 99.9% |

Every tier contains the ones above it, so the cumulative column climbs down the table rather than summing to 100%: the top 1% row counts the top 0.1% inside it. The column beside it is what each tier adds on its own, and those do sum. Thresholds are read from a histogram of every account balance, which bounds each figure at 0.1152% as of August 1, 2026. Shares are measured against all XRP in funded accounts, escrowed and spendable together.

_Shape of the ledger_

## How XRP is spread across wallets

Most funded XRP Ledger accounts hold very little. 85% of them held under 1,000 XRP as of August 1, 2026.

Every bar below is one balance band, and its height and the number above it are how many accounts held an amount inside that band as of August 1, 2026. The smaller figure under each band is that band’s share of all funded accounts on the same date.

### Funded accounts by balance band

All 8,032,344 funded XRP Ledger accounts as of August 1, 2026

Bar heights use a square-root scale as of August 1, 2026, so a band holding a few hundred accounts stays visible beside one holding three million. Reading heights against each other therefore understates the gap between them; the printed counts are the exact figures.

_Band by band_

## Wallets and XRP held, by balance band

The largest band by account count and the largest by XRP held are not the same band, and the table below is where that separation is visible as of August 1, 2026.

Every one of the 8,032,344 funded accounts sits in exactly one band as of August 1, 2026. The last two columns are the XRP those accounts controlled and what share of all XRP that came to, on the same date.

**XRP Ledger distribution by amount controlled, as of August 1, 2026**

| Band (XRP) | Accounts | Percentage of accounts | XRP held | Percentage of XRP |
| --- | --- | --- | --- | --- |
| 0-1 | 9,712 | 0.12% | 7,473 | under 0.01% |
| 1-10 | 2,393,277 | 29.80% | 3,799,226 | under 0.01% |
| 10-100 | 3,518,227 | 43.80% | 82,525,311 | 0.08% |
| 100-1k | 935,765 | 11.65% | 343,281,814 | 0.34% |
| 1k-10k | 825,281 | 10.27% | 2,728,405,074 | 2.73% |
| 10k-100k | 307,704 | 3.83% | 8,039,879,957 | 8.04% |
| 100k-1M | 30,410 | 0.38% | 6,383,030,626 | 6.38% |
| 1M-10M | 1,522 | 0.02% | 3,851,005,278 | 3.85% |
| 10M+ | 519 | under 0.01% | 78,555,796,976 | 78.57% |

Bands are decade-wide and read as at least the lower bound and below the upper one. Amounts count escrowed XRP alongside spendable balances, measured as of August 1, 2026.

_Reading the numbers_

## What the XRP balance distribution shows

The top 1% of funded XRP Ledger accounts held 92% of the XRP controlled across funded accounts as of August 1, 2026. The top 50% held over 99.9% as of August 1, 2026, which leaves the smaller half of accounts holding the rest. Those shares count escrowed XRP alongside spendable balances, and 32.45bn XRP of the total was locked in escrow as of August 1, 2026.

Concentration at the top of this list is not the same as concentration of ownership. The largest accounts on the XRP Ledger are mostly exchange and custodian wallets, and a single one of them can hold balances for millions of customers, which is why this page names an account only against evidence it can show beside the name.

Most funded accounts hold very little. Accounts holding under 1,000 XRP made up 85% of all funded accounts as of August 1, 2026, and together they held 0.43% of the XRP in funded accounts. That shape is why most people who check a balance against this list place higher than they expect.

The top 10% threshold has moved from 2,150 XRP on July 31, 2026 to 2,150 XRP as of August 1, 2026. The top 1% threshold has moved from 44,926 XRP on July 31, 2026 to 44,926 XRP as of August 1, 2026.

_Comparison_

## How much XRP is working rather than sitting idle

8,032,344 accounts were funded on the XRP Ledger as of August 1, 2026. Across the wrapped and staked XRP products tracked in the XRP yield ranking, 14,227 addresses held a position as of July 30, 2026, a figure equal to 0.18% of that XRPL account count.

The two figures count different objects and the comparison is a ratio rather than a share. An XRP Ledger account is an entry in the ledger’s own state. A tracked position is an address on Flare or Base holding a receipt token for wrapped or staked XRP, counted once per product, so a person holding two products appears twice. Both readings push the same way: the number of XRP holders with a balance doing anything at all is small next to the number of accounts that simply hold.

The XRP Ledger pays no protocol reward for holding a balance, and it has no validator staking, so a balance that sits on the ledger earns nothing by design rather than by neglect. The XRP yield ranking tracks where XRP-denominated rates actually come from.

_Concentration_

## What the largest 100 accounts hold

The 100 largest XRP Ledger accounts controlled 64.44% of all XRP as of August 1, 2026, and 49.75% once known exchange wallets are set aside.

An exchange wallet is thousands of customer balances pooled into one account, so counting it as concentration reads the ledger wrong. The second figure is the closer answer to how few hands hold XRP, and it is still only as complete as the 49 accounts named in this list as of August 1, 2026.

The headline share is also mostly one entity. Ripple itself controlled 12 of these accounts as of August 1, 2026, holding 35.65% of all XRP in funded accounts on that date, which is more than half of everything the top 100 held. Most of it cannot move: 32.30bn XRP of that position sat in onchain escrow as of August 1, 2026, released against a published schedule rather than sitting as a spendable balance.

| Group | Accounts | XRP | Share of all XRP |
| --- | --- | --- | --- |
| Ripple-controlled | 12 | 35.64bn | 35.65% |
| Known exchanges | 25 | 14.69bn | 14.69% |
| Ripple founders | 12 | 3.73bn | 3.73% |
| Unnamed accounts | 51 | 10.37bn | 10.37% |

Set every named group aside and 51 accounts are left, holding 10.37% of all XRP as of August 1, 2026. Those are the positions this page cannot attribute to anyone as of that date, and they are the part of the ranking where a reader learns something a headline share does not tell them. Each group can be filtered out of the ranking above, so the remainder reads on its own.

One more distinction worth keeping. The 12 founder accounts are personal balances attributed to people who co-founded Ripple, holding 3.73% of all XRP as of August 1, 2026. They are counted apart from the company because the company does not control them, and a total that merges the two overstates what Ripple holds by that margin.

The largest holding attributed to a person rather than to a company or a trading venue was 500,000,001 XRP, worth about $532,357,001 at 1.0647 US dollars per XRP as of August 1, 2026, at rank 22 in the list above. That account is attributed to chrislarsen by XRPSCAN rather than by this page.

Shares are of all XRP in funded accounts, spendable and escrowed together. An exchange wallet holds balances for many customers, so excluding those is the closer read on how concentrated ownership is.

_Earning on XRP_

## XRP yield sources: where people earn on XRP

Holding XRP on the XRP Ledger pays nothing, so every rate on XRP-denominated capital is earned somewhere else. 14,227 addresses were already holding a wrapped or staked XRP product onchain as of July 30, 2026, across 14 products on Flare and Base. These are the four places that rate comes from.

- Lending marketsWrapped XRP supplied as collateral, earning what borrowers pay. The rate moves with utilisation.
- VaultsA strategy holds the position and compounds it. The rate is realised price-per-share growth rather than a quoted number.
- Liquidity venuesXRP paired against another asset, earning trading fees plus any incentive the venue pays on top.
- Fixed-rate productsA rate locked to a maturity date, priced by the market rather than floating with demand.

**Deposits**

$3.4M

**Asset**

stXRP

**Holders**

156

**Deposits**

$22.1M

**Asset**

FXRP

**Holders**

1,836

**Deposits**

$35.6M

**Asset**

FXRP

**Holders**

9,113

**Deposits**

$5.5M

**Asset**

stXRP / FXRP

**Holders**

142

The largest XRP fixed-rate Harvest tracks was stXRP on Spectra, paying 5.39% on $3.4M of deposits held by 156 wallets as of August 1, 2026. The largest XRP lending market Harvest tracks was FXRP on Kinetic, paying 1.01% on $22.1M of deposits held by 1,836 wallets as of August 1, 2026. The largest XRP vault Harvest tracks was FXRP on Upshift, paying 0.91% on $35.6M of deposits held by 9,113 wallets as of August 1, 2026. The largest XRP liquidity pool Harvest tracks was stXRP / FXRP on SparkDEX, paying 0.02% on $5.5M of deposits held by 142 wallets as of August 1, 2026.

No venue in Harvest’s XRP yield ranking pays a native XRP staking rate, because the XRP Ledger does not offer one. Every rate in that ranking is read from the venue’s own contracts rather than from an aggregator.

_Questions_

## XRP rich list questions

What people ask about XRP holder counts and thresholds, answered from the August 1, 2026 ledger snapshot behind this page.

**Q. Is there an XRP rich list?**

Yes. The XRP Ledger is public, so every account balance can be read directly from it. This page reads all 8,032,344 funded accounts from ledger 105,990,370, closed August 1, 2026 at 03:57 UTC, and ranks them.

**Q. How many XRP do you need to be in the top 1%?**

A balance of 44,926 XRP put an account in the top 1% of funded XRP Ledger accounts as of August 1, 2026. That tier held 92% of all XRP in funded accounts as of August 1, 2026.

**Q. How many XRP holders have 10,000 or more?**

338,642 funded XRP Ledger accounts held at least 10,000 XRP as of August 1, 2026, out of 8,032,344 funded accounts in total.

**Q. How many people own 20,000 XRP?**

183,551 funded XRP Ledger accounts held at least 20,000 XRP as of August 1, 2026. Accounts are not people: one person can control several accounts, and one account can hold balances for many people.

**Q. How many XRP Ledger accounts are there?**

8,032,344 accounts were funded on the XRP Ledger as of August 1, 2026. An account cannot exist on the ledger without meeting the base reserve, which validators lowered to 1 XRP in December 2024, so every account in that count holds a balance.

**Q. Who owns the most XRP?**

The largest single XRP Ledger account held 5.00bn XRP as of August 1, 2026, which is 5.0% of the XRP in funded accounts. Large accounts are usually exchange or custodian wallets holding balances for many customers rather than one owner, and this page names an account only against evidence it can show beside the name.

**Q. Is XRP ownership concentrated?**

The top 1% of funded XRP Ledger accounts held 92% of the XRP in those accounts as of August 1, 2026. The top 50% held over 99.9% as of August 1, 2026, which means the lower half of accounts together held the remainder.

**Q. How is the XRP rich list calculated?**

Every AccountRoot object in one validated XRP Ledger is read over public JSON-RPC, and the balances are aggregated as they stream. Ledger 105,990,370 was used for the figures on this page, closed August 1, 2026 at 03:57 UTC. Tier thresholds on the August 1, 2026 snapshot carry a resolution of 0.1152%, and the counts quoted at round balances are exact rather than interpolated.

**Q. Does holding more XRP change what a balance can do onchain?**

A larger balance does not change the rules of the ledger, and the XRP Ledger has no native staking and pays no protocol reward for holding. Rates on wrapped and staked XRP are tracked separately in the XRP yield ranking.

**Q. What counts as an XRP whale?**

There is no official threshold, so the honest answer is a distribution rather than a number. 2,041 of the 8,032,344 funded XRP Ledger accounts held 1,000,000 XRP or more as of August 1, 2026, which is 0.03% of them, and those accounts controlled 82% of all XRP on that date. Above them, 519 accounts held 10,000,000 XRP or more as of August 1, 2026. For a threshold that moves with the ledger rather than a round number, the top 1% of accounts started at 44,926 XRP as of August 1, 2026.

**Q. Can I see my own wallet's rank?**

Enter a balance in the calculator on this page and it returns the position that balance holds among all 8,032,344 funded accounts as of August 1, 2026. The page never asks for a wallet address, and the calculation runs in the browser rather than on a server.

_Method_

## How this XRP rich list is built

**Source**

Every AccountRoot object in one validated XRP Ledger, read over public JSON-RPC from XRP Ledger nodes. Ledger 105,990,370 closed August 1, 2026 at 03:57 UTC and is the single source for every figure on this page. No explorer rich list and no third-party dataset is used.

**Why one ledger**

The XRP Ledger closes a new version every three to five seconds. The walk is pinned to one ledger index so the snapshot describes a state that actually existed, rather than mixing accounts read seconds apart.

**What counts as a funded account**

Every AccountRoot in the ledger. An XRP Ledger account cannot exist without meeting the base reserve, which validators lowered to 1 XRP in December 2024, so the count of AccountRoot objects is the count of funded accounts.

**What each account is ranked on**

The XRP an account controls, which is its spendable balance plus anything it has locked in onchain escrow. The two are separate on the ledger: escrowed drops leave the account’s balance and sit in an Escrow object until their release date. Ranking on balance alone would put the six largest XRP positions on the network outside this list, since each of those accounts holds a few hundred XRP spendable against billions locked.

**How percentiles are computed**

Balances are aggregated into a log-spaced histogram as they stream, at 2,000 buckets per decade, which bounds the error on any tier threshold shown for August 1, 2026 at 0.1152%. Counts quoted at round balances as of August 1, 2026, such as the number of accounts holding at least 10,000 XRP, are counted exactly rather than read off the histogram.

**How the walk is checked**

Spendable balances and escrowed XRP are read at the same ledger index and summed against the ledger's own total supply. Every XRP that exists sits in an account or in an escrow, so a truncated walk shows up as a gap of billions.

**Labels**

An account is named only against evidence the page can show: a domain the account publishes onchain, an operator whose domain lists the address under the XRP Ledger’s own standard, an address the operator published officially, or an attribution by a named data provider. Which one applies is printed next to every name. Identity is never inferred from how an account transacts, and the build rejects a label that cannot state its source.

**Known limitations**

An account is not a person. Exchanges and custodians hold balances for many customers in a small number of accounts, and one person can control many accounts, so this distribution describes accounts rather than owners. Balances held off the XRP Ledger, including XRP wrapped onto other networks, are outside it.

Published by Harvest Research. Figures on this page are informational research, not financial advice.
