// Outbound-click tracking for /report/* pages, kept as a SEPARATE channel
// from the into-app funnel on purpose.
//
// The `outbound_clicks` table (see components/tracked-app-link.tsx) is the
// visit -> app.harvest.finance conversion funnel. Report links point at
// third-party venues (Kinetic, SparkDEX, Aerodrome...), so folding them into
// outbound_clicks would pollute the acquisition/conversion metrics. Instead
// these land in their own table, `report_outbound_clicks`, surfaced under
// Control Room > Reports > Outbound Clicks.
//
// Two events per venue give a small intent funnel:
//   - "open"    the visitor clicked Discover / Visit (opened the leave modal)
//   - "confirm" the visitor clicked "I understand" and actually left
//
// Best-effort and consent-gated, exactly like the into-app tracker: it never
// blocks navigation, no-ops on /control-room, and no-ops until the Supabase
// table exists (the insert simply fails silently).

import { supabaseInsert } from "@/lib/supabase";
import {
  deriveSource,
  parseUserAgent,
  readCachedGeo,
  fetchGeo,
  getSessionId,
  getConsent,
} from "@/lib/analytics";

export interface ReportOutboundClick {
  event: "open" | "confirm";
  platform: string;
  product?: string;
  chain?: string;
  // Stable identifier for the row/card the click came from, e.g.
  // "ranking:sparkdex-v4" or "venue:kinetic".
  venueRef?: string;
  targetUrl: string;
}

export function trackReportOutbound(c: ReportOutboundClick): void {
  try {
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/control-room")) return;
    if (getConsent() !== "accepted") return;

    // Synchronous geo read (see tracked-app-link for why we don't await
    // fetchGeo here), then warm the cache for the next click.
    const geo = readCachedGeo();
    void fetchGeo();
    const ua = parseUserAgent(navigator.userAgent);

    void supabaseInsert("report_outbound_clicks", {
      session_id: getSessionId(),
      event: c.event,
      source_page: window.location.pathname,
      platform: c.platform,
      product: c.product ?? null,
      chain: c.chain ?? null,
      venue_ref: c.venueRef ?? null,
      target_url: c.targetUrl,
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
    // analytics is best-effort; never break the page or the click.
  }
}
