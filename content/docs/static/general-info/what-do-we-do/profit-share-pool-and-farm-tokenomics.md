# FARM token and iFARM

FARM tokenomics, the profit sharing pool and iFARM: how protocol fees are shared with FARM holders.

In order to provide incentives to yield farmers using the Harvest platform, the `$FARM` token was released when Harvest (formerly known as Harvest Finance) launched on [September 1st, 2020](https://medium.com/harvest-finance/the-harvest-finance-project-338c3e5806fc). The token was launched without any premining, presale, venture capitalist, or investor funds, with 0 circulating supply at launch. Tokens were never sold at ICO / TGE or any kind of fundraising venture.

The FARM token is emitted on a weekly schedule over a four-year period from its launch date. Below is a breakdown of token emissions:

* 70% of the FARM tokens will be utilized as rewards for liquidity providers, liquidity provisioning on decentralized marketplaces, market-making services across exchanges, and for the creation & ongoing maintenance of any deployed strategies (Including any payments associated with strategy development). New emissions details are released weekly on the [Medium](https://yogafire-genuine.medium.com/) blog or Official Discord server.
* 10% of the FARM tokens will flow to the [Operational Treasury](https://etherscan.io/address/0x843002b1d545ef7abb71c716e6179570582faa40) to pay for contributions to the maintenance of the protocol, including community contributor rewards and business operation expenses, including any legal fees to support Harvest operations and/or its contributors.
* 20% of the FARM tokens will flow to the original founding [Development Team](https://etherscan.io/address/0x49d71131396f23f0bce31de80526d7c025981c4d).

The specific weekly distribution of incentives is monitored by the community contributor team with the goal of providing the greatest benefit to liquidity providers and FARM token holders.

### Supply

In Week 5, FARM holders [voted overwhelmingly](https://medium.com/harvest-finance/week-5-the-power-of-69-6c8346ec3d8d) to cap the maximum supply to **690,420** tokens by reducing the emissions of tokens by 4.45% every week until week 208 (27 August 2024) which is exactly 4 years from launch. As a result, token emissions were set to follow this curve:

![](https://harvest.finance/docs/assets/57e8889e26-image.png)

At [07:46 PM UTC on September 6, 2024](https://etherscan.io/tx/0x8266d0ba33968684ff3474d26b7944457e86b607abf7ae165e3886559ef92104), the last FARM was officially minted and [emissions ended](https://medium.com/harvest-finance/the-end-of-farm-emissions-what-it-means-whats-next-32b51c898ce5).

### Notes on maximum supply

`$FARM` was launched with a hard-coded maximum supply of 5,000,000 tokens which would be minted over the course of 4 years.

In this initial period, it was noted that emissions were higher than needed for the growth of the project. As a result, a total of 14,870.23 `$FARM` tokens were burned irretrievably to [0xffffffffffffffffffffffffffffffffffffffff](https://etherscan.io/token/0xa0246c9032bc3a600820415ae600c6388619a14d?a=0xffffffffffffffffffffffffffffffffffffffff) to decrease the total circulating supply. Considering this amount to the maximum circulating amount of 690,420 `$FARM` is 705,290.23 `$FARM` which could be verified through the [totalSupply amount in the smart contract](https://etherscan.io/readContract?m=light\&a=0xa0246c9032bc3a600820415ae600c6388619a14d\&n=mainnet\&v=0xa0246c9032bc3a600820415ae600c6388619a14d#readCollapse11) of `$FARM`.

All `$FARM` tokens circulated in L2 networks are all bridged tokens from the Ethereum mainnet and are not tokens minted over the 690,420 cap.

### Governance

The FARM token was also used to determine voting power in Harvest governance proposals when originally launched. The snapshot governance page can be found here: <https://snapshot.org/#/harvestfi.eth/about>.

Today the Harvest protocol has moved away from formal voting and instead comes to consensus through contributor proposal and discussion. **The FARM token does*****not*****give holders a vote on incentive distribution, strategy deployment/updates, addition/removal of vaults, etc.** When voting is utilized, it is used for higher-order strategic decisions, such as the above mentioned supply reduction.

### Spot Trading

`$FARM` is available for trading on several centralized and decentralized exchanges:

**Centralized Exchanges**

[Coinbase](https://www.coinbase.com/advanced-trade/spot/FARM-USD), [Crypto.com](https://crypto.com/exchange/trade/spot/FARM_USD), [Kraken](https://pro.kraken.com/app/trade/farm-usd) and many more

**Decentralized Exchanges**

[ETH - Uniswap](https://app.uniswap.org/swap?inputCurrency=ETH\&outputCurrency=0xa0246c9032bc3a600820415ae600c6388619a14d\&chain=ethereum), [BASE - Aerodrome](https://aerodrome.finance/swap?from=eth\&to=0xd08a2917653d4e460893203471f0000826fb4034),  [BASE - Uniswap](< https://app.uniswap.org/swap?inputCurrency=ETH\&outputCurrency=0xd08a2917653d4e460893203471f0000826fb4034\&chain=base>)

## Communal Harvesting and iFARM

The communal sharing of protocol fees via open market FARM buy-backs.

#### Protocol Earnings

<figure><img src="https://harvest.finance/docs/assets/6e590015cf-Screenshot-2024-05-14-at-10.28.14-AM.png" alt=""><figcaption></figcaption></figure>

A key innovation of the `$FARM` token is that it indirectly shares with staked holders a portion of performance fees taken from Harvest's yield farming strategies. While each strategy may farm different assets, each strategy has a performance fee that is used to recover operational expenses for the Harvest treasury. A % of Performance fees are used to buy `$FARM` on the open market, which is then distributed to those who stake `$FARM` in the Communal Harvest pool. To participate in the Communal Harvest, users must first obtain FARM by earning incentives by participating in Harvest's yield farming strategies or simply buying FARM directly on the open market. Then FARM must be sent to the auto-compounding Communal Harvest pool.

#### Technical Details

The Communal Harvest pool is a modified SNX style staking pool. Once `$FARM` is purchased on the open market it is distributed pro rata to all those staked in the Communal Harvest pool over a duration of 1 day, with each new reward added resetting the duration of the payout. As a result, the instantaneous reward rate for the pool fluctuates over the course of the day. For this reason, a 7-day average of the reward rate is displayed for this pool. The instantaneous rate can always be checked by reading the smart contract directly.

#### iFARM

iFARM is a receipt token for FARM that is auto-compounding in the Communal Harvest pool. It can be obtained by staking FARM in the iFARM pool on Ethereum mainnet or Arbitrum network, or purchased on the open market.

iFARM utilizes the same [vault architecture](https://harvest.finance/docs/how-it-works/harvest-contracts/vaults) as Harvest's other vaults, collecting FARM from users and then putting it in aggregate into the Communal Harvest pool. The advantages of iFARM over FARM include:

* Lower gas costs to put FARM into the Communal Harvest pool.
* A fungible and transferrable receipt token, allowing compounded allocations to be transferred between addresses without first unstaking the underlying FARM.
* Composability of the iFARM token allows compounding allocations to be utilized in external opportunities, such as providing liquidity for iFARM on Matic, or futurization of yield at Spectra.Finance.

<figure><img src="https://harvest.finance/docs/assets/9231af739a-Communal-Harvest.png" alt=""><figcaption></figcaption></figure>

#### Trading

iFARM is available for trading on decentralized exchanges:

**Decentralized Exchanges**

[ARB - Camelot](https://app.camelot.exchange/), [POLYGON - Quickswap](https://quickswap.exchange/#/swap?swapIndex=0\&currency0=ETH\&currency1=0xab0b2ddB9C7e440fAc8E140A89c0dbCBf2d7Bbff), [POLYGON - Uniswap](https://app.uniswap.org/swap?inputCurrency=ETH\&outputCurrency=0xab0b2ddb9c7e440fac8e140a89c0dbcbf2d7bbff\&chain=polygon), [BASE - Uniswap](https://app.uniswap.org/swap?inputCurrency=ETH\&outputCurrency=0xe7798f023fc62146e8aa1b36da45fb70855a77ea\&chain=base)
