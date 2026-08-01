// How concentrated XRP ownership is, measured over the largest accounts.
//
// Pinned to a fixed cohort rather than to however deep the snapshot happens to
// run. The ranking table pages through 500 accounts, but "the top 100 hold X%"
// is a claim about 100 accounts, and letting the cohort follow the snapshot
// depth would silently restate every figure on the page the next time the walk
// goes deeper. The number of accounts a share is measured over is part of the
// claim, so it lives here as a constant.
//
// The label research behind the exchange, Ripple and founder splits also only
// covers the first 100 rows, so a wider cohort would report a smaller share as
// "attributed" purely because nobody has looked at rows 101 and down yet.
export const CONCENTRATION_N = 100;

// Concentration read three ways. The first is the number every rich list
// quotes. The second is the one that means something: an exchange wallet is
// thousands of customers in one row, so counting it as concentration overstates
// how few hands hold XRP. The third is the largest holding attributed to a
// person rather than to a venue or a treasury.
export function concentrationOf(rows, totalXrp) {
  const sum = (r) => r.reduce((a, t) => a + t.xrp, 0);
  const share = (r) => (totalXrp ? Math.round((sum(r) / totalXrp) * 1e4) / 1e2 : 0);
  const isExchange = (t) => t.label?.type === "exchange";
  const isRipple = (t) => t.label?.affiliation === "ripple";
  const isFounder = (t) => t.label?.affiliation === "ripple-founder";
  const nonExchange = rows.filter((t) => !isExchange(t));
  const individuals = rows.filter((t) => t.label?.type === "individual");
  const ripple = rows.filter(isRipple);
  const founders = rows.filter(isFounder);
  const residual = rows.filter((t) => !isExchange(t) && !isRipple(t) && !isFounder(t));
  return {
    top100Xrp: Math.round(sum(rows)),
    top100PctOfXrp: share(rows),
    exchangeAccounts: rows.length - nonExchange.length,
    exchangeXrp: Math.round(sum(rows.filter(isExchange))),
    exExchangeXrp: Math.round(sum(nonExchange)),
    exExchangePctOfXrp: share(nonExchange),
    // Ripple's own wallets and the personal wallets of its co-founders, read
    // apart. Both get folded into "Ripple owns most of XRP" in the usual
    // telling, and only the first is XRP the company controls.
    rippleAccounts: ripple.length,
    rippleXrp: Math.round(sum(ripple)),
    ripplePctOfXrp: share(ripple),
    rippleEscrowedXrp: Math.round(ripple.reduce((a, t) => a + (t.escrowedXrp ?? 0), 0)),
    founderAccounts: founders.length,
    founderXrp: Math.round(sum(founders)),
    founderPctOfXrp: share(founders),
    // What is left once exchanges, Ripple and its founders come out: the part
    // of the top 100 that is neither a venue holding customer balances nor
    // connected to the company that issued XRP.
    residualAccounts: residual.length,
    residualXrp: Math.round(sum(residual)),
    residualPctOfXrp: share(residual),
    largestIndividual: individuals.length
      ? {
          rank: individuals[0].rank,
          address: individuals[0].address,
          name: individuals[0].label.name,
          xrp: individuals[0].xrp,
          attribution: individuals[0].label.attribution ?? null,
        }
      : null,
    labelledAccounts: rows.filter((t) => t.label).length,
    basis:
      "Shares are of all XRP in funded accounts, spendable and escrowed together. An exchange wallet holds balances for many customers, so excluding those is the closer read on how concentrated ownership is.",
  };
}
