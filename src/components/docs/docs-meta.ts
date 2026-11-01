import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { breadcrumbSchema } from "@/lib/jsonld";
import type { DocsPage } from "@/lib/docs";

export function docsMetadata(page: DocsPage): Metadata {
  const url = SITE_URL + page.path;
  return {
    title: { absolute: page.meta_title },
    description: page.description || undefined,
    openGraph: { title: page.meta_title, description: page.description || undefined, url, siteName: SITE_NAME, type: "article" },
    alternates: { canonical: url, types: { "text/markdown": page.markdown_url.replace("https://harvest.finance", SITE_URL) } },
  };
}

export function docsBreadcrumbJsonLd(page: DocsPage): string {
  const crumbs = [
    { name: "Harvest", url: SITE_URL + "/" },
    { name: "Docs", url: SITE_URL + "/docs" },
    ...page.breadcrumbs.filter((b) => b.path !== "/docs").map((b) => ({ name: b.title, url: SITE_URL + b.path })),
    ...(page.path === "/docs" ? [] : [{ name: page.title, url: SITE_URL + page.path }]),
  ];
  return JSON.stringify(breadcrumbSchema(crumbs));
}
