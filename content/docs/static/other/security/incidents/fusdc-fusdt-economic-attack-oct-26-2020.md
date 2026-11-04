# fUSDC/fUSDT Economic Attack Oct 26 2020

At 02:53 UTC on Monday October 26th 2020, attackers launched an economic attack on the fUSDC and fUSDT vaults to drain a total of $24 million.

At around 03:30 UTC, users in the Harvest Finance Discord began noticing significant drops in their USDT and USDC balances in the respective vaults.

The Harvest dev team was immediately informed, and shortly after, All DAI, TUSD, renBTC, wBTC, and remaining USDC and USDT funds on Curve were reverting into the vaults pending investigation. Converting into these pools were shortly disabled, while revertings are unaffected.

The attacker had repeatedly exploited the effects of impermanent loss of USDC and USDT inside the Y pool on [Curve.fi](http://curve.fi/). They used the manipulated asset value to convert funds into the Harvest’s vaults and obtain vault shares for a beneficial price, and later exit the vault at a regular share price generating a profit.

At around 19:00 UTC the same day, [a post mortem was posted on Medium.](https://medium.com/harvest-finance/harvest-flashloan-economic-attack-post-mortem-3cf900d65217) Refer to the article for the latest details on the attack, the attacker, and the current addresses of stolen funds.

All WETH, UNI LP, and SUSHI LP converting are immune from a similar attack. They remain invested and continue to compound. Remaining non reverted funds in the Curve strategies continue to earn FARM.
