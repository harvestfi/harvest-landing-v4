// The Markdown pages the build must produce, with the HTML page each mirrors.
// scripts/build-markdown.mjs fails the build when the files and this list
// disagree.
import { agentPages } from "@/lib/agent-md";

export const dynamic = "force-static";

export async function GET() {
  const pages = await agentPages();
  return Response.json({ count: pages.length, pages: pages.map((p) => ({ file: p.file, canonical: p.canonical, kind: p.kind })) });
}
