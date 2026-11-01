import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDocsPage } from "@/lib/docs";
import { DocsArticle } from "@/components/docs/docs-article";
import { docsBreadcrumbJsonLd, docsMetadata } from "@/components/docs/docs-meta";

export function generateMetadata(): Metadata {
  const page = getDocsPage([]);
  return page ? docsMetadata(page) : {};
}

export default function DocsHome() {
  const page = getDocsPage([]);
  if (!page) notFound();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: docsBreadcrumbJsonLd(page) }} />
      <DocsArticle page={page} />
    </>
  );
}
