-- report_outbound_clicks
--
-- Separate analytics channel for clicks leaving the /report pages for
-- third-party venues (Discover / Visit + "I understand"). Kept apart from
-- outbound_clicks (the into-app funnel) so the two never mix.
--
-- Security model mirrors the other analytics tables: the public site inserts
-- with the anon (publishable) key; the Control Room reads with an
-- authenticated session. Run this once in the Supabase SQL editor.

create table if not exists public.report_outbound_clicks (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  session_id   text,
  event        text,              -- 'open' | 'confirm'
  source_page  text,              -- e.g. /report/xrp-yield-ranking
  platform     text,              -- venue platform, e.g. SparkDEX
  product      text,              -- e.g. WFLR-FXRP
  chain        text,              -- e.g. Flare
  venue_ref    text,              -- e.g. ranking:sparkdex-v4 | venue:kinetic
  rank         integer,           -- 1-based ranking position of the clicked row (null for venue cards)
  target_url   text,
  source       text,              -- referrer-derived acquisition source
  country      text,
  city         text,
  device_type  text,
  os           text,
  browser      text,
  user_agent   text,
  is_bot       boolean
);

-- Backfill the rank column on projects where the table predates it (no-op on
-- a fresh create above).
alter table public.report_outbound_clicks
  add column if not exists rank integer;

create index if not exists report_outbound_clicks_created_at_idx
  on public.report_outbound_clicks (created_at desc);

alter table public.report_outbound_clicks enable row level security;

-- Anonymous visitors may INSERT only (no read/update/delete).
drop policy if exists "report_outbound_clicks anon insert"
  on public.report_outbound_clicks;
create policy "report_outbound_clicks anon insert"
  on public.report_outbound_clicks
  for insert
  to anon
  with check (true);

-- Authenticated Control Room sessions may read.
drop policy if exists "report_outbound_clicks authenticated read"
  on public.report_outbound_clicks;
create policy "report_outbound_clicks authenticated read"
  on public.report_outbound_clicks
  for select
  to authenticated
  using (true);
