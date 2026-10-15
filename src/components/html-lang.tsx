"use client";

// Sets <html lang> for a page whose language differs from the site's.
//
// The root layout hardcodes lang="en", and with a static export there is no
// per-request way to change it, so a non-English page also wraps its own
// content in an element carrying the right `lang` (which is what assistive
// tech and the browser's translate prompt read for that content). This
// component corrects the document element after load as well, and puts the
// layout's value back on the way out, so a client-side navigation from the
// Korean page to an English one does not leave the whole site marked Korean.

import { useEffect } from "react";

export function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.lang;
    el.lang = lang;
    return () => {
      el.lang = prev;
    };
  }, [lang]);
  return null;
}
