// New / Existing user badge for the Live Feed + SEO Summary.
//   Existing (orange) = the wallet already had a Harvest balance (a
//                       deposit predating this session).
//   New (purple)      = no prior Harvest balance, even if it deposits
//                       during the session (first-time depositor).
// Desktop shows the full word; the tight mobile rows show N / E.
//
// On mobile the wallet column is gone, so the badge doubles as the
// wallet affordance: tapping it reveals a tooltip bubble with the
// shortened address + a DeBank link (the reveal is gated to mobile in
// CSS; on desktop the address lives in its own column).

function shortAddr(a: string): string {
  if (!a || a.length < 10) return a || "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function StatusBadge({
  status,
  wallet,
}: {
  status: "new" | "existing" | null;
  wallet?: string | null;
}) {
  if (!status) return <span className="lf-dim">—</span>;
  const isNew = status === "new";
  const badge = (
    <span className={`lf-badge ${isNew ? "lf-badge-new" : "lf-badge-existing"}`}>
      <span className="lf-lbl-full">{isNew ? "New" : "Existing"}</span>
      <span className="lf-lbl-short">{isNew ? "N" : "E"}</span>
    </span>
  );
  if (!wallet) return badge;
  return (
    <span className="lf-ne-tip">
      <button
        type="button"
        className="lf-ne-tip-btn"
        aria-label={`${isNew ? "New" : "Existing"} user · wallet ${wallet}`}
        onClick={(e) => e.stopPropagation()}
      >
        {badge}
      </button>
      <span className="lf-ne-tip-pop" role="tooltip">
        <a
          href={`https://debank.com/profile/${wallet}`}
          target="_blank"
          rel="noopener noreferrer"
          className="lf-mono lf-wallet-link"
          onClick={(e) => e.stopPropagation()}
        >
          {shortAddr(wallet)} · DeBank ↗
        </a>
      </span>
    </span>
  );
}
