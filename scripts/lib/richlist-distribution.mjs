// Streaming balance-distribution aggregator for /xrp-rich-list.
//
// The constraint that shapes this file: there are roughly 8.5 million funded
// XRP Ledger accounts, and the pipeline sees each balance exactly once, in
// whatever order the ledger's state tree hands it over. Holding them all to
// sort at the end is ~70MB of float plus GC pressure in CI, and the artifact
// that ships to the browser has to be a few tens of kilobytes, not megabytes.
//
// So balances go into a log-spaced histogram as they arrive. Percentiles come
// out of the cumulative counts rather than out of a sorted array. With 2000
// buckets per decade a threshold is accurate to 0.12%, which on a 2,000 XRP
// cutoff is about two XRP. That bound is stated on the page rather than
// hidden, because a rich list that will not say how it was computed is the
// thing this page is trying to beat.
//
// Three things the histogram cannot answer are tracked exactly alongside it:
// the total supply held, the largest N accounts, and the count at each of the
// round balances the page quotes in prose. Those are quoted as facts, so they
// are counted rather than interpolated.

// Buckets per decade. 2000 gives a worst-case relative error of
// 10^(1/2000) - 1 = 0.115% on any threshold read out of the histogram.
export const BUCKETS_PER_DECADE = 2000;
const MIN_EXP = -6; // one drop
const MAX_EXP = 11; // 100 billion XRP, above the 100bn total supply
const NUM_BUCKETS = (MAX_EXP - MIN_EXP) * BUCKETS_PER_DECADE + 1;

const bucketOf = (xrp) => {
  const i = Math.round((Math.log10(xrp) - MIN_EXP) * BUCKETS_PER_DECADE);
  return i < 0 ? 0 : i > NUM_BUCKETS - 1 ? NUM_BUCKETS - 1 : i;
};
export const bucketValue = (i) => 10 ** (i / BUCKETS_PER_DECADE + MIN_EXP);

// Round balances the page quotes directly. The FAQ asks "how many holders have
// 10,000 or more" and "how many people own 20,000", and an answer read off a
// histogram would be a near-miss on a number the reader can check elsewhere.
export const EXACT_THRESHOLDS = [
  1, 10, 20, 50, 100, 500, 1_000, 5_000, 10_000, 20_000, 50_000,
  100_000, 500_000, 1_000_000, 10_000_000,
];

// Tiers the threshold table shows. Each is "the minimum balance that puts an
// account in the top N% of funded accounts by balance".
//
// 0.01 was added after AI Overview testing: Google quoted a top 0.01% figure
// of "over 3.8 million XRP" on "top xrp holders" while the page supplied no
// such row. The histogram already holds the resolution, so this is one more
// read over data the walk collects anyway, not a new pass.
//
// The tier appears in the artifact after the next scheduled walk. Both the
// table and the prose render whatever tiers the data carries, so nothing needs
// touching again when it lands.
export const TIERS = [0.01, 0.1, 1, 5, 10, 25, 50];

export class Distribution {
  constructor({ topN = 100 } = {}) {
    this.counts = new Float64Array(NUM_BUCKETS);
    this.total = 0;
    this.sumXrp = 0;
    this.exact = new Map(EXACT_THRESHOLDS.map((t) => [t, 0]));
    this.topN = topN;
    // Kept as a plain array and only sorted when it overflows. At topN = 100
    // the overflow path runs a handful of times per million accounts, which is
    // cheaper than maintaining a heap in JS for this size.
    this.top = [];
    this.topFloor = -Infinity;
  }

