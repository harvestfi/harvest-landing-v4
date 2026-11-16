// The site's facts as one file: counts, the derived APY figures
// and data dates the pages print. The post-export scripts (build-data-json,
// build-seo-static) read public/facts.json instead of recomputing from
// vaults.json, so the JSON, llms.txt and HTML cannot disagree.
import { getSiteFacts } from "@/lib/site-facts";

export const dynamic = "force-static";

export async function GET() {
  return Response.json(await getSiteFacts());
}
