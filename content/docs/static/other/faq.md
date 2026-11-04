# FAQ

**What is an underlying token?**

An underlying token is essential for a farm's strategy and serves as the base asset, ranging from basic tokens like ETH to complex LP tokens such as aerodrome\_DOLA\_USDC. It's the default token within the app for actions like conversions and reversions. All yields in Harvest farms are expressed in this token.<br>

**What is converting tokens all about?**

Converting involves exchanging your tokens for Harvest's fTokens, which are interest-bearing tokens representing your entitlement to the initial funds plus any generated yield. Converting your cryptocurrency into fTokens is the first step in beginning farming, enabling Harvest to compound your yield automatically into more underlying tokens than you started with. Upon conversion, your funds are integrated into the farm’s yield strategy, and the fToken acts as proof, allowing you to revert to your original funds along with the accumulated yield at any time. These tokens can be transferred freely.<br>

**What is fToken?**

A fToken is a special token within Harvest representing an interest-bearing receipt for both your tokens  and the generated yield. Over time, the value of fTokens (e.g. fETH) increases relative to the underlying token (e.g. ETH). However, the quantity of fTokens remains constant unless further conversions are made or reverts occur.<br>

**Do I need to stake fToken?**

Staking fTokens is an optional activity that enables you to earn extra token rewards, where available. These rewards are not automatically compounded but can be claimed anytime. Staking is done through the Rewards tab present on all farm pages, and it's advisable to check the APY details under **the Details tab for potential rewards of specific farms.**<br>

**What happens to my crypto after converting them into fTokens?**

Upon conversion, your crypto is managed by the vault's smart contract, which then engages with the underlying protocol to partake in yield-generating activities on underlying protocols such as lending, staking, or providing liquidity. Details of the utilized farming strategy can be found under the farm's Details tab in the Source of Yield section. You can revert your fTokens back to the original or another supported token anytime.

**How are staking rewards calculated?**

When you stake your assets on Harvest, you begin earning rewards, which can originate either from projects seeking to incentivize liquidity through Harvest or directly from Harvest via FARM or iFARM tokens. For a detailed breakdown of your APY and to understand the reward portion, refer to the Details section of each farm. Note that not all farms receive rewards.

**Can I claim rewards partially from a farm?**

You can claim your rewards whenever and how often you’d like, but you can only claim your rewards from a farm all at once and not partially. Please note that rewards will also be claimed when you revert your fTokens back.

**Can I claim rewards from all farms at once?**

No, you cannot simultaneously claim rewards from multiple farms.<br>

**How does the Lifetime Earnings box work?**

The Lifetime Earnings feature, accessible on each farm's page, tallies the net change in underlying tokens from all harvest activities listed under the History section. For instance, if your initial token amount was 5 ETH in an underlying token and over a few days, through several auto-compounding events, this amount grows to 5.3 ETH, the Lifetime Earnings will show a profit of 0.3 ETH. This profit is also converted into its current USD value, though this amount can fluctuate due to market conditions. This tool summarizes your farming yields over time, factoring in the growth of your underlying token balance and the real-time value of these earnings in USD.

**Why does the APY of a farm fluctuate, and where can I find detailed insights and historical data on its performance?**

A farm's APY (Annual Percentage Yield) naturally fluctuates due to various factors. Governance decisions by the platform can alter operational parameters, affecting APY. Price variations in incentive tokens, like FARM/iFARM, also play a role. Additionally, significant shifts in Total Value Locked (TVL) can dilute rewards, lowering APY, while the market volume of farmed Liquidity Provider (LP) assets influences APY, as higher volumes capture more fees. These elements collectively reflect the dynamic nature of decentralized finance (DeFi) ecosystems, leading to the inherent variability of APY. For insights into APY fluctuations and to review the historical performance of a farm, you can refer to the farm's Details tab.<br>

**Why have my yield estimates decreased since I started farming on Harvest?**

Yield estimates in farming may vary due to several factors, primarily due to the price fluctuations of underlying tokens. Tokens like ETH or WBTC, often comprising the underlying assets, are known for their volatility. Understanding that yield estimates are intended as rough guides rather than precise predictions is crucial.

**How do I revert my funds or stop farming?**

Go to the "Manage" tab and select "Revert."

Enter the number of fTokens you wish to revert and select the token you want to receive as the output. Although the default choice is the token used in the farming strategy (the underlying token), you have the flexibility to select from various tokens, such as USDC or ETH.

**How do I start to yield farming?**

To begin yield farming, you only need a small amount of tokens in your wallet to handle transactions and gas fees; even $5 in USDC or ETH is sufficient. For newcomers to yield farming, head to the "Beginners" section accessible from the side menu, where you'll find a specially selected farm ideal for beginners. To understand how to engage your funds in yield farming, please refer to the "Tutorial" link at the bottom of the side menu. This guide provides step-by-step instructions to help you navigate the process smoothly.

