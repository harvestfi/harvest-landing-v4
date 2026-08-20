// Calculator tracking, kept as its own channel.
//
// TWO CALCULATORS, THREE SURFACES, ONE TABLE. This started as the tracker for
// the percentile calculator on /xrp-rich-list and now also carries the XRP
// staking calculator, which renders on /report/xrp-yield-ranking and again
// behind a switch on /xrp-rich-list. They are the same three events over the
// same columns, and every row already records `source_page`, so a second
// table would duplicate a schema to hold the same shape of interaction. Read
// the rows scoped by `source_page` and no surface is ever counted inside
// another; read them unscoped and a strong surface hides a weak one.
//
// On the staking calculator `tier` carries the selected product's venue slug
// rather than a percentile band. It is the same kind of value: a coarse label
// for which answer the visitor was shown, not anything about the visitor.
//
// A tool can override `source_page` when it is embedded somewhere other than
// its own page; see `sourcePage` below.
//
// The build spec asked for two numbers before launch: the calculator's
// completion rate, and the click-through from a result into the XRP yield
// report. The report gets few sessions and almost no onward clicks, so whether
// this page feeds it is the whole question of whether the page was worth
// building. Neither number existed until this file.
//
// A separate table rather than a column on an existing one. `outbound_clicks`
// is the visit -> app.harvest.finance funnel and `report_outbound_clicks` is
// the report -> third-party-venue funnel; a calculator interaction is neither,
// and folding it into either would move numbers an operator reads as
// acquisition.
//
// Three events, which is the smallest set that answers both questions:
//   - "start"   the visitor pressed the calculate button with an amount typed
//   - "result"  an answer was shown
//   - "cta"     the visitor clicked the box under the result
//
// start -> result is the completion rate. result -> cta is the click-through.
// Both are read per tool, because `source_page` tells the tools apart.
//
// WHAT IS DELIBERATELY NOT SENT: the balance. The visitor types a number that
// is nobody's business, the lookup runs entirely in the browser against a
// build-time ladder, and there is no version of this feature worth having that
// changes either of those. What lands is the percentile band the result fell
// into, which is coarse enough that it describes an audience rather than a
// person, and is the only shape of that answer an operator can act on anyway.
//
// SCHEMA. Create before deploying, or PostgREST rejects every insert and the
// events are silently lost.
//
// The policies are not optional. This project writes with the publishable key
// (the `anon` role, INSERT-only) and reads in the control room with a
// logged-in admin's JWT (`authenticated`) — see the note in lib/supabase.ts.
// Leaving RLS off would make every row world-readable with the key that ships
// in the page; enabling it without policies fails every insert, which looks
// exactly like no traffic. Both halves below.
//
//   create table public.richlist_calculator_events (
//     id           bigint generated always as identity primary key,
//     created_at   timestamptz not null default now(),
//     session_id   text,
//     event        text not null,
//     tier         text,
//     cta          text,
//     target_url   text,
//     source_page  text,
//     source       text,
//     country      text,
//     city         text,
//     device_type  text,
//     os           text,
//     browser      text,
//     user_agent   text,
//     is_bot       boolean
//   );
//
//   alter table public.richlist_calculator_events enable row level security;
//
//   create policy "anon inserts calculator events"
//     on public.richlist_calculator_events
//     for insert to anon with check (true);
//
//   create policy "authenticated reads calculator events"
//     on public.richlist_calculator_events
//     for select to authenticated using (true);
//
//   create index on public.richlist_calculator_events (created_at desc);
//   create index on public.richlist_calculator_events (event);
//
// Best-effort and consent-gated, exactly like the other two trackers: it never
// blocks the interaction, no-ops on /control-room, and no-ops until the table
// exists.

import { supabaseInsert } from "@/lib/supabase";
import {
  deriveSource,
  parseUserAgent,
  readCachedGeo,
  fetchGeo,
  getSessionId,
  getConsent,
} from "@/lib/analytics";

/**
 * Which onward click a "cta" event was.
 *
 * `top-accounts` is retired: it was the second button under a result, sending
 * the reader back up the same page to the table they had already scrolled
 * past, and it went when the two buttons became one box. The value stays in
 * the union because rows carrying it are already in the table and the control
 * room still has to name them.
 *
 * `earn-on-xrp` is the surviving one. The box that replaced the buttons points
 * at the same `#bridge` anchor the old button did, so it keeps the same value
 * and the click-through series does not restart.
 *
 * `see-ranking` belongs to the staking calculator on the XRP yield report: the
 * link from a result down to the ranking table. It is a different page and a
 * different destination, so it gets its own value rather than borrowing one.
 */
export type CalculatorCta = "top-accounts" | "earn-on-xrp" | "see-ranking";

export interface RichListCalculatorEvent {
  event: "start" | "result" | "cta";
  /**
   * What the answer was. A percentile band on the rich list calculator and
   * the selected product's venue slug on the staking calculator.
   */
  tier?: string | null;
  /** Which onward click. Only on "cta". */
  cta?: CalculatorCta | null;
  targetUrl?: string | null;
  /**
   * What to record as `source_page`, when the tool is not the page it sits on.
   *
   * The staking calculator also appears on /xrp-rich-list, behind a switch
   * above the rich list calculator. Left to default, its events would report
   * the rich list's path and land in the rich list's completion rate, which is
   * the one number that page exists to measure. It reports
   * "/xrp-rich-list#staking-calculator" instead: still the page it is on, but
   * distinguishable, and no new column to add to a live table.
   */
  sourcePage?: string;
}

/**
 * The percentile band a result gets recorded as.
 *
 * Bands, not the percentage, and certainly not the balance. "top 1%" describes
 * a segment of an audience; "top 0.8431%" plus a timestamp and a session id
 * starts describing one person's wallet, which is not a trade this page is
 * willing to make for an analytics chart.
 */
export function calculatorTier(topPct: number): string {
  if (!Number.isFinite(topPct)) return "unknown";
  if (topPct <= 0.1) return "top 0.1%";
  if (topPct <= 1) return "top 1%";
  if (topPct <= 5) return "top 5%";
  if (topPct <= 10) return "top 10%";
  if (topPct <= 25) return "top 25%";
  if (topPct <= 50) return "top 50%";
  return "bottom 50%";
}

export function trackCalculator(e: RichListCalculatorEvent): void {
  try {
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/control-room")) return;
    if (getConsent() !== "accepted") return;

    // Synchronous read, then warm the cache for the next event. Awaiting a geo
    // lookup here would put a network round trip in front of a button press.
    const geo = readCachedGeo();
    void fetchGeo();
    const ua = parseUserAgent(navigator.userAgent);

    void supabaseInsert("richlist_calculator_events", {
      session_id: getSessionId(),
      event: e.event,
      tier: e.tier ?? null,
      cta: e.cta ?? null,
      target_url: e.targetUrl ?? null,
      source_page: e.sourcePage ?? window.location.pathname,
      source: deriveSource(document.referrer || ""),
      country: geo.country ?? null,
      city: geo.city ?? null,
      device_type: ua.device_type,
      os: ua.os,
      browser: ua.browser,
      user_agent: navigator.userAgent,
      is_bot: ua.is_bot,
    });
  } catch {
    // analytics is best-effort; never break the calculator.
  }
}
