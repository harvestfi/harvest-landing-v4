// Wallet address chip for the Live Feed / SEO Summary tables. Renders
// the address twice — the regular 6+4 shortening for desktop and an
// extra-tight 4+2 shortening for the one-line mobile rows — and lets
// CSS (.lf-lbl-full / .lf-lbl-short) pick which one shows.

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
    <span className="lf-mono" title={title ?? address}>
      <span className="lf-lbl-full">{shortDesktop(address)}</span>
      <span className="lf-lbl-short">{shortMobile(address)}</span>
    </span>
  );
}