**Why do I need to approve the token when converting and reverting?**

Approving tokens is a crucial step for you so that Harvest can transform your crypto of choice into fTokens. This process involves a quick approval in your wallet, which incurs a modest fee for the network, commonly known as a gas fee.

**Why do I need to confirm the transaction?**

Confirming transactions is essential for any action on Harvest, including converting or reverting tokens. This confirmation ensures you maintain full control over your tokens and their use. It's important to note that performing any transaction on the blockchain requires a network fee.

**When converting, why is the number of fTokens lower than my input token?**

The number of received fTokens being lower than your initial converted amount is due to increased fToken value over time. For example, if you're the first to join a new ETH farm strategy with a 10% Annual Percentage Yield (APY), initially, 1 fETH equals 1 ETH. The strategy compounds yield as time passes, making your 1 fETH worth 1.10 ETH after a year. If you decide to join the pool with 1 ETH one year after the farm started, you'll receive 0.909 fETH. This adjustment occurs because the value of 1 fETH has grown to be equivalent to 1.10 ETH, reflecting the accumulated yield over the year.

**What is “the last harvest”?**

"The last harvest" indicates the most recent time the underlying balance of farmers in this farm experienced an increase due to the auto-compounding of earned rewards. This event benefits all farm participants and can be traced by the date in the Details tab. For insights into how such events influenced other farmers on a farm in the past, the sharePrice chart available in the same tab offers a deeper understanding.

**What do TVL and APY mean?**

TVL (Total Value Locked): This represents the total value of all tokens converted in a farm, measured in USD. APY (Annual Percentage Yield): APY shows the yield rate earned by farming over a year, including compound yield. While it reflects the current rate of return, it should not be seen as a guarantee but rather as an estimate. For a more accurate understanding, it's recommended that you review the APY performance chart available under the farm's "Details" tab.

**Why am I not earning the full displayed APY?**

The APY values shown on Harvest are estimates based on the current value of underlying and reward tokens. They are meant to be rough guides and not exact figures. Fluctuations in the market may cause the estimated APY to be exceeded or not met, but this is beyond Harvest's control. If you think you’ll need further assistance, please contact Harvest’s moderation team on Discord.

**What are the fees on Harvest?**

Harvest doesn't charge you when you convert or revert assets. Instead, there's a small performance fee on the yield you earn. This means your original funds are never touched. This performance fee is included in the APY (Annual Percentage Yield) you see on Harvest. This makes it easy to see exactly what your earnings could be, with no hidden surprises. The fees help pay for Harvest's operational costs and reward FARM token holders through our Communal Harevst pool.

**What is Communal Harvesting on Harvest?**

Communal Harvest is a special farm on Harvest where you can convert FARM and in exchange, you get iFARM tokens. These iFARM tokens entitle you to a share of the yield from all Harvest farming strategies. This means you benefit from the success of various strategies, all by holding iFARM.

**Why Are Gas Fees for Converting and Reverting So High?**

You're subject to network fees when you interact with Harvest farms by converting or reverting assets. These fees can spike due to high network congestion, making transactions more expensive temporarily. To avoid high fees, you might want to try transacting during off-peak times – for example, Sundays typically see lower network activity. Also, if your ETH balance is low, your gas fee estimate might not be accurate; topping up your wallet could help. Remember, initial gas fee estimates can sometimes be double your actual cost.

**Exploring FARM, iFARM, and bFARM Tokens**

FARM: This is the cornerstone token of Harvest, acting as a cash flow mechanism. It can be traded on various centralized and decentralized exchanges and is accessible on both the Ethereum and Base blockchains.

iFARM: Upgraded from FARM, iFARM is an interest-bearing token of Harvest, offering an enhanced way to earn a share of the platform's fees. Unlike FARM, which requires staking on the platform for fee entitlements, holding iFARM directly in your wallet qualifies you for yield earnings. This makes iFARM a convenient option for passive income from Harvest's operations.

bFARM: This token represents FARM bridged to the Binance Smart Chain (BSC), facilitated by the Multichain bridge system. However, due to the cessation of Multichain operations, bFARM cannot return to the Ethereum network. If you possess bFARM and seek assistance, contacting Harvest Discord's moderation team is recommended for support and guidance.

**Why I cannot swap/trade/sell bFARM (FARM on BSC) on DEXs or CEXs (like Binance, Coinbase, MEXC, Kraken…)?**

Due to the cessation of Multichain operations, bFARM cannot return to the Ethereum network and for this reason exchanges have stopped supporting them. If you hold bFARM please contact Harvest Discord's moderation team for support and guidance

**What is the road map for Harvest?**

