"use client";

// Admin > SEO Summary extension: "Deep-landing loyalty".
//
// Answers a single question: of the people search dropped straight onto a
// content page (a deep landing like /usdc or /report/aerodrome, NOT the brand
// homepage), how many came back later — a separate visiting occasion — to look
// around again (homepage, another product, a report). That return is the signal
// that a content page didn't just get found, it earned a recurring visitor.
//
// A "visitor" is identified by device fingerprint (falling back to session id),
// so a return that mints a fresh session id still counts. A "return" is a visit
// more than RETURN_GAP after the first touch. Bots and spoofed-fingerprint
// fleets are filtered out with the same logic as the SEO funnel.
//
// The whole block is wrapped in .uni-hub-test so it inherits the admin design
// system (the uni-hub-* and dll-* styles are scoped under it). Its own chart is
// the .dll-* block in admin.css.

import { useEffect, useMemo, useState } from "react";
import { supabaseSelectAll } from "@/lib/supabase";
import { classifyVisit, channelGroup } from "@/lib/channels";
import {
  isBotRow,
  isNonPagePath,
  fingerprintKey,
  detectSpoofedFingerprints,
} from "@/lib/bots";

interface VisitRow {
  created_at: string;
  session_id: string | null;
  page_path: string | null;
  source: string | null;
  referrer: string | null;
  is_bot: boolean | null;
  user_agent: string | null;
  screen_width: number | null;
  screen_height: number | null;
  viewport_width: number | null;
  viewport_height: number | null;
  country: string | null;
  timezone: string | null;
}

const COLS =
  "select=created_at,session_id,page_path,source,referrer,is_bot,user_agent,screen_width,screen_height,viewport_width,viewport_height,country,timezone&order=created_at.asc";
// A visit more than this after the first touch is a separate occasion (a return).
const RETURN_GAP_MS = 6 * 60 * 60 * 1000;

type ReturnCat = "Homepage" | "Report" | "Product / asset";
function returnCat(path: string): ReturnCat {
  if (path === "/") return "Homepage";
  if (path.startsWith("/report/")) return "Report";
  return "Product / asset";
}

