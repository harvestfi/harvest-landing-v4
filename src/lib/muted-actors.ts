// Addresses whose on-chain deposits/withdrawals are protocol-internal
// liquidity moves, not real users or net inflows into Harvest, and so must
// be excluded from every activity view (Live Feed stream + journeys, the
// acquisition Deposits page, and any future activity ranking).
//
// An Autopilot sits on top of standalone autocompounders and shifts
// liquidity between them; when it rebalances it appears as the
// depositor/withdrawer wallet on the underlying vault. Two kinds of address
// drive that and must be muted:
//
//  1. AUTOPILOT_VAULTS - the user-facing autopilot vault token contracts.
//     Keep in sync with data/vaults.json (vaultType === "Autopilot"). A real
//     user depositing *into* an autopilot is unaffected: there the user is
//     the wallet and the autopilot is the vault, not the actor.
//
//  2. AUTOPILOT_ALLOCATORS - the allocator / rebalancer / keeper contracts
//     that actually move funds for an autopilot. These are NOT vault tokens,
//     so they never appear in vaults.json and must be listed here by hand.
//     Add the full, lowercased address of any rebalancer you spot reading
//     "External" while cycling deposits/withdrawals across several vaults
//     (grab it from the Live Feed row's "view" tx link, the From/actor).

export const AUTOPILOT_VAULTS: readonly string[] = [
  "0x3151cee0cdb517c0e7db2b55ff5085e7d1809d90", // USDC Autopilot - Ethereum
  "0x7872893e528fe2c0829e405960db5b742112aa97", // WETH Autopilot - Base
  "0x0d877dc7c8fa3ad980dfdb18b48ec9f8768359c4", // USDC Autopilot - Base
  "0x407d3d942d0911a2fea7e22417f81e27c02d6c6f", // USDC Autopilot - Arbitrum
  "0xd6701905c59ee618dc36dc747506bce0a4ac760a", // USDC Autopilot (Morpho) - Base
  "0xce4d997a3b404f9eaa796f89deae40747d3647b7", // WETH Autopilot - Arbitrum
  "0x49b2248f7a7a703731852db0b2217f40da75b8ab", // WBTC Autopilot - Arbitrum
  "0x31a421271414641cb5063b71594b642d2666db6b", // cbBTC Autopilot - Base
];

export const AUTOPILOT_ALLOCATORS: readonly string[] = [
  // Full, lowercased allocator / rebalancer addresses go here, e.g.:
  // "0x13b3............................................ef5b", // USDC autopilot rebalancer
];

const MUTED = new Set<string>(
  [...AUTOPILOT_VAULTS, ...AUTOPILOT_ALLOCATORS].map((a) => a.toLowerCase()),
);

// True when an on-chain actor (the depositor/withdrawer wallet on an event)
// is a known protocol-internal autopilot or allocator and should be hidden
// from every activity feed and ranking.
export function isMutedActor(address: string | null | undefined): boolean {
  if (!address) return false;
  return MUTED.has(address.toLowerCase());
}

// Behavioural detection of allocator / rebalancer contracts that are not in
// the static denylist (they are not vault tokens, so they never appear in
// vaults.json). An autopilot rebalancer cycles liquidity *out of* some
// underlying vaults and *into* others, so within any window it shows both
// deposits and withdrawals spread across several distinct vaults. A real
// user deposits into one or a few vaults and rarely both deposits and
// withdraws across many in the same window, so this signature separates the
// two without needing the address. Tunable via REBALANCER_MIN_VAULTS.
const REBALANCER_MIN_VAULTS = 3;

export interface ActorEvent {
  wallet_address: string | null;
  vault_address: string | null;
  event_type: string;
}

export function detectRebalancerActors(
  events: ReadonlyArray<ActorEvent>,
): Set<string> {
  const agg = new Map<
    string,
    { vaults: Set<string>; deposited: boolean; withdrew: boolean }
  >();
  for (const e of events) {
    const w = (e.wallet_address || "").toLowerCase();
    if (!w) continue;
    let a = agg.get(w);
    if (!a) {
      a = { vaults: new Set<string>(), deposited: false, withdrew: false };
      agg.set(w, a);
    }
    a.vaults.add((e.vault_address || "").toLowerCase());
    if (e.event_type === "deposit") a.deposited = true;
    else if (e.event_type === "withdraw") a.withdrew = true;
  }
  const rebalancers = new Set<string>();
  for (const [w, a] of agg) {
    if (a.deposited && a.withdrew && a.vaults.size >= REBALANCER_MIN_VAULTS) {
      rebalancers.add(w);
    }
  }
  return rebalancers;
}
