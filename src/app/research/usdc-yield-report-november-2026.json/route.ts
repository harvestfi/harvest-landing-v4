// The dataset behind the report, served at /research/usdc-yield-report-november-2026.json:
// every vault, its rates and its daily share price.
import { reportJson } from "@/lib/usdc-yield-report";

export const dynamic = "force-static";

export function GET() {
  return Response.json(reportJson());
}
