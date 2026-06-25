"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { readHiddenSlugs, writeHiddenSlugs } from "@/lib/hidden-products-client";

export interface HideItem {
  slug: string;
  name: string;
  asset: string;
  chain: string;
  isLp: boolean;
  hiddenAtBuild: boolean;
}

const COLS = "minmax(220px, 2fr) 90px 110px 120px 90px";

export function HideManager({ items }: { items: HideItem[] }) {
  // `saved` = what's persisted in localStorage. `draft` = the operator's
  // in-progress edits. Save commits draft -> localStorage. No backend.
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  // The exact content to commit to data/hidden.json for an all-visitor hide.
  const hiddenJson = useMemo(
    () => JSON.stringify([...draft].sort(), null, 2),
    [draft],
  );
  function copyHiddenJson() {
    navigator.clipboard?.writeText(hiddenJson).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => setCopied(false),
    );
  }

  // localStorage is only available client-side; read after mount so SSR
  // markup matches (everything starts visible, then we reconcile).
  useEffect(() => {
    const current = readHiddenSlugs();
    setSaved(current);
    setDraft(new Set(current));
    setReady(true);
  }, []);

  function toggle(slug: string) {
    const key = slug.toLowerCase();
    setSaveMsg(null);
    setDraft((d) => {
      const next = new Set(d);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const dirty = useMemo(() => {
    if (draft.size !== saved.size) return true;
    for (const k of draft) if (!saved.has(k)) return true;
    return false;
  }, [draft, saved]);

  function save() {
    const ok = writeHiddenSlugs(draft);
    if (ok) {
      setSaved(new Set(draft));
      setSaveMsg(
        `Previewing ${draft.size} hidden product${draft.size === 1 ? "" : "s"} in this browser. Commit data/hidden.json (below) to apply for all visitors.`,
      );
    } else {
      setSaveMsg("Could not write to this browser's storage.");
    }
  }

  function discard() {
    setDraft(new Set(saved));
    setSaveMsg(null);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.slug.toLowerCase().includes(q) ||
        i.asset.toLowerCase().includes(q) ||
        i.chain.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <>
      <div
        className="uni-hub-stats"
        role="group"
        aria-label="Hide summary"
        style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 24 }}
      >
        <Stat label="Total products" value={items.length.toLocaleString("en-US")} />
        <Stat label="Hidden" value={draft.size.toLocaleString("en-US")} />
        <Stat label="Unsaved changes" value={dirty ? "yes" : "no"} />
      </div>

      {/* Save bar */}
      <div
        className="lf-filterbar"
        style={{ marginBottom: 16, gap: 12, alignItems: "center", flexWrap: "wrap" }}
      >
        <button
          type="button"
          className="hide-save-cta"
          disabled={!dirty || !ready}
          onClick={save}
        >
          {dirty ? "Save changes" : "Saved"}
        </button>
        {dirty && (
          <button type="button" className="aq-timeframe-tab" onClick={discard}>
            Discard
          </button>
        )}
        <span className="uni-hub-section-meta">
          {!ready
            ? "loading…"
            : dirty
              ? "unsaved changes"
              : "all changes saved in this browser"}
        </span>
      </div>

      {saveMsg && (
        <div
          className="uni-hub-empty"
          style={{ color: "#a16207", marginBottom: 8 }}
        >
          {saveMsg}
        </div>
      )}

      {/* Commit panel: the toggles above are an instant per-browser preview
          (localStorage). To hide from the rankings for ALL visitors, this
          list must land in the committed data/hidden.json, which the build
          filters server-side. No backend / no Supabase. */}
      <div
        style={{
          marginBottom: 20,
          padding: "12px 14px",
          border: "1px solid var(--uni-line)",
          borderRadius: 10,
          background: "var(--uni-bg)",
        }}
      >
        <div
          className="uni-hub-section-meta"
          style={{ marginBottom: 8, lineHeight: 1.5 }}
        >
          The toggles above preview instantly in <strong>this browser</strong>{" "}
          only. To hide from the rankings for <strong>all visitors</strong>,
          commit the list below to <code>data/hidden.json</code> and redeploy.
          This affects rankings only — it does not change a product&apos;s
          index status or its own page.
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <pre
            style={{
              flex: 1,
              margin: 0,
              padding: "8px 10px",
              maxHeight: 160,
              overflow: "auto",
              fontFamily: "var(--mono)",
              fontSize: 12,
              background: "var(--uni-tint)",
              borderRadius: 8,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {hiddenJson}
          </pre>
          <button
            type="button"
            className="aq-timeframe-tab"
            onClick={copyHiddenJson}
            style={{ flexShrink: 0 }}
          >
            {copied ? "Copied ✓" : "Copy data/hidden.json"}
          </button>
        </div>
      </div>

      <div className="lf-filterbar" style={{ marginBottom: 16 }}>
        <input
          type="search"
          className="lf-select"
          placeholder="Search by name, asset, network or slug"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minWidth: 280 }}
          aria-label="Search products"
        />
        <span className="uni-hub-section-meta">{filtered.length} shown</span>
      </div>

      <div className="hub-table-wrap aq-recent-wrap">
        <div className="hub-table aq-recent-table">
          <div className="hub-thead" style={{ gridTemplateColumns: COLS }}>
            <span className="hub-th">Product</span>
            <span className="hub-th">Asset</span>
            <span className="hub-th">Network</span>
            <span className="hub-th">Status</span>
            <span className="hub-th">Action</span>
          </div>

          {filtered.length === 0 ? (
            <div className="uni-hub-empty">No products match that search.</div>
          ) : (
            filtered.map((i) => {
              const key = i.slug.toLowerCase();
              const isHidden = draft.has(key);
              const isDirty = isHidden !== saved.has(key);
              return (
                <div
                  key={i.slug}
                  className="hub-row"
                  style={{ gridTemplateColumns: COLS, opacity: isHidden ? 0.6 : 1 }}
                >
                  <span className="hub-cell aq-cell-vault">
                    <Link href={`/${i.slug}`} className="aq-vault-link" target="_blank">
                      {i.name}
                      {i.isLp ? " [LP]" : ""}
                    </Link>
                  </span>
                  <span className="hub-cell aq-cell-text">{i.asset}</span>
                  <span className="hub-cell aq-cell-text">{i.chain}</span>
                  <span className="hub-cell">
                    <span className={`lf-badge lf-badge-${isHidden ? "external" : "owned"}`}>
                      {isHidden ? "Hidden" : "Visible"}
                      {isDirty ? " *" : ""}
                    </span>
                  </span>
                  <span className="hub-cell">
                    <button
                      type="button"
                      className="aq-timeframe-tab"
                      aria-pressed={isHidden}
                      disabled={!ready}
                      onClick={() => toggle(i.slug)}
                    >
                      {isHidden ? "Unhide" : "Hide"}
                    </button>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="uni-hub-stat">
      <div className="uni-hub-stat-label">{label}</div>
      <div className="uni-hub-stat-value">{value}</div>
    </div>
  );
}
