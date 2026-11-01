import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDocsPage, getDocsSlugs } from "@/lib/docs";
import { DocsArticle } from "@/components/docs/docs-article";
import { docsBreadcrumbJsonLd, docsMetadata } from "@/components/docs/docs-meta";

export const dynamicParams = false;

export function generateStaticParams() {
  return getDocsSlugs().map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocsPage(slug);
  return page ? docsMetadata(page) : {};
}

export default async function DocsPage({ params }: Props) {
  const { slug } = await params;
  const page = getDocsPage(slug);
  if (!page) notFound();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: docsBreadcrumbJsonLd(page) }} />
      <DocsArticle page={page} />
    </>
  );
}
