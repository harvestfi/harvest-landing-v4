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
}

// True if any layer flags the row as non-human.
export function isBotRow(s: BotSignals): boolean {
  return (
    s.is_bot === true ||
    isBotUserAgent(s.user_agent) ||
    isNonPagePath(s.page_path)
  );
}
