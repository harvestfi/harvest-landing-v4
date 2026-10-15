"use client";

// The largest-accounts table on /xrp-rich-list.
//
// Built on the ranking pattern the asset hubs use (see .uni-hub-row in
// asset-hub.css): a CSS grid where the header defines the column track and
// every row repeats it, rather than a <table> whose cells size themselves.
// The reason is uniform rows. A table lets one cell with an extra line push
// its whole row taller, and a hundred rows of different heights read as a
// dump rather than as a ranking. Here every cell is exactly one line, so all
// the rows are the same height and the eye can run down a column.
//
// That constraint is why the escrow figure has its own column instead of a
// sub-line under the XRP amount, and why the evidence note moved out of the
// Name cell and into a single sentence under the table. Both were secondary
// text living inside a cell, and both broke the row rhythm.
//
// It is still a table semantically: role="table" with row/columnheader/cell
// on the grid elements, so a screen reader gets the same structure a <table>
// would give it.
//
// The filters exist because three groups in this list are not what a reader
// means by "an XRP holder". An exchange wallet is thousands of customers
// pooled into one row. Ripple's own wallets are the issuer's treasury, most
// of it escrowed and unable to move. Its co-founders' personal wallets are a
// third thing again, and folding them into the company's total would overstate
// what Ripple controls. Each comes out separately.
//
// The controls sit under the ranking rather than over it. The table is what
// the section is for and what a visitor scrolled to; three checkboxes above it
// delay that for everyone, including the majority who never filter.
//
// All hundred rows render on the server and the filters only narrow what is
// already there, so the unfiltered ranking is what a crawler sees. Ranks stay
// at their position in the full list when a filter is on: a renumbered subset
// would call a row "the third largest XRP holder" when it is really the
// twelfth, and that sentence would be false.

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { holderAvatar } from "./holder-avatars";
import { koName, koXrp } from "@/lib/xrp-richlist-ko";

export interface TopRow {
  rank: number;
  address: string;
  xrp: number;
  spendableXrp?: number;
  escrowedXrp?: number;
  pctOfSupply: number;
  domain: string | null;
  label?: {
    name: string;
    type?: string;
    affiliation?: string | null;
    evidence: string;
    evidenceUrl: string | null;
    attribution: string | null;
    verifiedOn: string | null;
  } | null;
}

const usd = (n: number): string => {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}bn`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n)}`;
};

// One format for every XRP figure in the table, so the column reads as a
// column. Full digit groups would be exact but would also make the widest cell
// twice the width of the narrowest, and the ranking is about relative size.
const xrpShort = (n: number): string =>
  n >= 1_000_000_000
    ? `${(n / 1_000_000_000).toFixed(2)}bn`
    : n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : Math.round(n).toLocaleString("en-US");

const pct = (v: number): string => {
  if (v >= 1) return `${v.toFixed(2)}%`;
  if (v >= 0.01) return `${v.toFixed(2)}%`;
  return "<0.01%";
};

