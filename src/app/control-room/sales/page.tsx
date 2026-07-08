"use client";

// Sales - the ranking-to-app conversion funnel. Answers: of the people who
// SAW a product in a ranking (on the homepage / an asset hub / a network
// hub), how many opened its product page, and how many then went into the
// app? And what is a top-1 / top-2 / top-3 slot actually worth?
//
// How it's stitched (all client-side, no new tracking needed):
//  - frontpage_visits + outbound_clicks share session_id, so a visitor's
//    path is reconstructed in time order.
//  - public/data/sales-surfaces.json gives, per surface page, the ordered
//    product list (apy24h-desc, live-filtered - the same ranking visitors
//    see). A view of a surface = an impression of the products ranked on it
//    (capped to the top IMPRESSION_DEPTH, i.e. what's plausibly seen).
//  - Impression -> Product page: the session later views /<slug>, AND that
//    product-page view was PRECEDED by a surface impression. A session that
//    landed straight on the product page (e.g. SEO) has no prior impression,
//    so it is excluded automatically - exactly the "exclude direct landings"
//    requirement.
//  - Product page -> Into app: the session fired any into-app outbound click
//    after the product-page view.
//
// Caveat surfaced in the UI: positions use the CURRENT ranking as a proxy
// for historical visits (rankings aren't snapshotted yet), and "saw" means
// "viewed a page listing it in the top slots", not a scroll-tracked view.

import { useEffect, useMemo, useState } from "react";
import { supabaseSelectAll } from "@/lib/supabase";
import { FilterHint } from "@/components/admin/filter-hint";
import {
  TimeframeSelector,
  resolveDays,
  type Timeframe,
} from "@/components/admin/timeframe-selector";
import "../../_styles/asset-hub.css";

// Only the top slots of a ranking are plausibly "seen" on a page view; we
// don't count a product buried at position 40 as an impression.
const IMPRESSION_DEPTH = 10;

interface VisitRow {
  session_id: string | null;
  page_path: string | null;
  created_at: string;
  is_bot: boolean | null;
}
interface ClickRow {
  session_id: string | null;
  source_page: string | null;
  vault_slug: string | null;
  created_at: string;
  is_bot: boolean | null;
}
interface SurfacesDoc {
  generatedAt: string;
  surfaceGroups: { home: string[]; asset: string[]; network: string[] };
  surfaces: Record<string, string[]>;
  products: Record<
    string,
    { name: string; asset: string; chain: string; apy24h: number }
  >;
}

type SurfaceGroup = "all" | "home" | "asset" | "network";
const GROUP_OPTIONS: ReadonlyArray<{ value: SurfaceGroup; label: string }> = [
  { value: "all", label: "All surfaces" },
  { value: "home", label: "Homepage" },
  { value: "asset", label: "Asset hubs" },
  { value: "network", label: "Network hubs" },
];

// One (session, product) impression record - the funnel's unit.
interface Rec {
  slug: string;
  minPos: number; // most prominent position at which it was seen
  surfaces: Map<string, number>; // surface path -> position seen there
  productView: boolean; // opened /<slug> after an impression
  intoApp: boolean; // fired an into-app click after that product view
}