The long-term goal for Harvest is to become DeFi's go-to place for all yield farmers—big or small—by offering a clean and intuitive interface to manage funds easily. Harvest is a decentralized cooperative shaped by dozens of users who believe in better, decentralized finance. Given the pace at which DeFi develops, Harvest does not have a detailed roadmap to shift the course rapidly when needed.

**Who is behind Harvest?**

The team behind Harvest Finance values privacy and operates anonymously, similar to the approach of Satoshi Nakamoto, the creator of Bitcoin.

**Is Harvest audited?**

Yes, reputable firms such as PeckShield, Haechi, Certik, and Least Authority have thoroughly audited Harvest's smart contracts. We prioritize security by incorporating audited components wherever possible. For details on these audits, please visit our GitHub page here. We're grateful to the auditors for their diligence and expertise.

**Can I review Harvest's code?**

Absolutely. Harvest's smart contracts are open-source and available for anyone to review on our GitHub repository. This transparency is part of our commitment to security and community trust.

**What if I can't find a farm I participated in?**

Harvest occasionally retires farms, moving them to our "Inactive" section. If you're looking for a farm that's no longer active, try using the Inactive filter in the Advanced section of our platform. For farms on the Binance Smart Chain (BSC) or others you cannot locate, our old website is at old.harvest.finance might have what you're looking for. For further assistance, our Discord community is always ready to help. Head to the #support channel or open a ticket for private assistance. Please be cautious on Discord; our official moderators will never DM you first, ask for your secret key, or direct you to another server.

**Need Help or Have Suggestions?**

Contacting Support: For direct assistance or to speak with someone, please join us on Discord. Navigate to the #support channel to ask questions or open a ticket for private discussions. Always be cautious; our official moderators will never directly message you first, request your secret key, or guide you to another server.

Sharing Ideas or Suggestions: If you have a new idea for a farm, strategy, or feedback for our app and website, we welcome your input! Share your thoughts in the #farming-strategies channel on our Discord server. Remember, safety first—our real moderators won't DM you first or ask for sensitive information.

Proposing Collaborations: Interested in collaborating with Harvest? Join us on Discord and share your proposal in the #defi-collaborations channel, tailored to the nature of your collaboration. Vigilance on Discord is key, as impersonators can be a risk. Our moderators won’t initiate DMs or request your private keys.

Joining Our Team: Looking to work with Harvest? We’re always on the lookout for passionate individuals. Depending on your skills, post a message on our Discord's relevant channel, like #dev for developers. As always, be alert to the risk of impersonation on Discord.

Unstaking Issues: If you're having trouble unstaking your crypto, check if the tokens were staked from another wallet. Tokens must be in the original wallet used for staking to successfully complete the unstaking process.

Token Value and Farming Resources: Wondering about your fTokens' worth? Check the Manage tab on your farm's page for real-time balance or USD value. Ready to start farming? The Details tab provides a Source of Yield section with \[Add Liquidity] instructions and resources for obtaining necessary tokens.

**Security and Usage Guidelines**

Safety of Funds: While Harvest undergoes regular audits by firms like PeckShield, Certik, and others, the inherent risks in DeFi strategies could lead to asset loss if an exploit occurs. It's crucial to research and understand each farm's strategy.

Who Can Use Harvest: Regulatory uncertainties mean Harvest Finance may not be accessible to individuals or entities in the United States or other restricted areas. By using Harvest, users acknowledge the experimental nature of DeFi farming and accept all associated risks.

**Understanding Trends, LSD, and DeSci**
Harvest highlights trending DeFi narratives and innovations, such as Liquid Staking Derivatives (LSD) and decentralized science (DeSci), offering users insights into evolving sectors of web3 and DeFi.

DeSci is a term used to define those platforms as part of the new web3 movement that aims to decentralize science.<br>

**Understanding Key Concepts on Harvest**<br>

**What is a Stablecoin?**

A stablecoin is a type of cryptocurrency designed to maintain a stable value, typically pegged to assets like the US dollar, commodities, or other cryptocurrencies. This stability offers an attractive alternative for those looking to avoid the volatility of traditional cryptocurrencies, making stablecoins a practical choice for transactions and savings.<br>

**Bridging Tokens Between Chains**

Bridges are available for transferring tokens between different blockchain networks. These platforms facilitate the movement of tokens from one chain to another. It's recommended to start with official bridges for networks like Polygon, Arbitrum, and Base due to their reliability. Should you need alternatives, carefully evaluate other bridges to find one that suits your needs.<br>

**Accuracy and Nature of APY Values**

At Harvest, the Annual Percentage Yield (APY) values are derived directly from the returns of underlying yield platforms, providing a real-time snapshot of potential earnings. However, it's important to view these APYs as guides rather than precise figures, as they reflect the current rates that fluctuate based on market conditions and platform performance.<br>