// Won in a table cell: "11.5조", "4,312억", "891만". Short for the same reason
// the dollar column is: the ranking is about relative size.
const wonShort = (n: number): string => {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
  if (n >= 1e8) return `${Math.round(n / 1e8).toLocaleString("en-US")}억`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString("en-US")}만`;
  return `${Math.round(n)}`;
};

// Korean is the copy /ko/xrp-rich-list renders; English is unchanged.
type Locale = "en" | "ko";

const COPY = {
  en: {
    aria: (d: string) => `Largest XRP Ledger accounts as of ${d}`,
    account: "Account",
    escrow: "In escrow",
    value: "Value",
    name: "Name",
    share: "Share",
    unnamed: "Unnamed",
    prev: "Previous",
    next: "Next",
    hide: "Hide",
    filters: {
      exchange: "Exchange wallets",
      ripple: "Ripple-controlled wallets",
      founder: "Ripple founder wallets",
    },
  },
  ko: {
    aria: (d: string) => `${d} 기준 XRP 보유량 상위 지갑`,
    account: "지갑 주소",
    escrow: "에스크로",
    value: "원화 가치",
    name: "보유자",
    share: "비중",
    unnamed: "미확인",
    prev: "이전",
    next: "다음",
    hide: "숨기기",
    filters: {
      exchange: "거래소 지갑",
      ripple: "리플사 지갑",
      founder: "리플 창업자 지갑",
    },
  },
} as const;

type FilterKey = "exchange" | "ripple" | "founder";

const FILTERS: { key: FilterKey; label: string; match: (r: TopRow) => boolean }[] = [
  {
    key: "exchange",
    label: "Exchange wallets",
    match: (r) => r.label?.type === "exchange",
  },
  {
    key: "ripple",
    label: "Ripple-controlled wallets",
    match: (r) => r.label?.affiliation === "ripple",
  },
  {
    key: "founder",
    label: "Ripple founder wallets",
    match: (r) => r.label?.affiliation === "ripple-founder",
  },
];

// A hundred rows is already a long scroll and the snapshot runs five times
// deeper than that, so the table pages rather than growing without end. A
// hundred to a page keeps the top 100, the cohort every other figure on this
// page is measured over, as exactly the first page.
const PAGE_SIZE = 100;

export function TopAccountsTable({
  rows,
  snapshotDate,
  xrpUsd,
  locale = "en",
  xrpKrw = null,
}: {
  rows: TopRow[];
  snapshotDate: string;
  xrpUsd: number | null;
  locale?: Locale;
  /** Korean page only: the value column is in won when this is set. */
  xrpKrw?: number | null;
}) {
  const c = COPY[locale];
  const ko = locale === "ko";
  // Won when the Korean page has a won price, dollars otherwise, so the
  // column is never empty just because one feed failed.
  // 억/만 on the Korean page: "50억", not "5.00bn".
  const amount = (n: number): string => (ko ? koXrp(n) : xrpShort(n));
  const value = (xrp: number): string =>
    ko && xrpKrw ? wonShort(xrp * xrpKrw) : xrpUsd ? usd(xrp * xrpUsd) : "—";
  const [hidden, setHidden] = useState<Record<FilterKey, boolean>>({
    exchange: false,
    ripple: false,
    founder: false,
  });
  const [page, setPage] = useState(0);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f.key, rows.filter(f.match).length]),
      ) as Record<FilterKey, number>,
    [rows],
  );

  const active = FILTERS.filter((f) => hidden[f.key]);
  const shown = useMemo(
    () => (active.length ? rows.filter((r) => !active.some((f) => f.match(r))) : rows),
    // `active` is derived from `hidden` on every render, so keying on the flags
    // themselves is what keeps this from recomputing on unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, hidden],
  );

  const shownXrp = shown.reduce((a, r) => a + r.xrp, 0);
  const shownPct = shown.reduce((a, r) => a + r.pctOfSupply, 0);

  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  // Filtering can leave fewer pages than the one being viewed, which would
  // otherwise show an empty table with no way back.
  useEffect(() => {
    if (page > pages - 1) setPage(0);
  }, [page, pages]);
  const from = page * PAGE_SIZE;
  const pageRows = shown.slice(from, from + PAGE_SIZE);

  return (
    <>
      <div className="rl-rank-box">
      <div className="rl-rank" role="table" aria-label={c.aria(snapshotDate)} data-nosnippet="">
        <div className="rl-rank-head" role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">{c.account}</span>
          <span role="columnheader" className="rl-rank-n">XRP</span>
          <span role="columnheader" className="rl-rank-n rl-rank-esc">{c.escrow}</span>
          <span role="columnheader" className="rl-rank-n">
            {ko && !xrpKrw ? "USD" : c.value}
          </span>
          <span role="columnheader">{c.name}</span>
          <span role="columnheader" className="rl-rank-n">{c.share}</span>
        </div>
        {/* The rows sit in a wrapper so the header can be sticky against the
            scroll container, and a bare <div> between a table and its rows
            breaks the role hierarchy, so it declares itself a rowgroup. */}
        <div className="rl-rank-body" role="rowgroup">
          {pageRows.map((t) => (
            <div className="rl-rank-row" role="row" key={t.address}>
              <span className="rl-rank-i" role="cell">{t.rank}</span>
              <span className="rl-rank-addr" role="cell">
                {t.address}
              </span>
              <span className="rl-rank-n rl-rank-xrp" role="cell">
                {amount(t.xrp)}
              </span>
              <span className="rl-rank-n rl-rank-esc" role="cell">
                {t.escrowedXrp ? amount(t.escrowedXrp) : "—"}
              </span>
              <span className="rl-rank-n" role="cell">
                {value(t.xrp)}
              </span>
              <span className="rl-rank-name" role="cell">
                {t.label ? (
                  (() => {
                    // The mark sits inside the pill, sized to its line box, so
                    // the badge keeps its height and only the left padding
                    // tightens to sit flush around a circle. Same shape as the
                    // eyebrow badge on the calculator.
                    const avatar = holderAvatar(t.label.name);
                    return (
                      <span
                        className={`rl-badge rl-badge-${t.label.type ?? "unknown"}${
                          avatar ? " has-avatar" : ""
                        }`}
                      >
                        {avatar ? (
                          <Image
                            className="rl-badge-avatar"
                            src={avatar}
                            alt=""
                            width={15}
                            height={15}
                            aria-hidden="true"
                          />
                        ) : null}
                        {ko ? koName(t.label.name) : t.label.name}
                      </span>
                    );
                  })()
                ) : t.domain ? (
                  <span className="rl-badge rl-badge-domain">{t.domain}</span>
                ) : (
                  <span className="rl-rank-none">{c.unnamed}</span>
                )}
              </span>
              <span className="rl-rank-n rl-rank-share" role="cell">
                {pct(t.pctOfSupply)}
              </span>
            </div>
          ))}
        </div>
      </div>
      </div>

      {pages > 1 ? (
        <div className="rl-pager">
          <button
            type="button"
            className="rl-pager-btn"
            onClick={() => setPage((n) => Math.max(0, n - 1))}
            disabled={page === 0}
          >
            {c.prev}
          </button>
          {/* Positions in the list as filtered, not ledger ranks. Hiding the
              exchange rows shifts every position up, so "rank 401" would name
              a different account than the one on the row. */}
          {ko ? (
            <span className="rl-pager-at">
              {shown.length.toLocaleString("en-US")}개 중{" "}
              {(from + 1).toLocaleString("en-US")}~
              {Math.min(from + PAGE_SIZE, shown.length).toLocaleString("en-US")}위
            </span>
          ) : (
          <span className="rl-pager-at">
            Accounts {(from + 1).toLocaleString("en-US")} to{" "}
            {Math.min(from + PAGE_SIZE, shown.length).toLocaleString("en-US")} of{" "}
            {shown.length.toLocaleString("en-US")}
          </span>
          )}
          <button
            type="button"
            className="rl-pager-btn"
            onClick={() => setPage((n) => Math.min(pages - 1, n + 1))}
            disabled={page >= pages - 1}
          >
            {c.next}
          </button>
        </div>
      ) : null}

      <div className="rl-rank-foot">
      <div className="rl-filters">
        <span className="rl-filters-label">{c.hide}</span>
        {FILTERS.map((f) => (
          <label key={f.key} className="rl-chip">
            <input
              type="checkbox"
              checked={hidden[f.key]}
              onChange={(e) =>
                setHidden((h) => ({ ...h, [f.key]: e.target.checked }))
              }
            />
            <span>
              {c.filters[f.key]} <em>{counts[f.key]}</em>
            </span>
          </label>
        ))}
      </div>

      {ko ? (
        <p className="rl-filters-read" role="status" aria-live="polite">
          {rows.length}개 지갑 중 <strong>{shown.length}개</strong> 표시 중. 이 지갑들은{" "}
          {snapshotDate} 기준 {koXrp(shownXrp)} XRP를 보유하고 있으며, 이는 전체 XRP의{" "}
          {shownPct.toFixed(2)}%입니다.
        </p>
      ) : (
      <p className="rl-filters-read" role="status" aria-live="polite">
        Showing <strong>{shown.length}</strong> of {rows.length} accounts,
        holding {xrpShort(shownXrp)} XRP between them, or {shownPct.toFixed(2)}%
        of all XRP in funded accounts as of {snapshotDate}.
      </p>
      )}
      </div>
    </>
  );
}