  /** @param {number} xrp  balance in XRP  @param {object} meta  carried into the top list */
  add(xrp, meta) {
    if (!(xrp > 0)) {
      // A zero-balance AccountRoot cannot normally exist, but a malformed page
      // must not silently shift every percentile, so it is counted and skipped.
      this.total++;
      return;
    }
    this.total++;
    this.sumXrp += xrp;
    this.counts[bucketOf(xrp)]++;
    for (const t of EXACT_THRESHOLDS) if (xrp >= t) this.exact.set(t, this.exact.get(t) + 1);

    if (xrp > this.topFloor || this.top.length < this.topN) {
      this.top.push({ xrp, ...meta });
      if (this.top.length > this.topN * 4) this.#trimTop();
    }
  }

  #trimTop() {
    this.top.sort((a, b) => b.xrp - a.xrp);
    this.top.length = Math.min(this.top.length, this.topN);
    this.topFloor = this.top.length >= this.topN ? this.top[this.top.length - 1].xrp : -Infinity;
  }

  /** Accounts holding at least `xrp`, read from the histogram. */
  atOrAbove(xrp) {
    if (!(xrp > 0)) return this.total;
    let n = 0;
    for (let i = bucketOf(xrp); i < NUM_BUCKETS; i++) n += this.counts[i];
    return n;
  }

  /**
   * Minimum balance to sit in the top `pct`% of funded accounts.
   *
   * Walks buckets from the largest balance down, accumulating accounts until
   * the target share is covered. The returned value is the low edge of the
   * bucket that crossed it, so the tier is never overstated.
   */
  thresholdForTopPct(pct) {
    const target = (this.total * pct) / 100;
    let cum = 0;
    for (let i = NUM_BUCKETS - 1; i >= 0; i--) {
      cum += this.counts[i];
      if (cum >= target) return { xrp: bucketValue(i), accounts: cum };
    }
    return { xrp: 0, accounts: this.total };
  }

  /**
   * A monotone ladder of {xrp, atOrAbove} used by the client calculator and by
   * the chart. Sampled at a fixed number of buckets per decade rather than at
   * even percentile steps, because the distribution spans eleven orders of
   * magnitude and even steps would put almost every point in the dust.
   */
  ladder({ perDecade = 40 } = {}) {
    const step = Math.round(BUCKETS_PER_DECADE / perDecade);
    const out = [];
    // Suffix sums, walked once from the top so the ladder costs one pass.
    let cum = 0;
    const rows = [];
    for (let i = NUM_BUCKETS - 1; i >= 0; i--) {
      cum += this.counts[i];
      if (i % step === 0 && cum > 0) rows.push({ i, cum });
    }
    // Ascending balance. Rounded to six significant figures rather than to a
    // fixed number of decimals: the ladder's low end sits at a millionth of an
    // XRP, and rounding that to four decimal places produces a literal zero,
    // which the client's log interpolation turns into NaN.
    for (const { i, cum: n } of rows.reverse()) out.push({ xrp: sig(bucketValue(i), 6), atOrAbove: n });

    // Trim the head. Every point below the smallest balance in the population
    // reports the full count, so all but the highest of them are noise. Keep
    // the last such point so the curve still starts at 100%.
    let firstUseful = 0;
    while (firstUseful + 1 < out.length && out[firstUseful + 1].atOrAbove === this.total) firstUseful++;
    return out.slice(firstUseful);
  }

  /**
   * Balance bands for the chart and the data-table twin. Decade bands are what
   * readers actually reason about ("how many wallets hold 1k to 10k"), and they
   * survive being read out loud, which the log ladder does not.
   */
  bands() {
    // Finer than one band per decade through the range people actually ask
    // about. The screenshot-shaped tables that circulate on X split 1k-5k from
    // 5k-10k and 10k-25k from 25k-50k, because that is where the answer to
    // "where do I sit" changes, and a single 1k-10k bar hides it. The cost is
    // free: the histogram underneath is 2000 buckets per decade, so these are
    // sums over buckets we already hold.
    //
    // Unlike those tables, this keeps every band below 500 XRP. They omit the
    // long tail, which is where roughly eight in ten accounts sit, and a
    // distribution that starts at 500 XRP overstates the typical holder by
    // leaving most holders out.
    const edges = [
      0, 1, 10, 100, 500,
      1_000, 5_000, 10_000, 25_000, 50_000, 100_000,
      500_000, 1_000_000, 5_000_000, 10_000_000, 100_000_000, 1_000_000_000,
      Infinity,
    ];
    const out = [];
    for (let k = 0; k < edges.length - 1; k++) {
      const lo = edges[k];
      const hi = edges[k + 1];
      const n = this.atOrAbove(lo === 0 ? 1e-6 : lo) - (hi === Infinity ? 0 : this.atOrAbove(hi));
      let xrpHeld = 0;
      const loB = lo === 0 ? 0 : bucketOf(lo);
      const hiB = hi === Infinity ? NUM_BUCKETS : bucketOf(hi);
      for (let i = loB; i < hiB; i++) xrpHeld += this.counts[i] * bucketValue(i);
      out.push({
        min: lo,
        max: hi === Infinity ? null : hi,
        accounts: Math.round(n),
        pctOfAccounts: this.total ? round4((n / this.total) * 100) : 0,
        xrpHeld: Math.round(xrpHeld),
        pctOfXrp: this.sumXrp ? round4((xrpHeld / this.sumXrp) * 100) : 0,
      });
    }
    return out;
  }

  tiers() {
    return TIERS.map((pct) => {
      const t = this.thresholdForTopPct(pct);
      // Share of circulating XRP the tier holds, summed over its buckets.
      let held = 0;
      for (let i = bucketOf(t.xrp); i < NUM_BUCKETS; i++) held += this.counts[i] * bucketValue(i);
      return {
        pct,
        minXrp: roundSig(t.xrp),
        accounts: Math.round(t.accounts),
        xrpHeld: Math.round(held),
        pctOfXrp: this.sumXrp ? round4((held / this.sumXrp) * 100) : 0,
      };
    });
  }

  /**
   * The ranked accounts, deepest first.
   *
   * `rank` is written after the spread, not before it. A resumed run restores
   * `top` from a checkpoint whose entries were themselves produced by this
   * method, so they arrive carrying a rank from the partial walk. Spread last,
   * that stale number overwrote the positional one and the shipped snapshot
   * had two rank 1s and rank 8 above rank 7. Position in the sorted array is
   * the only thing that defines a rank, so it wins here unconditionally.
   */
  topAccounts() {
    this.#trimTop();
    return this.top.slice(0, this.topN).map((a, i) => ({ ...a, rank: i + 1, xrp: Math.round(a.xrp) }));
  }

  /**
   * The raw top buffer, for a checkpoint to persist. Derived fields do not go
   * into a checkpoint: a rank read off a partial walk is wrong by definition,
   * and rounding the balances on the way in loses precision the final sort
   * still needs.
   */
  topBuffer() {
    this.#trimTop();
    return this.top.map((a) => ({ ...a }));
  }

  exactCounts() {
    return Object.fromEntries([...this.exact].map(([k, v]) => [String(k), v]));
  }
}

const round4 = (v) => Math.round(v * 10_000) / 10_000;
// Significant figures, which is the right rounding for a quantity that spans
// eleven orders of magnitude. Fixed decimals round the dust end to zero.
// toPrecision rather than a scale-round-unscale, which reintroduces binary
// float error at the top of the range and writes 1778280000.0000002 into the
// artifact where 1778280000 was meant.
const sig = (v, digits) => (v > 0 ? Number(Number(v).toPrecision(digits)) : 0);
// Thresholds are read off a histogram whose resolution is 0.115%, so printing
// more than four significant figures would claim precision the method does not
// have. 2,151 XRP is honest; 2,151.3847 is not.
const roundSig = (v) => {
  if (!(v > 0)) return 0;
  const mag = Math.floor(Math.log10(v));
  const p = Math.max(0, 3 - mag);
  return Math.round(v * 10 ** p) / 10 ** p;
};

export { roundSig };