export function RecurringFromDeepLanding() {
  const [rows, setRows] = useState<VisitRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await supabaseSelectAll<VisitRow>("frontpage_visits", COLS);
        if (alive) setRows(r);
      } catch {
        if (alive) setRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const model = useMemo(() => {
    if (!rows) return null;
    const clean = rows.filter((v) => !isBotRow(v));
    const poisoned = detectSpoofedFingerprints(clean);
    const idOf = (v: VisitRow) => {
      const fp = fingerprintKey(v);
      return fp && !poisoned.has(fp) ? `fp:${fp}` : `sid:${v.session_id ?? "?"}`;
    };

    const byVisitor = new Map<string, VisitRow[]>();
    for (const v of clean) {
      const k = idOf(v);
      const arr = byVisitor.get(k);
      if (arr) arr.push(v);
      else byVisitor.set(k, [v]);
    }

    let discoverers = 0;
    let recurring = 0;
    let returnedHome = 0;
    const byLanding = new Map<string, { disc: number; rec: number }>();
    const returnDist = new Map<ReturnCat, number>();

    for (const visits of byVisitor.values()) {
      visits.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      const first = visits[0];
      const entry = first.page_path || "/";
      const isSeo = channelGroup(classifyVisit(first.source, first.referrer)) === "SEO";
      const isDeep = entry !== "/" && !isNonPagePath(entry);
      if (!isSeo || !isDeep) continue;

      discoverers++;
      const lb = byLanding.get(entry) ?? { disc: 0, rec: 0 };
      lb.disc++;

      const firstMs = +new Date(first.created_at);
      const returns = visits
        .slice(1)
        .filter((v) => +new Date(v.created_at) - firstMs > RETURN_GAP_MS);
      if (returns.length > 0) {
        recurring++;
        lb.rec++;
        let hitHome = false;
        for (const v of returns) {
          const cat = returnCat(v.page_path || "/");
          if (cat === "Homepage") hitHome = true;
          returnDist.set(cat, (returnDist.get(cat) ?? 0) + 1);
        }
        if (hitHome) returnedHome++;
      }
      byLanding.set(entry, lb);
    }

    const landings = [...byLanding.entries()]
      .map(([page, x]) => ({ page, ...x, rate: x.disc ? x.rec / x.disc : 0 }))
      .sort((a, b) => b.rec - a.rec || b.disc - a.disc)
      .slice(0, 12);
    const maxDisc = landings.reduce((m, l) => Math.max(m, l.disc), 1);

    return {
      discoverers,
      recurring,
      returnedHome,
      rate: discoverers ? recurring / discoverers : 0,
      homeRate: discoverers ? returnedHome / discoverers : 0,
      landings,
      maxDisc,
      returnDist: [...returnDist.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [rows]);

  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
  const w = (v: number) => `${Math.max(v * 100, v > 0 ? 2 : 0)}%`;

  return (
    <div className="uni-hub-test" style={{ marginTop: 28 }}>
      <section className="uni-hub-section">
        <header className="uni-hub-section-head">
          <div>
            <h2 className="uni-hub-section-title">Deep-landing loyalty</h2>
            <span className="uni-hub-section-meta">
              of visitors search dropped straight onto a content page, how many
              came back later to look around
            </span>
          </div>
        </header>

        {!model ? (
          <div className="dll-empty">Loading…</div>
        ) : model.discoverers === 0 ? (
          <div className="dll-empty">No deep-landing discoveries captured yet.</div>
        ) : (
          <>
            <div className="uni-hub-stats dll-stats">
              <div className="uni-hub-stat">
                <div className="uni-hub-stat-label">Deep-landing discoveries</div>
                <div className="uni-hub-stat-value">
                  {model.discoverers.toLocaleString("en-US")}
                </div>
                <div className="dll-stat-sub">
                  first touch was a content page from search
                </div>
              </div>
              <div className="uni-hub-stat">
                <div className="uni-hub-stat-label">Became recurring</div>
                <div className="uni-hub-stat-value">
                  {model.recurring.toLocaleString("en-US")}
                </div>
                <div className="dll-stat-sub">
                  {pct(model.rate)} of discoveries returned later
                </div>
              </div>
              <div className="uni-hub-stat">
                <div className="uni-hub-stat-label">Returned to homepage</div>
                <div className="uni-hub-stat-value">
                  {model.returnedHome.toLocaleString("en-US")}
                </div>
                <div className="dll-stat-sub">
                  came back to the homepage to check rates
                </div>
              </div>
            </div>

            {/* Loyalty funnel: discovery -> recurring -> returned to homepage. */}
            <div className="dll-card">
              <div className="dll-card-title">From discovery to recurring visit</div>
              <div className="dll-funnel">
                {[
                  {
                    label: "Discovered via deep landing",
                    value: model.discoverers,
                    rate: 1,
                    tone: "disc",
                  },
                  {
                    label: "Became recurring",
                    value: model.recurring,
                    rate: model.rate,
                    tone: "rec",
                  },
                  {
                    label: "Returned to homepage",
                    value: model.returnedHome,
                    rate: model.homeRate,
                    tone: "home",
                  },
                ].map((s) => (
                  <div className="dll-funnel-row" key={s.label}>
                    <span className="dll-funnel-label">{s.label}</span>
                    <span className="dll-funnel-track">
                      <span
                        className="dll-funnel-fill"
                        data-tone={s.tone}
                        style={{ width: w(s.rate) }}
                      />
                    </span>
                    <span className="dll-funnel-val">
                      {s.value.toLocaleString("en-US")}
                      <em>{pct(s.rate)}</em>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Which landing pages earn recurring visitors. */}
            <div className="dll-card">
              <div className="dll-card-title">
                Which landing pages earn recurring visitors
              </div>
              <div className="dll-bars">
                {model.landings.map((l) => (
                  <div className="dll-bar-row" key={l.page}>
                    <span className="dll-bar-name" title={l.page}>
                      {l.page}
                    </span>
                    <span className="dll-bar-track">
                      <span
                        className="dll-bar-disc"
                        style={{ width: w(l.disc / model.maxDisc) }}
                      />
                      <span
                        className="dll-bar-rec"
                        style={{ width: w(l.rec / model.maxDisc) }}
                      />
                    </span>
                    <span className="dll-bar-val">
                      {l.rec}/{l.disc}
                      <em>{pct(l.rate)}</em>
                    </span>
                  </div>
                ))}
              </div>
              <div className="dll-legend">
                <span>
                  <i className="dll-dot dll-dot-disc" /> Discovered
                </span>
                <span>
                  <i className="dll-dot dll-dot-rec" /> Became recurring
                </span>
              </div>
            </div>

            {model.returnDist.length > 0 ? (
              <p className="dll-note">
                Where they return:{" "}
                {model.returnDist.map(([cat, n]) => `${cat} (${n})`).join(" · ")}
                . A return is a visit more than 6 hours after the first touch;
                visitors are matched by device fingerprint, bots excluded.
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
