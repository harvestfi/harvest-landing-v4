#!/usr/bin/env node
// Build gate for the XRP Ledger account label registry.
//
// The top-100 table on /xrp-rich-list names accounts. Every name is a public
// claim about who controls somebody's money, made on a page whose whole
// argument is that its figures can be checked. This gate is the thing standing
// between a typo and that claim landing on the wrong wallet.
//
// What it enforces:
//   - every address passes full base58check, not a shape regex
//   - every label declares an evidence tier from the accepted list
//   - inference from transaction behaviour is rejected by name
//   - tiers that need a human to have looked at something carry a URL and the
//     date they looked
//   - third-party attributions name the provider, so the page can disclose it
//   - a label claiming an onchain Domain still matches the live ledger
//   - labels point at addresses that are actually in the current snapshot
//
//   node scripts/check-xrpl-labels.mjs             lint the registry
//   node scripts/check-xrpl-labels.mjs --self-test verify the rules still bite

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  loadLabels,
  validateLabels,
  verifyAgainstAccount,
  isValidXrplAddress,
  EVIDENCE_TIERS,
} from "./lib/xrpl-labels.mjs";

const ROOT = process.cwd();
const SNAPSHOT = join(ROOT, "data", "xrp-richlist.json");

// Ages out a human verification. An exchange rotates wallets, and a label
// checked two years ago is an assertion rather than a verification.
const STALE_DAYS = 365;

function selfTest() {
  const cases = [
    [
      "valid published entry",
      {
        labels: [
          {
            address: "rPyCQm8E5j78PDbrfKF24fRC7qUAk1kDMZ",
            name: "Example Exchange",
            evidence: "published",
            evidenceUrl: "https://example.com/proof",
            verifiedOn: "2026-07-31",
          },
        ],
      },
      0,
    ],
    [
      "behaviour inference rejected",
      {
        labels: [
          {
            address: "rPyCQm8E5j78PDbrfKF24fRC7qUAk1kDMZ",
            name: "Example Exchange",
            evidence: "onchain-behaviour",
          },
        ],
      },
      1,
    ],
    [
      "one-character typo in the address is caught",
      {
        labels: [
          {
            address: "rPyCQm8E5j78PDbrfKF24fRC7qUAk1kDMY",
            name: "Example Exchange",
            evidence: "published",
            evidenceUrl: "https://example.com/proof",
            verifiedOn: "2026-07-31",
          },
        ],
      },
      1,
    ],
    [
      "published without a URL",
      {
        labels: [
          {
            address: "rPyCQm8E5j78PDbrfKF24fRC7qUAk1kDMZ",
            name: "Example Exchange",
            evidence: "published",
            verifiedOn: "2026-07-31",
          },
        ],
      },
      1,
    ],
    [
      "third-party without attribution",
      {
        labels: [
          {
            address: "rPyCQm8E5j78PDbrfKF24fRC7qUAk1kDMZ",
            name: "Example Exchange",
            evidence: "third-party",
            evidenceUrl: "https://example.com/names",
            verifiedOn: "2026-07-31",
          },
        ],
      },
      1,
    ],
    [
      "account-domain without a domain to check against",
      {
        labels: [
          {
            address: "rPyCQm8E5j78PDbrfKF24fRC7qUAk1kDMZ",
            name: "Example Exchange",
            evidence: "account-domain",
          },
        ],
      },
      1,
    ],
    [
      "unknown holder type",
      {
        labels: [
          {
            address: "rPyCQm8E5j78PDbrfKF24fRC7qUAk1kDMZ",
            name: "Example Exchange",
            type: "definitely-a-whale",
            evidence: "published",
            evidenceUrl: "https://example.com/proof",
            verifiedOn: "2026-07-31",
          },
        ],
      },
      1,
    ],
    [
      "duplicate addresses",
      {
        labels: [
          {
            address: "rPyCQm8E5j78PDbrfKF24fRC7qUAk1kDMZ",
            name: "A",
            evidence: "published",
            evidenceUrl: "https://a.example/x",
            verifiedOn: "2026-07-31",
          },
          {
            address: "rPyCQm8E5j78PDbrfKF24fRC7qUAk1kDMZ",
            name: "B",
            evidence: "published",
            evidenceUrl: "https://b.example/x",
            verifiedOn: "2026-07-31",
          },
        ],
      },
      1,
    ],
  ];

  let failed = 0;
  for (const [name, doc, expected] of cases) {
    const got = validateLabels(doc).length;
    const ok = got === expected;
    if (!ok) failed++;
    console.error(`  ${ok ? "ok   " : "FAIL "} ${name} (${got} finding(s), expected ${expected})`);
  }

  // Domain re-verification against the live ledger value.
  const dv = [
    ["domain matches", { evidence: "account-domain", domain: "bitstamp.net" }, "bitstamp.net", true],
    ["www is normalised", { evidence: "account-domain", domain: "bitstamp.net" }, "www.bitstamp.net", true],
    ["domain changed", { evidence: "account-domain", domain: "bitstamp.net" }, "elsewhere.com", false],
    ["domain dropped", { evidence: "account-domain", domain: "bitstamp.net" }, null, false],
    ["other tiers are not domain-checked", { evidence: "published" }, null, true],
  ];
  for (const [name, label, live, expected] of dv) {
    const got = verifyAgainstAccount(label, live).ok;
    const ok = got === expected;
    if (!ok) failed++;
    console.error(`  ${ok ? "ok   " : "FAIL "} ${name}`);
  }

  // The checksum is the guard that matters most, so it is tested directly.
  const addrCases = [
    ["real address", "rPyCQm8E5j78PDbrfKF24fRC7qUAk1kDMZ", true],
    ["last char changed", "rPyCQm8E5j78PDbrfKF24fRC7qUAk1kDMY", false],
    ["middle char changed", "rPyCQm8E5j78PDbrfKF24fRC7qUAk1kDXZ", false],
    ["not base58", "r0OIl1234567890123456789012345", false],
    ["empty", "", false],
  ];
  for (const [name, addr, expected] of addrCases) {
    const got = isValidXrplAddress(addr);
    const ok = got === expected;
    if (!ok) failed++;
    console.error(`  ${ok ? "ok   " : "FAIL "} address: ${name}`);
  }

  if (failed) {
    console.error(`[FAIL] xrpl-labels self-test: ${failed} failure(s)`);
    process.exit(1);
  }
  console.error(
    `[OK] xrpl-labels self-test passed (${cases.length + dv.length + addrCases.length} cases, tiers: ${EVIDENCE_TIERS.join(", ")})`,
  );
  process.exit(0);
}

