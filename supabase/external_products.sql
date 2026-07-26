-- external_products / external_product_history
--
-- Backing store for standalone third-party product pages (/product/[slug]),
-- e.g. Aave v3 DAI on Polygon, Fluid USDC, Compound Blue USDT. Mirrors the
-- role Harvest's own indexer/subgraph plays for in-house vault pages, except
-- the data is external (Portals API, or a direct on-chain read where one
-- exists) and there is no equivalent of vaults.json committing a growing
-- history array to git -- that does not scale (see data/history.json at
-- 25MB for just 156 owned vaults). Time series lives here instead.
--
-- Which products exist is still curated in git (data/external-products.json,
-- an allowlist, not a scanner) so adding a product is a reviewable diff.
-- This table holds only what that curation cannot: live numbers.
--
-- Security model: the public site reads with the anon (publishable) key
-- (same as vault_events_prod's read side); only the sync cron
-- (scripts/sync-external-products.mjs), authenticated with the service role
-- key, writes. Run this once in the Supabase SQL editor.

create table if not exists public.external_products (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,      -- e.g. aave-v3-dai-polygon
  asset              text not null,             -- e.g. DAI
  platform           text not null,             -- e.g. Aave, Fluid, Compound, Compound Blue
  chain              text not null,             -- e.g. Polygon
  product_type       text,                      -- e.g. Lending market
  product_url        text not null,             -- the platform's own page
  vault_token_address text not null,            -- aToken / fToken / cToken / vault share address
  source_kind        text not null,             -- 'onchain' | 'portals'
  apy                double precision,
  apy_base           double precision,
  tvl_usd            double precision,
  rate_na            boolean not null default false,
  rate_basis         text,
  updated_at         timestamptz not null default now()
);

create index if not exists external_products_slug_idx
  on public.external_products (slug);

alter table public.external_products enable row level security;

drop policy if exists "external_products anon read"
  on public.external_products;
create policy "external_products anon read"
  on public.external_products
  for select
  to anon
  using (true);

-- No anon write policy: only the service-role sync script writes, which
-- bypasses RLS entirely, matching vault_events_prod's model.

-- ---------------------------------------------------------------------------

create table if not exists public.external_product_history (
  id           bigint generated always as identity primary key,
  product_slug text not null references public.external_products (slug) on delete cascade,
  d            date not null,               -- one row per UTC day, matches the /polygon history convention
  apy          double precision,
  tvl_usd      double precision,
  created_at   timestamptz not null default now(),
  unique (product_slug, d)
);

create index if not exists external_product_history_slug_date_idx
  on public.external_product_history (product_slug, d desc);

alter table public.external_product_history enable row level security;

drop policy if exists "external_product_history anon read"
  on public.external_product_history;
create policy "external_product_history anon read"
  on public.external_product_history
  for select
  to anon
  using (true);
