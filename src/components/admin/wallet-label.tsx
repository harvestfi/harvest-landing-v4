"use client";

// Wallet address chip linking to the wallet's DeBank profile. Renders
// the address twice — a 6+4 shortening for desktop, a tighter 4+2 for
// the one-line mobile rows — and CSS (.lf-lbl-full / .lf-lbl-short)
// picks which shows. stopPropagation so clicking it inside a clickable
// (expandable) row opens DeBank instead of toggling the row.

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
    <a
      className="lf-mono lf-wallet-link"
      href={`https://debank.com/profile/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      title={title ? `${title} · DeBank ↗` : `${address} · DeBank ↗`}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="lf-lbl-full">{shortDesktop(address)}</span>
      <span className="lf-lbl-short">{shortMobile(address)}</span>
    </a>
  );
}
