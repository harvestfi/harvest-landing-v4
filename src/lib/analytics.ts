// Client-side helpers for the visit-tracking pipeline. All functions
// here run only in the browser (they touch `window`, `navigator`,
// `sessionStorage`, `localStorage`). They are imported only by
// "use client" components.

// --------------------------------------------------------------------------
// Consent
// --------------------------------------------------------------------------

const CONSENT_KEY = "harvest_analytics_consent";

export type Consent = "accepted" | "declined";

export function getConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(v: Consent): void {
  try {
    localStorage.setItem(CONSENT_KEY, v);
  } catch {
    // private browsing or storage blocked - tracking simply won't fire.
  }
}

// --------------------------------------------------------------------------
// Session ID (random UUID, scoped to one tab lifespan)
// --------------------------------------------------------------------------

const SESSION_KEY = "harvest_session_id";

export function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

const SESSION_INIT_KEY = "harvest_session_initialized";

export function takeIsEntryPage(): boolean {
  try {
    const seen = sessionStorage.getItem(SESSION_INIT_KEY) === "1";
    if (!seen) sessionStorage.setItem(SESSION_INIT_KEY, "1");
    return !seen;
  } catch {
    return true;
  }
}

// --------------------------------------------------------------------------
// Source derivation
// --------------------------------------------------------------------------

// Map of well-known referrer hostnames → display label. Match is
// exact OR suffix (so "news.google.com" still resolves to "Google").
const SOURCE_MAP: Record<string, string> = {
  "google.com": "Google",
  "bing.com": "Bing",
  "duckduckgo.com": "DuckDuckGo",
  "yahoo.com": "Yahoo",
  "yandex.com": "Yandex",
  "baidu.com": "Baidu",
  "perplexity.ai": "Perplexity",
  "chatgpt.com": "ChatGPT",
  "openai.com": "ChatGPT",
  "claude.ai": "Claude",
  "anthropic.com": "Claude",
  "gemini.google.com": "Gemini",
  "copilot.microsoft.com": "Copilot",
  "twitter.com": "Twitter/X",
  "x.com": "Twitter/X",
  "t.co": "Twitter/X",
  "facebook.com": "Facebook",
  "linkedin.com": "LinkedIn",
  "reddit.com": "Reddit",
  "old.reddit.com": "Reddit",
  "github.com": "GitHub",
  "medium.com": "Medium",
  "substack.com": "Substack",
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "warpcast.com": "Warpcast",
  "farcaster.xyz": "Farcaster",
  "discord.com": "Discord",
  "telegram.org": "Telegram",
  "t.me": "Telegram",
  "instagram.com": "Instagram",
  "tiktok.com": "TikTok",
};

export function deriveSource(
  referrer: string,
  utmSource?: string | null,
): string {
  if (utmSource) return capitalize(utmSource);
  if (!referrer) return "Direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    for (const [domain, label] of Object.entries(SOURCE_MAP)) {
      if (host === domain || host.endsWith("." + domain)) return label;
    }
    // Internal navigation (referrer is same site) - shouldn't normally
    // fire because we track each route, but covers edge cases like
    // hash navigation.
    if (host.includes("harvest")) return "Internal";
    return capitalize(host.split(".")[0] || host);
  } catch {
    return "Unknown";
  }
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// --------------------------------------------------------------------------
// User-agent parsing
// --------------------------------------------------------------------------

export interface ParsedUserAgent {
  device_type: "desktop" | "tablet" | "mobile";
  os: string;
  browser: string;
  browser_version: string;
  is_bot: boolean;
}

const BOT_RE =
  /\b(bot|crawler|spider|googlebot|bingbot|yandex|baiduspider|slurp|duckduckgo|facebot|ia_archiver|chatgpt|gptbot|claude-?web|anthropic|perplexitybot)\b/i;

export function parseUserAgent(ua: string): ParsedUserAgent {
  const u = (ua || "").toLowerCase();
  const is_bot = BOT_RE.test(u);

  let device_type: ParsedUserAgent["device_type"] = "desktop";
  if (/\b(ipad|tablet|kindle|playbook|silk)\b/.test(u)) device_type = "tablet";
  else if (/\b(mobile|android|iphone|ipod|blackberry|opera mini|windows phone)\b/.test(u))
    device_type = "mobile";

  let os = "Unknown";
  if (/windows nt/.test(u)) os = "Windows";
  else if (/iphone|ipad|ipod/.test(u) || /mac os x.*mobile/.test(u)) os = "iOS";
  else if (/mac os x/.test(u)) os = "macOS";
  else if (/android/.test(u)) os = "Android";
  else if (/linux/.test(u)) os = "Linux";
  else if (/cros/.test(u)) os = "ChromeOS";

  let browser = "Unknown";
  let browser_version = "";
  // Order matters: Edge before Chrome (Edge UA contains "Chrome").
  // Opera, Brave, Vivaldi often pose as Chrome and are reported as such.
  let m: RegExpMatchArray | null;
  if ((m = ua.match(/Edg\/(\S+)/))) {
    browser = "Edge";
    browser_version = m[1];
  } else if ((m = ua.match(/OPR\/(\S+)/))) {
    browser = "Opera";
    browser_version = m[1];
  } else if ((m = ua.match(/Firefox\/(\S+)/))) {
    browser = "Firefox";
    browser_version = m[1];
  } else if ((m = ua.match(/Chrome\/(\S+)/))) {
    browser = "Chrome";
    browser_version = m[1];
  } else if ((m = ua.match(/Version\/(\S+)\s+Safari/))) {
    browser = "Safari";
    browser_version = m[1];
  }

  return { device_type, os, browser, browser_version, is_bot };
}

// --------------------------------------------------------------------------
// Geo lookup (consent-gated)
// --------------------------------------------------------------------------

// Called only after the visitor has clicked Accept on the banner.
// Hits ipapi.co (free 30k req/month, returns country/region/city).
// Result is cached in sessionStorage so we don't re-fetch on every
// route change. Failures degrade silently to empty geo.
const GEO_CACHE_KEY = "harvest_geo";

export interface Geo {
  country?: string;
  region?: string;
  city?: string;
}

export async function fetchGeo(): Promise<Geo> {
  try {
    const cached = sessionStorage.getItem(GEO_CACHE_KEY);
    if (cached) return JSON.parse(cached) as Geo;
  } catch {
    // ignore - we'll fall through to the network call.
  }
  let out: Geo = {};
  try {
    const r = await fetch("https://ipapi.co/json/", { mode: "cors" });
    if (r.ok) {
      const j = (await r.json()) as Record<string, unknown>;
      out = {
        country: (j.country_code as string) || undefined,
        region: (j.region as string) || undefined,
        city: (j.city as string) || undefined,
      };
    }
  } catch {
    // ipapi failed - try Cloudflare trace for country-only fallback.
    try {
      const r = await fetch("https://www.cloudflare.com/cdn-cgi/trace", {
        mode: "cors",
      });
      if (r.ok) {
        const text = await r.text();
        const loc = text.match(/loc=(\S+)/)?.[1];
        if (loc) out = { country: loc };
      }
    } catch {
      // give up - return {} below.
    }
  }
  try {
    sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(out));
  } catch {
    // ignore
  }
  return out;
}
