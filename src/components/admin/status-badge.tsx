// New / Existing user badge for the Live Feed + SEO Summary.
//   Existing (orange) = the wallet already had a Harvest balance (a
//                       deposit predating this session).
//   New (purple)      = no prior Harvest balance, even if it deposits
//                       during the session (first-time depositor).
// Desktop shows the full word; the tight mobile rows show N / E.

export function StatusBadge({ status }: { status: "new" | "existing" | null }) {
  if (!status) return <span className="lf-dim">—</span>;
  const isNew = status === "new";
  return (
    <span
      className={`lf-badge ${isNew ? "lf-badge-new" : "lf-badge-existing"}`}
      title={
        isNew
          ? "New: no prior Harvest balance"
          : "Existing: had a Harvest balance before this session"
      }
    >
      <span className="lf-lbl-full">{isNew ? "New" : "Existing"}</span>
      <span className="lf-lbl-short">{isNew ? "N" : "E"}</span>
    </span>
  );
}
