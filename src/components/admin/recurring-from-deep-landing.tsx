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

    return {
      discoverers,
      recurring,
      returnedHome,
      rate: discoverers ? recurring / discoverers : 0,
      landings,
      returnDist: [...returnDist.entries()].sort((a, b) => b[1] - a[1]),
      loaded: true,
    };
  }, [rows]);

  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

  return (
    <section className="uni-hub-section" style={{ marginTop: 28 }}>
      <header className="uni-hub-section-head">
        <div>
          <h2 className="uni-hub-section-title">Deep-landing loyalty</h2>
          <span className="uni-hub-section-meta">
            of visitors search dropped straight onto a content page, how many came
            back later to look around
          </span>
        </div>
      </header>

      {!model ? (
        <div className="uni-hub-empty">Loading…</div>
      ) : model.discoverers === 0 ? (
        <div className="uni-hub-empty">
          No deep-landing discoveries captured yet.
        </div>
      ) : (
        <>
          <div className="uni-hub-stats">
            <div className="uni-hub-stat">
              <div className="uni-hub-stat-label">Deep-landing discoveries</div>
              <div className="uni-hub-stat-value">
                {model.discoverers.toLocaleString("en-US")}
              </div>
              <div className="uni-hub-stat-sub">
                first touch was a content page from search
              </div>
            </div>
            <div className="uni-hub-stat">
              <div className="uni-hub-stat-label">Became recurring</div>
              <div className="uni-hub-stat-value">
                {model.recurring.toLocaleString("en-US")}
              </div>
              <div className="uni-hub-stat-sub">
                {pct(model.rate)} of discoveries returned later
              </div>
            </div>
            <div className="uni-hub-stat">
              <div className="uni-hub-stat-label">Returned to homepage</div>
              <div className="uni-hub-stat-value">
                {model.returnedHome.toLocaleString("en-US")}
              </div>
              <div className="uni-hub-stat-sub">
                came back to the homepage to check rates
              </div>
            </div>
          </div>

          <div className="aq-chart-card" style={{ marginTop: 16 }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-4 font-medium">Landing page (discovery)</th>
                  <th className="py-2 pr-4 font-medium text-right">Discovered</th>
                  <th className="py-2 pr-4 font-medium text-right">Recurring</th>
                  <th className="py-2 font-medium text-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {model.landings.map((l) => (
                  <tr key={l.page} className="border-t border-gray-100">
                    <td className="py-2 pr-4 font-mono text-xs">{l.page}</td>
                    <td className="py-2 pr-4 text-right">{l.disc}</td>
                    <td className="py-2 pr-4 text-right">{l.rec}</td>
                    <td className="py-2 text-right font-semibold">{pct(l.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {model.returnDist.length > 0 ? (
            <p className="uni-hub-section-meta" style={{ marginTop: 12 }}>
              Where they return:{" "}
              {model.returnDist
                .map(([cat, n]) => `${cat} (${n})`)
                .join(" · ")}
              . A return is a visit more than 6 hours after the first touch;
              visitors are matched by device fingerprint, bots excluded.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
