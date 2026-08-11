// Calculator tracking for /xrp-rich-list, kept as its own channel.
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
//   - "start"   the visitor pressed Start check with a balance typed
//   - "result"  a rank was shown
//   - "cta"     the visitor clicked the box under the result
//
// start -> result is the completion rate. result -> cta is the click-through.
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
 */
export type CalculatorCta = "top-accounts" | "earn-on-xrp";

export interface RichListCalculatorEvent {
  event: "start" | "result" | "cta";
  /** Coarse percentile band the result fell into. Only on "result". */
  tier?: string | null;
  /** Which onward click. Only on "cta". */
  cta?: CalculatorCta | null;
  targetUrl?: string | null;
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
      source_page: window.location.pathname,
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
