"use client";

// Admin > SEO / AI Summary: data exports.
//
// Downloads the funnel's full session history as CSV or JSON so it can be fed
// to a spreadsheet or to an AI agent as context. Three shapes, two scopes:
//
//   Sessions CSV - one row per session, every scalar we hold.
//   Actions CSV  - one row per action (visit / click / deposit / withdraw).
//                  This is the finest granularity in the pipeline: the raw
//                  per-event timeline, session-attributed.
//   JSON         - metadata envelope + sessions with their nested action
//                  timelines. The richest single artefact, and the one to hand
//                  an agent: it carries a field glossary so the consumer does
//                  not have to guess what a column means.
//
//   Scope "all"  - every session in the group (the default page view).
//   Scope "deep" - only sessions whose first touch was NOT the homepage, i.e.
//                  exactly what the "Isolate direct" toggle shows.
//
// BOTS ARE ALWAYS EXCLUDED, in both scopes and every format, regardless of the
// page's "Show bots" toggle. The raw table is mostly crawler traffic, so an
// export that included it would poison any downstream analysis. Bot detection
// is the same logic the funnel itself uses (isBotRow + spoofed-fingerprint
// cluster detection), applied upstream in funnel-summary.

import type { SeoSession } from "./funnel-summary";

type Scope = "all" | "deep";

const iso = (ms: number) =>
  Number.isFinite(ms) && ms > 0 && ms !== Infinity
    ? new Date(ms).toISOString()
    : "";

