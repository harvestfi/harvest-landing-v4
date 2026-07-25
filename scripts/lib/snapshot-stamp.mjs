// Shared helper for the XRP report pipeline: keep a section's run stamp frozen
// when the section's content did not change.
//
// WHY THIS EXISTS
// Every script that writes data/xrp-yield.json used to set its own timestamp to
// now() on every run. Because those timestamps live inside the file the
// workflows diff, the "commit only if changed" guard in update-data.yml and
// update-xrp-data.yml could never fire: the file was always byte-different, so
// every run committed, every commit triggered a rebuild, and the report's
// visible "Last updated" date plus its three schema `dateModified` fields
// advanced whether or not a single figure had moved.
//
// That is expensive for this site specifically. The whole machine-readable
// layer (llms.txt, Dataset schema, per-page citation strings) trains answer
// engines to trust our dates. An engine that learns those dates advance
// unconditionally has learned the freshness signal carries no information.
//
// With these helpers each script compares its own section against what is
// already on disk, ignoring only its own stamp, and reuses the previous stamp
// when nothing else changed. The stamps then mean "when this data last
// changed", the guard fires on genuinely idle runs, and each pass advances
// independently of the others.

// Key-order-independent serialization. The pipeline scripts rewrite the whole
// file in sequence and do not all preserve key order, so a plain
// JSON.stringify comparison would report a false difference.
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

// True when `prev` and `next` are identical once the named stamp keys are
// ignored on both sides.
export function sameIgnoringStamps(prev, next, stampKeys) {
  if (!prev || !next) return false;
  const strip = (o) => {
    const copy = { ...o };
    for (const k of stampKeys) delete copy[k];
    return copy;
  };
  return canonicalJson(strip(prev)) === canonicalJson(strip(next));
}

// Returns `next`, but with its stamp carried over from `prev` when the rest of
// the object is unchanged, so the serialized file stays byte-identical.
// Pass the stamp key this script owns (e.g. "generatedAt" or "asOf").
export function freezeStampIfUnchanged(prev, next, stampKey = "generatedAt") {
  if (sameIgnoringStamps(prev, next, [stampKey]) && prev[stampKey] != null) {
    return { ...next, [stampKey]: prev[stampKey] };
  }
  return next;
}
