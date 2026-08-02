// Balance distribution chart for /xrp-rich-list.
//
// Deliberately NOT a client component. The build spec makes the chart a
// requirement rather than a decoration, because roughly 920 US searches a
// month ask for one by name, and a chart that only exists after hydration is
// invisible to the crawler serving those queries. So this is plain SVG
// rendered at build time: it is in the HTML, it needs no JavaScript, and it
// prints.
//
// It is paired with a data-table twin below it. The twin is not an
// accessibility afterthought: an answer engine cannot lift a figure out of an
// SVG path, and the writing spec requires every number on the page to exist as
// extractable text.

import type { ReactNode } from "react";

export interface Band {
  min: number;
  max: number | null;
  accounts: number;
  pctOfAccounts: number;
  xrpHeld: number;
  pctOfXrp: number;
}

// Sized so the type inside the SVG lands at the page's own body size once the
// chart is scaled to its container. The viewBox is 720 wide against roughly
// 930px of column on desktop, a factor of about 1.29, so a 12.5-unit tick
// renders at the 16px the report uses for body copy.
const W = 720;
const H = 340;
// Left padding carries the y-axis tick labels the grid lines need to mean
// anything. Without them a grid is decoration.
const PAD_L = 46;
const PAD_R = 8;
const PAD_T = 22;
const PAD_B = 86;

// Grid lines as fractions of the plot height. Because the bar scale is a
// square root, the value at a given height is the fraction squared times the
// maximum, which is what makes the compression visible rather than hidden.
const GRID = [0.25, 0.5, 0.75, 1];

const xrpShort = (n: number): string => {
  if (n >= 1_000_000_000) return `${n / 1_000_000_000}bn`;
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}k`;
  return String(n);
};

export const bandName = (b: Band): string =>
  b.max == null ? `${xrpShort(b.min)}+` : `${xrpShort(b.min)}-${xrpShort(b.max)}`;

// One decimal below 100k. Rounding 9,707 to a whole "10k" puts a number on the
// bar that the data table two elements below contradicts.
const compact = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 100_000
      ? `${(n / 1_000).toFixed(0)}k`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}k`
        : String(n);

