"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  supabaseSelect,
  supabaseInsert,
  supabaseDelete,
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

export function HideManager({ items }: { items: HideItem[] }) {
  // Live hidden set from Supabase (the source of truth the cron syncs).
  // Starts from the build-time set so the table is correct on first
  // paint, then reconciles with Supabase once it loads.
  const [hidden, setHidden] = useState<Set<string>>(
    () =>
      new Set(
        items.filter((i) => i.hiddenAtBuild).map((i) => i.slug.toLowerCase()),
      ),
  );
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await supabaseSelect<HiddenRow>(
          "hidden_products",
          "select=slug",
        );
        if (cancelled) return;
        setHidden(
          new Set(
            rows
              .map((r) => (r.slug || "").toLowerCase())
              .filter(Boolean),
          ),
        );
        setLoaded(true);
      } catch (e) {
        if (!cancelled) {
          setErr(String(e));
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(slug: string) {
    const key = slug.toLowerCase();
    if (pending.has(key)) return;
    const willHide = !hidden.has(key);

    setPending((p) => new Set(p).add(key));
    // Optimistic update.
    setHidden((h) => {
      const next = new Set(h);
      if (willHide) next.add(key);
      else next.delete(key);
      return next;
    });

    let ok = false;
    if (willHide) {
      // Best-effort insert; duplicates are harmless if slug is the PK.
      await supabaseInsert("hidden_products", { slug: key });
      ok = true;
    } else {
      ok = await supabaseDelete("hidden_products", `slug=eq.${encodeURIComponent(key)}`);
    }

    setPending((p) => {
      const next = new Set(p);
      next.delete(key);
      return next;
    });

    if (!ok) {
      // Roll back on failure.
      setErr("Could not save the change. Check Supabase connection.");
      setHidden((h) => {
        const next = new Set(h);
        if (willHide) next.delete(key);
        else next.add(key);
        return next;
      });
    } else {
      setErr(null);
    }
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

  const hiddenCount = hidden.size;

  return (
    <>
      <div
        className="uni-hub-stats"
        role="group"
        aria-label="Hide summary"
        style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 24 }}
      >
        <Stat label="Total products" value={items.length.toLocaleString("en-US")} />
        <Stat label="Hidden" value={hiddenCount.toLocaleString("en-US")} />
        <Stat label="Visible" value={(items.length - hiddenCount).toLocaleString("en-US")} />
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
        <span className="uni-hub-section-meta">
          {loaded ? "synced with Supabase" : "loading live state…"}
          {" · "}
          {filtered.length} shown
        </span>
      </div>

      {err && (
        <div className="uni-hub-empty" style={{ color: "#b91c1c" }}>
          {err}
        </div>
      )}

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
              const isHidden = hidden.has(key);
              const isPending = pending.has(key);
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
                    <span
                      className={`lf-badge lf-badge-${isHidden ? "external" : "owned"}`}
                    >
                      {isHidden ? "Hidden" : "Visible"}
                    </span>
                  </span>
                  <span className="hub-cell">
                    <button
                      type="button"
                      className="aq-timeframe-tab"
                      aria-pressed={isHidden}
                      disabled={isPending}
                      onClick={() => toggle(i.slug)}
                    >
                      {isPending ? "…" : isHidden ? "Unhide" : "Hide"}
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
