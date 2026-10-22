#!/usr/bin/env node
// Places the agent Markdown pages at /<path>.md.
//
// Next exports them to public/agent-md/<file> (src/app/agent-md), rendered
// from the same loaders as the HTML pages. This moves each to public/<file>,
// removes the staging directory, and fails the build when the files and the
// manifest of in-scope pages disagree, or when a page carries a value that
// did not render.
//
// Runs in the post-export phase of `npm run build` (after `mv out public`).

import { readFileSync, readdirSync, renameSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const PUBLIC = join(process.cwd(), "public");
const STAGE = join(PUBLIC, "agent-md");
const MANIFEST = join(STAGE, "manifest.json");

if (!existsSync(MANIFEST)) {
  console.error("[markdown] public/agent-md/manifest.json not found; run after `mv out public`.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf-8"));
const expected = new Set(manifest.pages.map((p) => p.file));
const produced = readdirSync(STAGE).filter((f) => f.endsWith(".md"));

const findings = [];
for (const f of expected) if (!produced.includes(f)) findings.push(`missing: ${f}`);
for (const f of produced) if (!expected.has(f)) findings.push(`not in manifest: ${f}`);

// A template slip shows up as a literal in the output, not as an error.
const UNRENDERED = /\bundefined\b|\bNaN\b|\[object Object\]|\bnull%|\$NaN/;
for (const f of produced) {
  const text = readFileSync(join(STAGE, f), "utf-8");
  const m = text.match(UNRENDERED);
  if (m) findings.push(`${f}: unrendered value "${m[0]}"`);
  if (!text.startsWith("---\n")) findings.push(`${f}: no front matter`);
}

// Never overwrite something the site already serves under the same name.
for (const f of produced) {
  if (existsSync(join(PUBLIC, f))) findings.push(`public/${f} already exists`);
}

const counts = manifest.pages.reduce((acc, p) => ({ ...acc, [p.kind]: (acc[p.kind] ?? 0) + 1 }), {});
console.log(
  `[markdown] in-scope pages: ${manifest.count} (${Object.entries(counts)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ")}); files produced: ${produced.length}`,
);

if (findings.length) {
  for (const f of findings) console.error(`    [X] ${f}`);
  console.error(`[markdown] ${findings.length} finding(s); build stopped.`);
  process.exit(1);
}

for (const f of produced) renameSync(join(STAGE, f), join(PUBLIC, f));
rmSync(STAGE, { recursive: true, force: true });
console.log(`[markdown] wrote ${produced.length} .md files to public/`);
