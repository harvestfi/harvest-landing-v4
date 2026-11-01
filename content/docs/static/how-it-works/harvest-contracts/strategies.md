# Strategies

Strategies are a key component in the Harvest machinery that define the ways in which vault funds can be utilized with 3rd party protocols to generate yield.

Because strategies are directly moving user's tokens, they are strictly scrutinized and tested prior to their deployment. Strategies become associated with a vault through a 'timelock' mechanism, meaning that the change is first announced, then a period of time must elapse (currently 12 hours) before the change is made official and the new strategy can access funds.

While the specifics of each strategy may differ based on the farming opportunity being taken advantage of, all strategies use a function called `doHardWork()` to compound their tokens with the following steps:

1. Collect reward tokens accumulated by the farmed tokens.
2. Liquidate the rewards into the farming token.
3. Reutilize the new tokens in the farming opportunity.

> During liquidation, a performance fee (8-15%) is taken from the rewards and used to buy FARM on the market, which is then distributed to those who have staked FARM in Profitsharing.

Whenever `doHardWork()` is called, the price of each share of the associated vault increases. Most vaults are harvested every 12-48 hours, depending on the liquidity of their associated token. If you notice that a vault has failed to harvest in more than 48 hours, please let a mod know in the Harvest community discord server.

The following is an example of what this 'harvest' transaction via `doHardWork()` looks like: <https://etherscan.io/tx/0xa96648073820c1b2a9e2427963a439d7ae895661e5ea3c7f8c99604b04832d3b>
