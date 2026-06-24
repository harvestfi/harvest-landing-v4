// Non-human traffic detection, shared by the Live Feed, SEO Summary and
// Acquisition surfaces so they weed out crawlers identically. Three
// independent layers, any of which flags a row as a bot:
//   (a) is_bot     - the flag persisted at capture time (lib/analytics
//                    BOT_RE); narrow, but free and already on every row.
//   (b) user_agent - a wider match for crawlers that slip past (a): SEO /
//                    AI scanners, link unfurlers, headless browsers, bare
//                    HTTP clients. Re-tested client-side so it applies
//                    retroactively to rows captured before the list grew.
//   (c) page_path  - request shape: a "visit" to a static asset or a
//                    malformed / recursive path is machinery, never a
//                    human page view (this is what catches the .svg and
//                    /public/public/... rows even when the UA is spoofed).
// Single-page or no-referrer visits are deliberately NOT treated as bot
// signals - that would throw out real organic traffic.

// (b) Crawlers / scanners / unfurlers / headless browsers / HTTP clients.
// `bot\b` is the workhorse (googlebot, bingbot, GPTBot, ClaudeBot, ...);
// the rest are crawlers whose name doesn't end in "bot". Real browser
// user agents contain none of these tokens.
const UA_BOT_RE =
  /(bot\b|crawl|spider|slurp|headless|phantomjs|puppeteer|playwright|google-extended|duckduck|yandex|baidu|sogou|facebookexternalhit|chatgpt|claude-web|anthropic|perplexity|ahrefs|semrush|mj12|dataforseo|barkrowler|whatsapp|embedly|python-requests|urllib|\bcurl\b|\bwget\b|go-http-client|okhttp|axios|node-fetch|lighthouse|pagespeed|uptimerobot|pingdom|statuscake)/i;

// (c) Static-asset extensions and malformed / recursive paths. A real
// route looks like "/", "/eth", "/usdc-autopilot-base".
const ASSET_PATH_RE =
  /\.(svg|png|jpe?g|gif|webp|avif|ico|css|js|mjs|map|woff2?|ttf|otf|eot|json|xml|txt|pdf|wasm|webmanifest)(\?|#|$)/i;
const JUNK_PATH_RE =
  /\/public\/public\/|\/_next\/|\/static\/|\/\.well-known\/|\/wp-(admin|login|content|includes)|\/xmlrpc\.php|\/\.env\b/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  return !!ua && UA_BOT_RE.test(ua);
}

export function isNonPagePath(path: string | null | undefined): boolean {
  return !!path && (ASSET_PATH_RE.test(path) || JUNK_PATH_RE.test(path));
}

export interface BotSignals {
  is_bot?: boolean | null;
  user_agent?: string | null;
  page_path?: string | null;
  // Geometry for the headless-automation check (d). Optional: callers that
  // don't select these columns simply skip that layer.
  device_type?: string | null;
  screen_width?: number | null;
  screen_height?: number | null;
  viewport_width?: number | null;
  viewport_height?: number | null;
  // Geo signals for cluster-poisoning (e). Optional.
  country?: string | null;
  timezone?: string | null;
}

// (d) Headless / automation footprint: a DESKTOP hit whose viewport is
// exactly the full screen in both dimensions. A real desktop browser always
// loses vertical space to the OS taskbar + browser chrome, so
// viewport_height < screen_height holds for every genuine visit; viewport
// == screen only happens in a headless / no-UI browser. This is the stable
// fingerprint of the worldwide referrer-spoofing "Google" flood (every hit
// reported a 1920x1080 viewport on a 1920x1080 screen, with a real-looking
// Windows Chrome UA the UA layer can't touch) and of assorted datacenter
// scrapers. Desktop-only on purpose: on mobile, viewport == screen does
// occur on real devices, and mobile bots are already caught by the UA
// layer. Validated against ~280 real rows with zero false positives - every
// genuine desktop visit had viewport_height < screen_height.
export function isAutomationViewport(s: BotSignals): boolean {
  return (
    s.device_type === "desktop" &&
    typeof s.screen_width === "number" &&
    s.screen_width > 0 &&
    typeof s.screen_height === "number" &&
    s.screen_height > 0 &&
    s.viewport_width === s.screen_width &&
    s.viewport_height === s.screen_height
  );
}

// True if any layer flags the row as non-human (per-row layers a-d).
export function isBotRow(s: BotSignals): boolean {
  return (
    s.is_bot === true ||
    isBotUserAgent(s.user_agent) ||
    isNonPagePath(s.page_path) ||
    isAutomationViewport(s)
  );
}

