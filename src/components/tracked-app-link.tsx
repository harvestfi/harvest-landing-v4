"use client";

// Wraps an outbound link to app.harvest.finance with click
// tracking. On click, fires a row to Supabase outbound_clicks
// before letting the browser follow the link. Same context shape
// as frontpage_visits (session_id, source label, country/city,
// device) so visit + click can be joined on session_id.
//
// Also appends ?hsid=<session_id> to the outbound URL so the app
// side can record (wallet_address, session_id) into
// wallet_session_links at connect time. That link closes the
// funnel: visit -> click -> wallet connect -> onchain deposit.
//
// Consent-gated: only fires if the visitor has clicked Accept on
// the cookie banner (same flag the Traffic tracker reads). On
// admin pages the handler short-circuits so operator browsing
// doesn't pollute the click stream.

import { useCallback, useEffect, useState } from "react";
import { supabaseInsert } from "@/lib/supabase";
import {
  deriveSource,
  parseUserAgent,
  fetchGeo,
  readCachedGeo,
  getSessionId,
  getConsent,
} from "@/lib/analytics";

interface Props {
  href: string;
  cta: string;
  vaultSlug?: string;
  vaultAddress?: string;
  className?: string;
  children: React.ReactNode;
  target?: string;
  rel?: string;
  ariaLabel?: string;
}

export function TrackedAppLink({
  href,
  cta,
  vaultSlug,
  vaultAddress,
  className,
  children,
  target = "_blank",
  rel = "noopener noreferrer",
  ariaLabel,
}: Props) {
  // SSR-safe initial value is the bare href. On mount we append
  // ?hsid=<session_id> so the app side can join the visit chain to
  // the wallet at connect time. Also covers middle-click / copy-link
  // / open-in-new-tab paths (the param lives on the href, not the
  // click handler).
  const [stampedHref, setStampedHref] = useState(href);
  useEffect(() => {
    if (getConsent() !== "accepted") return;
    setStampedHref(appendSessionParam(href, getSessionId()));
  }, [href]);

  const onClick = useCallback(() => {
    void fireClick({ href, cta, vaultSlug, vaultAddress });
  }, [href, cta, vaultSlug, vaultAddress]);

  return (
    <a
      href={stampedHref}
      target={target}
      rel={rel}
      className={className}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </a>
  );
}

function appendSessionParam(href: string, sessionId: string): string {
  try {
    const u = new URL(href, window.location.origin);
    u.searchParams.set("hsid", sessionId);
    return u.toString();
  } catch {
    return href;
  }
}

function fireClick(opts: {
  href: string;
  cta: string;
  vaultSlug?: string;
  vaultAddress?: string;
}): void {
  try {
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/control-room")) return;
    if (getConsent() !== "accepted") return;

    const sessionId = getSessionId();
    const referrer = document.referrer || "";
    const source = deriveSource(referrer);
    const ua = parseUserAgent(navigator.userAgent);
    // Read geo from the sessionStorage cache SYNCHRONOUSLY. We must
    // not `await fetchGeo()` here: on the visitor's first click of a
    // session geo isn't cached yet, so awaiting it does a network
    // round-trip (200-800ms, sometimes failing) - and if the CTA
    // navigates the same tab, the page unloads before the insert is
    // ever sent and the click is lost. That's why outbound_clicks
    // was under-recording. Fire the insert immediately with whatever
    // geo we have (often {} on first click), then warm the cache in
    // the background for subsequent clicks.
    const geo = readCachedGeo();
    void fetchGeo();

    void supabaseInsert("outbound_clicks", {
      session_id: sessionId,
      source_page: window.location.pathname,
      source_cta: opts.cta,
      vault_slug: opts.vaultSlug ?? null,
      vault_address: opts.vaultAddress ?? null,
      target_url: opts.href,
      source,
      country: geo.country ?? null,
      city: geo.city ?? null,
      device_type: ua.device_type,
      os: ua.os,
      browser: ua.browser,
      user_agent: navigator.userAgent,
      is_bot: ua.is_bot,
    });
  } catch {
    // best-effort; never block navigation.
  }
}
