# Audits

To keep the crops secure, you must farm in fences. The Harvest operations budget (10% of supply) will be used to ensure that Harvest farming strategies are audited and secure.

### PeckShield Audit

> We acquired an audit from PeckShield which should assure our farmers that their crops are safe and bread for the people will be produced, no matter what the future brings. The main issue pointed out by PeckShield is the privileged role of our 0xf00d deployer address. Based on the discussion with our community, we have implemented timelock mechanisms that provide the farmers with an opportunity to leave the farm if they disagree with the deployer's actions before these actions are executed. An additional issue related to CRVStrategyStable's depositArbCheck() was pointed out by our wonderful community and was already fixed before the report by PeckShield was completed. Other non-informational issues do not affect the system, or are explicit design choices and decentralization features made by our team. We would like to thank PeckShield for their hard work on this audit and keeping our farmers safe.
>
> [PeckShield Audit](https://github.com/harvestfi/audits/blob/main/PeckShield-Harvest.pdf)

> On September 7th 2020, PeckShield indicated that no serious business logic issues had been found in a preliminary review:
> [PeckShield Inc. @peckshield (2020-09-07)](https://twitter.com/peckshield/status/1303012731197382656)
> Last few days PeckShield has done a sanity check of Harvest Finance smart contracts, so far no serious business logic issue was found. In the next several weeks, we will conduct a full security audit of the smart contracts. [@harvest\_finance](https://twitter.com/harvest_finance) #DeFiFarming

### Haechi Labs

> We acquired an audit from Haechi which should assure our farmers that their crops are safe and bread for the people will be produced, no matter what the future brings. The audit highlighted one issue classified as major (initially pointed out by the community, thus it is already fixed), and 5 additional minor issues, 4 of which are in fact decentralization features and design choices that we actively made for our platform. The one remaining minor issue was fixed as well. We would like to thank Haechi for their hard work on this audit and keeping our farmers safe.
>
> [Haechi Labs Audit](https://github.com/harvestfi/audits/blob/main/Haechi-Harvest.pdf)

> Preliminary results from 14th of September 2020: Thanks to Harvest.Finance developer’s hard work, we could not identify any serious bug in smart contracts. We were able to find that Harvest.Finance development team had put a lot of effort into testing the smart contracts. Including external contract tests which were very helpful while reviewing the contracts.
> As a result, what we could find was minor issues including missing interface files which do not affect the security of the business logic. [LINK to the original post](https://medium.com/haechi-audit/harvest-finance-security-review-64782c98d2ae)

[haechi.io](https://haechi.io/) is a Korean security company that has performed audits for LG, Samsung, Carry Protocol, and the Ethereum Foundation.

### Certik Audit

An audit from [Certik](https://twitter.com/certik_io) has also been commissioned. The Certik audit started on September 16 and ended on October 2, 2020. No critical issues were found.

> [Certik Audit](https://github.com/harvest-finance/harvest/blob/master/audits/CertiK-Harvest.pdf)

### Least Authority

An audit from [Least Authority](https://twitter.com/LeastAuthority?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Eauthor) has also been commissioned. The Least Authority audit started on November 30, 2020 (a month after the Flash Loan incident) and ended on February 17, 2021. The audit identified several areas for improvement, and no unresolved critical issues directly affecting the current production environment were found, as the vulnerable strategies were discontinued or mitigated.

> [Least Authority](https://github.com/harvest-finance/harvest/blob/master/audits/LeastAuthority-Harvest.pdf)

### Halborn

[Halborn](https://x.com/HalbornSecurity/status/1907115747056193869) conducted a security audit of Harvest Finance’s smart contracts on Base. The audit, completed in January 2025, focused on identifying vulnerabilities and enhancing the protocol’s security. Halborn’s assessment involved manual code reviews and automated testing, uncovering minor issues that were addressed to strengthen the system. No critical vulnerabilities impacting the production environment were reported, and recommendations provided by Halborn were implemented to improve the robustness of Harvest Finance’s smart contracts.

> [Halborn](https://github.com/harvestfi/audits/blob/main/Halborn-Harvest-2025.pdf)