function normPath(p: string | null): string {
  if (!p) return "";
  let s = p.split("?")[0].split("#")[0];
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtNum = (v: number) => v.toLocaleString("en-US");

export default function SalesPage() {
  const [visits, setVisits] = useState<VisitRow[] | null>(null);
  const [clicks, setClicks] = useState<ClickRow[] | null>(null);
  const [surfaces, setSurfaces] = useState<SurfacesDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [group, setGroup] = useState<SurfaceGroup>("all");
  const [product, setProduct] = useState<string>(""); // "" = all products
  const [showBots, setShowBots] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, c, sRes] = await Promise.all([
          supabaseSelectAll<VisitRow>(
            "frontpage_visits",
            "select=session_id,page_path,created_at,is_bot&order=created_at.asc",
          ),
          supabaseSelectAll<ClickRow>(
            "outbound_clicks",
            "select=session_id,source_page,vault_slug,created_at,is_bot&order=created_at.asc",
          ),
          fetch("/data/sales-surfaces.json").then((r) =>
            r.ok ? (r.json() as Promise<SurfacesDoc>) : null,
          ),
        ]);
        if (cancelled) return;
        setVisits(v);
        setClicks(c);
        setSurfaces(sRes);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const oldestMs = useMemo(() => {
    if (!visits || visits.length === 0) return null;
    let o = Infinity;
    for (const v of visits) {
      const t = new Date(v.created_at).getTime();
      if (t < o) o = t;
    }
    return Number.isFinite(o) ? o : null;
  }, [visits]);

  // Build the funnel records for the current filters.
  const recs = useMemo<Rec[] | null>(() => {
    if (!visits || !clicks || !surfaces) return null;

    const days = resolveDays(timeframe, oldestMs);
    const cutoff = Date.now() - days * 86_400_000;

    // Which surfaces count as impressions for this group filter.
    const activePaths =
      group === "all"
        ? Object.keys(surfaces.surfaces)
        : surfaces.surfaceGroups[group] ?? [];
    const surfacePos = new Map<string, Map<string, number>>();
    for (const path of activePaths) {
      const ordered = surfaces.surfaces[path] ?? [];
      const m = new Map<string, number>();
      for (let i = 0; i < ordered.length && i < IMPRESSION_DEPTH; i++) {
        m.set(ordered[i], i + 1);
      }
      surfacePos.set(path, m);
    }
    const slugSet = new Set(Object.keys(surfaces.products));

    // Assemble sessions from visits + clicks inside the window.
    type Ev = { t: number; kind: "view" | "click"; path: string };
    const sessions = new Map<string, Ev[]>();
    const push = (id: string | null, ev: Ev) => {
      if (!id) return;
      let arr = sessions.get(id);
      if (!arr) sessions.set(id, (arr = []));
      arr.push(ev);
    };
    for (const v of visits) {
      if (!showBots && v.is_bot) continue;
      const t = new Date(v.created_at).getTime();
      if (t < cutoff) continue;
      push(v.session_id, { t, kind: "view", path: normPath(v.page_path) });
    }
    for (const c of clicks) {
      if (!showBots && c.is_bot) continue;
      const t = new Date(c.created_at).getTime();
      if (t < cutoff) continue;
      push(c.session_id, { t, kind: "click", path: normPath(c.source_page) });
    }

    const out: Rec[] = [];
    for (const evs of sessions.values()) {
      evs.sort((a, b) => a.t - b.t);
      const impr = new Map<
        string,
        { surfaces: Map<string, number>; minPos: number }
      >();
      const pView = new Map<string, number>(); // slug -> product-view time
      const clickTimes: number[] = [];
      for (const ev of evs) {
        if (ev.kind === "click") {
          clickTimes.push(ev.t);
          continue;
        }
        const posMap = surfacePos.get(ev.path);
        if (posMap) {
          // Surface view: every ranked product on it gets an impression.
          for (const [slug, pos] of posMap) {
            let e = impr.get(slug);
            if (!e) impr.set(slug, (e = { surfaces: new Map(), minPos: 99 }));
            if (!e.surfaces.has(ev.path)) e.surfaces.set(ev.path, pos);
            if (pos < e.minPos) e.minPos = pos;
          }
        } else if (ev.path.startsWith("/")) {
          // Product-page view - only counts if preceded by an impression.
          const slug = ev.path.slice(1);
          if (slugSet.has(slug) && impr.has(slug) && !pView.has(slug)) {
            pView.set(slug, ev.t);
          }
        }
      }
      for (const [slug, e] of impr) {
        const pvT = pView.get(slug);
        const hasPV = pvT !== undefined;
        const intoApp = hasPV && clickTimes.some((t) => t >= pvT);
        out.push({
          slug,
          minPos: e.minPos,
          surfaces: e.surfaces,
          productView: hasPV,
          intoApp,
        });
      }
    }
    return out;
  }, [visits, clicks, surfaces, group, timeframe, oldestMs, showBots]);

  // Product-scoped subset for the tiles + surface table.
  const scoped = useMemo(
    () => (recs && product ? recs.filter((r) => r.slug === product) : recs),
    [recs, product],
  );

  const totals = useMemo(() => {
    if (!scoped) return null;
    let impr = 0,
      pv = 0,
      app = 0;
    for (const r of scoped) {
      impr++;
      if (r.productView) pv++;
      if (r.intoApp) app++;
    }
    return { impr, pv, app };
  }, [scoped]);

  const byPosition = useMemo(() => {
    if (!recs) return null;
    const buckets: Record<string, { impr: number; pv: number; app: number }> = {
      "1": { impr: 0, pv: 0, app: 0 },
      "2": { impr: 0, pv: 0, app: 0 },
      "3": { impr: 0, pv: 0, app: 0 },
      "4–10": { impr: 0, pv: 0, app: 0 },
    };
    const rows = product ? recs.filter((r) => r.slug === product) : recs;
    for (const r of rows) {
      const key = r.minPos <= 3 ? String(r.minPos) : "4–10";
      const b = buckets[key];
      b.impr++;
      if (r.productView) b.pv++;
      if (r.intoApp) b.app++;
    }
    return buckets;
  }, [recs, product]);

  const leaderboard = useMemo(() => {
    if (!recs || !surfaces) return null;
    const agg = new Map<string, { impr: number; pv: number; app: number }>();
    for (const r of recs) {
      let a = agg.get(r.slug);
      if (!a) agg.set(r.slug, (a = { impr: 0, pv: 0, app: 0 }));
      a.impr++;
      if (r.productView) a.pv++;
      if (r.intoApp) a.app++;
    }
    const bestPos = (slug: string) => {
      let best = 99;
      for (const ordered of Object.values(surfaces.surfaces)) {
        const i = ordered.indexOf(slug);
        if (i >= 0 && i + 1 < best) best = i + 1;
      }
      return best;
    };
    return [...agg.entries()]
      .map(([slug, a]) => ({
        slug,
        name: surfaces.products[slug]?.name ?? slug,
        bestPos: bestPos(slug),
        ...a,
      }))
      .sort((x, y) => y.impr - x.impr);
  }, [recs, surfaces]);

  // Per-surface breakdown for the selected product.
  const surfaceRows = useMemo(() => {
    if (!recs || !product || !surfaces) return null;
    const agg = new Map<string, { impr: number; pv: number; app: number }>();
    for (const r of recs) {
      if (r.slug !== product) continue;
      for (const path of r.surfaces.keys()) {
        let a = agg.get(path);
        if (!a) agg.set(path, (a = { impr: 0, pv: 0, app: 0 }));
        a.impr++;
        if (r.productView) a.pv++;
        if (r.intoApp) a.app++;
      }
    }
    return [...agg.entries()]
      .map(([path, a]) => {
        const ordered = surfaces.surfaces[path] ?? [];
        return { path, pos: ordered.indexOf(product) + 1, ...a };
      })
      .sort((x, y) => y.impr - x.impr);
  }, [recs, product, surfaces]);

  const productOptions = useMemo(() => {
    if (!surfaces) return [];
    return Object.entries(surfaces.products)
      .map(([slug, p]) => ({ slug, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [surfaces]);

  const loading = recs === null && !error;

  return (
    <>
      <section className="aq-step-header">
        <h2 className="aq-step-title">Sales funnel</h2>
        <p className="aq-step-sub">
          From ranking impression to in-app click. Of the visitors who saw a
          product in a ranking (homepage, asset hub or network hub), how many
          opened its product page, then went into the app. Sessions that landed
          directly on a product page (e.g. via search) are excluded - only
          discovery through a ranking counts.
        </p>
      </section>

      {surfaces === null && !loading && (
        <div className="uni-hub-empty">
          Ranking map (sales-surfaces.json) not found - rebuild the site so the
          funnel can attribute impressions.
        </div>
      )}

      <div className="aq-head-controls" style={{ marginBottom: 24, flexWrap: "wrap" }}>
        <span className="lf-filter-grp">
          <select
            className="lf-select"
            aria-label="Product"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          >
            <option value="">All products</option>
            {productOptions.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name}
              </option>
            ))}
          </select>
          <FilterHint label="About the funnel">
            Impression = a session viewed a page (homepage / asset hub / network
            hub) that lists the product in its top {IMPRESSION_DEPTH}. Product
            page = the session then opened the product page, preceded by that
            impression (direct landings excluded). Into app = it then fired an
            into-app click. Positions use the current ranking as a proxy for
            past visits.
          </FilterHint>
        </span>
        <select
          className="lf-select"
          aria-label="Surface"
          value={group}
          onChange={(e) => setGroup(e.target.value as SurfaceGroup)}
        >
          {GROUP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="lf-bot-toggle" title="Bots are excluded by default.">
          <input
            type="checkbox"
            checked={showBots}
            onChange={(e) => setShowBots(e.target.checked)}
          />
          Show bots
        </label>
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />
      </div>

      {error && (
        <div className="uni-hub-empty" style={{ color: "#b91c1c" }}>
          Could not load funnel: {error}
        </div>
      )}
      {loading && <div className="uni-hub-empty">Loading funnel…</div>}

      {totals && (
        <div
          className="uni-hub-stats"
          role="group"
          aria-label="Funnel summary"
          style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginBottom: 32 }}
        >
          <FunnelTile label="Impressions" value={totals.impr} />
          <FunnelTile
            label="Product-page views"
            value={totals.pv}
            sub={`${fmtPct(pct(totals.pv, totals.impr))} of impressions`}
          />
          <FunnelTile
            label="Into-app clicks"
            value={totals.app}
            sub={`${fmtPct(pct(totals.app, totals.pv))} of product views`}
          />
          <FunnelTile
            label="End-to-end"
            value={fmtPct(pct(totals.app, totals.impr))}
            sub="impression → app"
          />
        </div>
      )}

      {byPosition && totals && (
        <section className="uni-hub-section" style={{ marginTop: 0 }}>
          <header className="uni-hub-section-head">
            <h2 className="uni-hub-section-title">By ranking position</h2>
            <span className="uni-hub-section-meta">
              what each slot converts{product ? " · selected product" : ""}
            </span>
          </header>
          <PosTable buckets={byPosition} />
        </section>
      )}

      {surfaceRows && surfaceRows.length > 0 && (
        <section className="uni-hub-section">
          <header className="uni-hub-section-head">
            <h2 className="uni-hub-section-title">Where they saw it</h2>
            <span className="uni-hub-section-meta">
              per surface, for {surfaces?.products[product]?.name ?? product}
            </span>
          </header>
          <SurfaceTable rows={surfaceRows} />
        </section>
      )}

      {leaderboard && !product && (
        <section className="uni-hub-section">
          <header className="uni-hub-section-head">
            <h2 className="uni-hub-section-title">Product leaderboard</h2>
            <span className="uni-hub-section-meta">
              ranked by impressions · {leaderboard.length} products
            </span>
          </header>
          <Leaderboard rows={leaderboard.slice(0, 40)} onPick={setProduct} />
        </section>
      )}
    </>
  );
}

function FunnelTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="uni-hub-stat">
      <div className="uni-hub-stat-label">{label}</div>
      <div className="uni-hub-stat-value">
        {typeof value === "number" ? fmtNum(value) : value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--hub-ink-3, #6e6c66)",
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

const POS_COLS = "minmax(90px,1fr) 120px 1fr 1fr 1fr";

function PosTable({
  buckets,
}: {
  buckets: Record<string, { impr: number; pv: number; app: number }>;
}) {
  return (
    <div className="hub-table-wrap">
      <div className="hub-table">
        <div className="hub-thead" style={{ gridTemplateColumns: POS_COLS }}>
          <span className="hub-th hub-th-rank">Position</span>
          <span className="hub-th">Impressions</span>
          <span className="hub-th">→ Product page</span>
          <span className="hub-th">→ Into app</span>
          <span className="hub-th">End-to-end</span>
        </div>
        {["1", "2", "3", "4–10"].map((k) => {
          const b = buckets[k];
          return (
            <div className="hub-row" key={k} style={{ gridTemplateColumns: POS_COLS }}>
              <span className="hub-cell hub-rank">
                {k === "4–10" ? "4–10" : `Top ${k}`}
              </span>
              <span className="hub-cell aq-cell-text">{fmtNum(b.impr)}</span>
              <span className="hub-cell aq-cell-text">
                {fmtPct(pct(b.pv, b.impr))}{" "}
                <span style={{ color: "var(--hub-ink-3,#6e6c66)" }}>
                  ({fmtNum(b.pv)})
                </span>
              </span>
              <span className="hub-cell aq-cell-text">
                {fmtPct(pct(b.app, b.pv))}{" "}
                <span style={{ color: "var(--hub-ink-3,#6e6c66)" }}>
                  ({fmtNum(b.app)})
                </span>
              </span>
              <span className="hub-cell aq-cell-text">
                {fmtPct(pct(b.app, b.impr))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SURFACE_COLS = "minmax(120px,1.4fr) 90px 120px 1fr 1fr";

function SurfaceTable({
  rows,
}: {
  rows: { path: string; pos: number; impr: number; pv: number; app: number }[];
}) {
  return (
    <div className="hub-table-wrap">
      <div className="hub-table">
        <div className="hub-thead" style={{ gridTemplateColumns: SURFACE_COLS }}>
          <span className="hub-th hub-th-rank">Surface</span>
          <span className="hub-th">Position</span>
          <span className="hub-th">Impressions</span>
          <span className="hub-th">→ Product page</span>
          <span className="hub-th">→ Into app</span>
        </div>
        {rows.map((r) => (
          <div className="hub-row" key={r.path} style={{ gridTemplateColumns: SURFACE_COLS }}>
            <span className="hub-cell hub-rank" style={{ fontFamily: "var(--mono)" }}>
              {r.path}
            </span>
            <span className="hub-cell aq-cell-text">{r.pos > 0 ? `#${r.pos}` : "—"}</span>
            <span className="hub-cell aq-cell-text">{fmtNum(r.impr)}</span>
            <span className="hub-cell aq-cell-text">{fmtPct(pct(r.pv, r.impr))}</span>
            <span className="hub-cell aq-cell-text">{fmtPct(pct(r.app, r.pv))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const LB_COLS = "minmax(160px,2fr) 80px 110px 1fr 1fr 1fr";

function Leaderboard({
  rows,
  onPick,
}: {
  rows: {
    slug: string;
    name: string;
    bestPos: number;
    impr: number;
    pv: number;
    app: number;
  }[];
  onPick: (slug: string) => void;
}) {
  return (
    <div className="hub-table-wrap">
      <div className="hub-table">
        <div className="hub-thead" style={{ gridTemplateColumns: LB_COLS }}>
          <span className="hub-th">Product</span>
          <span className="hub-th">Best pos</span>
          <span className="hub-th">Impressions</span>
          <span className="hub-th">Product page</span>
          <span className="hub-th">Into app</span>
          <span className="hub-th">End-to-end</span>
        </div>
        {rows.map((r) => (
          <div
            className="hub-row"
            key={r.slug}
            style={{ gridTemplateColumns: LB_COLS, cursor: "pointer" }}
            onClick={() => onPick(r.slug)}
            title="Drill into this product"
          >
            <span className="hub-cell hub-vault">
              <span
                className="hub-vault-name"
                style={{ fontFamily: "var(--sans)", fontSize: 12.5 }}
              >
                {r.name}
              </span>
            </span>
            <span className="hub-cell aq-cell-text">
              {r.bestPos < 99 ? `#${r.bestPos}` : "—"}
            </span>
            <span className="hub-cell aq-cell-text">{fmtNum(r.impr)}</span>
            <span className="hub-cell aq-cell-text">{fmtPct(pct(r.pv, r.impr))}</span>
            <span className="hub-cell aq-cell-text">{fmtPct(pct(r.app, r.pv))}</span>
            <span className="hub-cell aq-cell-text">{fmtPct(pct(r.app, r.impr))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
