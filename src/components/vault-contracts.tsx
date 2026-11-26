"use client";

// One vault per row, nothing truncated: the full name on top (links to the
// vault on its platform), the full contract address underneath (links to the
// block explorer) with a copy button beside it.
import { useState } from "react";
import { AssetIcon, ChainIcon } from "@/components/token-icons";

export type ContractRow = { address: string; name: string; chain: string; venue: string; href: string; explorer: string };

export function VaultContracts({ rows, title }: { rows: ContractRow[]; title: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(address);
      window.setTimeout(() => setCopied((c) => (c === address ? null : c)), 1600);
    } catch {
      /* clipboard blocked: the address is still selectable text */
    }
  };

  return (
    <div className="rk uyr-contracts">
      <div className="rk-bar">
        <p className="rk-title">
          <span className="rk-title-ico" aria-hidden="true">
            <AssetIcon asset="USDC" size={18} decorative />
          </span>
          <span>{title}</span>
        </p>
      </div>
      <ul className="uyr-contracts-list">
        {rows.map((r) => (
          <li key={r.address}>
            <span className="rk-tile" aria-hidden="true">
              <AssetIcon asset="USDC" size={20} decorative />
              <span className="rk-tile-chain">
                <ChainIcon chain={r.chain} size={11} decorative />
              </span>
            </span>
            <div className="uyr-contracts-txt">
              <p className="uyr-contracts-n">
                <a href={r.href} target="_blank" rel="noopener noreferrer">
                  {r.name}
                </a>
                <span>{`${r.chain} · ${r.venue}`}</span>
              </p>
              <p className="uyr-contracts-a">
                <a href={r.explorer} target="_blank" rel="noopener noreferrer" title={`Open on the ${r.chain} explorer`}>
                  {r.address}
                </a>
                <button
                  type="button"
                  onClick={() => copy(r.address)}
                  aria-label={copied === r.address ? "Address copied" : `Copy the address of ${r.name}`}
                  title={copied === r.address ? "Copied" : "Copy address"}
                  data-copied={copied === r.address ? "true" : "false"}
                >
                  {copied === r.address ? (
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m3.5 8.5 3 3 6-7" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
                      <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
                    </svg>
                  )}
                </button>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