**What is a HODL Farm?**

A HODL farm is a special strategy on Harvest where rewards are not turned into more underlying, but put into a dedicated farm for this reward for auto-compounding. This method is beneficial if you anticipate an increase in the reward token's value, aiming to maximize long-term gains.

**I want to participate in one of the Camelot farms but I have a spNFT. What can I do?**

**Troubleshooting Visibility Issues**

If you face difficulties seeing your positions or tokens on Harvest, a forceful page refresh (Ctrl+F5) might resolve the issue. Should your farm be listed as inactive, apply the Inactive filter under the Advanced section for better clarity. For farms on Binance Smart Chain (BSC) or elsewhere and are now missing, check our old website (old.harvest.finance) for information. For additional support, join our Discord community. Whether you post in #support or open a private ticket, our team is ready to assist. Be cautious of security; official Harvest support will never directly message you asking for private keys or suggest moving to another server.

**Where can I trade FARM/iFARM?**

FARM can be traded on centralized exchanges (CEXs) such as Coinbase, Binance, Crypto.com, MEXC, Gate.io, Kraken, Latoken, Bitrue, CoinEx, and Uphold, among others. It's also available on decentralized exchanges (DEXs) like Uniswap.

iFARM is available for trading on DEXs including Uniswap, Quickswap, and Camelot.

**What happens to my rewards if I unstake from an inactive farm?**

If you unstake from a farm, your rewards are automatically claimed. If you don't see them in your wallet, you might need to manually add the token addresses to view them.

**Do the displayed APY values include additional rewards?**

Yes, the APYs shown account for the compounded yield and any additional reward tokens unless stated otherwise.

**How does Harvest generate high APY?**

Harvest can offer higher APYs for a few reasons: additional rewards in the form of FARM/iFARM or other tokens, and the use of strategies like "folding" where assets are lent and borrowed multiple times to maximize yield.

**Why does the USD value of my stablecoins differ from the graph?**

Stablecoins can slightly deviate from their pegged value, often by about 0.5% due to market fluctuations. While a small variance might not seem significant, it can be more noticeable with larger amounts. The USD value provided is for reference to give you an idea of your token's value, but the quantity of your underlying tokens is what's most important.

**Staked FARM Not Visible on Harvest 4?**

If you staked FARM using the legacy method back in 2021 and it's not visible on the current Harvest interface, it's likely still accessible via the older version of our platform. Please visit old.harvest.finance for access. For additional support, connect with us on Discord in the #support channel or by opening a ticket for a private discussion. Our community's safety is paramount, so genuine Harvest moderators will never initiate contact for sensitive information or direct you to external servers.

**Retrieving Tokens from BSC:**

Harvest 4 no longer supports Binance Smart Chain (BSC). To manage or retrieve tokens previously engaged on BSC, utilize the older interface at old.harvest.finance, applying the "Inactive" filter to locate your farm. If you encounter challenges or need further assistance, our Discord community is ready to help. Reach out in the #support channel or submit a ticket for personal assistance, staying alert to impersonation attempts.

**Understanding Estimated Yield:**

Displayed APYs on Harvest include the auto-compounded yield and additional rewards unless stated otherwise. This ensures you have a comprehensive view of potential earnings from your farming.

**Token Value Visibility Issues:**

Some wallets might not automatically display the current value of your FARM/iFARM tokens. If this occurs, a decentralized exchange (DEX) aggregator like swap.defillama.com can provide real-time value estimations, allowing for informed decisions on swapping or trading your tokens.

**Unstaking from Inactive or Unlisted Farms:**

To unstake from farms that are no longer visible on the current Harvest interface, utilize the "Inactive" filter in the Advanced section of our older UI at old.harvest.finance. Our Discord server is a supportive space for guidance for any hurdles or queries. Reach out in #support or open a private ticket, and remember to practice caution, as the official Harvest team will never solicit your private keys or redirect you off-platform.

These steps and precautions are designed to help navigate the Harvest ecosystem safely and effectively, ensuring your DeFi farming journey is as fruitful as possible.

**Why is my Underlying tokens declining on the chart?**

If you notice your underlying tokens decreasing on the chart, it's likely due to participation in a folding strategy. These strategies inherently result in minor and temporary fluctuations in your converted  value. To better understand these fluctuations and the strategy's overall mechanics, the "Details" tab offers a sharePrice chart that illustrates trends over an extended period, helping clarify the reasons behind these changes. In the longer timeframe, these fluctuations are followed by an overall increase in underlying tokens.

**Why my APY is low?**

If a user asks about APY or TVL or any details of a specific farm, such as Lodestar, Moonwell, Aerodrome, Aave, respond with generic questions pertaining to these keywords as stated above.

\ <br>
