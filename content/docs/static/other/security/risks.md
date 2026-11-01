# Risks

> Do farming at your own risk. Problems with Harvest or with protocols that Harvest integrates with may result in partial or total loss of funds. Stated yields aren't guaranteed. Do your own research and don't do farming with more than you can afford to lose.

### Smart Contract Failures

Harvest's smart contracts are open source, readable, and include tests. They are not a direct fork of an existing contract system. Multiple [Audits finished](https://harvest.finance/docs/other/security/audits), but a successful audit does not guarantee that a new or existing Harvest strategy will hit APY targets or avoid hacks of Harvest or contracts that Harvest integrates with (Curve, Sushi, Uniswap, Compound, AAVE & etc).

### Composability Risks

Harvest contracts handle many different assets and interact with many other contracts. This contract composability gives Harvest its utility, but interacting with multiple contracts creates risk if there is a failure in one of the contracts. Harvest makes a best effort to audit and evaluate the risks of the contracts that Harvest farms, but farming tokens are subject to the risks inherent to each strategy. Look into the strategies employed by the vaults that you farm into to get acquainted with the risks.

### Asset Risks

> Stablecoins aren't necessarily stable! Stablecoins and synthetics may depeg from the target price and you may lose value. Carefully evaluate the risks of all of your so-called "stable" assets!

Harvest interacts with many stablecoins and synthetic representations of other assets like Bitcoin. These assets may rely on collateralization with other digital assets (DAI, sUSD, sBTC) or may be non-bearer liabilities that are only redeemable for the underlying asset with a centralized third party (USDC, USDT, wBTC). If a non-bearer asset is blacklisted by the issuer or a synthetic asset becomes undercollateralized, your positions that hold or interact with these assets may lose value or even become worthless.

### Automated Market Maker Risks

> Harvest uses yield farming strategies that have exposure to liquidity pools. Providing liquidity on an AMM is an advanced topic and there are several ways to lose money. Proceed at your own risk!

Impermanent loss (aka Divergence Loss) is associated with providing assets to a liquidity pool. Liquidity pools are used in Decentralized Exchanges such as Uniswap, Curve, and Balancer in order to create money markets and enable traders to buy and sell the assets that the pools support.

If you convert funds to provide liquidity in an automated market maker, you may lose some or all of the value you converted if there is a change in the relative values of the assets in the automated market maker. If just one of the assets in the pool loses value or becomes worthless, your entire position in the pool, regardless of which assets you originally provided when you entered the pool, may lose value or become worthless.

If you provide liquidity to a pool and one of the assets *gains* in value relative to the others in the pool, you may not make as much money as you would have, had you held these assets instead of converting  them in the pool. It is critical to understand the math behind impermanent loss before providing liquidity!

Many yield farming strategies, including the yield farming strategies employed by Harvest, provide incentives for providing liquidity in an AMM. **These incentives do not guarantee that providing liquidity will be profitable for you.**

Further reading on impermanent loss and AMM risks:

* [Beginner’s Guide to (Getting Rekt by) Impermanent Loss](https://blog.bancor.network/beginners-guide-to-getting-rekt-by-impermanent-loss-7c9510cb2f22)
* [Uniswap: a good deal for liquidity providers?](https://medium.com/@pintail/uniswap-a-good-deal-for-liquidity-providers-104c0b6816f2)
* [Calculating Value, Impermanent Loss and Slippage for Balancer Pools](https://medium.com/balancer-protocol/calculating-value-impermanent-loss-and-slippage-for-balancer-pools-4371a21f1a86)
* [What Is IMPERMANENT LOSS? DEFI Explained - Uniswap, Curve, Balancer, Bancor](https://www.youtube.com/watch?v=8XJ1MSTEuU0)

### Liquidity and Market Impact

> Many new DeFi assets have extremely poor liquidity and you may experience significant losses due to market impact when buying or selling. Liquidity may disappear when prices are changing rapidly, and you may be stranded in a position and unable to sell. Carefully evaluate the liquidity profiles of the assets that you hold!

Market impact (aka price impact) occurs when a trade is large enough to change the price of the assets that are traded on the exchange where they are being traded. Market impact can increase when liquidity decreases during periods of high volatility.

Some Harvest strategies may involve entering and exiting automated market maker LP positions on Curve, Swerve, Balancer, Uniswap from a single asset supported by the AMM. If price volatility reduces the liquidity of the asset you have converted, **you may experience market impact losses when you try to revert.** These losses may appear as a reduction in your farming balance. If the liquidity situation for your asset improves, your displayed balance may also improve.

### Death Spiral Risk

> Crypto markets can be volatile, while this provides huge opportunities it can also be a huge risk.

Many market events can increase volatility, those events can have a direct effect in value converted in harvest finance through many different assets, also, a panic in the market can trigger a bank run, if such an event happens in the same time FARM token suffers sell pressure, incentives in harvest finance may be affected and this can cause a negative feedback loop.
