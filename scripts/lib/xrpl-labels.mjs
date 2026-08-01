// Account labels for the /xrp-rich-list top-100 table.
//
// Showing "Binance cold wallet" instead of a base58 string is the only way
// this table beats an explorer, so the labels stay. The risk they carry is
// specific and worth naming: the XRP community checks these, a wrong
// attribution is found within the hour, and the cost lands on a page whose
// entire pitch is that its numbers are verifiable. So a label is not a string
// in a map. It is a claim with a stated evidence tier, and the build refuses to
// ship one that cannot say where it came from.
//
// Four tiers, strongest first:
//
//   account-domain   The account sets a Domain onchain and it matches the
//                    operator. Self-declared by the account itself, and
//                    re-verified against the ledger on every run.
//   xrpl-toml        The operator's domain publishes /.well-known/
//                    xrp-ledger.toml listing this address. The XRPL standard
//                    for exactly this claim, made by the operator.
//   published        The operator published the address somewhere official.
//                    Needs a URL and a human verification date.
//   third-party      An explorer or data provider attributes it. Weakest, and
//                    the page discloses the provider by name rather than
//                    passing the attribution off as its own.
//
// Explicitly NOT a tier: inference from transaction behaviour. Clustering
// heuristics are how wrong labels get made, the build spec forbids them, and
// the validator rejects the tier name outright so nobody can add one quietly.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export const EVIDENCE_TIERS = ["account-domain", "xrpl-toml", "published", "third-party"];

// What kind of holder the named entity is. This is a statement about the
// entity, not about who controls the address, so it carries none of the risk
// the name itself does. The page needs it for two things a plain name cannot
// answer: filtering exchange wallets out of the ranking, and reporting the
// largest holding attributed to a person rather than to a venue holding
// customer balances.
export const HOLDER_TYPES = ["exchange", "company", "protocol", "individual", "unknown"];

// Who the holder is connected to, kept separate from what kind of holder it
// is. The distinction the top 100 needs is that "Ripple" and "a person who
// co-founded Ripple" are not the same claim: the first is XRP the company
// controls, the second is a personal balance the company does not. Collapsing
// them into one "Ripple" bucket would overstate company control by a third of
// the top 100, so the two are separate values and the page filters them
// separately.
export const AFFILIATIONS = ["ripple", "ripple-founder"];

// A tier that needs a human to have looked at something, and therefore a date
// on which they did. The two machine-checkable tiers re-verify themselves.
const NEEDS_URL = new Set(["published", "third-party"]);

const B58 =
  "rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz";

/**
 * Full base58check validation of an XRP Ledger classic address.
 *
 * A length-and-prefix regex accepts a typo that changes one character, and a
 * typo in this file puts a real exchange's name on somebody else's wallet.
 * The checksum makes that impossible: it is the difference between validating
 * the shape of a claim and validating the claim.
 */
