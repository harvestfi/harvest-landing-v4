import { FunnelSummary } from "@/components/admin/funnel-summary";

// Admin > AI Summary. The AI-answer-engine funnel - the same chart, funnel
// stats, filters and session table as the SEO Summary, but scoped to sessions
// the index was cited into by an AI assistant (ChatGPT, Perplexity, Claude,
// Gemini) instead of a search engine.

export default function AiSummaryPage() {
  return (
    <FunnelSummary
      group="AI"
      copy={{
        title: "AI Summary",
        description:
          "The AI-answer-engine funnel at a glance: of the people the index acquired from an AI assistant (ChatGPT, Perplexity, Claude, Gemini), how many crossed into app.harvest.finance and how many deposited. Every stage, the chart, and the table below are scoped to the same AI sessions. The table lists one row per session; expand a row to see that session's actions.",
        acquiredLabel: "Acquired via AI",
        engineFilterLabel: "AI engine filter",
        engineHint:
          "AI assistant the session came through (ChatGPT, Perplexity, Claude, Gemini). Multi-touch: a session is listed under every engine that touched it, so picking one shows all sessions it appeared in - not only the ones it acquired first. Only AI-touched sessions appear on this page.",
        stageHint:
          "Funnel stage in view: Acquired (landed from an AI assistant), Reached app (clicked through to the app), or Deposited. The chart and table follow the chosen stage.",
        isolateHint:
          "Hides AI sessions that first landed on the homepage (/), leaving only the ones where the AI assistant dropped the visitor straight onto a content page - e.g. /usdc, /hyperevm, /usdc-autopilot-base. Those are the pages whose own content is doing the work: the strategy or asset page itself is what got cited and clicked, not the brand homepage. Use it to judge how well individual product and asset pages get surfaced and convert on their own, separate from people who arrive at the homepage and browse in.",
        sampleEngines: ["ChatGPT", "Perplexity", "Claude", "Gemini"],
        sampleDomains: {
          ChatGPT: "chatgpt.com",
          Perplexity: "perplexity.ai",
          Claude: "claude.ai",
          Gemini: "gemini.google.com",
        },
      }}
    />
  );
}
