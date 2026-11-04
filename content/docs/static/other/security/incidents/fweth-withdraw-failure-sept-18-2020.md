# fWETH Revert Failure Sept 18 2020

> This summary was prepared by user `Silage Pete` and has not been reviewed for accuracy or completeness by the Harvest team.

At around 06:00 UTC on Friday September 18th 2020, users in the Harvest Finance Discord chat began reporting problems with fWETH revertings.

At the time of the incident, the fWETH vault was using a farming strategy that earned yield for farmers by converting the underlying WETH onto the CREAM platform for lending. CREAM lending is based on a fork of the Compound lending codebase.

When an fWETH reverting is processed, the underlying WETH should be removed from CREAM and returned to the claimant, and the interest-bearing fWETH convert receipt should be burned. In the faulty transactions, the convert receipt was burned, but only some or even none of the requested WETH was returned from CREAM and returned to the user:

* <https://etherscan.io/tx/0x8231e0136b47526d9dd55367767ea0bbda174758b1ce3b8f07ac5cd207c1a4f9>
* <https://etherscan.io/tx/0xe77f253d3035e60fc6629e7d553e8b5a1d0ed2870d38666d4d27c9818d940d69>

CREAM, like Compound, cannot always guarantee that reverting of any size can be honored at any time. As a result, large reverting may result in partial or no return of funds and the error message `TOKEN_INSUFFICIENT_CASH`. Due to an oversight, the Harvest strategy contract failed to check for this error and would burn the user's fWETH even if only some or none of the requested WETH was returned.

When the issue was understood, Harvest community wiki managers `BIBI CAT`, `Silage Pete`, and several other Harvest Discord moderators and helpful users notified the Harvest development team of the problem and alerted everyone in Discord that they should not attempt any more WETH revertings until the issue was fixed. Notices to avoid reverting were placed in Discord and the wiki.

At 07:00 UTC, around 1 hour after the incident was reported, contributor `Byron McKeeby` submitted [a pull request to the WETH strategy repository](https://github.com/harvest-finance/harvest/pull/4/files) attempting to fix this bug. This PR would not recover the WETH for those who had failed to revert, but it proposed an approach for avoiding the failed reverting problem in future strategy deployments.

Approximately 5% of the fWETH supply held by 11 owners attempted to revert and was affected by this bug. When a reverting failed, ownership of the WETH in CREAM that failed to be reverted was transferred to the remaining shareholders in the fWETH pool and causing the fWETH share price to increase.

![fweth-shareprice.png](https://farm.chainwiki.dev/fweth-shareprice.png)

Around 14:00 UTC, Discord administrator and development team member `Bread for the People` posted in Discord to announce that the problem was being worked on:

> Revert for WETH are currently disabled due to a lack of ETH inside Cream lending. We are working with CREAM and are actively working to resolve the issue. Safe reverting of WETH will be enabled soon. We would like to take responsibility and to thank Andre Cronje and the CREAM team for actively assisting with the fix.

Around 16:00 UTC, `Bread for the People` announced that the Harvest and CREAM teams had a plan to restore the funds:

> ![🎑](https://farm.chainwiki.dev/_assets/svg/twemoji/1f391.svg) Working together with the CREAM team, we have a plan to restore peace and harmony to the WETH Farm. ![🎑](https://farm.chainwiki.dev/_assets/svg/twemoji/1f391.svg) ![👨‍🌾](https://farm.chainwiki.dev/_assets/svg/twemoji/1f468-200d-1f33e.svg) Users do not need to do anything, the strategy will be updated with the fix. After that, all values will be double-checked, and then reverting will be re-enabled.

Around 17:00 UTC, `Bread for the People` announced that the WETH had been recovered:

> Update: crWETH from the CREAM strategy has been successfully redeemed to WETH.
> ![👨‍🌾](https://farm.chainwiki.dev/_assets/svg/twemoji/1f468-200d-1f33e.svg) Users do not need to do anything, all values will be double-checked once the strategy is updated with the fix, and then reverting will be re-enabled.

Around 19:00 UTC, `Bread for the People` announced that the incident was resolved:

> ![🎑](https://farm.chainwiki.dev/_assets/svg/twemoji/1f391.svg) Peace and harmony has been restored to the WETH Farm. ![🎑](https://farm.chainwiki.dev/_assets/svg/twemoji/1f391.svg)
> ![✅](https://farm.chainwiki.dev/_assets/svg/twemoji/2705.svg) fWETH balances have been restored.
> ![✅](https://farm.chainwiki.dev/_assets/svg/twemoji/2705.svg) Revertings have been re-enabled.
> ![✅](https://farm.chainwiki.dev/_assets/svg/twemoji/2705.svg) All WETH Farm participants are in profit.
> ![👨‍🌾](https://farm.chainwiki.dev/_assets/svg/twemoji/1f468-200d-1f33e.svg) Thanks to the excellent Cream team and the prolific Andre Cronje for helping out.

Recovery transactions:

* [all WETH is redeemed from CREAM and converted in the fWETH contract](https://etherscan.io/tx/0x519acf0a0a71f944e2ae573740d399b77d60220e7c8e4b22742c2a76f2cad69a)
* [fWETH strategy is changed to a recovery strategy contract](https://etherscan.io/tx/0x4482df10258c414853155be260ce4626a645779aa9b600deead35eb621395675)
* [all WETH is moved from fWETH to an intermediate recovery strategy contract](https://etherscan.io/address/0x26d3e02999beffaeb07af3a94438769df0ee4150#tokentxns)
* [4,295 WETH from failed reverting are pooled for return to their 11 owners](https://etherscan.io/address/0x23b6c1f600111895cc4536d070eb35660500d670#tokentxns)
* [85,271 WETH is returned to the fWETH contract and fWETH strategy switched to safewithdrawal contract](https://etherscan.io/tx/0x706068b557f9b61a3780f357daf0f6b710d80db86fec72aaae003b4a8110af1d)
