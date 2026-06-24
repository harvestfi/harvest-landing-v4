// Source-channel classification shared by the Live Feed and SEO Summary.
// A visit/click `source` arrives as a referrer URL or utm_source string; an
// on-chain event inherits its session's first-touch source. These helpers
// normalize that into a channel name, a badge tone, and a coarse filter group.

export type SourceGroup =
  | "all"
  | "SEO"
  | "AI"
  | "Social"
  | "Wallet"
  | "App"
  | "Email"
  | "Referral"
  | "Direct";

export type ChannelTone =
  | "search"
  | "ai"
  | "social"
  | "wallet"
  | "email"
  | "app"
  | "owned"
  | "direct"
  | "referral";

// In-app webview referrers arrive as android-app://<package> (Android Chrome
// Custom Tabs / WebView set this) or, more rarely, ios-app://<bundle>.
// Undecoded, every one of them collapses into Direct - which is exactly the
// slice we want to pull apart, since a "Direct" hit that lands on a deep
// product page is almost always a link shared/opened inside an app, not a
// typed URL. Matched by package substring so suffixed variants (...android /
// ...lite / ...gp) still resolve. Order matters: specific tokens (webmail)
// come before the broad vendor token (google).
const APP_PACKAGES: ReadonlyArray<readonly [string, string]> = [
  // Wallet dapp browsers - the highest-signal traffic hiding under Direct.
  ["metamask", "MetaMask"],
  ["rainbow", "Rainbow"],
  ["trust", "Trust Wallet"],
  ["toshi", "Coinbase Wallet"],
  ["coinbase", "Coinbase Wallet"],
  ["rabby", "Rabby"],
  ["zerion", "Zerion"],
  ["imtoken", "imToken"],
  ["token.app", "imToken"],
  ["okex", "OKX"],
  ["okx", "OKX"],
  ["bitkeep", "Bitget Wallet"],
  ["bitget", "Bitget Wallet"],
  ["phantom", "Phantom"],
  ["binance", "Binance"],
  // Webmail (before the generic "google" token below).
  ["android.gm", "Gmail"],
  ["googlemail", "Gmail"],
  ["outlook", "Outlook"],
  ["yahoo", "Yahoo Mail"],
  ["protonmail", "Proton Mail"],
  // AI assistants.
  ["openai", "ChatGPT"],
  ["chatgpt", "ChatGPT"],
  ["perplexity", "Perplexity"],
  ["anthropic", "Claude"],
  ["bard", "Gemini"],
  // Social / messaging.
  ["twitter", "X / Twitter"],
  ["atebits", "X / Twitter"],
  ["instagram", "Instagram"],
  ["katana", "Facebook"],
  ["facebook", "Facebook"],
  ["linkedin", "LinkedIn"],
  ["musically", "TikTok"],
  ["zhiliaoapp", "TikTok"],
  ["tiktok", "TikTok"],
  ["reddit", "Reddit"],
  ["discord", "Discord"],
  ["telegram", "Telegram"],
  ["whatsapp", "WhatsApp"],
  ["securesms", "Signal"],
  ["warpcast", "Farcaster"],
  ["farcaster", "Farcaster"],
  // Search / discover apps.
  ["googlequicksearchbox", "Google"],
  ["google", "Google"],
];

