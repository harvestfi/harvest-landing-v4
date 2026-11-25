"use client";

// Share price indexed to 100, one line per vault. Hovering, dragging a finger
// or the arrow keys move a crosshair along the dates; a tooltip lists the five
// highest vaults at that date, so nobody has to aim at a 2px line. On touch the
// tooltip stays after the finger lifts and closes on a tap outside the chart.
// Clicking a legend row hides or shows its line; hovering one dims the others.
// Colours are CSS variables (--uyr-s1..8) so light and dark each get their own steps.
import { useEffect, useMemo, useRef, useState } from "react";

export type ChartRow = { id: string; name: string; chain: string; series: [string, number | null][] };

const W = 720, H = 300, L = 44, R = 12, T = 12, B = 28;
const TOP = 5;
const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

export function SharePriceChart({ rows }: { rows: ChartRow[] }) {
  const { dates, lines, yMin, yMax } = useMemo(() => {
    // One shared date axis; a vault younger than the period starts its line on
    // its first real reading, indexed to 100 there.
    const dates = [...new Set(rows.flatMap((v) => v.series.map((s) => s[0])))].sort();
    const di = new Map(dates.map((d, i) => [d, i]));
    const lines = rows
      .map((v, k) => {
        const ok = v.series.filter((s): s is [string, number] => Number.isFinite(s[1]));
        const base = ok[0]?.[1] ?? 1;
        const pts = ok.map(([d, p]) => [di.get(d)!, (100 * p) / base] as [number, number]);
        return { ...v, slot: k + 1, pts, at: new Map(pts) };
      })
      .filter((l) => l.pts.length > 1);
    const ys = lines.flatMap((l) => l.pts.map((p) => p[1]));
    return {
      dates,
      lines,
      yMin: Math.floor(Math.min(...ys) * 4) / 4,
      yMax: Math.ceil(Math.max(...ys) * 4) / 4,
    };
  }, [rows]);

  const n = dates.length;
  const plot = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [off, setOff] = useState<Set<string>>(() => new Set());

  // Touch keeps the tooltip open after the finger lifts; a tap elsewhere closes it.
  useEffect(() => {
    if (hover == null) return;
    const close = (e: PointerEvent) => {
      if (!plot.current?.contains(e.target as Node)) setHover(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [hover]);

  const x = (i: number) => L + ((W - L - R) * i) / Math.max(1, n - 1);
  const y = (v: number) => T + ((H - T - B) * (yMax - v)) / (yMax - yMin || 1);
  const ticks = Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4);
  const clamp = (i: number) => Math.max(0, Math.min(n - 1, i));
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(clamp(Math.round(((px - L) / (W - L - R)) * (n - 1))));
  };

  const toggle = (id: string) =>
    setOff((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else if (next.size < lines.length - 1) next.add(id); // never hide the last line
      return next;
    });

  const shown = lines.filter((l) => !off.has(l.id));
  const top =
    hover == null
      ? []
      : shown
          .map((l) => ({ l, v: l.at.get(hover) }))
          .filter((t): t is { l: (typeof lines)[number]; v: number } => t.v != null)
          .sort((a, b) => b.v - a.v)
          .slice(0, TOP);
  const right = hover != null && hover > (n - 1) / 2;

  return (
    <figure className="uyr-chart">
      <div className="uyr-chart-plot" ref={plot}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          tabIndex={0}
          aria-label="Share price of each vault, indexed to 100 at the start of the period. Use the arrow keys to move along the dates."
          onPointerDown={pick}
          onPointerMove={pick}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setHover(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") return setHover(null);
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            setHover(clamp((hover ?? n - 1) + (e.key === "ArrowLeft" ? -1 : 1)));
          }}
          onBlur={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="uyr-grid" />
              <text x={L - 6} y={y(t) + 4} textAnchor="end" className="uyr-ax">
                {t.toFixed(2)}
              </text>
            </g>
          ))}
          {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
            <text
              key={i}
              x={x(i)}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              className="uyr-ax"
            >
              {dates[i] ? day(dates[i]) : ""}
            </text>
          ))}
          {hover != null ? <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="uyr-cross" /> : null}
          {shown.map((l) => (
            <polyline
              key={l.id}
              fill="none"
              stroke={`var(--uyr-s${l.slot})`}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={focus && focus !== l.id ? 0.18 : 1}
              points={l.pts.map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ")}
            />
          ))}
          {top.map(({ l, v }) => (
            <circle key={l.id} cx={x(hover!)} cy={y(v)} r="4" fill={`var(--uyr-s${l.slot})`} className="uyr-dot" />
          ))}
        </svg>
        {hover != null && top.length ? (
          <div
            className="uyr-tip"
            role="status"
            data-side={right ? "left" : "right"}
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            <p className="uyr-tip-d">{day(dates[hover])}</p>
            <ul>
              {top.map(({ l, v }) => (
                <li key={l.id}>
                  <i style={{ background: `var(--uyr-s${l.slot})` }} />
                  <span>{l.name}</span>
                  <b>{v.toFixed(2)}</b>
                </li>
              ))}
            </ul>
            {shown.length > TOP ? <p className="uyr-tip-n">{`Top ${TOP} of ${shown.length} on this day`}</p> : null}
          </div>
        ) : null}
      </div>
      <figcaption>
        <ul className="uyr-legend">
          {lines.map((l) => {
            const hidden = off.has(l.id);
            return (
              <li key={l.id}>
                <button
                  type="button"
                  aria-pressed={!hidden}
                  data-off={hidden ? "true" : "false"}
                  title={hidden ? `Show ${l.name}` : `Hide ${l.name}`}
                  onClick={() => toggle(l.id)}
                  onPointerEnter={(e) => e.pointerType === "mouse" && !hidden && setFocus(l.id)}
                  onPointerLeave={() => setFocus(null)}
                >
                  <i style={{ background: `var(--uyr-s${l.slot})` }} />
                  <span className="uyr-legend-n">{l.name}</span>
                  <span className="uyr-legend-c">{l.chain}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </figcaption>
    </figure>
  );
}
