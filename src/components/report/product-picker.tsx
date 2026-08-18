"use client";

// Product picker for the XRP staking calculator.
//
// A native <select> was the first version and it failed on the surface that
// matters most here. On a phone the browser takes over the whole screen with
// its own picker, renders one flat line per option, truncates it, and drops
// every distinction the list is built on: the rate, the venue and the product
// type all collapse into the same grey run of text. Fourteen options of the
// shape "FXRP · MetaVault · Gami Labs · Spectra · 4.20%" are unreadable that
// way, and the rate, which is the only reason anyone opens the list, sits at
// the far end where a narrow screen cuts it off.
//
// So this is a listbox rather than a select. Same keyboard contract as the
// native control (arrows, Home, End, Enter, Escape, type-ahead), and the same
// form semantics via role="listbox" and aria-activedescendant, but the options
// are laid out: rate first at display size, then the venue, then the asset,
// the product type and the network on a second line.
//
// On a phone it opens as a sheet anchored to the bottom of the viewport rather
// than as a popover, because a popover pinned to a control halfway down the
// page either overflows the fold or covers the field it belongs to.

import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface PickerOption {
  slug: string;
  asset: string;
  detail: string | null;
  venue: string;
  chain: string;
  type: string;
  rate: number;
}

/**
 * The meta line under the venue: asset, then what the product is.
 *
 * The type is dropped when the detail already carries it, because the feed
 * says both. Left in, the line reads "PT · Aug 2026 · Fixed-Rate PT · Flare"
 * and "Pool · Nov 2026 · Pool · Flare", which spends the width a narrow screen
 * needs on saying the same word twice.
 */
function metaLine(o: PickerOption): string {
  const detail = o.detail ?? "";
  // Word-boundary match, and two-letter tokens count: the duplicate that
  // started this is "PT", which a three-character floor would let through.
  const dup = o.type
    .split(/[\s-]+/)
    .filter((w) => w.length >= 2)
    .some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(detail));
  return [o.asset, o.detail, dup ? null : o.type, o.chain].filter(Boolean).join(" \u00b7 ");
}

export function ProductPicker({

  options,
  value,
  onChange,
  label,
}: {
  options: PickerOption[];
  value: string;
  onChange: (slug: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const typed = useRef({ buf: "", at: 0 });
  const id = useId();

  const index = useMemo(
    () => Math.max(0, options.findIndex((o) => o.slug === value)),
    [options, value],
  );
  const selected = options[index];

  // Opening lands on the current selection rather than the top of the list,
  // which is what a native select does and what makes arrow keys predictable.
  useEffect(() => {
    if (open) setActive(index);
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Keep the active option in view when the arrows walk past the edge of the
  // scroll box.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const commit = (i: number) => {
    const o = options[i];
    if (o) onChange(o.slug);
    setOpen(false);
    btnRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Type-ahead, same as a native select: letters jump to the next option
    // whose venue or asset starts with what was typed.
    if (open && e.key.length === 1 && /\S/.test(e.key) && !e.metaKey && !e.ctrlKey) {
      const now = Date.now();
      typed.current.buf = now - typed.current.at > 800 ? e.key : typed.current.buf + e.key;
      typed.current.at = now;
      const q = typed.current.buf.toLowerCase();
      const hit = options.findIndex(
        (o) =>
          o.venue.toLowerCase().startsWith(q) || o.asset.toLowerCase().startsWith(q),
      );
      if (hit >= 0) setActive(hit);
      return;
    }
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActive((a) => Math.min(options.length - 1, Math.max(0, a + step)));
        return;
      }
      case "Home":
        if (open) {
          e.preventDefault();
          setActive(0);
        }
        return;
      case "End":
        if (open) {
          e.preventDefault();
          setActive(options.length - 1);
        }
        return;
      default:
        return;
    }
  };

  if (!selected) return null;

  return (
    <div className="rp-pick" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        id={`${id}-btn`}
        className={`rp-pick-btn${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected.rate.toFixed(2)}% on ${selected.venue}, ${selected.asset}${selected.detail ? ` ${selected.detail}` : ""}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (open) commit(active);
            else setOpen(true);
            return;
          }
          onKeyDown(e);
        }}
      >
        <span className="rp-pick-rate">{selected.rate.toFixed(2)}%</span>
        <span className="rp-pick-txt">
          <span className="rp-pick-venue">{selected.venue}</span>
          <span className="rp-pick-meta">
            {metaLine(selected)}
          </span>
        </span>
        <span className="rp-pick-caret" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
            <path
              d="M4 6.5 8 10.5l4-4"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open ? (
        <>
          {/* Backdrop exists only at sheet size; on a wide screen it is a
              transparent click-catcher the outside-click handler already
              covers, so it is display:none there. */}
          <div className="rp-pick-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className="rp-pick-pop"
            role="listbox"
            aria-label={label}
            aria-activedescendant={`${id}-o${active}`}
            tabIndex={-1}
            ref={listRef}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                commit(active);
                return;
              }
              onKeyDown(e);
            }}
          >
            <p className="rp-pick-pop-h">{label}</p>
            <div className="rp-pick-list">
              {options.map((o, i) => (
                <div
                  key={o.slug}
                  id={`${id}-o${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={o.slug === value}
                  className={`rp-pick-opt${i === active ? " is-active" : ""}${
                    o.slug === value ? " is-sel" : ""
                  }`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(i)}
                >
                  <span className="rp-pick-rate">{o.rate.toFixed(2)}%</span>
                  <span className="rp-pick-txt">
                    <span className="rp-pick-venue">{o.venue}</span>
                    <span className="rp-pick-meta">
                      {metaLine(o)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
