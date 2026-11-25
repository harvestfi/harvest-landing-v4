"use client";

// Every vault in the report in one table, ten to a page. All rows are in the
// HTML from the start (the ones off the current page carry `hidden`), so a
// crawler or an agent reading the source gets the full set without clicking.
import { useState } from "react";
import { AssetIcon, ChainIcon } from "@/components/token-icons";

export type ResultRow = {
  id: string;
  name: string;
  chain: string;
  venue: string;
  href: string;
  d30: string;
  tvl: string;
};

export function AllResultsTable({ rows, title, size = 10 }: { rows: ResultRow[]; title: string; size?: number }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const from = page * size;
  const to = Math.min(rows.length, from + size);

  return (
    <div className="rk uyr-all">
      <div className="rk-bar">
        <p className="rk-title">
          <span className="rk-title-ico" aria-hidden="true">
            <AssetIcon asset="USDC" size={18} decorative />
          </span>
          <span>{title}</span>
        </p>
      </div>
      <div className="rk-scroll">
        <table className="rk-table">
          <thead>
            <tr>
              <th scope="col" className="rk-c-name"><span className="rk-sort uyr-static">Vault</span></th>
              <th scope="col" className="rk-num uyr-c-n"><span className="rk-sort uyr-static">30d realized</span></th>
              <th scope="col" className="rk-num uyr-c-n"><span className="rk-sort uyr-static">TVL</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="rk-row" data-rowlink="" hidden={i < from || i >= to}>
                <th scope="row" className="rk-c-name">
                  <span className="rk-prod">
                    <span className="rk-tile" aria-hidden="true">
                      <AssetIcon asset="USDC" size={20} decorative />
                      <span className="rk-tile-chain">
                        <ChainIcon chain={r.chain} size={11} decorative />
                      </span>
                    </span>
                    <span className="rk-prod-txt">
                      <a href={r.href} className="rk-name" title={r.name} target="_blank" rel="noopener noreferrer">
                        {r.name}
                      </a>
                      <span className="rk-sub">{`${r.chain} · ${r.venue}`}</span>
                    </span>
                  </span>
                </th>
                <td className="rk-num uyr-c-n"><strong>{r.d30}</strong></td>
                <td className="rk-num uyr-c-n">{r.tvl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <div className="uyr-pager">
          <span aria-live="polite">{`${from + 1}–${to} of ${rows.length} vaults`}</span>
          <span className="uyr-pager-btns">
            <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
              Previous
            </button>
            <span>{`Page ${page + 1} of ${pages}`}</span>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= pages - 1}>
              Next
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
