"use client";

import { useMemo, useState } from "react";

interface SerpRow {
  slug: string;
  type: string;
  title: string;
  description: string;
}

interface Props {
  rows: SerpRow[];
  siteOrigin: string;
}

// SERP preview. Renders the title + description + URL as Google
// surfaces them in search results, in both desktop and mobile
// formats side by side. The picker swaps the active row; the row
// list mirrors the SEO table below so any page on the site can be
// auditioned in the SERP layout before shipping a copy change.
export function SerpPreview({ rows, siteOrigin }: Props) {
  const [slug, setSlug] = useState<string>(rows[0]?.slug ?? "/");
  const [query, setQuery] = useState<string>("");

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(
      (r) =>
        r.slug.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const active = rows.find((r) => r.slug === slug) ?? rows[0];
  if (!active) return null;

  const host = siteOrigin.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const fullUrl = `${siteOrigin.replace(/\/$/, "")}${active.slug === "/" ? "" : active.slug}`;
  const breadcrumbSegments = active.slug === "/"
    ? [host]
    : [host, ...active.slug.replace(/^\//, "").split("/")];

  return (
    <div className="serp-card">
      <div className="serp-picker">
        <div className="serp-picker-head">
          <h3 className="serp-picker-title">Select a page</h3>
          <span className="serp-picker-count mono">
            {filteredRows.length} of {rows.length}
          </span>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by slug, title, or type"
          className="serp-picker-search"
          aria-label="Filter pages"
        />
        <div className="serp-picker-list" role="listbox" aria-label="Pages">
          {filteredRows.slice(0, 200).map((r) => (
            <button
              key={`${r.type}-${r.slug}`}
              type="button"
              role="option"
              aria-selected={r.slug === slug}
              className={`serp-picker-item${r.slug === slug ? " active" : ""}`}
              onClick={() => setSlug(r.slug)}
            >
              <span className="serp-picker-item-type mono">{r.type}</span>
              <span className="serp-picker-item-slug mono">{r.slug}</span>
            </button>
          ))}
          {filteredRows.length === 0 && (
            <div className="serp-picker-empty">No pages match.</div>
          )}
        </div>
      </div>

      <div className="serp-previews">
        <div className="serp-preview serp-preview-desktop">
          <header className="serp-preview-head">
            <span className="serp-preview-device-label mono">Desktop</span>
            <span className="serp-preview-device-meta mono">~600px width</span>
          </header>
          <div className="serp-preview-frame">
            <SerpResultDesktop
              host={host}
              breadcrumbSegments={breadcrumbSegments}
              fullUrl={fullUrl}
              title={active.title}
              description={active.description}
            />
          </div>
        </div>

        <div className="serp-preview serp-preview-mobile">
          <header className="serp-preview-head">
            <span className="serp-preview-device-label mono">Mobile</span>
            <span className="serp-preview-device-meta mono">~360px width</span>
          </header>
          <div className="serp-preview-frame serp-preview-frame-mobile">
            <SerpResultMobile
              host={host}
              breadcrumbSegments={breadcrumbSegments}
              fullUrl={fullUrl}
              title={active.title}
              description={active.description}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FaviconDot({ host }: { host: string }) {
  const initial = host[0]?.toUpperCase() ?? "H";
  return (
    <span className="serp-favicon" aria-hidden="true">
      {initial}
    </span>
  );
}

function SerpResultDesktop({
  host,
  breadcrumbSegments,
  fullUrl,
  title,
  description,
}: {
  host: string;
  breadcrumbSegments: string[];
  fullUrl: string;
  title: string;
  description: string;
}) {
  return (
    <article className="serp-result serp-result-desktop">
      <div className="serp-site">
        <FaviconDot host={host} />
        <div className="serp-site-meta">
          <span className="serp-site-name">Harvest</span>
          <span className="serp-site-url" title={fullUrl}>
            {breadcrumbSegments.map((seg, i) => (
              <span key={i}>
                {i > 0 && <span className="serp-url-sep"> › </span>}
                <span>{seg}</span>
              </span>
            ))}
          </span>
        </div>
      </div>
      <h4 className="serp-title">{title}</h4>
      <p className="serp-desc">{description}</p>
    </article>
  );
}

function SerpResultMobile({
  host,
  breadcrumbSegments,
  fullUrl,
  title,
  description,
}: {
  host: string;
  breadcrumbSegments: string[];
  fullUrl: string;
  title: string;
  description: string;
}) {
  return (
    <article className="serp-result serp-result-mobile">
      <div className="serp-site">
        <FaviconDot host={host} />
        <div className="serp-site-meta">
          <span className="serp-site-name">Harvest</span>
          <span className="serp-site-url" title={fullUrl}>
            {breadcrumbSegments.map((seg, i) => (
              <span key={i}>
                {i > 0 && <span className="serp-url-sep"> › </span>}
                <span>{seg}</span>
              </span>
            ))}
          </span>
        </div>
      </div>
      <h4 className="serp-title">{title}</h4>
      <p className="serp-desc">{description}</p>
    </article>
  );
}