export function DistributionChart({
  bands,
  snapshotDate,
  totalAccounts,
}: {
  bands: Band[];
  snapshotDate: string;
  totalAccounts: number;
}) {
  // Drop leading empty bands so the axis starts where accounts actually are.
  const rows = bands.filter((b) => b.accounts > 0);
  if (rows.length < 2) return null;

  const maxAccounts = Math.max(...rows.map((b) => b.accounts));
  const slot = (W - PAD_L - PAD_R) / rows.length;
  const barW = Math.min(slot * 0.66, 64);
  const plotH = H - PAD_T - PAD_B;

  // Square-root scale. A linear axis on a distribution this skewed renders
  // every band above 100k XRP as a flat line at zero, and a log axis on counts
  // invites reading a band as far larger than it is. Square root keeps the
  // small bands visible without overstating them.
  const barH = (n: number) => Math.max(2, Math.sqrt(n / maxAccounts) * plotH);

  const axisY = PAD_T + plotH;

  // "chart" leads the accessible name because it is the word people search
  // for and the SVG's aria-label was the only place it could go without
  // padding the visible copy.
  const caption =
    `XRP rich list chart: funded XRP Ledger accounts by balance band as of ${snapshotDate}. ` +
    rows
      .map((b) => `${bandName(b)} XRP: ${compact(b.accounts)} accounts`)
      .join(". ") +
    ".";

  return (
    <figure className="rl-chart-fig">
      <svg
        className="rl-chart"
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="auto"
        role="img"
        aria-label={caption}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* No <title>. React 19 treats it as document metadata and hoists
            it out of the SVG, which left `<title></title>` sitting in the
            markup: an empty title wins the accessible-name calculation over
            aria-label, so the chart was announcing itself as nothing. It has
            been shipping that way. The name comes from aria-label on the svg
            and the detail from desc, and neither is hoisted.

            With aria-hidden on every label, a screen reader gets one coherent
            sentence rather than thirty-three numbers run together, and the
            exact figures stay in the table below. */}
        <desc>{caption}</desc>
        {/* Grid first, so the bars sit over it. Hairlines at low contrast,
            following the shadcn chart container, which strokes its cartesian
            grid at half the border colour. */}
        {GRID.map((f) => {
          const y = PAD_T + plotH - f * plotH;
          return (
            <g key={f}>
              <line
                x1={PAD_L}
                y1={y + 0.5}
                x2={W - PAD_R}
                y2={y + 0.5}
                className="rl-chart-grid"
              />
              <text aria-hidden="true"
                x={PAD_L - 8}
                y={y + 4}
                textAnchor="end"
                className="rl-chart-tick rl-chart-tick-dim"
              >
                {compact(Math.round(f * f * maxAccounts))}
              </text>
            </g>
          );
        })}
        {rows.map((b, i) => {
          const h = barH(b.accounts);
          const x = PAD_L + i * slot + (slot - barW) / 2;
          const y = PAD_T + plotH - h;
          return (
            <g key={bandName(b)}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={3}
                className="rl-chart-bar"
              />
              <text aria-hidden="true"
                x={x + barW / 2}
                y={y - 5}
                textAnchor="middle"
                className="rl-chart-val"
              >
                {compact(b.accounts)}
              </text>
              <text aria-hidden="true"
                x={x + barW / 2}
                y={axisY + 20}
                textAnchor="middle"
                className="rl-chart-tick"
              >
                {bandName(b)}
              </text>
              <text aria-hidden="true"
                x={x + barW / 2}
                y={axisY + 36}
                textAnchor="middle"
                className="rl-chart-tick rl-chart-tick-dim"
              >
                {b.pctOfAccounts >= 0.1 ? `${b.pctOfAccounts.toFixed(1)}%` : "<0.1%"}
              </text>
            </g>
          );
        })}
        <line
          x1={PAD_L}
          y1={axisY + 0.5}
          x2={W - PAD_R}
          y2={axisY + 0.5}
          className="rl-chart-axis"
        />
        {/* Axis titles. Without them the two rows of numbers under each bar are
            unlabelled, and a reader has to guess whether "1-10" is a count, a
            rank or a balance. */}
        <text aria-hidden="true" x={W / 2} y={axisY + 64} textAnchor="middle" className="rl-chart-axis-title">
          XRP held in wallet
        </text>
        <text aria-hidden="true" x={W / 2} y={axisY + 79} textAnchor="middle" className="rl-chart-axis-sub">
          second line under each band: its share of all funded accounts
        </text>
      </svg>
      {/* The caption used to live here, inside the figure. It reads as part
          of the same thought as the scale note under the card, so it sits with
          it in the page rather than boxed off from it. */}
    </figure>
  );
}

/**
 * The extractable twin of the chart. Same numbers, as text, in source order.
 */
export function DistributionTable({
  bands,
  snapshotDate,
}: {
  bands: Band[];
  snapshotDate: string;
}): ReactNode {
  const rows = bands.filter((b) => b.accounts > 0);
  return (
    <div className="rl-dtable-wrap">
      <table className="rl-dtable">
        <caption className="rl-dtable-cap">
          XRP Ledger distribution by amount controlled, as of {snapshotDate}
        </caption>
        <thead>
          <tr>
            <th scope="col">Band (XRP)</th>
            <th scope="col">Accounts</th>
            <th scope="col">Percentage of accounts</th>
            <th scope="col">XRP held</th>
            <th scope="col">Percentage of XRP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={bandName(b)}>
              <th scope="row">{bandName(b)}</th>
              <td data-label="Accounts">{b.accounts.toLocaleString("en-US")}</td>
              <td data-label="Share of accounts">
                {b.pctOfAccounts >= 0.01 ? `${b.pctOfAccounts.toFixed(2)}%` : "under 0.01%"}
              </td>
              <td data-label="XRP held">{Math.round(b.xrpHeld).toLocaleString("en-US")}</td>
              <td data-label="Share of XRP">{b.pctOfXrp >= 0.01 ? `${b.pctOfXrp.toFixed(2)}%` : "under 0.01%"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