if (process.argv.includes("--self-test")) selfTest();

// ------------------------------------------------------------------- lint

const doc = loadLabels(ROOT);
const findings = validateLabels(doc);

// Cross-check against the snapshot: a label on an address that is not in the
// ranked snapshot renders nowhere, and is usually a sign the address is wrong.
if (existsSync(SNAPSHOT) && doc.labels.length) {
  const snap = JSON.parse(readFileSync(SNAPSHOT, "utf-8"));
  const top = new Map((snap.top ?? []).map((t) => [t.address, t]));
  for (const l of doc.labels) {
    const acct = top.get(l.address);
    if (!acct) {
      console.error(
        `[xrpl-labels] note: ${l.address} (${l.name}) is not in the current top ${top.size}, so its label renders nowhere.`,
      );
      continue;
    }
    const v = verifyAgainstAccount(l, acct.domain);
    if (!v.ok) findings.push({ address: l.address, problem: `live check failed: ${v.note}` });
  }
}

// Staleness is a warning, not a failure: an old verification is weaker than a
// fresh one but it is not wrong, and failing the build on the passage of time
// would break a deploy nobody touched.
const today = new Date().toISOString().slice(0, 10);
for (const l of doc.labels) {
  if (!l.verifiedOn) continue;
  const age = (Date.parse(today) - Date.parse(l.verifiedOn)) / 86_400_000;
  if (age > STALE_DAYS) {
    console.error(
      `[xrpl-labels] warning: ${l.address} (${l.name}) was last verified ${Math.round(age)} days ago; re-check the evidence.`,
    );
  }
}

if (findings.length) {
  console.error(`[FAIL] xrpl-labels: ${findings.length} problem(s)`);
  for (const f of findings) console.error(`  ${f.address}: ${f.problem}`);
  process.exit(1);
}

console.error(
  `[OK] xrpl-labels passed (${doc.labels.length} label(s) validated)` +
    (doc.labels.length === 0
      ? ". Registry is empty: the top-100 table shows onchain facts only until entries are added."
      : ""),
);
