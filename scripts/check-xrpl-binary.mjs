#!/usr/bin/env node
// Self-test for the binary ledger-entry decoder the rich list walk runs on.
//
// The walk reads ~20 million objects as raw binary and decodes balances itself,
// so a decoding slip would ship a wrong distribution with no error anywhere.
// The fixtures are real objects from ledger 107466454 with the values Clio's
// JSON gives for the same keys; the decoder matched that JSON on all 36,864
// objects of the sample they were drawn from. The synthetic cases cover the
// encodings the sample did not contain.
//
//   node scripts/check-xrpl-binary.mjs

import {
  entryKind,
  decodeAccountRoot,
  decodeEscrow,
  encodeAccountId,
  decodeAddress,
  accountRootKey,
  decodeDomain,
} from "./lib/xrpl.mjs";

let failed = 0;
const ok = (name, cond, detail = "") => {
  if (!cond) failed++;
  console.error(`  ${cond ? "ok  " : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
};

const ACCOUNTS = [
  {
    data: "1100612200000000240553FCA42505852AE52D0000000155EA8EE871830990D6A69A87C7D438078DE5FA7831D7D0F92C2102A1DA1EECF1AD62400000000106E89E8114544553E18902CFCD8880FC9F4103476104264168",
    account: "r3g2Fn1gfKsY9b1BeTHS49RX8XKhU2bvMM",
    balance: "17229982",
    domain: null,
  },
  {
    data: "1100612200000000240000000625059493992D0000000055A29B5CC89AB66995143E79E85D3B76820C23A01EB8A5726E1A60807AC3E38E1D6240000000000F42378114E376654FF7B1F656D56462FB43E77E9776EE7396",
    account: "rMj5DFATVxw91PDy3AM2wu7Uu1kgrhWypE",
    balance: "999991",
    domain: null,
  },
  {
    data: "11006122008800002405839697250591F0B62D0000000155731BBBCB9FEE61386FA7094247FC31E6D0343F8B1F6DC3B9528A3CD146AAB814624000000000124A0977297938646E70373476316539707430396C757277362E746F6D6C2E66697273746C65646765722E6E657481144512681DABB2299DF13990EE10BEA5A5813583CD",
    account: "rfJDgwnDd6poCekcAssDPRkomnJybrXWMc",
    balance: "1198601",
    domain: "y8dnp74v1e9pt09lurw6.toml.firstledger.net",
  },
  {
    // Carries a second AccountID field (8:8) after Account; the parser must
    // read Account and not be thrown by what follows.
    data: "11006122009900002405DD22A9250630172F2D00000000551E6012784D0FBEDBB38ABE418FE20C8C2AB46F5385B3386853941C4D346F880C6240000000000F45A6772978713970777072346F61676F75676477373271672E746F6D6C2E66697273746C65646765722E6E65748114159BC5E916D3598C3D1560DA5F66CB5E0EFE5DAC88140000000000000000000000000000000000000001",
    account: "rpyEoLGxxweVVn7uBJPMmdRLqQxjvPdqEA",
    balance: "1000870",
    domain: "xq9pwpr4oagougdw72qg.toml.firstledger.net",
  },
];

const ESCROWS = [
  {
    data: "11007522000000002505BE605A20255D437D0034000000000000000755793201C20AE8A2CEE2E531FD53CF7C35D345E313D5F745F4D0319433DB890C3561400000000007A1208114F6CF494392CC746C293A7D15D26A6AE6A73929ED8314F6CF494392CC746C293A7D15D26A6AE6A73929ED",
    account: "rPWrYgiKsSWUAbeV2enBoPZSYaH3Tr7Yg6",
    amount: "500000",
  },
  {
    data: "1100752200000000240516EA332506522C45202535FFE080340000000000000002556F410A61BC2682AE1705B9A7936309AC0D427D7809AD8131A2EF22BCDB919BAA614000000001F78A408114AB908942BE09849AAF93FD9C329E5AED5EC3093A8314AB908942BE09849AAF93FD9C329E5AED5EC3093A",
    account: "rGe96MSjss5vvkzG5iMb1XGzZ9SXdj1Jom",
    amount: "33000000",
  },
];

console.error("[xrpl binary self-test]");

for (const f of ACCOUNTS) {
  ok(`kind of ${f.account}`, entryKind(f.data) === "account");
  const a = decodeAccountRoot(f.data);
  ok(`AccountRoot ${f.account}`, encodeAccountId(a.accountHex) === f.account, encodeAccountId(a.accountHex));
  ok(`  balance`, String(a.drops) === f.balance, `${a.drops} vs ${f.balance}`);
  ok(`  domain`, decodeDomain(a.domainHex) === f.domain, `${decodeDomain(a.domainHex)}`);
}

for (const f of ESCROWS) {
  ok(`kind of escrow ${f.account}`, entryKind(f.data) === "escrow");
  const e = decodeEscrow(f.data);
  ok(`Escrow ${f.account}`, e && encodeAccountId(e.accountHex) === f.account, e ? encodeAccountId(e.accountHex) : "null");
  ok(`  amount`, e && String(e.drops) === f.amount, `${e?.drops} vs ${f.amount}`);
}

// Synthetic objects for the encodings the sample did not contain.
const ACCT_HEX = "544553E18902CFCD8880FC9F4103476104264168";
const ACCT = encodeAccountId(ACCT_HEX);
const xrp = (drops) => (BigInt(drops) | 0x4000000000000000n).toString(16).toUpperCase().padStart(16, "0");

{
  // A field code above 15 takes a second header byte (0x20 0x1A: UInt32 #26),
  // and a 200-byte Domain takes a two-byte length prefix (193 + 7).
  const domain = "61".repeat(200);
  const hex = `110061201A00000001${"62" + xrp(1_000_000)}77C107${domain}8114${ACCT_HEX}`;
  const a = decodeAccountRoot(hex);
  ok("extended field code and two-byte length", a.accountHex === ACCT_HEX && a.drops === 1_000_000n && a.domainHex === domain.toLowerCase());
}
{
  // An escrow of an issued currency (48-byte amount) or an MPT (33 bytes) is
  // not XRP and must come back null, without misreading the owner either.
  const iou = `110075${"61" + "D4838D7EA4C68000" + "0".repeat(80)}8114${ACCT_HEX}`;
  const mpt = `110075${"61" + "60" + "00000000000F4240" + "0".repeat(48)}8114${ACCT_HEX}`;
  ok("issued-currency escrow skipped", decodeEscrow(iou) === null);
  ok("MPT escrow skipped", decodeEscrow(mpt) === null);
}
{
  ok("other object types ignored", entryKind("1100720000") === null && entryKind("110064") === null);
  let threw = false;
  try {
    decodeAccountRoot("1100618114" + ACCT_HEX);
  } catch {
    threw = true;
  }
  ok("AccountRoot without a Balance refused", threw);
}

// Addresses and keys: the round trip, a checksum that must be rejected, and
// the AccountRoot key that resolved to this exact account on the live ledger.
ok("address round trip", encodeAccountId(decodeAddress(ACCT)) === ACCT);
let bad = false;
try {
  decodeAddress(ACCT.slice(0, -1) + (ACCT.endsWith("a") ? "b" : "a"));
} catch {
  bad = true;
}
ok("bad checksum rejected", bad);
ok(
  "AccountRoot key",
  accountRootKey("rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh") ===
    "2B6AC232AA4C4BE41BF49D2459FA4A0347E1B543A4C92FCEE0821C0201E2E9A8",
);

if (failed) {
  console.error(`[FAIL] xrpl binary self-test: ${failed} failure(s)`);
  process.exit(1);
}
console.error("[OK] xrpl binary self-test passed");
