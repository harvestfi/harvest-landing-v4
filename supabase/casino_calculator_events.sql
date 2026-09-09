-- casino_calculator_events
-- Bonus calculator usage on /best-crypto-casino-bonus.
-- Events: 'view' when the calculator renders, 'calculate' on the button.
-- Anon inserts, authenticated reads. Run once in the Supabase SQL editor.

create table if not exists public.casino_calculator_events (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  session_id   text,
  event        text,              -- 'view' | 'calculate'
  venue        text,              -- casino slug, e.g. lucky-rollers
  source_page  text,              -- /best-crypto-casino-bonus
  source       text,              -- referrer-derived acquisition source
  country      text,
  city         text,
  device_type  text,
  os           text,
  browser      text,
  user_agent   text,
  is_bot       boolean
);

-- The panel reads one page's rows newest-first, so the filter and the sort
-- belong in the same index.
create index if not exists casino_calculator_events_page_created_at_idx
  on public.casino_calculator_events (source_page, created_at desc);

alter table public.casino_calculator_events enable row level security;

-- Anonymous visitors may INSERT only (no read/update/delete).
drop policy if exists "casino_calculator_events anon insert"
  on public.casino_calculator_events;
create policy "casino_calculator_events anon insert"
  on public.casino_calculator_events
  for insert
  to anon
  with check (true);

-- Authenticated Control Room sessions may read.
drop policy if exists "casino_calculator_events authenticated read"
  on public.casino_calculator_events;
create policy "casino_calculator_events authenticated read"
  on public.casino_calculator_events
  for select
  to authenticated
  using (true);
