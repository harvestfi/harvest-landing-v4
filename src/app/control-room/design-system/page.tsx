import { readFileSync, statSync, existsSync } from "fs";
import { join } from "path";
import "../../_styles/asset-hub.css";

// Admin > Design System. Surfaces the portable design-system bundle
// (palette, typography, spacing, component patterns) as a set of
// download links so the operator can hand it to another AI or drop
// it into a fresh project without copying anything out of this
// repo manually.
//
// The files themselves live under public/design-system/ and are
// served as static assets by Next.js. This page just lists them
// with a description, file size, and a direct download link.

export const metadata = {
  title: "Design System | Admin",
  robots: { index: false, follow: false },
};

interface Artefact {
  name: string;
  href: string;
  summary: string;
  detail: string;
  priority: number; // sort order on the page; lower = higher up
}

const ARTEFACTS: Artefact[] = [
  {
    name: "design-system.md",
    href: "/design-system/design-system.md",
    summary: "Master document. Read this first.",
    detail:
      "Palette (Sunflower Gold + Onyx + Graphite ramps), typography stack (Inter / Inter Tight / JetBrains Mono), spacing + radii, light/dark theme mechanism, class naming convention, component patterns (hub-table, stat tile, pills, hero, section), editorial constraints, integration recipe.",
    priority: 1,
  },
  {
    name: "tokens.css",
    href: "/design-system/tokens.css",
    summary: "CSS variables - the only file with raw hex values.",
    detail:
      "Light + dark theme tokens (--bg, --card, --ink ramp, --line, --gold), radii, font bindings, page-shell sizes. Import first. Every other stylesheet reads from these via var(--...).",
    priority: 2,
  },
  {
    name: "components.css",
    href: "/design-system/components.css",
    summary: "Reusable component classes.",
    detail:
      "Hero + stat tiles, section rhythm, .hub-table grid pattern, .pill-filled / .pill-tinted / .chip-outlined, .cta-primary / .cta-secondary, .card-surface, .note callout, .mono / .dim helpers. Import after tokens.css.",
    priority: 3,
  },
  {
    name: "darkmode.css",
    href: "/design-system/darkmode.css",
    summary: "Dark-theme scope overrides.",
    detail:
      "Activated by <html data-theme=\"dark\">. Swaps the inner --hub-* variables for the .hub-table-wrap, lifts pill text contrast for the Onyx background, bumps CTA shadow alpha. Import last.",
    priority: 4,
  },
  {
    name: "logo.md",
    href: "/design-system/logo.md",
    summary: "Brand wordmark + animated dot - how to replicate the Harvest mark.",
    detail:
      "Markup, CSS, the cubic-bezier spring on the hover transform, the gold-to-onyx colour flip, prefers-reduced-motion handling, where the mark is and isn't used across the site, and an explicit list of variants you should NOT make.",
    priority: 5,
  },
  {
    name: "charts.md",
    href: "/design-system/charts.md",
    summary: "Bar / line / sparkline charts - palette, layout, hover, annotations.",
    detail:
      "How charts look across the site: gold-on-dotted-white plot, no charting library, hand-rolled CSS-grid bars + inline-SVG lines. Covers chart-card chrome, bar height pitfalls (the parent must be align-items: stretch, not flex-end), line-chart gradient fill, sparkline currentColor trick, hover tooltip via ::after, vertical annotation markers in canonical blue, and a list of what NOT to do.",
    priority: 6,
  },
  {
    name: "README.md",
    href: "/design-system/README.md",
    summary: "60-second integration guide.",
    detail:
      "Import order, next/font setup, the inline theme-resolver script that prevents light-mode flash, and a verification checklist to catch hardcoded colours that don't move when you toggle the theme.",
    priority: 7,
  },
];

function readSizeBytes(name: string): number | null {
  const p = join(process.cwd(), "src", "design-system-bundle", name);
  if (!existsSync(p)) return null;
  try {
    return statSync(p).size;
  } catch {
    return null;
  }
}

function formatBytes(n: number | null): string {
  if (n === null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function previewSnippet(name: string, lines: number): string | null {
  const p = join(process.cwd(), "src", "design-system-bundle", name);
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, "utf-8");
    const head = raw.split("\n").slice(0, lines).join("\n");
    return head.length > 2000 ? head.slice(0, 2000) + "..." : head;
  } catch {
    return null;
  }
}

export default function DesignSystemPage() {
  const sorted = [...ARTEFACTS].sort((a, b) => a.priority - b.priority);
  const totalBytes = sorted.reduce(
    (sum, a) => sum + (readSizeBytes(a.name) ?? 0),
    0,
  );
  const tokensPreview = previewSnippet("tokens.css", 24);

  return (
    <div className="uni-hub-test">
      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <div>
            <h1 className="uni-hub-h1">Design System</h1>
            <p className="uni-hub-sub">
              Portable bundle for handing the Harvest visual language to a
              fresh codebase. Five files: one master Markdown document plus
              three layered CSS files plus a README. Drop them into any
              project and you can recreate the same look without pulling the
              rest of this repo.
            </p>
          </div>
        </div>

        <div
          className="uni-hub-stats"
          role="group"
          aria-label="Bundle summary"
          style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
        >
          <Stat label="Files" value={sorted.length.toString()} />
          <Stat label="Total size" value={formatBytes(totalBytes)} />
          <Stat label="Theme support" value="Light + dark" mono={false} />
        </div>
      </header>

      <section className="uni-hub-section" style={{ marginTop: 0 }}>
        <header className="uni-hub-section-head">
          <h2 className="uni-hub-section-title">Bundle</h2>
          <span className="uni-hub-section-meta">
            click any file to download
          </span>
        </header>
        <div className="rules-cards">
          {sorted.map((a) => {
            const size = readSizeBytes(a.name);
            return (
              <a
                key={a.name}
                href={a.href}
                download
                className="rules-card"
              >
                <div className="rules-card-head">
                  <h3 className="rules-card-title">{a.name}</h3>
                  <span className="rules-card-arrow" aria-hidden="true">↓</span>
                </div>
                <p className="rules-card-blurb">{a.summary}</p>
                <dl className="rules-card-meta">
                  <div className="rules-meta-row">
                    <dt>What&apos;s in it</dt>
                    <dd>{a.detail}</dd>
                  </div>
                  <div className="rules-meta-row">
                    <dt>Size</dt>
                    <dd className="mono">{formatBytes(size)}</dd>
                  </div>
                </dl>
              </a>
            );
          })}
        </div>
      </section>

      <section className="uni-hub-section">
        <header className="uni-hub-section-head">
          <h2 className="uni-hub-section-title">Sample of tokens.css</h2>
          <span className="uni-hub-section-meta">first 24 lines</span>
        </header>
        <pre className="ds-preview">
          <code>{tokensPreview ?? "(file not available)"}</code>
        </pre>
      </section>

      <section className="uni-hub-section">
        <div className="rules-note">
          <p className="rules-note-title">
            How to hand this to another AI
          </p>
          <p className="rules-note-body">
            Download all five files. Open a new chat with the receiving AI,
            paste the contents of <code className="rules-code">design-system.md</code>{" "}
            first (it&apos;s the master doc), then attach{" "}
            <code className="rules-code">tokens.css</code>,{" "}
            <code className="rules-code">components.css</code> and{" "}
            <code className="rules-code">darkmode.css</code> as reference
            files. Ask the AI to bootstrap a new project that follows the
            integration recipe in Section 9 of the master doc. The bundle is
            framework-agnostic - Next.js / Vite / vanilla all work.
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
