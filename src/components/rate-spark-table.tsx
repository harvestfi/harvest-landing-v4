"use client";

// A year of earnings for every strategy, at the rate it paid on any of the
// last 90 days. One sparkline per row, one shared crosshair: move the pointer
// (or the arrow keys) across any row and every row's value, change chip and
// the date in the header follow it. Escape returns to the latest rates.
//
// The interaction follows the spark-table pattern (shared index, damped
// focus, latest-by-default); the drawing is plain SVG so the server render
// already carries the latest values and the page needs no canvas.
import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Link from "next/link";
import type { RateSeries } from "@/lib/rate-series";

const W = 240;
const H = 32;
const PAD = 3;

const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function pathOf(values: (number | null)[], lo: number, hi: number, n: number) {
  const x = (k: number) => (k / Math.max(1, n - 1)) * W;
  const y = (v: number) => PAD + ((hi - v) / (hi - lo)) * (H - PAD * 2);
  // Days without a reading are bridged: the line only starts where the
  // vault's history does.
  let d = "";
  let open = false;
  values.forEach((v, k) => {
    if (v == null) return;
    d += `${open ? "L" : "M"}${x(k).toFixed(1)} ${y(v).toFixed(1)}`;
    open = true;
  });
  return { d, x, y };
}

export function RateSparkTable({
  series,
  amount,
  unit,
  digits,
  caption,
}: {
  series: RateSeries;
  amount: number;
  unit: string;
  digits: number;
  caption: string;
}) {
  const { days, rows } = series;
  const n = days.length;
  const [idx, setIdx] = useState<number | null>(null);
  const sparkRef = useRef<HTMLSpanElement>(null);

  const scales = useMemo(
    () =>
      rows.map((r) => {
        const vs = r.values.filter((v): v is number => v != null);
        let lo = Math.min(...vs);
        let hi = Math.max(...vs);
        if (!vs.length) {
          lo = 0;
          hi = 1;
        }
        if (hi - lo < 1e-6) {
          hi += 0.5;
          lo = Math.max(0, lo - 0.5);
        }
        return { lo, hi, ...pathOf(r.values, lo, hi, n) };
      }),
    [rows, n],
  );

  const at = useCallback(
    (values: (number | null)[]) => {
      const k = idx ?? n - 1;
      for (let j = k; j >= 0; j--) if (values[j] != null) return values[j] as number;
      return null;
    },
    [idx, n],
  );
  const firstOf = (values: (number | null)[]) => values.find((v) => v != null) ?? null;

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = sparkRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = e.clientX - r.left;
    if (x < -8 || x > r.width + 8) {
      setIdx(null);
      return;
    }
    setIdx(Math.max(0, Math.min(n - 1, Math.round((x / r.width) * (n - 1)))));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const step = (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 7 : 1);
      setIdx((i) => Math.max(0, Math.min(n - 1, (i ?? n - 1) + step)));
    } else if (e.key === "Home") {
      e.preventDefault();
      setIdx(0);
    } else if (e.key === "Escape" || e.key === "End") {
      setIdx(null);
    }
  };

  const fmt = (v: number | null) =>
    v == null
      ? "–"
      : `${((amount * v) / 100).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${unit}`;

  const k = idx ?? n - 1;
  const crossX = (k / Math.max(1, n - 1)) * 100;

  return (
    <figure className="rs-table" data-nosnippet="">
      <div
        className="rs-grid"
        role="group"
        aria-roledescription="chart"
        aria-label={`${caption}. Left and right move through the last ${n} days for every row, Escape returns to the latest rates.`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setIdx(null)}
        onKeyDown={onKey}
      >
        <div className="rs-head" aria-hidden="true">
          <span>Strategy</span>
          <span className="rs-head-spark" ref={sparkRef}>
            <span
              className="rs-head-date"
              data-active={idx != null ? "true" : "false"}
              style={{ left: `${Math.min(88, Math.max(12, crossX))}%` }}
            >
              {idx != null ? fmtDate(days[idx]) : `Last ${n} days`}
            </span>
          </span>
          <span className="rs-num">{`${amount} ${unit}, 1 year`}</span>
          <span className="rs-num">APY</span>
        </div>
        {rows.map((r, i) => {
          const v = at(r.values);
          const v0 = firstOf(r.values);
          const chg = v != null && v0 != null ? v - v0 : 0;
          const flat = Math.abs(chg) < 0.005;
          const s = scales[i];
          const dotV = v;
          return (
            <div className="rs-row" key={r.id}>
              <span className="rs-label">
                <Link href={r.href} className="rs-name">
                  {r.label}
                </Link>
                <span className="rs-sub">{r.sublabel}</span>
              </span>
              <span className="rs-spark">
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
                  <path d={s.d} className="rs-line" vectorEffect="non-scaling-stroke" />
                </svg>
                <span className="rs-cross" style={{ left: `${crossX}%`, opacity: idx != null ? 1 : 0 }} />
                {dotV != null ? (
                  <span
                    className="rs-dot"
                    style={{ left: `${crossX}%`, top: `${(s.y(dotV) / H) * 100}%` }}
                  />
                ) : null}
              </span>
              <span className="rs-num rs-val">{fmt(v)}</span>
              <span className="rs-num">
                <span className={`rs-chip ${flat ? "is-flat" : chg > 0 ? "is-up" : "is-down"}`}>
                  {v == null ? "–" : `${v.toFixed(2)}%`}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="rs-caption">{caption}</figcaption>
    </figure>
  );
}
