// Editorial reference for the /report/xrp-yield-ranking "in depth" section.
//
// Hand-authored from sourced research (see the venue registry in
// data/xrp-venues.json for the live-ranking deep-links). Every venue here is an
// external protocol Harvest tracks for research, not a Harvest product. Facts
// are qualitative on purpose: live APY / TVL come from the DeFiLlama snapshot,
// not from this file, so nothing here goes stale. No em dashes anywhere.

export interface WrappedToken {
  token: string; // display + icon key
  icon: string; // token-icons key (falls back to a monogram if unknown)
  chain: string;
  desc: string;
  // Deployment: contract address + block-explorer link (EVM tokens only).
  address?: string;
  explorer?: string; // full URL to the token on its explorer
  explorerName?: string;
}

export interface VenueFact {
  label: string;
  value: string;
}

export interface VenueNote {
  slug: string;
  platform: string;
  product: string;
  type: string;
  chain: string;
  assets: string[]; // token symbols for the row icons
  url: string;
  blurb: string[];
  facts: VenueFact[];
}

export interface VenueGroup {
  chain: string;
  tag?: string;
  intro?: string;
  venues: VenueNote[];
}

// The token forms that sit under almost every row in the ranking.
export const WRAPPED_TOKENS: WrappedToken[] = [
  {
    token: "FXRP",
    icon: "FXRP",
    chain: "Flare",
    desc: "XRP bridged onto Flare through the FAssets system. It is a 1:1, over-collateralized ERC-20 minted by independent agents who post collateral (roughly 1.3x) while the real XRP stays on the XRP Ledger, verified on-chain rather than held by one custodian. FXRP went live on Flare mainnet on 24 September 2025 and is the base asset behind nearly all Flare XRP yield.",
    address: "0xad552a648c74d49e10027ab8a618a3ad4901c5be",
    explorer: "https://flarescan.com/token/0xad552a648c74d49e10027ab8a618a3ad4901c5be",
    explorerName: "Flarescan",
  },
  {
    token: "stXRP",
    icon: "stXRP",
    chain: "Flare",
    desc: "Firelight's liquid staking token, minted 1:1 from FXRP. Its yield is designed to come from DeFi insurance, where other protocols pay cover fees that flow back to stXRP holders, rather than from token inflation. Firelight was incubated by Sentora, and stXRP is used across SparkDEX and Spectra.",
    address: "0x4c18ff3c89632c3dd62e796c0afa5c07c4c1b2b3",
    explorer: "https://flarescan.com/token/0x4c18ff3c89632c3dd62e796c0afa5c07c4c1b2b3",
    explorerName: "Flarescan",
  },
  {
    token: "cbXRP",
    icon: "cbXRP",
    chain: "Base",
    desc: "Coinbase Wrapped XRP, an ERC-20 on Base backed 1:1 by XRP held in Coinbase custody, with published proof of reserves. It launched in June 2025 and is the XRP form used across Base venues like Aerodrome and Moonwell. Backing is custodial, so it rests on Coinbase rather than an on-chain collateral system.",
    address: "0xcb585250f852c6c6bf90434ab21a00f02833a4af",
    explorer: "https://basescan.org/token/0xcb585250f852c6c6bf90434ab21a00f02833a4af",
    explorerName: "Basescan",
  },
  {
    token: "wXRP",
    icon: "wXRP",
    chain: "Solana",
    desc: "Wrapped XRP on Solana, issued and custodied by Hex Trust and bridged through LayerZero, backed 1:1 by native XRP in segregated custody. It is the XRP form behind Solana pools on Raydium, Jupiter and elsewhere.",
    address: "6UpQcMAb5xMzxc7ZfPaVMgx3KqsvKZdT5U718BzD5We2",
    explorer: "https://solscan.io/token/6UpQcMAb5xMzxc7ZfPaVMgx3KqsvKZdT5U718BzD5We2",
    explorerName: "Solscan",
  },
];

