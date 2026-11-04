# Supported protocols

The DeFi protocols where Harvest vaults and Autopilots deploy your assets, on which networks, and for which assets.

When you supply assets to a Harvest vault, a strategy contract deploys them into a third-party DeFi protocol: a lending market, a curated lending vault or a liquidity pool. The strategy then claims the rewards, converts them back into the deposited asset and compounds them, so you hold one receipt token instead of managing positions yourself. Autopilots go one step further and move your deposit between several of these vaults automatically.

This page lists the protocols Harvest currently integrates. Live rates, TVL and the full list of vaults for each asset are on the asset pages: [USDC](https://harvest.finance/usdc), [USDT](https://harvest.finance/usdt), [ETH](https://harvest.finance/eth) and [BTC](https://harvest.finance/btc).

> **Note:** The list reflects vaults live on harvest.finance in October 2026. Harvest adds and retires vaults as markets change; the asset and network pages always show the current set.

## Overview

| Protocol | Type | Networks | Assets | Where to compare |
|---|---|---|---|---|
| [Morpho](#morpho) | Curated lending vaults and markets | Ethereum, Base, Arbitrum, Polygon, HyperEVM | USDC, USDT, ETH, cbBTC | [harvest.finance/morpho](https://harvest.finance/morpho) |
| [Aave](#aave) | Lending market | Ethereum, Base, Arbitrum, Polygon | USDC, USDT, ETH | [harvest.finance/aave](https://harvest.finance/aave) |
| [Autopilot (IPOR technology)](#autopilot-and-ipor) | Automated allocation across Harvest vaults | Ethereum, Base, Arbitrum | USDC, ETH, WBTC, cbBTC | [Autopilots](https://harvest.finance/docs/how-it-works/autopilots) |
| [IPOR](#autopilot-and-ipor) | Optimised lending vaults | Ethereum, Base | USDC, ETH, WBTC | [USDC](https://harvest.finance/usdc), [ETH](https://harvest.finance/eth) |
| [Fluid](#fluid) | Lending market | Ethereum, Base, Arbitrum | USDC, USDT, ETH | [USDC](https://harvest.finance/usdc), [USDT](https://harvest.finance/usdt) |
| [Euler](#euler) | Modular lending vaults | Ethereum, Base, Arbitrum | USDC, ETH | [USDC](https://harvest.finance/usdc), [ETH](https://harvest.finance/eth) |
| [Compound V3](#compound-v3) | Lending market | Base, Arbitrum | USDC, USDT, ETH | [USDC](https://harvest.finance/usdc), [ETH](https://harvest.finance/eth) |
| [ExtraFi](#extrafi) | Lending pools | Base | USDC, ETH, cbBTC | [Base](https://harvest.finance/base) |
| [Dolomite](#dolomite) | Lending market | Arbitrum | USDC, USDT, ETH, WBTC | [Arbitrum](https://harvest.finance/arbitrum) |
| [Arcadia](#arcadia) | Lending pools | Base | USDC, ETH, cbBTC | [Base](https://harvest.finance/base) |
| [Stake DAO](#stake-dao) | Boosted Curve and Convex liquidity | Ethereum | ETH/CVX, ETH/stETH, BTC/WBTC | [Ethereum](https://harvest.finance/ethereum) |
| [HypurrFi](#hypurrfi) | Lending market | HyperEVM | USDC, USDT | [HyperEVM](https://harvest.finance/hyperevm) |
| [Venus](#venus) | Lending market | Arbitrum | ETH | [ETH](https://harvest.finance/eth) |
| [40 Acres](#40-acres) | Lending vault | Base | USDC | [USDC](https://harvest.finance/usdc) |
| [Aerodrome](#aerodrome) | Liquidity pool | Base | ETH/GENOME | [Base](https://harvest.finance/base) |

## Protocols by type

### Lending markets and curated vaults

Most Harvest vaults supply a single asset, usually a stablecoin or ETH, to a lending protocol. Borrowers pay interest on it, and many protocols add token incentives on top. Harvest's strategy claims those incentives, sells them for the deposited asset and adds the proceeds to your position. This is the "auto-harvested" part of the APY breakdown described in [Yield Sources on Harvest](https://harvest.finance/docs/general-info/yield-sources-on-harvest-how-to-get-and-track-them).

Protocols in this group: Morpho, Aave, Fluid, Euler, Compound V3, ExtraFi, Dolomite, Arcadia, HypurrFi, Venus and 40 Acres.

### Automated allocation

[Autopilots](https://harvest.finance/docs/how-it-works/autopilots) do not add a new protocol. They allocate one deposit across several Harvest vaults of the same asset and rebalance it as rates move. The allocation technology is developed by IPOR Labs.

### Liquidity pools

A smaller number of vaults provide liquidity to a pool and earn trading fees plus rewards: Stake DAO (Curve and Convex positions on Ethereum) and Aerodrome on Base.

## Morpho

Morpho is a lending protocol where independent risk curators run vaults that lend to a selected set of Morpho markets. Harvest offers the largest number of vaults on Morpho, with curators such as Steakhouse, Gauntlet, Moonwell, KPK, Clearstar, API3, Felix, Hyperithm and MEV Capital, plus direct Morpho markets on Base (USDC lent against cbETH, wstETH, cbBTC or WETH).

- **Networks:** Ethereum, Base, Arbitrum, Polygon, HyperEVM
- **Assets:** USDC, USDT, ETH, cbBTC
- **Compare all Morpho vaults:** [harvest.finance/morpho](https://harvest.finance/morpho)
- **Examples:** [USDC on Morpho: Gauntlet (HyperEVM)](https://harvest.finance/usdc-morpho-gauntlet-hyperevm), [USDC on Morpho: KPK Yield V2 (Ethereum)](https://harvest.finance/usdc-morpho-kpk-yield-v2-ethereum), [USDC on Morpho Market: cbBTC (Base)](https://harvest.finance/usdc-morpho-market-cbbtc-base)

Morpho vaults are managed by third-party curators, who can change allocations and risk parameters. See the [Risk Disclosures](https://harvest.finance/docs/legal/risk-disclosures).

## Aave

Aave is one of the longest-running lending markets in DeFi. Harvest supplies stablecoins and ETH to Aave on several networks, including Aave Prime on Ethereum and a WETH looping strategy on Base.

- **Networks:** Ethereum, Base, Arbitrum, Polygon
- **Assets:** USDC, USDT, ETH
- **Compare all Aave vaults:** [harvest.finance/aave](https://harvest.finance/aave)
- **Examples:** [USDC on Aave (Ethereum)](https://harvest.finance/usdc-aave-ethereum), [USDC on Aave: Prime](https://harvest.finance/usdc-aave-prime-ethereum), [WETH on Aave: Looping (Base)](https://harvest.finance/weth-aave-looping-base)

## Autopilot and IPOR

Autopilots spread one deposit across the Harvest vaults of an asset and rebalance it automatically, with no lockups. The technology comes from IPOR Labs AG and has been audited twice; see [Autopilots](https://harvest.finance/docs/how-it-works/autopilots). Harvest also offers IPOR lending optimiser vaults on Ethereum and Base.

- **Autopilot networks and assets:** USDC on Ethereum, Base and Arbitrum; WETH on Base and Arbitrum; WBTC on Arbitrum; cbBTC on Base
- **Examples:** [USDC Autopilot (Base)](https://harvest.finance/usdc-autopilot-base), [USDC Autopilot (Ethereum)](https://harvest.finance/usdc-autopilot-ethereum), [USDC on IPOR: Base USDC Lending Optimizer](https://harvest.finance/usdc-ipor-base-usdc-lending-optimizer-base)

## Fluid

Fluid is a lending protocol with a shared liquidity layer for lending and borrowing.

- **Networks:** Ethereum, Base, Arbitrum
- **Assets:** USDC, USDT, ETH
- **Examples:** [USDC on Fluid (Base)](https://harvest.finance/usdc-fluid-base), [USDT on Fluid (Ethereum)](https://harvest.finance/usdt-fluid-ethereum), [ETH on Fluid (Ethereum)](https://harvest.finance/eth-fluid-ethereum)

## Euler

Euler is a modular lending protocol in which each vault has its own collateral and risk settings, often managed by a curator.

- **Networks:** Ethereum, Base, Arbitrum
- **Assets:** USDC, ETH
- **Examples:** [USDC on Euler (Base)](https://harvest.finance/usdc-euler-euler-base-base), [ETH on Euler: Clearstar Fusion (Base)](https://harvest.finance/eth-euler-clearstar-fusion-base)

## Compound V3

Compound V3 (Comet) is a lending market in which each market has a single borrowable base asset.

- **Networks:** Base, Arbitrum
- **Assets:** USDC, USDT, ETH
- **Examples:** [USDC on Compound V3 (Base)](https://harvest.finance/usdc-compound-v3-base), [ETH on Compound V3 (Arbitrum)](https://harvest.finance/eth-compound-v3-arbitrum)

## ExtraFi

ExtraFi runs lending pools on Base, which also fund leveraged yield farming.

- **Network:** Base
- **Assets:** USDC, ETH, cbBTC
- **Examples:** [USDC on ExtraFi: Lend](https://harvest.finance/usdc-extrafi-lend-base), [cbBTC on ExtraFi](https://harvest.finance/cbbtc-extrafi-lend-base)

## Dolomite

Dolomite is a lending and margin protocol on Arbitrum.

- **Network:** Arbitrum
- **Assets:** USDC, USDT, ETH, WBTC
- **Examples:** [USDC on Dolomite](https://harvest.finance/usdc-dolomite-arbitrum), [WBTC on Dolomite](https://harvest.finance/wbtc-dolomite-arbitrum)

## Arcadia

Arcadia offers lending pools on Base.

- **Network:** Base
- **Assets:** USDC, ETH, cbBTC
- **Examples:** [USDC on Arcadia](https://harvest.finance/usdc-arcadia-lend-base), [cbBTC on Arcadia](https://harvest.finance/cbbtc-arcadia-lend-base)

## Stake DAO

Stake DAO's OnlyBoost strategies hold boosted Curve and Convex liquidity positions. Harvest compounds their rewards.

- **Network:** Ethereum
- **Pairs:** ETH/CVX, ETH/stETH, BTC/WBTC
- **Examples:** [ETH/stETH on Stake DAO](https://harvest.finance/steth-stake-dao-onlyboost-ethereum), [BTC/WBTC on Stake DAO](https://harvest.finance/wbtc-stake-dao-onlyboost-ethereum)

## HypurrFi

HypurrFi is a lending market on HyperEVM, the EVM network of Hyperliquid.

- **Network:** HyperEVM
- **Assets:** USDC, USDT (USDT0)
- **Examples:** [USDC on Hypurr](https://harvest.finance/usdc-hypurr-hyperevm), [USDT on Hypurr](https://harvest.finance/usdt-hypurr-usdt0-hyperevm)

## Venus

Venus is a lending market. Harvest supplies ETH to its Core pool on Arbitrum.

- **Network:** Arbitrum
- **Asset:** ETH
- **Example:** [ETH on Venus](https://harvest.finance/eth-venus-core-arbitrum)

## 40 Acres

40 Acres runs a USDC lending vault on Base.

- **Network:** Base
- **Asset:** USDC
- **Example:** [USDC on 40 Acres](https://harvest.finance/usdc-40-acres-base)

## Aerodrome

Aerodrome is the main decentralised exchange on Base. Harvest's vault provides ETH/GENOME liquidity and compounds the rewards.

- **Network:** Base
- **Pair:** ETH/GENOME
- **Example:** [ETH/GENOME on Aerodrome](https://harvest.finance/eth-aerodrome-genome-base)

## Supported networks

| Network | Protocols | Vaults |
|---|---|---|
| [Ethereum](https://harvest.finance/ethereum) | Morpho, Aave, Fluid, Euler, IPOR, Stake DAO, Autopilot | [harvest.finance/ethereum](https://harvest.finance/ethereum) |
| [Base](https://harvest.finance/base) | Morpho, Aave, Fluid, Euler, Compound V3, ExtraFi, Arcadia, IPOR, 40 Acres, Aerodrome, Autopilot | [harvest.finance/base](https://harvest.finance/base) |
| [Arbitrum](https://harvest.finance/arbitrum) | Morpho, Aave, Fluid, Euler, Compound V3, Dolomite, Venus, Autopilot | [harvest.finance/arbitrum](https://harvest.finance/arbitrum) |
| [Polygon](https://harvest.finance/polygon) | Morpho, Aave | [harvest.finance/polygon](https://harvest.finance/polygon) |
| [HyperEVM](https://harvest.finance/hyperevm) | Morpho, HypurrFi | [harvest.finance/hyperevm](https://harvest.finance/hyperevm) |
| [zkSync](https://harvest.finance/zksync) | See the network page | [harvest.finance/zksync](https://harvest.finance/zksync) |

## How Harvest chooses protocols

Harvest adds a protocol when it has audited contracts, enough liquidity to enter and exit without large price impact, and a yield that Harvest can automate: claiming and selling rewards, compounding, or allocating between markets. Each integration is a separate strategy contract behind a Harvest vault, and every vault is listed with its contract addresses in [Contract Addresses](https://harvest.finance/docs/how-it-works/contract-addresses).

How Harvest measures and displays yields is described in the [Methodology](https://harvest.finance/methodology). How each vault is rated for risk is described in the [Risk Framework](https://harvest.finance/risk-framework). Audits of Harvest's own contracts are listed under [Security](https://harvest.finance/security) and [Audits](https://harvest.finance/docs/other/security/audits).

> **Warning:** Every vault also carries the risks of the protocol it uses: smart contract bugs, oracle failures, curator decisions, bad debt and temporary withdrawal limits when a market is fully borrowed. Read the [Risk Disclosures](https://harvest.finance/docs/legal/risk-disclosures) before you deposit.

## FAQ

### Which DeFi protocols does Harvest support?

As of October 2026: Morpho, Aave, Fluid, Euler, Compound V3, IPOR, ExtraFi, Dolomite, Arcadia, Stake DAO, HypurrFi, Venus, 40 Acres and Aerodrome, plus Autopilots that allocate across Harvest vaults. Morpho and Aave have their own comparison pages: [harvest.finance/morpho](https://harvest.finance/morpho) and [harvest.finance/aave](https://harvest.finance/aave).

### Do I need an account with each protocol?

No. You deposit into the Harvest vault with your own wallet, and the vault's strategy holds the position in the underlying protocol. You receive one receipt token and can withdraw at any time. See [How to convert and revert](https://harvest.finance/docs/how-it-works/how-to-deposit-withdraw).

### Where can I compare yields for one asset across protocols?

On the asset pages: [USDC](https://harvest.finance/usdc), [USDT](https://harvest.finance/usdt), [ETH](https://harvest.finance/eth) and [BTC](https://harvest.finance/btc). Each lists every Harvest vault for that asset, with live APY and TVL.

### Why is a protocol I used before no longer listed?

Harvest retires vaults when liquidity or rewards dry up, or when a protocol's risk changes. Retired vaults stay withdrawable in the app.
