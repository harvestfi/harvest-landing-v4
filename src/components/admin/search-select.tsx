"use client";

// A compact searchable single-select (combobox) for the control room:
// a trigger button that opens a floating panel with a live search field
// and a filtered, keyboard-navigable option list. Unlike the native
// <select>, the list can be typed to filter - the ask on the Live Feed's
// product drill-down where there are ~100 products.
//
// The panel is absolutely positioned so it overlays neighbouring controls
// (e.g. a horizontal filter bar) instead of pushing them down. Styles live
// under .adm-combo* in admin.css. Option value "" is the reset/"all" row.

import { useEffect, useMemo, useRef, useState } from "react";

export interface SearchOption {
  value: string;
  label: string;
}

export function SearchSelect({
  value,
  onChange,
  options,
  allLabel = "All",
  searchPlaceholder = "Search…",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchOption[];
  allLabel?: string;
  searchPlaceholder?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // The reset row ("All …") always sits at the top of the list.
  const full = useMemo<SearchOption[]>(
    () => [{ value: "", label: allLabel }, ...options],
    [options, allLabel],
  );
  const selected = full.find((o) => o.value === value) ?? full[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return full;
    return full.filter((o) => o.label.toLowerCase().includes(q));
  }, [full, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(Math.max(0, full.findIndex((o) => o.value === value)));
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open, value, full]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (o: SearchOption) => {
    onChange(o.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = filtered[active];
      if (o) choose(o);
    }
  };

  return (
    <div className="adm-combo" ref={rootRef}>
      <button
        type="button"
        className="lf-select adm-combo-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="adm-combo-value">{selected.label}</span>
        <svg
          className="adm-combo-caret"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="adm-combo-panel">
          <input
            ref={inputRef}
            type="text"
            className="adm-combo-search"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label={ariaLabel ? `${ariaLabel} search` : "Search"}
          />
          <div className="adm-combo-list" role="listbox" ref={listRef}>
            {filtered.length === 0 ? (
              <div className="adm-combo-empty">No matches.</div>
            ) : (
              filtered.map((o, i) => (
                <button
                  key={o.value || "__all__"}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={`adm-combo-option${o.value === value ? " selected" : ""}${
                    i === active ? " active" : ""
                  }`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
