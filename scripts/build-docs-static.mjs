#!/usr/bin/env node
// Copies the static Harvest Docs files (Markdown versions of every page,
// llms.txt, images and Media Kit files) from content/docs/static into
// public/docs after the Next export. public/ is the build output here,
// so these files live in content/ and are copied in at build time.
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "content", "docs", "static");
const OUT = join(ROOT, "public", "docs");

if (!existsSync(SRC)) throw new Error("content/docs/static not found");
cpSync(SRC, OUT, { recursive: true });
console.log("[docs-static] copied content/docs/static → public/docs");