function decodeAppScheme(lower: string): string {
  const pkg = lower
    .replace(/^(android-app|ios-app):\/\//, "")
    .split(/[/?#]/)[0];
  for (const [needle, name] of APP_PACKAGES) {
    if (pkg.includes(needle)) return name;
  }
  // Known to be an in-app webview, just not one we've named yet. Surfacing it
  // as "App" (rather than Direct) tells the operator this was a link opened
  // inside some app; the Source tooltip still carries the raw package so the
  // map can be extended over time.
  return "App";
}

// Brand label from a host or URL, stripped to the registrable domain so a
// referral pill shows the site, not a subdomain: "docs.moonwell.fi" and
// "https://docs.moonwell.fi/x" both -> "Moonwell", "www.coingecko.com" ->
// "Coingecko". Returns the input unchanged when it isn't host-like (a utm
// label or an already-clean brand with no dot). Heuristic root = last two
// labels, so the second-to-last is the brand (imperfect for multi-part TLDs
// like .co.uk, which are rare for our referrers).
export function brandFromSource(raw: string): string {
  const s = raw.trim();
  let host: string;
  try {
    host = (
      /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? new URL(s) : new URL("https://" + s)
    ).hostname;
  } catch {
    return raw;
  }
  host = host.replace(/^www\./, "").toLowerCase();
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return raw;
  const sld = parts[parts.length - 2];
  return sld.charAt(0).toUpperCase() + sld.slice(1);
}

export function classifyChannel(raw: string | null): string {
  if (!raw) return "Direct";
  const s = raw.toLowerCase();

  // In-app webview: decode the host app (wallet / social / webmail / AI / ...)
  // so it doesn't disappear into Direct.
  if (s.startsWith("android-app://") || s.startsWith("ios-app://")) {
    return decodeAppScheme(s);
  }

  // Webmail (checked before search - mail.google.com contains "google").
  if (s.includes("mail.google") || s.includes("googlemail")) return "Gmail";
  if (s.includes("outlook") || s.includes("office.com")) return "Outlook";
  if (s.includes("mail.yahoo")) return "Yahoo Mail";
  if (s.includes("proton.me") || s.includes("protonmail")) return "Proton Mail";

  // Search engines.
  if (s.includes("google")) return "Google";
  if (s.includes("bing")) return "Bing";
  if (s.includes("duckduckgo")) return "DuckDuckGo";
  if (s.includes("yandex")) return "Yandex";
  if (s.includes("baidu")) return "Baidu";
  if (s.includes("brave")) return "Brave";
  if (s.includes("ecosia")) return "Ecosia";
  if (s.includes("startpage")) return "Startpage";
  if (s.includes("qwant")) return "Qwant";
  if (s.includes("naver")) return "Naver";
  if (s.includes("seznam")) return "Seznam";
  if (s.includes("kagi")) return "Kagi";
  if (s.includes("mojeek")) return "Mojeek";
  if (s.includes("ask.com")) return "Ask";

  // AI assistants.
  if (s.includes("chatgpt") || s.includes("openai")) return "ChatGPT";
  if (s.includes("perplexity")) return "Perplexity";
  if (s.includes("claude") || s.includes("anthropic")) return "Claude";
  if (s.includes("gemini")) return "Gemini";
  if (s.includes("minara")) return "Minara";

  // Social / messaging.
  if (s.includes("t.co") || s.includes("twitter") || s.includes("x.com")) return "X / Twitter";
  if (s.includes("reddit")) return "Reddit";
  if (s.includes("instagram")) return "Instagram";
  if (s.includes("facebook") || s.includes("fb.com") || s.includes("fb.me")) return "Facebook";
  if (s.includes("linkedin") || s.includes("lnkd.in")) return "LinkedIn";
  if (s.includes("tiktok")) return "TikTok";
  if (s.includes("t.me") || s.includes("telegram")) return "Telegram";
  if (s.includes("discord")) return "Discord";
  if (s.includes("whatsapp") || s.includes("wa.me")) return "WhatsApp";
  if (s.includes("github")) return "GitHub";
  if (s.includes("medium")) return "Medium";

  // Our own site: first-party / owned referral (before the Direct catch-all,
  // which also swallows other "harvest" self-referrals).
  if (s.includes("harvest.finance")) return "Homepage";

  // No identifiable acquisition source -> Direct, matching GA's treatment of
  // a typed URL, bookmark, or stripped / self referrer. Covers an explicit
  // "direct"/"(none)", our own site (self-referral / internal navigation),
  // and a literal "unknown". In-app schemes are decoded above, so they no
  // longer land here.
  if (
    s === "direct" ||
    s === "(direct)" ||
    s === "(none)" ||
    s === "internal" ||
    s === "unknown" ||
    s.includes("harvest")
  ) {
    return "Direct";
  }
  // A real external site we don't have a named channel for: surface its
  // brand (registrable domain, subdomains stripped) so the pill reads
  // "Moonwell", not "docs". Falls back to the raw value when not host-like.
  return brandFromSource(raw);
}

// App-side events (clicks, deposits, withdrawals) entered the app from our
// index, so a bare "Direct" session reads as "Homepage" (owned) - they came
// straight to us and through the CTA. A real channel (Google, a wallet, ...)
// is kept since it's the more useful first touch.
export function appChannel(raw: string | null): string {
  const c = classifyChannel(raw);
  return c === "Direct" ? "Homepage" : c;
}

const SEARCH_CHANNELS = new Set([
  "Google", "Bing", "DuckDuckGo", "Yandex", "Baidu", "Brave",
  "Ecosia", "Startpage", "Qwant", "Naver", "Seznam", "Kagi", "Mojeek", "Ask",
]);
const AI_CHANNELS = new Set(["ChatGPT", "Perplexity", "Claude", "Gemini", "Minara"]);
const SOCIAL_CHANNELS = new Set([
  "X / Twitter", "Reddit", "Discord", "Telegram", "GitHub", "Medium",
  "Instagram", "Facebook", "LinkedIn", "TikTok", "WhatsApp", "Signal", "Farcaster",
]);
// Wallet dapp browsers: a crypto-native first touch, and the most valuable
// thing we recover from Direct.
const WALLET_CHANNELS = new Set([
  "MetaMask", "Rainbow", "Trust Wallet", "Coinbase Wallet", "Rabby",
  "Zerion", "imToken", "OKX", "Bitget Wallet", "Binance", "Phantom",
]);
const EMAIL_CHANNELS = new Set(["Gmail", "Outlook", "Yahoo Mail", "Proton Mail"]);

export function channelTone(name: string): ChannelTone {
  if (SEARCH_CHANNELS.has(name)) return "search";
  if (AI_CHANNELS.has(name)) return "ai";
  if (WALLET_CHANNELS.has(name)) return "wallet";
  if (EMAIL_CHANNELS.has(name)) return "email";
  if (SOCIAL_CHANNELS.has(name)) return "social";
  if (name === "Homepage") return "owned";
  if (name === "Direct") return "direct";
  // Decoded-but-unnamed in-app webview.
  if (name === "App") return "app";
  // Anything left is a real external site we don't have a named channel for
  // (an aggregator, blog, ...) - the badge shows its domain. Distinct tone so
  // these referral sources stand out instead of blending into neutral.
  return "referral";
}

// Map a per-row channel name to its coarse source-filter group. Owned
// Homepage and Direct both fall under Direct ("came on their own / no tracked
// channel"); everything else maps to its named bucket.
export function channelGroup(channel: string): Exclude<SourceGroup, "all"> {
  switch (channelTone(channel)) {
    case "search":
      return "SEO";
    case "ai":
      return "AI";
    case "social":
      return "Social";
    case "wallet":
      return "Wallet";
    case "email":
      return "Email";
    case "app":
      return "App";
    case "referral":
      return "Referral";
    default:
      return "Direct"; // owned + direct
  }
}

// Compact channel names for the one-line mobile feed rows, where the full
// label ("X / Twitter", "Coinbase Wallet") eats column width for no extra
// information. Channels without an entry keep their full name.
const SHORT_CHANNEL: Record<string, string> = {
  Homepage: "Home",
  "X / Twitter": "X",
  DuckDuckGo: "DDG",
  Perplexity: "Pplx",
  ChatGPT: "GPT",
  Telegram: "TG",
  "Coinbase Wallet": "Coinbase",
  "Trust Wallet": "Trust",
  "Bitget Wallet": "Bitget",
  "Yahoo Mail": "Yahoo",
  "Proton Mail": "Proton",
  Instagram: "IG",
  Facebook: "FB",
};

export function shortChannelLabel(channel: string): string {
  return SHORT_CHANNEL[channel] ?? channel;
}

// Best-effort full domain for the Source-column tooltip, derived from a
// referrer URL or a bare host. "https://www.coingecko.com/x" and
// "coingecko.com" both return "coingecko.com"; an in-app referrer
// "android-app://io.metamask" returns its package "io.metamask" so the
// operator can see the exact app. Returns null when there's no usable host
// (Direct, internal, or a utm label with no dot), so the caller can omit the
// tooltip.
export function sourceDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  try {
    const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(s)
      ? new URL(s)
      : new URL("https://" + s);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}