// (e) Cluster-poisoning — defeats the referrer-spoofing fleets that mimic a
// real maximized browser (so the per-row viewport layer misses them) and
// spoof an organic search referrer. Their tell is statistical, not per-row:
// one identical device fingerprint (UA + screen + viewport) appears across
// many countries while reporting a single timezone, so for most of those
// hits the browser timezone and the IP-geolocated country sit on different
// continents — geographically impossible. We poison the whole fingerprint
// off that signal, which also catches the fleet's hits whose own country
// happens to match the timezone (e.g. the US-located ones).

// Coarse continent group of an IANA timezone, from its region prefix. UTC /
// GMT / Indian / Atlantic are ambiguous, so we don't judge them.
function tzGroup(tz: string | null | undefined): string | null {
  if (!tz) return null;
  switch (tz.split("/")[0]) {
    case "America":
      return "AMER";
    case "Europe":
      return "EU";
    case "Asia":
      return "AS";
    case "Africa":
      return "AF";
    case "Australia":
    case "Pacific":
      return "OC";
    default:
      return null;
  }
}

// Continent group of an ISO country code. "AMER" spans both Americas so it
// lines up with the "America/*" timezone region. Unlisted codes return null
// (we simply don't judge them).
const COUNTRY_GROUP: Record<string, string> = {
  US: "AMER", CA: "AMER", MX: "AMER", BR: "AMER", AR: "AMER", CL: "AMER",
  CO: "AMER", PE: "AMER", VE: "AMER", EC: "AMER", BO: "AMER", PY: "AMER",
  UY: "AMER", GY: "AMER", SR: "AMER", PA: "AMER", CR: "AMER", GT: "AMER",
  HN: "AMER", NI: "AMER", SV: "AMER", BZ: "AMER", DO: "AMER", CU: "AMER",
  JM: "AMER", HT: "AMER", TT: "AMER", BS: "AMER", PR: "AMER",
  GB: "EU", IE: "EU", FR: "EU", DE: "EU", ES: "EU", PT: "EU", IT: "EU",
  NL: "EU", BE: "EU", LU: "EU", CH: "EU", AT: "EU", SE: "EU", NO: "EU",
  DK: "EU", FI: "EU", IS: "EU", PL: "EU", CZ: "EU", SK: "EU", HU: "EU",
  RO: "EU", BG: "EU", GR: "EU", HR: "EU", SI: "EU", RS: "EU", UA: "EU",
  LT: "EU", LV: "EU", EE: "EU",
  IN: "AS", CN: "AS", JP: "AS", KR: "AS", SG: "AS", ID: "AS", PK: "AS",
  TH: "AS", VN: "AS", PH: "AS", MY: "AS", BD: "AS", LK: "AS", HK: "AS",
  TW: "AS", AE: "AS", SA: "AS", IL: "AS", QA: "AS", KW: "AS", KZ: "AS",
  ZA: "AF", NG: "AF", EG: "AF", KE: "AF", MA: "AF", GH: "AF", DZ: "AF",
  TN: "AF", ET: "AF", UG: "AF", TZ: "AF", CI: "AF", SN: "AF",
  AU: "OC", NZ: "OC", FJ: "OC", PG: "OC",
};

function countryGroup(cc: string | null | undefined): string | null {
  return cc ? COUNTRY_GROUP[cc.toUpperCase()] ?? null : null;
}

function geoImpossible(s: BotSignals): boolean {
  const t = tzGroup(s.timezone);
  const c = countryGroup(s.country);
  return t !== null && c !== null && t !== c;
}

// Device fingerprint: UA + screen + viewport. Specific enough that diverse
// real visitors don't collide, but every node of one automation fleet shares
// it exactly.
export function fingerprintKey(s: BotSignals): string {
  return [
    (s.user_agent || "").trim(),
    `${s.screen_width ?? ""}x${s.screen_height ?? ""}`,
    `${s.viewport_width ?? ""}x${s.viewport_height ?? ""}`,
  ].join("|");
}

// Returns the set of fingerprints to treat as bots. A fingerprint is poisoned
// when it carries at least one geographically impossible hit AND is spread
// across >=3 countries with >=5 total hits — the guards keep a lone
// VPN/travelling user (foreign OS timezone) from poisoning a real, shared
// fingerprint.
export function detectSpoofedFingerprints(rows: BotSignals[]): Set<string> {
  const agg = new Map<
    string,
    { countries: Set<string>; impossible: number; total: number }
  >();
  for (const r of rows) {
    if (!r.user_agent && !r.screen_width) continue;
    const key = fingerprintKey(r);
    let a = agg.get(key);
    if (!a) {
      a = { countries: new Set(), impossible: 0, total: 0 };
      agg.set(key, a);
    }
    a.total++;
    if (r.country) a.countries.add(r.country.toUpperCase());
    if (geoImpossible(r)) a.impossible++;
  }
  const poisoned = new Set<string>();
  for (const [key, a] of agg) {
    if (a.impossible >= 1 && a.countries.size >= 3 && a.total >= 5) {
      poisoned.add(key);
    }
  }
  return poisoned;
}
