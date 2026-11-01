# Timelocks

All Harvest vaults operate with a 12 hour timelock in place

Timelocks are an often-referenced security feature in Ethereum contracts that protect users from changes they disagree with.

Because DeFi platforms handle money, there have been numerous examples of scams and projects turned fraudulent that have stolen money from users. Timelocks have been popularized as a method of distancing developers from users funds by requiring a period of time to elapse before changes can be made.

Harvest has deployed timelocks on all vaults that function as follows:

1. If the devs wish to change the investing strategy, they must first deploy the new strategy to the blockchain.
2. Next they "announce" the strategy change, which emits a web3 event that can be read by chainwatching bots.
3. Users have a specified amount of time (currently 12 hours) to examine the new contract and revert funds if they wish to opt out.
4. Any time after the specified period has elapsed, the deployer may choose to either accept or reject the strategy change.

The primary function of timelocks is to protect farmers from malicious strategies attempting to steal funds.

Example scenario without timelock:

* A malicious investment strategy is deployed that funds all of users' funds into a malicious wallet.
* In the same block, the investment strategy in the vault updates.
* In the same block, the vault transfers funds to the malicious wallet, and all funds are lost.

Example scenario with timelock:

* A malicious investment strategy is deployed that funds all of users' funds into a malicious wallet.
* The strategy change is announced by the vault, indicating that it can change to this malicious strategy in 12 hours.
* Chainwatchers report the strategy change, and technically competent users can sound the alarm, warning others to revert.
* Users have the remaining time to revert their funds.

While timelocks can play a big role in protecting funds from malicious or compromised developers, they are not without drawbacks. Because the timelock period must elapse before *any* strategy change, timelocks **amplify** users exposure to bugs and vulnerabilities in the code. If a bug exposes user funds to exploitation, developers must wait the timelock's duration after building a fix to apply it. Additionally, timelocks limit the flexibility developers have in swiftly deploying new strategies to capture shorter term opportunities.

The current 12 hour duration of timelocks was selected on 9/15/2020 by the harvest community as a compromise between the risks and benefits of timelocks via a farmer's market discord poll:

![](https://harvest.finance/docs/assets/4c05730489-image.png)