export function isValidXrplAddress(addr) {
  if (typeof addr !== "string" || addr.length < 25 || addr.length > 35) return false;
  if (!addr.startsWith("r")) return false;

  let num = 0n;
  for (const ch of addr) {
    const v = B58.indexOf(ch);
    if (v < 0) return false;
    num = num * 58n + BigInt(v);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  let bytes = Buffer.from(hex, "hex");
  // Leading 'r' characters are leading zero bytes that base58 drops.
  let leading = 0;
  for (const ch of addr) {
    if (ch === "r") leading++;
    else break;
  }
  bytes = Buffer.concat([Buffer.alloc(leading, 0), bytes]);
  if (bytes.length !== 25) return false;
  if (bytes[0] !== 0x00) return false; // classic address type prefix

  const payload = bytes.subarray(0, 21);
  const checksum = bytes.subarray(21);
  const h1 = createHash("sha256").update(payload).digest();
  const h2 = createHash("sha256").update(h1).digest();
  return h2.subarray(0, 4).equals(checksum);
}

/** Normalise a domain for comparison: no scheme, no www, no trailing slash. */
export const normDomain = (d) =>
  String(d ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

export function loadLabels(root = process.cwd()) {
  const p = join(root, "data", "xrpl-account-labels.json");
  if (!existsSync(p)) return { labels: [], byAddress: new Map() };
  const doc = JSON.parse(readFileSync(p, "utf-8"));
  const labels = Array.isArray(doc.labels) ? doc.labels : [];
  return { ...doc, labels, byAddress: new Map(labels.map((l) => [l.address, l])) };
}

/**
 * Validate the registry. Returns findings rather than throwing so the gate can
 * print all of them at once instead of one per run.
 */
export function validateLabels(doc) {
  const findings = [];
  const seen = new Set();

  for (const l of doc.labels ?? []) {
    const where = l.address ?? "(no address)";

    if (!isValidXrplAddress(l.address)) {
      findings.push({ address: where, problem: "address fails base58check validation" });
      continue;
    }
    if (seen.has(l.address)) {
      findings.push({ address: where, problem: "duplicate entry" });
    }
    seen.add(l.address);

    if (!l.name || typeof l.name !== "string" || l.name.length > 60) {
      findings.push({ address: where, problem: "missing or over-long name" });
    }
    if (!EVIDENCE_TIERS.includes(l.evidence)) {
      findings.push({
        address: where,
        problem: `evidence "${l.evidence}" is not one of ${EVIDENCE_TIERS.join(", ")}. Inference from transaction behaviour is not an accepted tier.`,
      });
      continue;
    }
    if (NEEDS_URL.has(l.evidence)) {
      if (!/^https:\/\/\S+$/.test(l.evidenceUrl ?? "")) {
        findings.push({
          address: where,
          problem: `evidence "${l.evidence}" requires an https evidenceUrl`,
        });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(l.verifiedOn ?? "")) {
        findings.push({
          address: where,
          problem: `evidence "${l.evidence}" requires a verifiedOn date (YYYY-MM-DD)`,
        });
      }
    }
    if (l.type != null && !HOLDER_TYPES.includes(l.type)) {
      findings.push({
        address: where,
        problem: `type "${l.type}" is not one of ${HOLDER_TYPES.join(", ")}`,
      });
    }
    if (l.affiliation != null && !AFFILIATIONS.includes(l.affiliation)) {
      findings.push({
        address: where,
        problem: `affiliation "${l.affiliation}" is not one of ${AFFILIATIONS.join(", ")}`,
      });
    }
    if (l.evidence === "third-party" && !l.attribution) {
      findings.push({
        address: where,
        problem: "third-party evidence must name the provider in `attribution`, so the page can disclose it",
      });
    }
    if ((l.evidence === "account-domain" || l.evidence === "xrpl-toml") && !l.domain) {
      findings.push({
        address: where,
        problem: `evidence "${l.evidence}" requires the operator \`domain\` so it can be re-verified against the ledger`,
      });
    }
  }
  return findings;
}

/**
 * Re-verify a label against what the ledger currently says.
 *
 * Only `account-domain` is machine-checkable from an AccountRoot alone, and it
 * is checked on every run rather than trusted from the file. An account that
 * changes or drops its Domain silently invalidates the label, and the point of
 * checking is to catch that before a reader does.
 */
export function verifyAgainstAccount(label, accountDomain) {
  if (!label) return { ok: true, note: null };
  if (label.evidence !== "account-domain") return { ok: true, note: null };
  if (!accountDomain) {
    return { ok: false, note: "account no longer publishes a Domain onchain" };
  }
  if (normDomain(accountDomain) !== normDomain(label.domain)) {
    return {
      ok: false,
      note: `account Domain is ${normDomain(accountDomain)}, label claims ${normDomain(label.domain)}`,
    };
  }
  return { ok: true, note: null };
}
