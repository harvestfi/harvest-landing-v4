// Source-channel classification shared by the Live Feed and SEO Summary.
// A visit/click `source` arrives as a referrer URL or utm_source string; an
// on-chain event inherits its session's first-touch source. These helpers
// normalize that into a channel name, a badge tone, and a coarse filter group.

export type SourceGroup = "all" | "SEO" | "AI" | "Social" | "Referral" | "Direct";

export type ChannelTone =
  | "search"
  | "ai"
  | "social"
  | "owned"
  | "direct"
  | "referral";

export function classifyChannel(raw: string | null): string {
  if (!raw) return "Direct";
  const s = raw.toLowerCase();
  if (s.includes("google")) return "Google";
  if (s.includes("bing")) return "Bing";
  if (s.includes("duckduckgo")) return "DuckDuckGo";
  if (s.includes("chatgpt") || s.includes("openai")) return "ChatGPT";
  if (s.includes("perplexity")) return "Perplexity";
  if (s.includes("claude") || s.includes("anthropic")) return "Claude";
  if (s.includes("gemini")) return "Gemini";
  if (s.includes("t.co") || s.includes("twitter") || s.includes("x.com")) return "X / Twitter";
  if (s.includes("reddit")) return "Reddit";
  if (s.includes("github")) return "GitHub";
  if (s.includes("t.me") || s.includes("telegram")) return "Telegram";
  if (s.includes("discord")) return "Discord";
  if (s.includes("medium")) return "Medium";
  if (s.includes("harvest.finance")) return "Homepage";
  // No identifiable acquisition source -> Direct, matching GA's treatment of
  // a typed URL, bookmark, or stripped / self referrer. Covers an explicit
  // "direct"/"(none)", our own site (self-referral / internal navigation),
  // an in-app webview scheme that carries no real origin, and a literal
  // "unknown". This is the bucket the operator should read as "came on their
  // own", not a mysterious one.
  if (
    s === "direct" ||
    s === "(direct)" ||
    s === "(none)" ||
    s === "internal" ||
    s === "unknown" ||
    s.includes("harvest") ||
    s.startsWith("android-app") ||
    s.startsWith("ios-app")
  ) {
    return "Direct";
  }
  // A real external site we don't have a named channel for: surface the
  // referrer itself (GA-style "Referral / <source>") rather than a blank
  // "Referral" bucket, so the operator can see where it actually came from.
  return raw;
}

// App-side events (clicks, deposits, withdrawals) entered the app from our
// index, so a bare "Direct" session reads as "Homepage" (owned) - they came
// straight to us and through the CTA. A real external channel (Google,
// Reddit, ...) is kept since it's the more useful first touch.
export function appChannel(raw: string | null): string {
  const c = classifyChannel(raw);
  return c === "Direct" ? "Homepage" : c;
}

export function channelTone(name: string): ChannelTone {
  if (name === "Google" || name === "Bing" || name === "DuckDuckGo") return "search";
  if (name === "ChatGPT" || name === "Perplexity" || name === "Claude" || name === "Gemini") return "ai";
  if (
    name === "X / Twitter" || name === "Reddit" || name === "Discord" ||
    name === "Telegram" || name === "GitHub" || name === "Medium"
  )
    return "social";
  if (name === "Homepage") return "owned";
  if (name === "Direct") return "direct";
  // Anything left is a real external site we don't have a named channel for
  // (an aggregator, blog, ...) - the badge shows its domain. Distinct tone so
  // these referral sources stand out instead of blending into neutral.
  return "referral";
}

// Map a per-row channel name to its coarse source-filter group. Search, AI
// and social engines map to their bucket; a real external referrer domain
// maps to Referral; owned Homepage and Direct fall under Direct ("came on
// their own / no tracked channel").
export function channelGroup(channel: string): Exclude<SourceGroup, "all"> {
  const tone = channelTone(channel);
  if (tone === "search") return "SEO";
  if (tone === "ai") return "AI";
  if (tone === "social") return "Social";
  if (tone === "referral") return "Referral";
  return "Direct";
}
