"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  supabaseSelect,
  supabaseInsertChecked,
  supabaseDeleteChecked,
} from "@/lib/supabase";

export interface HideItem {
  slug: string;
  name: string;
  asset: string;
  chain: string;
  isLp: boolean;
  hiddenAtBuild: boolean;
}

interface HiddenRow {
  slug: string;
}

const COLS = "minmax(220px, 2fr) 90px 110px 120px 90px";

type LoadState = "loading" | "ready" | "error";

export function HideManager({ items }: { items: HideItem[] }) {
  // `saved` = the hidden set as it actually exists in Supabase (the
  // source of truth the cron syncs). `draft` = what the operator has
  // toggled in the UI but not yet saved. Save reconciles draft -> saved.
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [query, setQuery] = useState("");

  // Load the live hidden set from Supabase on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await supabaseSelect<HiddenRow>(
          "hidden_products",
          "select=slug",
        );
        if (cancelled) return;
        const set = new Set(
          rows.map((r) => (r.slug || "").toLowerCase()).filter(Boolean),
        );
        setSaved(set);
        setDraft(new Set(set));
        setLoadState("ready");
      } catch (e) {
        if (!cancelled) {
          setLoadErr(String(e));
          setLoadState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
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

  // Diff draft vs saved into the actual writes needed.
  const { toHide, toUnhide, dirty } = useMemo(() => {
    const toHide: string[] = [];
    const toUnhide: string[] = [];
    for (const k of draft) if (!saved.has(k)) toHide.push(k);
    for (const k of saved) if (!draft.has(k)) toUnhide.push(k);
    return { toHide, toUnhide, dirty: toHide.length + toUnhide.length };
  }, [draft, saved]);

  async function save() {
    if (saving || dirty === 0) return;
    setSaving(true);
    setSaveMsg(null);

    const failures: string[] = [];
    for (const slug of toHide) {
      const res = await supabaseInsertChecked("hidden_products", { slug });
      if (!res.ok) failures.push(`hide ${slug}: ${res.error ?? res.status}`);
    }
    for (const slug of toUnhide) {
      const res = await supabaseDeleteChecked(
        "hidden_products",
        `slug=eq.${encodeURIComponent(slug)}`,
      );
      if (!res.ok) failures.push(`unhide ${slug}: ${res.error ?? res.status}`);
    }

    // Re-read Supabase so the UI reflects what actually persisted, not
    // what we hoped happened.
    let confirmed: Set<string> | null = null;
    try {
      const rows = await supabaseSelect<HiddenRow>("hidden_products", "select=slug");
      confirmed = new Set(rows.map((r) => (r.slug || "").toLowerCase()).filter(Boolean));
    } catch {
      confirmed = null;
    }

    if (confirmed) {
      setSaved(confirmed);
      setDraft(new Set(confirmed));
    }
    setSaving(false);

    if (failures.length > 0) {
      setSaveMsg({
        kind: "err",
        text: `Could not save ${failures.length} change(s). ${failures[0]}${failures.length > 1 ? ` (+${failures.length - 1} more)` : ""}`,
      });
    } else {
      setSaveMsg({ kind: "ok", text: `Saved. ${dirty} change(s) written to Supabase.` });
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

  const hiddenCount = draft.size;

  return (
    <>
      <div
        className="uni-hub-stats"
        role="group"
        aria-label="Hide summary"
        style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 24 }}
      >
        <Stat label="Total products" value={items.length.toLocaleString("en-US")} />
        <Stat label="Hidden (draft)" value={hiddenCount.toLocaleString("en-US")} />
        <Stat label="Unsaved changes" value={dirty.toLocaleString("en-US")} />
      </div>

      {/* Save bar */}
      <div
        className="lf-filterbar"
        style={{ marginBottom: 16, gap: 12, alignItems: "center", flexWrap: "wrap" }}
      >
        <button
          type="button"
          className="uni-cta"
          style={{ minWidth: 120, opacity: dirty === 0 || saving ? 0.5 : 1 }}
          disabled={dirty === 0 || saving || loadState !== "ready"}
          onClick={save}
        >
          {saving ? "Saving…" : dirty > 0 ? `Save ${dirty} change${dirty === 1 ? "" : "s"}` : "Saved"}
        </button>
        {dirty > 0 && !saving && (
          <button type="button" className="aq-timeframe-tab" onClick={discard}>
            Discard
          </button>
        )}
        <span className="uni-hub-section-meta">
          {loadState === "loading" && "loading live state…"}
          {loadState === "ready" && (dirty > 0 ? "unsaved changes" : "in sync with Supabase")}
          {loadState === "error" && "could not load from Supabase"}
        </span>
      </div>

      {loadState === "error" && (
        <div className="uni-hub-empty" style={{ color: "#b91c1c" }}>
          Could not load the hidden list from Supabase: {loadErr}. Toggling is
          disabled until the connection works. Check that the{" "}
          <code>hidden_products</code> table exists and anon SELECT is allowed.
        </div>
      )}

      {saveMsg && (
        <div
          className="uni-hub-empty"
          style={{ color: saveMsg.kind === "ok" ? "#15803d" : "#b91c1c", marginBottom: 8 }}
        >
          {saveMsg.text}
          {saveMsg.kind === "err" && (
            <>
              {" "}
              The <code>hidden_products</code> table likely needs an anon
              INSERT/DELETE policy (or doesn{"'"}t exist yet).
            </>
          )}
        </div>
      )}

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
                      disabled={loadState !== "ready"}
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
