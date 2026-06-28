#!/usr/bin/env node
// IndexNow submitter. Notifies participating search engines (Bing, Yandex,
// Seznam, Naver, Yep, ...) the instant a page is added, removed or
// meaningfully changed, instead of waiting for them to recrawl. One POST to
// api.indexnow.org fans out to every participating engine. Google does not
// consume IndexNow today, so it keeps relying on the sitemap — this is
// purely additive.
//
// AUTH: none. The submission is signed by INDEXNOW_KEY, which is proved by
// the public file at https://<host>/<key>.txt (emitted by
// build-seo-static.mjs). No API account, no GitHub secret.
//
// MODES
//   (default)   Incremental. Diffs data/slugs.json between HEAD^ and HEAD
//               and submits only the product URLs that were added or
//               removed, plus the home + asset/network hubs (whose rankings
//               shifted). Exits quietly when nothing changed. This is the
//               best-practice trigger: we deliberately do NOT resubmit all
//               150 pages every hour just because APY/TVL ticked — that is
//               the over-submission the IndexNow guidelines warn against.
//   --all       Full submission of the canonical URL set (home + hubs +
//               every <loc> in public/sitemap.xml, or all slugs if the
//               sitemap is absent). Use once after enabling, to seed.
//   --dry-run   Print the payload; do not POST. Combine with either mode.
//
// USAGE
//   node scripts/indexnow-submit.mjs                # incremental (CI)
//   node scripts/indexnow-submit.mjs --all          # one-time seed
//   node scripts/indexnow-submit.mjs --all --dry-run

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { INDEXNOW_KEY } from "./indexnow.config.mjs";

const ROOT = process.cwd();
const ENDPOINT = "https://api.indexnow.org/indexnow";
const ASSET_HUBS = ["usdc", "usdt", "eth", "btc"];
const NETWORK_HUBS = [
  "ethereum",
  "base",
  "arbitrum",
  "polygon",
  "zksync",
  "hyperevm",
];

const argv = process.argv.slice(2);
const ALL = argv.includes("--all");
const DRY = argv.includes("--dry-run");

function readSiteUrl() {
  const src = readFileSync(join(ROOT, "src", "lib", "constants.ts"), "utf-8");
  const m = src.match(/export\s+const\s+SITE_URL\s*=\s*["'`]([^"'`]+)["'`]/);
  if (!m) {
    console.error("[indexnow] could not find SITE_URL in constants.ts");
    process.exit(1);
  }
  return m[1].replace(/\/$/, "");
}

const SITE_URL = readSiteUrl();
const HOST = new URL(SITE_URL).host;
const hubUrls = () => [
  `${SITE_URL}/`,
  ...ASSET_HUBS.map((h) => `${SITE_URL}/${h}`),
  ...NETWORK_HUBS.map((h) => `${SITE_URL}/${h}`),
];

// --- slug helpers -----------------------------------------------------------
function slugSetFromJson(text) {
  // data/slugs.json is { address: slug }; we care about the slug values.
  const obj = JSON.parse(text);
  return new Set(Object.values(obj));
}

function gitShow(ref) {
  try {
    return execSync(`git show ${ref}:data/slugs.json`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null; // ref or file absent (e.g. first commit) -> treat as empty
  }
}

function incrementalUrls() {
  const headText = gitShow("HEAD");
  if (!headText) {
    console.error("[indexnow] HEAD:data/slugs.json unreadable; nothing to do.");
    return [];
  }
  const prevText = gitShow("HEAD^");
  const head = slugSetFromJson(headText);
  const prev = prevText ? slugSetFromJson(prevText) : new Set();

  const added = [...head].filter((s) => !prev.has(s));
  const removed = [...prev].filter((s) => !head.has(s));
  if (added.length === 0 && removed.length === 0) return [];

  console.log(
    `[indexnow] slug changes: +${added.length} added, -${removed.length} removed`,
  );
  // Changed product pages + the listings they appear in (home + all hubs).
  return [
    ...hubUrls(),
    ...added.map((s) => `${SITE_URL}/${s}`),
    ...removed.map((s) => `${SITE_URL}/${s}`),
  ];
}

function allUrls() {
  const sitemap = join(ROOT, "public", "sitemap.xml");
  if (existsSync(sitemap)) {
    const xml = readFileSync(sitemap, "utf-8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
      m[1].trim(),
    );
    if (locs.length) {
      console.log(`[indexnow] --all: ${locs.length} URLs from sitemap.xml`);
      return locs;
    }
  }
  // Fallback: hubs + every product slug.
  const slugs = slugSetFromJson(
    readFileSync(join(ROOT, "data", "slugs.json"), "utf-8"),
  );
  console.log(
    `[indexnow] --all: sitemap absent, using hubs + ${slugs.size} slugs`,
  );
  return [...hubUrls(), ...[...slugs].map((s) => `${SITE_URL}/${s}`)];
}

// --- main -------------------------------------------------------------------
let urls = ALL ? allUrls() : incrementalUrls();
// Dedupe, keep same-host only (IndexNow rejects cross-host URL lists).
urls = [...new Set(urls)].filter((u) => {
  try {
    return new URL(u).host === HOST;
  } catch {
    return false;
  }
});

if (urls.length === 0) {
  console.log("[indexnow] no URLs to submit; done.");
  process.exit(0);
}

const payload = {
  host: HOST,
  key: INDEXNOW_KEY,
  keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
  urlList: urls,
};

if (DRY) {
  console.log("[indexnow] DRY RUN — would POST:");
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
});

// 200 OK / 202 Accepted are both success. Anything else is logged loudly,
// but we exit 0 so a transient IndexNow hiccup never fails the data job
// (the sitemap remains the source of truth for crawlers).
const body = await res.text().catch(() => "");
if (res.status === 200 || res.status === 202) {
  console.log(`[indexnow] submitted ${urls.length} URL(s) — ${res.status}`);
} else {
  console.error(
    `[indexnow] submission returned ${res.status} ${res.statusText} — ${body.slice(0, 300)}`,
  );
}
process.exit(0);
