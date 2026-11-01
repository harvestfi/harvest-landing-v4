// Harvest Docs content (harvest.finance/docs). Pages are pre-rendered HTML
// fragments in content/docs/pages; metadata and the side menu come from
// content/docs/pages.json and content/docs/nav.json. Read at build time only.

import { readFileSync } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "content", "docs");

export type DocsTocItem = { depth: number; id: string; text: string };
export type DocsLink = { title: string; path: string };
export type DocsPage = {
  path: string;
  url: string;
  title: string;
  meta_title: string;
  description: string;
  html: string;
  markdown: string;
  markdown_url: string;
  toc: DocsTocItem[];
  breadcrumbs: DocsLink[];
  prev: DocsLink | null;
  next: DocsLink | null;
};
export type DocsNavItem = DocsLink & { children?: DocsNavItem[] };
export type DocsNavSection = { section: string; icon: string; items: DocsNavItem[] };

let pages: DocsPage[] | null = null;
let nav: DocsNavSection[] | null = null;

export function getDocsPages(): DocsPage[] {
  pages ??= JSON.parse(readFileSync(path.join(DIR, "pages.json"), "utf8")) as DocsPage[];
  return pages;
}

export function getDocsNav(): DocsNavSection[] {
  nav ??= JSON.parse(readFileSync(path.join(DIR, "nav.json"), "utf8")) as DocsNavSection[];
  return nav;
}

export function getDocsPage(slug: string[] = []): DocsPage | undefined {
  const p = "/docs" + (slug.length ? "/" + slug.join("/") : "");
  return getDocsPages().find((x) => x.path === p);
}

export function getDocsHtml(page: DocsPage): string {
  return readFileSync(path.join(DIR, page.html), "utf8");
}

// Slugs for generateStaticParams (every page except the /docs root).
export function getDocsSlugs(): string[][] {
  return getDocsPages()
    .filter((p) => p.path !== "/docs")
    .map((p) => p.path.replace(/^\/docs\//, "").split("/"));
}
