// Static Markdown versions of the ranking and product pages (src/lib/agent-md).
// Exported to out/agent-md/<file>; scripts/build-markdown.mjs moves each to
// public/<file> so it is served at /<path>.md next to its HTML page.
import { agentPages, renderAgentPage } from "@/lib/agent-md";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await agentPages()).map((p) => ({ file: p.file }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const body = await renderAgentPage(file);
  if (body == null) return new Response("Not found", { status: 404 });
  return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
