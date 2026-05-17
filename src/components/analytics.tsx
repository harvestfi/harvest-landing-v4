"use client";

// Site-wide analytics + cookie consent banner. Mounted once in the
// root layout. Handles three things:
//   1. Render the consent banner on first visit (until accept/decline).
//   2. On every route change (after Accept), POST a visit row to the
//      Supabase frontpage_visits table.
//   3. Skip admin pages entirely so the operator's own browsing
//      doesn't pollute the data.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseInsert } from "@/lib/supabase";
import {
  deriveSource,
  parseUserAgent,
  fetchGeo,
  getSessionId,
  getConsent,
  setConsent,
  takeIsEntryPage,
  type Consent,
} from "@/lib/analytics";

export function Analytics() {
  const pathname = usePathname();
  const [consent, setConsentState] = useState<Consent | null>(null);
  const [mounted, setMounted] = useState(false);

  // Read consent on first mount. State drives both the banner
  // visibility and whether the tracking effect fires.
  useEffect(() => {
    setMounted(true);
    setConsentState(getConsent());
  }, []);

  // Track on every route change once consent is granted.
  useEffect(() => {
    if (!mounted) return;
    if (consent !== "accepted") return;
    if (!pathname) return;
    if (pathname.startsWith("/admin")) return; // exclude operator pages
    void trackVisit(pathname);
  }, [pathname, consent, mounted]);

  const accept = () => {
    setConsent("accepted");
    setConsentState("accepted");
  };
  const decline = () => {
    setConsent("declined");
    setConsentState("declined");
  };

  // Don't render the banner during SSR hydration mismatch window,
  // once a choice has been made, or on operator pages (admin is
  // internal - showing a consent banner there is misleading since
  // those pages aren't tracked anyway).
  if (!mounted) return null;
  if (consent === "accepted" || consent === "declined") return null;
  if (pathname?.startsWith("/admin")) return null;
  return <CookieBanner onAccept={accept} onDecline={decline} />;
}

async function trackVisit(pathname: string) {
  try {
    const sessionId = getSessionId();
    const isEntry = takeIsEntryPage();

    const url = new URL(window.location.href);
    const utm_source = url.searchParams.get("utm_source");
    const utm_medium = url.searchParams.get("utm_medium");
    const utm_campaign = url.searchParams.get("utm_campaign");
    const utm_content = url.searchParams.get("utm_content");
    const utm_term = url.searchParams.get("utm_term");

    const referrer = document.referrer || "";
    const source = deriveSource(referrer, utm_source);
    const ua = parseUserAgent(navigator.userAgent);
    const geo = await fetchGeo();

    await supabaseInsert("frontpage_visits", {
      session_id: sessionId,
      page_path: pathname,
      page_title: document.title || null,
      referrer: referrer || null,
      source,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      utm_content: utm_content || null,
      utm_term: utm_term || null,
      country: geo.country || null,
      region: geo.region || null,
      city: geo.city || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      device_type: ua.device_type,
      os: ua.os,
      browser: ua.browser,
      browser_version: ua.browser_version || null,
      user_agent: navigator.userAgent,
      language: navigator.language || null,
      screen_width: screen.width || null,
      screen_height: screen.height || null,
      viewport_width: window.innerWidth || null,
      viewport_height: window.innerHeight || null,
      pixel_ratio: window.devicePixelRatio || null,
      is_entry_page: isEntry,
      is_bot: ua.is_bot,
    });
  } catch {
    // best-effort; never throw from analytics.
  }
}

function CookieBanner({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="cookie-banner" role="dialog" aria-label="Analytics consent">
      <p className="cookie-banner-text">
        We track anonymous page visits (page, source, country, device) to
        understand how the index gets used. No third-party cookies, no
        cross-site trackers, no personal data.
      </p>
      <div className="cookie-banner-actions">
        <button
          type="button"
          onClick={onDecline}
          className="cookie-banner-decline"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="cookie-banner-accept"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
