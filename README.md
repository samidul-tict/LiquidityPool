# Please ignore Lock.sol & Lock.ts. These are sample files.

# Design Exercises

How would you extend your LP contract to award additional rewards – say, a separate ERC-20 token – to further incentivize liquidity providers to deposit into your pool?

# Answer:

Beside the pool specific LP token we can provide a generic token to all the liquidity providers based on their percentage of shares in a specific pool. We can add a logic to stop providers spending these tokens before a given time period. In that way we can make sure that liquidity providers are keeping their tokens in the pool for maximum amount of time. If any users spends the token before the specific time then system will apply some extra fee during withdrawal of the liquidity.

This newly generated token can be funded in the following ways:
1. If anyone is buying the token then we can use a percentage or full of that value.
2. If users are borrowing money from any pool then we can use the APY to fund this token.
3. Beside the trading fee if system is charging any extra fee, that money can be used to fund this token. If trading fee is high we can use a fraction of it also.

