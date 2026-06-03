// Operator hide-list, stored in the browser only (localStorage). No
// backend: toggling Hide in /admin/hide writes here, and the ranking
// tables read here to drop hidden products on the client. This is
// per-browser by design (the site is a static export with no server to
// persist to). For a hide that applies to every visitor, the slug also
// needs to land in the committed data/hidden.json, which the build
// filters server-side; this client store is the instant, local layer.

const KEY = "harvest_hidden_products";
export const HIDDEN_CHANGED_EVENT = "harvest-hidden-changed";

export function readHiddenSlugs(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(
      arr
        .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

export function writeHiddenSlugs(slugs: Set<string>): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify([...slugs].sort()),
    );
    // Notify any mounted ranking tables in this tab to re-filter live.
    window.dispatchEvent(new Event(HIDDEN_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}
