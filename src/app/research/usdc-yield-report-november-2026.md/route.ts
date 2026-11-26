// The report as Markdown, served at /research/usdc-yield-report-november-2026.md
// next to its HTML page (same data file, same ranking).
import { reportMarkdown } from "@/lib/usdc-yield-report";

export const dynamic = "force-static";

export function GET() {
  return new Response(reportMarkdown(), { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
