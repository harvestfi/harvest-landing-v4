// Master Config hub. Surfaces the downloadable handoff pack that lives
// in public/master-config/ - a cemented, point-in-time export of the
// entire single-product-page generation engine (data model, section
// templates, editorial + YMYL rules, canonical-value discipline, the
// regression log, and the build gates). Hand the bundle to a fresh AI
// and they can rebuild every product page to identical output.
//
// The .md files are static assets under /master-config/*.md, so each
// card is a direct download link; sizes are read at build time.

import fs from "node:fs";
import path from "node:path";
import "../../_styles/asset-hub.css";

export const metadata = {
  title: "Master Config | Admin",
  robots: { index: false, follow: false },
};

const SNAPSHOT = "2026-06-07 · prod main @ 05fb1ee";

const DOCS = [
  {
    file: "00-quickstart.md",
    title: "00 · Quickstart & File Map",
    blurb:
      "What the pack is, the read order, the repo file map, the build pipeline, and the rebuild-from-scratch recipe.",
  },
  {
    file: "01-data-model.md",
    title: "01 · Data Model & Sources",
    blurb:
      "The three JSON sources, the loading flow and fallbacks, derived metrics, freshness anchoring, the data-quality guards, and the noindex gates.",
  },
  {
    file: "02-page-anatomy.md",
    title: "02 · Page Anatomy",
    blurb:
      "Render order of every block, the component or builder behind each, vault-type dispatch, and the conditional-rendering matrix.",
  },
  {
    file: "03-section-specs.md",
    title: "03 · Section Specs",
    blurb:
      "Every section's exact copy templates, thresholds, and suppression rules, per vault type. The centerpiece of the pack.",
  },
  {
    file: "04-editorial-ymyl.md",
    title: "04 · Editorial & YMYL Rulebook",
    blurb:
      "No em dash, the unfalsifiability and coverage rule, observational (non-forward-looking) framing, tone, proximity buffers, schema framing.",
  },
  {
    file: "05-canonical-values.md",
    title: "05 · Canonical Values",
    blurb:
      "The single source for every cross-section value (days tracked, current TVL, spot-vs-indexed APY, the 30-day anchor, rank) and why each is unified.",
  },
  {
    file: "06-regression-log.md",
    title: "06 · Regression Log",
    blurb:
      "Every failure mode we found and fixed: symptom, root cause, the fix, and the guard that stops it recurring.",
  },
  {
    file: "07-gates.md",
    title: "07 · The Gates",
    blurb:
      "The two deterministic, build-failing scanners (banned-words + page-consistency) and their full check catalog.",
  },
  {
    file: "08-seo-schema.md",
    title: "08 · SEO & Structured Data",
    blurb:
      "JSON-LD schemas, the analytics framing, title and description templates, and the indexing gates.",
  },
] as const;

function sizeOf(file: string): string {
  try {
    const bytes = fs.statSync(
      path.join(process.cwd(), "content", "master-config", file),
    ).size;
    return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
  } catch {
    return "";
  }
}

export default function MasterConfigPage() {
  const masterSize = sizeOf("MASTER.md");
  return (
    <div className="uni-hub-test">
      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <div>
            <h1 className="uni-hub-h1">Master Config</h1>
            <p className="uni-hub-sub">
              A cemented, point-in-time export of the entire
              single-product-page generation engine: the data model, every
              section template, the editorial and YMYL rules, the
              canonical-value discipline, the full regression log, and the
              build gates. Hand the bundle to any AI or engineer and they can
              rebuild every product page to identical, regression-free output.
              Snapshot: <code className="rules-code">{SNAPSHOT}</code>.
            </p>
          </div>
        </div>

        <div
          className="uni-hub-stats"
          role="group"
          aria-label="Pack summary"
          style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
        >
          <Stat label="Documents" value="9 + bundle" mono={false} />
          <Stat label="Prod snapshot" value="05fb1ee" />
          <Stat label="Gate state" value="0 / 0 findings" mono={false} />
        </div>
      </header>

      <section className="uni-hub-section" style={{ marginTop: 0 }}>
        <header className="uni-hub-section-head">
          <h2 className="uni-hub-section-title">Download the full handout</h2>
          <span className="uni-hub-section-meta">everything in one file</span>
        </header>
        <div className="rules-cards">
          <a className="rules-card" href="/master-config/MASTER.md" download>
            <div className="rules-card-head">
              <h3 className="rules-card-title">MASTER.md</h3>
              <span className="rules-card-arrow" aria-hidden="true">
                ↓
              </span>
            </div>
            <p className="rules-card-blurb">
              The numbered set 00 to 08 concatenated into a single
              self-contained file. Best for handing to a fresh AI in one shot.
            </p>
            <dl className="rules-card-meta">
              <div className="rules-meta-row">
                <dt>File</dt>
                <dd className="mono">MASTER.md{masterSize ? ` · ${masterSize}` : ""}</dd>
              </div>
              <div className="rules-meta-row">
                <dt>Open</dt>
                <dd className="mono">/master-config/MASTER.md</dd>
              </div>
            </dl>
          </a>
        </div>
      </section>

      <section className="uni-hub-section">
        <header className="uni-hub-section-head">
          <h2 className="uni-hub-section-title">The modular set</h2>
          <span className="uni-hub-section-meta">nine files, read in order</span>
        </header>
        <div className="rules-cards">
          {DOCS.map((d) => {
            const size = sizeOf(d.file);
            return (
              <a
                key={d.file}
                className="rules-card"
                href={`/master-config/${d.file}`}
                download
              >
                <div className="rules-card-head">
                  <h3 className="rules-card-title">{d.title}</h3>
                  <span className="rules-card-arrow" aria-hidden="true">
                    ↓
                  </span>
                </div>
                <p className="rules-card-blurb">{d.blurb}</p>
                <dl className="rules-card-meta">
                  <div className="rules-meta-row">
                    <dt>File</dt>
                    <dd className="mono">
                      {d.file}
                      {size ? ` · ${size}` : ""}
                    </dd>
                  </div>
                </dl>
              </a>
            );
          })}
        </div>
      </section>

      <section className="uni-hub-section">
        <div className="rules-note">
          <p className="rules-note-title">What &quot;cemented&quot; means</p>
          <p className="rules-note-body">
            These documents are a point-in-time snapshot of the implementation
            as of <strong>{SNAPSHOT}</strong>. They are authoritative for
            rebuilding the pages to identical output, but they do not auto-sync:
            regenerate the pack after any material change to the section
            templates, the gates, or the editorial rules. The acceptance test
            for any rebuild is doc 07&apos;s two gates reporting zero findings
            across every product page.
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="uni-hub-stat">
      <div className="uni-hub-stat-label">{label}</div>
      <div
        className="uni-hub-stat-value"
        style={mono ? undefined : { fontSize: 15, fontWeight: 500 }}
      >
        {value}
      </div>
    </div>
  );
}
