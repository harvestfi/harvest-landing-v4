"use client";

// Wallet address chip. The address links to the internal per-wallet history
// page (/control-room/history) in the same tab; a small orange "D" beside it
// opens the wallet's DeBank profile in a new tab. Renders the address twice —
// a 6+4 shortening for desktop, a tighter 4+2 for the one-line mobile rows —
// and CSS (.lf-lbl-full / .lf-lbl-short) picks which shows. stopPropagation
// so clicking either inside a clickable (expandable) row doesn't toggle it.

import Link from "next/link";

function shortDesktop(addr: string): string {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function shortMobile(addr: string): string {
  if (!addr || addr.length < 8) return addr || "—";
  return `${addr.slice(0, 4)}…${addr.slice(-2)}`;
}

export function WalletLabel({
  address,
  title,
}: {
  address: string;
  title?: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Link
        className="lf-mono lf-wallet-link"
        href={`/control-room/history?address=${address}`}
        title={title ? `${title} · wallet history` : `${address} · history`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="lf-lbl-full">{shortDesktop(address)}</span>
        <span className="lf-lbl-short">{shortMobile(address)}</span>
      </Link>
      <a
        href={`https://debank.com/profile/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        title="View on DeBank"
        aria-label="View wallet on DeBank"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "1px solid #ff6a00",
          background: "rgba(255, 106, 0, 0.12)",
          fontFamily: "var(--sans)",
          fontSize: 9.5,
          fontWeight: 700,
          lineHeight: 1,
          color: "#ff6a00",
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        D
      </a>
    </span>
  );
}
