"use client";

import { openConsent } from "@/lib/analytics";

export function CookieSettingsLink() {
  return (
    <button type="button" onClick={openConsent} className="foot-link foot-link-button">
      Cookie settings
    </button>
  );
}