export const VENUE_GROUPS: VenueGroup[] = [
  {
    chain: "Flare",
    tag: "the XRPFi hub",
    intro:
      "Flare is where most XRP yield now lives. Its FAssets system turns XRP into FXRP without a single custodian, and a full DeFi stack has grown on top: lending markets, DEXes, liquid staking, and curated vaults. Almost everything here also stacks rFLR, Flare's reward token, on top of its base rate, so read the headline number as base yield plus time-limited emissions.",
    venues: [
      {
        slug: "kinetic",
        platform: "Kinetic",
        product: "FXRP Lending Market",
        type: "Lending Market",
        chain: "Flare",
        assets: ["FXRP"],
        url: "https://app.kinetic.market/market",
        blurb: [
          "Kinetic is a Compound and Aave style money market on Flare, built by Rome Blockchain Labs, the team behind BENQI and Moonwell. XRP holders supply FXRP to earn interest or borrow stablecoins against it without selling, and it is one of the largest single homes for FXRP in Flare DeFi.",
          "The base rate is what borrowers pay. On top of it, suppliers collect rFLR from Flare's FAssets Incentive Program plus FXRP supply incentives, so the headline blends real borrow demand with emissions that taper over time.",
        ],
        facts: [
          { label: "Yield source", value: "Borrow interest, plus rFLR and FXRP supply incentives" },
          { label: "Wrapped asset", value: "FXRP (Flare FAssets)" },
          { label: "Team", value: "Rome Blockchain Labs (BENQI, Moonwell)" },
          { label: "Token", value: "JOULE, stakes to Kii for interest rebates and governance" },
          { label: "Audits", value: "Coinspect, Zellic and Watchpug, plus a Code4rena contest and Immunefi bounty" },
        ],
      },
      {
        slug: "spectra-metavault-fxrp",
        platform: "Spectra",
        product: "Flare XRP Yield Prime",
        type: "MetaVault",
        chain: "Flare",
        assets: ["FXRP"],
        url: "https://app.spectra.finance/metavaults/flare:0x0c4f32c53d4b91a019c7c9d8da14af140295eef6",
        blurb: [
          "Spectra, formerly APWine, is a fixed-rate and yield-tokenization protocol. It splits a yield-bearing token into a Principal Token and a Yield Token with a set maturity, so one side can lock a fixed rate to expiry while the other takes leveraged, variable exposure to the floating yield.",
          "Flare XRP Yield Prime is a MetaVault on Spectra curated by Gami Labs. It takes FXRP or stXRP and keeps the liquidity positioned across Spectra's staked-XRP fixed-term pools, auto-rolling into the next pool at maturity and compounding as it goes. The underlying yield is Firelight staking rewards on stXRP plus swap fees and rFLR.",
        ],
        facts: [
          { label: "Yield source", value: "stXRP staking rewards, PT/YT swap fees and rFLR" },
          { label: "Curator", value: "Gami Labs" },
          { label: "Wrapped asset", value: "FXRP, staked to stXRP via Firelight" },
          { label: "Incentives", value: "rFLR and SPECTRA emissions" },
          { label: "Audits", value: "Pashov Audit Group and Code4rena" },
        ],
      },
      {
        slug: "sparkdex-stxrp-fxrp",
        platform: "SparkDEX",
        product: "stXRP / FXRP",
        type: "Pool",
        chain: "Flare",
        assets: ["stXRP", "FXRP"],
        url: "https://sparkdex.ai/pool/v4/add",
        blurb: [
          "SparkDEX is the leading DEX on Flare, spanning concentrated-liquidity pools (v3.1 and a v4 built on Algebra) and a perps venue. The stXRP / FXRP pool pairs Firelight's staked XRP with wrapped XRP, so both legs track XRP and the pair stays tight.",
          "LPs earn swap fees plus rFLR from Flare's emissions program, which vests over roughly 12 months. Because both sides are XRP-denominated, impermanent loss is limited compared with a pool against an unrelated asset. On the v4 app the two tokens are entered by hand into the add-liquidity form.",
        ],
        facts: [
          { label: "Yield source", value: "Swap fees plus rFLR emissions" },
          { label: "Wrapped assets", value: "stXRP (Firelight) and FXRP (Flare FAssets)" },
          { label: "Token", value: "SPRK, stakes to xSPRK for fee sharing" },
          { label: "Audits", value: "Protofire (v3, perps, token)" },
          { label: "Backing", value: "Independent, IDO launch via TrustSwap, no VC round" },
        ],
      },
      {
        slug: "mystic-vault",
        platform: "Mystic Finance",
        product: "XRP Vault (csXRP)",
        type: "Vault",
        chain: "Flare",
        assets: ["csXRP"],
        url: "https://app.mysticfinance.xyz/vault?vaultAddress=0x53184adabf312b490bf1ebcfdc896feff6019a14&chainId=14",
        blurb: [
          "Mystic Finance is the front end for Morpho-powered lending on Flare. Supplying FXRP into its Clearstar-curated vault mints csXRP, a share token that represents the deposited FXRP plus the interest it earns as the curator allocates it across Morpho markets.",
          "The yield is borrow interest from those markets, net of a fee (documented at 5 to 20 percent of interest) split between Mystic and the curator. Because a curator actively moves the money, depositors rely on that allocation as well as the underlying contracts.",
        ],
        facts: [
          { label: "Yield source", value: "Borrow interest from Morpho lending markets" },
          { label: "Curator", value: "Clearstar, backed by Clearsight Investments AG, a Swiss manager near $1B AUM" },
          { label: "Wrapped asset", value: "FXRP, wrapped again as the csXRP vault share" },
          { label: "Built on", value: "Morpho" },
          { label: "Audits", value: "Mystic's own vault contracts audited by Hacken (Dec 2024)" },
        ],
      },
      {
        slug: "upshift",
        platform: "Upshift",
        product: "earnXRP and MXRPY vaults",
        type: "Vault",
        chain: "Flare",
        assets: ["FXRP"],
        url: "https://app.upshift.finance/pools/14/0x373D7d201C8134D4a2f7b5c63560da217e3dEA28",
        blurb: [
          "Upshift, a spinout of the onchain prime brokerage August, runs curated, professionally managed vaults. On Flare it powers two FXRP vaults: earnXRP, curated by Clearstar, and MXRPY, managed by Monarq Asset Management.",
          "Instead of one fixed source, curators spread FXRP across active strategies: carry trades, staking, cover underwriting through Firelight and concentrated liquidity for earnXRP; options, funding-rate arbitrage and onchain XRPFi for MXRPY. You hold a vault receipt token redeemable back to FXRP, with a multi-day withdrawal window or instant redemption for a fee.",
        ],
        facts: [
          { label: "Yield source", value: "Active multi-strategy: carry, staking, LP, options and basis" },
          { label: "Curators", value: "Clearstar (earnXRP), Monarq Asset Management (MXRPY)" },
          { label: "Wrapped asset", value: "FXRP (Flare FAssets)" },
          { label: "Points", value: "Upshift Points program" },
          { label: "Backers", value: "Dragonfly Capital, Hack VC, 6th Man Ventures, Robot Ventures" },
          { label: "Audits", value: "ChainSecurity, Zellic, Sigma Prime and Hacken (per Upshift)" },
        ],
      },
      {
        slug: "enosys",
        platform: "Enosys",
        product: "FXRP / USDT0 Pool",
        type: "Pool",
        chain: "Flare",
        assets: ["FXRP", "USDT"],
        url: "https://dex.enosys.global/liquidity/0x686f53F0950Ef193C887527eC027E6A574A4DbE1",
        blurb: [
          "Enosys, formerly FLR Finance, is a Flare-native DeFi suite: a v3 concentrated-liquidity DEX, Enosys Loans (a Liquity v2 fork that mints an XRP-backed stablecoin), and farming. The FXRP / USDT0 pool pairs wrapped XRP with omnichain USDT.",
          "LP yield is swap fees plus rFLR emissions, and some pools add the APS governance token. The team describes itself as independent and unfunded, with no venture backers.",
        ],
        facts: [
          { label: "Yield source", value: "Swap fees plus rFLR emissions (some pools add APS)" },
          { label: "Wrapped asset", value: "FXRP (Flare FAssets), paired with USDT0" },
          { label: "Tokens", value: "APS (Apsis) and HLN (Helion)" },
          { label: "Backing", value: "Independent, states it has no venture backing" },
          { label: "Audits", value: "Enosys Loans audited by Coinspect and Dedaub (2025)" },
        ],
      },
      {
        slug: "superform",
        platform: "Superform",
        product: "bizFXRP Vault",
        type: "Vault",
        chain: "Flare",
        assets: ["FXRP"],
        url: "https://app.superform.xyz/vault/14_0x34f90dfa0f1b2f691ee3a3a87954f8d282193c16",
        blurb: [
          "Superform is a cross-chain yield marketplace. Its Flare vault, bizFXRP, is an institutional-grade strategy curated by Byzantine Labs that routes FXRP into Flare's XRP lending markets, tracked as an ERC-1155 SuperPosition.",
          "The base yield is lending interest, actively reallocated by the curator. Superform layers its own Points program on top, roughly one point per $100 held per hour, with multipliers and NFT boosts.",
        ],
        facts: [
          { label: "Yield source", value: "Flare XRP lending interest" },
          { label: "Curator", value: "Byzantine Labs" },
          { label: "Wrapped asset", value: "FXRP (Flare FAssets)" },
          { label: "Points", value: "Superform Rewards (Points)" },
          { label: "Backers", value: "Seed led by Polychain, strategic round led by VanEck Ventures" },
          { label: "Audits", value: "V2 Core reviewed by Spearbit (Cantina)" },
        ],
      },
    ],
  },
  {
    chain: "Base",
    tag: "Coinbase-wrapped XRP",
    intro:
      "On Base, XRP arrives as cbXRP, Coinbase's 1:1 custodied wrapper. The yield comes from the same two places as everywhere else: swap fees on a DEX, or lending interest on a money market.",
    venues: [
      {
        slug: "aerodrome",
        platform: "Aerodrome",
        product: "cbXRP / cbBTC and cbXRP / WETH",
        type: "Pool",
        chain: "Base",
        assets: ["cbXRP", "cbBTC"],
        url: "https://aerodrome.finance/connect?to=%2Fdeposit%3Ftoken0%3D0xcb585250f852C6c6bf90434AB21A00f02833a4af%26token1%3D0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf%26type%3D100%26chain0%3D8453%26chain1%3D8453%26factory%3D0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef",
        blurb: [
          "Aerodrome is the main ve(3,3) DEX on Base, built by the Velodrome team. Its Slipstream pools are Uniswap v3 style concentrated liquidity, and XRP comes in as Coinbase Wrapped XRP.",
          "The cbXRP / cbBTC and cbXRP / WETH pools pay swap fees plus AERO emissions that veAERO voters steer to each pool every week. Gauntlet has also run a USDC reward campaign to bootstrap the cbAsset pools. Rates move with vote weight and campaigns, and concentrated liquidity carries impermanent loss if the two sides drift apart.",
        ],
        facts: [
          { label: "Yield source", value: "Swap fees plus AERO emissions, and a USDC bootstrap campaign" },
          { label: "Wrapped asset", value: "cbXRP (Coinbase, 1:1 custody)" },
          { label: "Incentive curator", value: "Gauntlet (USDC campaign)" },
          { label: "Built by", value: "The Velodrome team" },
          { label: "Audits", value: "Forked from audited Velodrome v2; cbXRP contract by OpenZeppelin" },
        ],
      },
      {
        slug: "moonwell",
        platform: "Moonwell",
        product: "cbXRP Lending",
        type: "Lending Market",
        chain: "Base",
        assets: ["cbXRP"],
        url: "https://moonwell.fi/markets/supply/base/cbxrp",
        blurb: [
          "Moonwell was the first lending app on Base to list cbXRP. Supply cbXRP to earn borrow interest, with WELL incentives layered on top in some markets. It is a straightforward, single-sided way to earn on XRP with no second asset to manage.",
        ],
        facts: [
          { label: "Yield source", value: "Borrow interest, plus WELL incentives" },
          { label: "Wrapped asset", value: "cbXRP (Coinbase, 1:1 custody)" },
        ],
      },
    ],
  },
];
