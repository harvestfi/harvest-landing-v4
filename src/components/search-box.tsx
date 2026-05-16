"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AssetIcon, ChainIcon } from "./token-icons";
import { formatAPY, formatTVL, stripChainSuffix } from "@/lib/format";
import { LpBadge } from "./lp-badge";

export interface SearchItem {
  slug: string;
  productName: string;
  // Canonical name shown in the dropdown row. For LP-pair products
  // this expands the database "ETH Aerodrome" into "ETH/VVV
  // Aerodrome" so visually-identical names disambiguate without a
  // click-through. Computed in header.tsx via getCanonicalDisplayName.
  displayName: string;
  isLpPair: boolean;
  asset: string;
  chain: string;
  protocol: string;
  category: string;
  apy24h: number;
  tvl: number;
}

interface Props {
  items: SearchItem[];
}

interface Scored extends SearchItem {
  _score: number;
}

function scoreItem(item: SearchItem, q: string, tokens: string[]): number {
  // Include displayName in the haystack so users can find LP-pair
  // products by counterpart ticker (typing "vvv" matches "ETH/VVV
  // Aerodrome" even though the raw productName is just "ETH Aerodrome").
  const hay = `${item.productName} ${item.displayName} ${item.asset} ${item.chain} ${item.protocol} ${item.category}`.toLowerCase();
  const name = item.displayName.toLowerCase();
  const proto = item.protocol.toLowerCase();
  const asset = item.asset.toLowerCase();
  const chain = item.chain.toLowerCase();

  let score = 0;
  if (name === q) score += 1000;
  if (name.startsWith(q)) score += 400;
  if (proto.startsWith(q)) score += 200;
  if (asset === q) score += 300;
  if (chain.startsWith(q)) score += 150;
  if (name.includes(q)) score += 80;

  for (const t of tokens) {
    if (!hay.includes(t)) return 0;
    if (name.startsWith(t)) score += 40;
    if (proto.startsWith(t)) score += 30;
    if (asset === t) score += 50;
    if (chain.startsWith(t)) score += 20;
  }
  return score;
}

export function SearchBox({ items }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useMemo<Scored[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    const scored: Scored[] = [];
    for (const it of items) {
      const s = scoreItem(it, q, tokens);
      if (s > 0) scored.push({ ...it, _score: s + Math.log10(Math.max(1, it.tvl)) });
    }
    scored.sort((a, b) => b._score - a._score);
    return scored.slice(0, 5);
  }, [items, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onPointer(e: Event) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, []);

  function go(slug: string) {
    setOpen(false);
    setQuery("");
    router.push(`/${slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[active];
      if (pick) go(pick.slug);
    }
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <div className="search-wrap" ref={wrapRef}>
      {showDropdown && (
        <div
          className="search-backdrop"
          aria-hidden="true"
          onMouseDown={(e) => { e.preventDefault(); setOpen(false); }}
          onTouchStart={(e) => { e.preventDefault(); setOpen(false); }}
        />
      )}
      <label className="search-box">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          placeholder="Search pool, protocol, asset..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        <kbd>&#8984;K</kbd>
      </label>

      {showDropdown && (
        <div className="search-pop" role="listbox">
          {results.length === 0 ? (
            <div className="search-empty">
              No products match <b>{query}</b> in our index.
            </div>
          ) : (
            <>
              <div className="search-pop-head">Products</div>
              {results.map((r, i) => (
                <button
                  key={r.slug}
                  type="button"
                  className={`search-row${i === active ? " active" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r.slug)}
                  role="option"
                  aria-selected={i === active}
                >
                  <span className="sr-icon"><AssetIcon asset={r.asset} size={16} /></span>
                  <span className="sr-main">
                    <span className="sr-name">
                      {r.displayName}
                      {r.isLpPair && <LpBadge />}
                    </span>
                    <span className="sr-meta">
                      <ChainIcon chain={r.chain} size={12} />
                      <span>{r.chain}</span>
                      <span aria-hidden="true">·</span>
                      <span>{stripChainSuffix(r.category, r.chain)}</span>
                    </span>
                  </span>
                  <span className="sr-stats">
                    <span className="sr-apy">{formatAPY(r.apy24h)}</span>
                    <span className="sr-tvl">{formatTVL(r.tvl)}</span>
                  </span>
                </button>
              ))}
              <div className="search-pop-foot">
                <kbd>↑</kbd><kbd>↓</kbd> to navigate · <kbd>↵</kbd> to open · <kbd>esc</kbd> to close
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
