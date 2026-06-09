# Harvest yield index (frontend)

An independent, SEO-first index of DeFi yield strategies: per-strategy pages
with live APY / TVL / share-price history, asset and network hubs, and a
private analytics admin. Built with Next.js (App Router) and shipped as a
**fully static export** (`output: "export"`) — every public page is
pre-rendered at build time; there is no server runtime.

Production preview: https://harvest-flame.vercel.app
Target domain: https://harvest.finance

---

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in the two NEXT_PUBLIC_* values
npm run dev                        # http://localhost:3000
```

`npm run build` produces the static site and runs the content checks
(banned words / page-consistency). `npm run start` serves a production build.

## Environment variables

All are `NEXT_PUBLIC_*` (inlined into the client bundle) and public by
design — Row-Level Security on the Supabase tables is what actually controls
access, not secrecy of these values.

| Variable | Purpose | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project REST URL (analytics reads/writes) | yes for analytics |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key | yes for analytics |
| `NEXT_PUBLIC_SITE_URL` | Absolute base for `metadataBase` (OG / Twitter image URLs) | **at domain cutover** |

If the Supabase vars are unset the site still builds and renders; analytics
calls simply no-op.

## Domain cutover (harvest.finance) — read before pointing the domain here

Canonical links, `sitemap.xml`, `robots.txt`, and all JSON-LD already use
`https://harvest.finance` (hardcoded as `SITE_URL` in `src/lib/constants.ts`).

The **one thing to set** is the Open Graph base. `metadataBase` (which makes
`og:image` / `twitter:image` absolute) reads `OG_BASE_URL`, which defaults to
the Vercel staging domain so previews work today. At cutover:

> Set `NEXT_PUBLIC_SITE_URL=https://harvest.finance` in the production
> environment (Vercel → Settings → Environment Variables → Production).

Without it, social-share image URLs will still point at
`harvest-flame.vercel.app`. (Alternatively, flip the default in
`src/lib/constants.ts`.)

## Deployment

Static export, deploy-anywhere. On Vercel the framework preset builds and
serves the export. `vercel.json` sets `cleanUrls`, pins the OG image
content-types, and skips redundant non-`main` builds.

## Data refresh (GitHub Actions)

Public APY/TVL/holder data and on-chain events are refreshed by scheduled
workflows in `.github/workflows/` that commit to `main`, which triggers a
redeploy:

| Workflow | Cadence | Writes |
| --- | --- | --- |
| `Update Vault Data` | hourly | `data/*.json` (APY/TVL/holders) |
| `Index Vault Events` | every 15 min | `vault_events_prod` (Supabase) |

These require repository secrets: `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and optional `RPC_<CHAIN>` endpoint overrides.
The service-role key is used only inside CI, never shipped to the browser.

## Admin

`/admin/*` (Live Feed, SEO Summary, Acquisition, Products, etc.) is marked
`noindex` and disallowed in `robots.txt`. It reads visitor/session/wallet
analytics through the public anon key, so **access should be restricted at
the edge** (e.g. Vercel password protection or auth middleware) before the
domain goes live — `noindex` keeps it out of search but does not gate access.

## Content conventions

Enforced at build time by `scripts/check-banned-words.mjs` and
`scripts/check-page-consistency.mjs` (run automatically by `npm run build`):
no long em dash in user-facing copy, and comparison/ranking copy must signal
that the population is "what we track", not the whole market.

## Project layout

```
src/app/         routes (App Router); src/app/admin/* is the private panel
src/components/  page bodies and shared UI
src/lib/         data fetching, SEO/JSON-LD, formatting, channel + funnel logic
data/            build-time JSON snapshots (vaults, history) refreshed by CI
scripts/         data fetchers, indexers, content checks
```
