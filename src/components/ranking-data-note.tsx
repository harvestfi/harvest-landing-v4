// Compliance disclaimer rendered above every ranking table (homepage,
// asset hubs, network hubs). The pages keep their "best / top /
// ranking" framing for its search value, and this note qualifies it:
// the ranking is a sort of historical data, not an inducement or a
// promise of future performance. Styled per surface via the
// .uni-data-note rules in home.css / asset-hub.css.
//
// sortedBy names the actual sort key on pages that state one elsewhere, so
// the note does not describe a different ordering than the page's own copy.
export function RankingDataNote({ sortedBy }: { sortedBy?: string } = {}) {
  return (
    <p className="uni-data-note">
      Data reflected on this page is an aggregation of historical data
      and sorted by {sortedBy ?? "best (e.g. highest historical performance)"}, and is
      not a promise of continued performance or guaranteed results.
    </p>
  );
}
