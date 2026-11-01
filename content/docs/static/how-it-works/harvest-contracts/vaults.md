# Vaults

A vault is an Ethereum smart contract scaling solution that allows users to convert and revert tokens to/from a pool. Harvest utilizes the tokens from the vault into a 3rd party underlying protocol to generate yields to share.

When a user converts tokens to participate in a vault, those will be swapped for the token required by the vault (underlying token) whenever necessary and issued a share of the vault, represented by an `fToken`. The user's tokens are then made available for the pre-defined "strategy" to put it at a 3rd party protocol(s) specified by the strategy code published by the Harvest community developers. Whenever a deployed strategy trades rewards to generate more tokens, the total amount of tokens in the Vault is updated, however, the number of existing `fToken` shares does not change. As a result, the value of each `fToken` share increases with every successful and profitable harvest. When a user reverts `fToken` shares from the vault, the `fToken` is burned and the user receives tokens proportional to the growth of the amount of the token underlying the strategy since their conversion. When the reverted token is different from the underlying token of the strategy, a swap will be carried on to satisfy the user's request. Converting from / reverting into tokens that differ from the underlying token of a vault may result in loss due to market swings.

Most of Harvest's strategies function by putting the underlying tokens into incentivized liquidity pools for various 3rd party protocols. Harvest smart contracts automatically compound the user's tokens by selling any earned rewards into more of the underlying vault token and putting them to generate even more yield. While harvest may show that your fund is "farming" some particular token, you will only receive the token you converted, unless otherwise specified.

User funds are protected in vaults by several mechanisms:

1. The owners of the vault can only move the underlying funds in and out of the pre-defined investment strategy.
2. `fToken`shares can only be minted by converting funds into the vault, and are destroyed when the user reverts its tokens.
3. The investment strategy is protected from changes by a '[timelock](https://harvest.finance/docs/how-it-works/harvest-contracts/vaults/timelocks).'

Harvest Vaults do not track the wallet addresses of farmers. Instead, `fToken` shares are represented by fungible ERC-20 tokens that can be transferred between accounts and traded on secondary markets. Users who trade away or lose their `fToken` shares will not have access to their converted funds.

Because Ethereum gas usage is defined by the number of contracts interacted with and the complexity of the interactions, converting tokens through the Vault smart contract and minting new `fToken` shares requires significantly more gas than the token trading that most Ethereum users may be used to. Users should take care to monitor gas expenses, as they may reduce or even overwhelm the profitability of smaller-scale farming amounts (<$1000), especially when network activity is high.
