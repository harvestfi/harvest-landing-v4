import { FunnelSummary } from "@/components/admin/funnel-summary";

// Admin > SEO Summary. The search-engine funnel. Renders the shared
// FunnelSummary scoped to the "SEO" source group; the AI Summary page
// (/control-room/ai) renders the same component scoped to "AI".

export default function SeoSummaryPage() {
  return (
    <FunnelSummary
      group="SEO"
      copy={{
        title: "SEO Summary",
        description:
          "The search funnel at a glance: of the people the index acquired from a search engine (Google, Bing, DuckDuckGo, Brave, Yandex, Baidu), how many crossed into app.harvest.finance and how many deposited. Every stage, the chart, and the table below are scoped to the same SEO sessions. The table lists one row per session; expand a row to see that session's actions.",
        acquiredLabel: "Acquired via search",
        engineFilterLabel: "Search engine filter",
        engineHint:
          "Search engine the session came through (Google, Bing, DuckDuckGo, Brave, Yandex, Baidu). Multi-touch: a session is listed under every engine that touched it, so picking one shows all sessions it appeared in - not only the ones it acquired first. Only search-touched sessions appear on this page.",
        stageHint:
          "Funnel stage in view: Acquired (landed from search), Reached app (clicked through to the app), or Deposited. The chart and table follow the chosen stage.",
        isolateHint:
          "Hides SEO sessions that first landed on the homepage (/), leaving only the ones where search dropped the visitor straight onto a content page - e.g. /usdc, /hyperevm, /usdc-autopilot-base. Those are the pages whose own SEO is doing the work: the strategy or asset content itself is what got found and clicked, not the brand homepage. Use it to judge how well individual product and asset pages rank and convert on their own, separate from people who arrive at the homepage and browse in.",
        sampleEngines: ["Google", "Bing", "DuckDuckGo", "Brave", "Yandex", "Baidu"],
        sampleDomains: {
          Google: "google.com",
          Bing: "bing.com",
          DuckDuckGo: "duckduckgo.com",
          Brave: "search.brave.com",
          Yandex: "yandex.com",
          Baidu: "baidu.com",
        },
      }}
    />
  );
}