// RFC-4180 escaping: quote when the value holds a comma, quote, newline or a
// leading/trailing space, and double any embedded quote.
function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: unknown[][]): string {
  return [header.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n") + "\n";
}

function stageOf(s: SeoSession): "deposited" | "reached_app" | "acquired" {
  if (s.deposited) return "deposited";
  if (s.reached) return "reached_app";
  return "acquired";
}

const SESSION_HEADER = [
  "session_id",
  "first_touch_engine",
  "all_engines",
  "source_domain",
  "entry_page",
  "is_deep_landing",
  "country",
  "device",
  "device_fingerprint",
  "merged_raw_sessions",
  "page_count",
  "action_count",
  "stage",
  "reached_app",
  "deposited",
  "first_visit_at",
  "first_click_at",
  "first_deposit_at",
  "last_activity_at",
  "wallet_address",
  "wallet_status",
  "net_worth_usd",
];

function sessionRow(s: SeoSession): unknown[] {
  return [
    s.sessionId,
    s.seoName,
    s.seoEngines.join(" | "),
    s.srcDomain ?? "",
    s.entryPage,
    s.entryPage !== "/",
    s.country ?? "",
    s.device ?? "",
    s.fp ?? "",
    s.mergedCount,
    s.pageCount,
    s.actions.length,
    stageOf(s),
    s.reached,
    s.deposited,
    iso(s.firstVisitMs),
    iso(s.firstClickMs),
    iso(s.firstDepositMs),
    iso(s.latestMs),
    s.wallet ?? "",
    s.status ?? "",
    s.netWorth ?? "",
  ];
}

const ACTION_HEADER = [
  "session_id",
  "first_touch_engine",
  "entry_page",
  "country",
  "device",
  "action_time",
  "action_kind",
  "page",
  "vault_slug",
  "wallet_address",
  "chain",
  "tx_hash",
];

// Field glossary shipped inside the JSON so an agent consuming it does not have
// to infer semantics from column names.
const FIELD_NOTES: Record<string, string> = {
  first_touch_engine:
    "The search/AI engine that first touched the session. Multi-touch sessions list every engine in all_engines.",
  entry_page:
    "page_path of the session's first recorded visit. '/' means the visitor landed on the homepage.",
  is_deep_landing:
    "true when entry_page is not '/', i.e. search dropped the visitor straight onto a content page.",
  device_fingerprint:
    "Derived from user agent + screen/viewport dimensions. Used to coalesce repeat sessions from one device.",
  merged_raw_sessions:
    "How many raw Supabase session ids folded into this visitor (1 = no merging).",
  stage: "Furthest funnel stage reached: acquired -> reached_app -> deposited.",
  first_click_at:
    "First outbound click into app.harvest.finance. Empty when the session never clicked through.",
  first_deposit_at:
    "First on-chain deposit attributed to this session's wallet. Empty when it never deposited.",
  net_worth_usd:
    "Wallet's USD balance captured at connect time (DeBank). Empty when unknown.",
  actions:
    "Per-session event timeline, newest first. kind is one of visit | click | deposit | withdraw.",
};

function download(filename: string, mime: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so Safari has taken the blob before it disappears.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function SeoExport({
  sessions,
  group,
}: {
  // Every session in the group with bots ALREADY removed by the caller.
  sessions: SeoSession[];
  group: string;
}) {
  const slug = group.toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);
  const scoped = (scope: Scope) =>
    scope === "deep" ? sessions.filter((s) => s.entryPage !== "/") : sessions;
  const name = (scope: Scope, kind: string, ext: string) =>
    `harvest-${slug}-${scope === "deep" ? "deep-landing" : "all"}-${kind}-${stamp}.${ext}`;

  const sessionsCsv = (scope: Scope) => {
    const rows = scoped(scope)
      .slice()
      .sort((a, b) => a.firstVisitMs - b.firstVisitMs)
      .map(sessionRow);
    download(name(scope, "sessions", "csv"), "text/csv", toCsv(SESSION_HEADER, rows));
  };

  const actionsCsv = (scope: Scope) => {
    const rows: unknown[][] = [];
    for (const s of scoped(scope)) {
      // Oldest-first inside each session so the file reads as a timeline.
      for (const a of s.actions.slice().reverse()) {
        rows.push([
          s.sessionId,
          s.seoName,
          s.entryPage,
          s.country ?? "",
          s.device ?? "",
          a.time,
          a.kind,
          a.page ?? "",
          a.vaultSlug ?? "",
          a.wallet ?? "",
          a.chain ?? "",
          a.tx ?? "",
        ]);
      }
    }
    rows.sort((x, y) => String(x[5]).localeCompare(String(y[5])));
    download(name(scope, "actions", "csv"), "text/csv", toCsv(ACTION_HEADER, rows));
  };

  const json = (scope: Scope) => {
    const list = scoped(scope)
      .slice()
      .sort((a, b) => a.firstVisitMs - b.firstVisitMs);
    const payload = {
      dataset: `Harvest ${group} acquisition funnel`,
      generated_at: new Date().toISOString(),
      source: "Harvest first-party analytics (Supabase frontpage_visits, outbound clicks, wallet connects, on-chain deposit/withdraw events)",
      channel_group: group,
      scope:
        scope === "deep"
          ? "Deep landings only: sessions whose first touch was a content page, not the homepage."
          : "All sessions in this channel group (the page's default view).",
      bots_excluded: true,
      bot_filter:
        "Known crawler user agents plus spoofed-fingerprint clusters, removed with the same logic the on-page funnel uses.",
      session_count: list.length,
      action_count: list.reduce((n, s) => n + s.actions.length, 0),
      deposited_sessions: list.filter((s) => s.deposited).length,
      reached_app_sessions: list.filter((s) => s.reached).length,
      field_notes: FIELD_NOTES,
      sessions: list.map((s) => ({
        session_id: s.sessionId,
        first_touch_engine: s.seoName,
        all_engines: s.seoEngines,
        source_domain: s.srcDomain,
        entry_page: s.entryPage,
        is_deep_landing: s.entryPage !== "/",
        country: s.country,
        device: s.device,
        device_fingerprint: s.fp || null,
        merged_raw_sessions: s.mergedCount,
        page_count: s.pageCount,
        stage: stageOf(s),
        reached_app: s.reached,
        deposited: s.deposited,
        first_visit_at: iso(s.firstVisitMs) || null,
        first_click_at: iso(s.firstClickMs) || null,
        first_deposit_at: iso(s.firstDepositMs) || null,
        last_activity_at: iso(s.latestMs) || null,
        wallet_address: s.wallet,
        wallet_status: s.status,
        net_worth_usd: s.netWorth,
        actions: s.actions.map((a) => ({
          time: a.time,
          kind: a.kind,
          page: a.page,
          vault_slug: a.vaultSlug,
          wallet: a.wallet,
          chain: a.chain,
          tx: a.tx,
        })),
      })),
    };
    download(name(scope, "context", "json"), "application/json", JSON.stringify(payload, null, 2));
  };

  const deepCount = sessions.filter((s) => s.entryPage !== "/").length;

  return (
    <div className="sx-wrap">
      <div className="sx-head">
        <span className="sx-title">Export</span>
        <span className="sx-meta">
          full history · bots excluded · {sessions.length.toLocaleString("en-US")} sessions
          {" · "}
          {deepCount.toLocaleString("en-US")} deep landings
        </span>
      </div>
      <div className="sx-rows">
        {(["all", "deep"] as Scope[]).map((scope) => (
          <div className="sx-row" key={scope}>
            <span className="sx-label">
              {scope === "all" ? "Default view" : "Isolate direct"}
              <em>
                {scope === "all"
                  ? `${sessions.length.toLocaleString("en-US")} sessions`
                  : `${deepCount.toLocaleString("en-US")} sessions`}
              </em>
            </span>
            <span className="sx-btns">
              <button type="button" className="sx-btn" onClick={() => sessionsCsv(scope)}>
                Sessions CSV
              </button>
              <button type="button" className="sx-btn" onClick={() => actionsCsv(scope)}>
                Actions CSV
              </button>
              <button
                type="button"
                className="sx-btn sx-btn-primary"
                onClick={() => json(scope)}
                title="Richest format: sessions with nested action timelines plus a field glossary. Best for feeding an AI agent."
              >
                JSON for AI
              </button>
            </span>
          </div>
        ))}
      </div>
      <p className="sx-note">
        Sessions CSV is one row per session. Actions CSV is one row per event
        (visit, click, deposit, withdraw), the finest granularity we hold. JSON
        carries the same sessions with their full action timelines plus a field
        glossary, so an agent can read it without extra context.
      </p>
    </div>
  );
}
