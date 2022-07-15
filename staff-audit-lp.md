https://github.com/0xMacro/student.samidul-tict/tree/183a2526587db414574150d89e63719b6a144f0b/lp

Audited By: brianwatroba

# General Comments

Great effort. This is by far the most difficult project of the fellowship (which is why we allow more time). But I also think it has the most to teach us. Liquidity pools are truly innovative and fascinating! You made a really good effort to implement all the requirements of the spec and think through the systems design yourself. I can tell you used Uniswap as a guide, but took the time to pare down the implementation to fit this project. That's a sign that you really absorbed how liquidity pools work, but more importantly, how to build a liquidity pool that fits a specific limited feature set. Awesome!

You anticipated most of the "gotchas" in this type of project, which is great! For instance: you guarded against reentrancy in key spots, implement the core separation of concerns between the Router and the Pair contracts, and calculated max slippage in a correct and user friendly way.

One thing I especially liked: you saved the `currentK` as a storage variable, and in your LiquidityPool.sol swap functions create a local variable of `_kAfterSwap` and compare those to enforce the constant product formula. The constant product is one of the harder to grasp (and implement) concepts of this project, and this approach made your calculations very readable and easy to follow.

Excellent test coverage. You are very thorough to test both "sad" and "happy" paths, as well as all expected revert behavior. This definitely contributes to lower scores and helps you catch the outlier instances.

I've mentioned a few vulnerbalities and technical mistakes below, but I've also included a few stylistic recommendations that are hopefully helpful as you continue your journey as a Solidity engineer.

Overall: great work, and I hope you enjoyed this project. Any follow up questions, feel free to message me directly on Discord.

# Design Exercise

This is an interesting idea, I like it. As we've seen with some real world liquidity pools, providing additional incentive is key to attracting new liquidity and fostering community/reward amongst LPs. This is partly why Uniswap released their governance token, and how Sushi Swap gained users early on. It's also interesting to provide a further incentive to _keep_ users' liquidity in the pool via a separate reward token.

_To think about_

What utility would the secondary token have? Where does its value come from to create demand for buying and selling it? Uniswap did something similar to your idea (minus the lock up time period), but the utility of their token was to provide voting power on protocol proposals.

# Issues

**[M-1]** Fees are not enforced if LiquidityPool is called directly

In your SpaceRouter.sol contract both of your swap functions (`swapSPCtoETH()` and `swapETHtoSPC()`) call your Router's `_getAmountOut()` function to calculate the amount they'd like to receive back from a given swap. These swap functions then call the corresponding swap functions on the LiquidityPool contract, passing in the `_amountOut`.

If this flow is followed, and swaps always originate from the Router contract, the tax will be collected because a user is sending in a given amount and requesting back an `amount - fee` (which is calculated in the Router). This doesn't violate the constant product formula, so the swap works as intended.

However, if I were to call the LiquidityPool contract directly and request an amountOut based on what I sent in _with no fee levied_, there is no check in the LiquidityPool contract that a fee has been taken. Those values would not violate the constant product formula, and I'd get my swap without having to pay a fee.

Uniswap separates the Router and Pair contracts to have a separation of concerns. The Pair is meant to enforce the core swap logic and constaints (constant product formula, and tax), and is designed to be able to be called directly, so it doesn't have to trust the Router. The Router is meant to provide some safety checks on inputs to make things easier/safer for users. In this case, your LiquidityPool contract is trusting that Router calculated the fee and subsequent amountOut correctly.

Consider enforcing the fee in your LiquidityPool's swap functions to protect against fee evasion.

**[Technical Mistake]** Router’s `deposit` function does not account for feeOnTransfer tokens such as SPC

You calculate optimal `_netSPCIn` using `_quote` based on the current reserve ratio of the pool.
You transfer `_netSPCIn` and `_netETHIn` and call `mint` Now, if tax is on for SpaceToken then the amount received on the pool contract is less than what you had calculated in `_quote`. The pool contract will calculate LP shares to be minted based on this lesser amount and as we take minimum you get shares as per this decreased amount, losing the equivalent portion of ETH transferred.

Consider checking for the tax and subtracting away 2% from the SPC the pool receive when calculating the correct amount of SPC to add.

**[Extra Feature-1]** unused functions: sync() and getEstimatedTradeValue()

Both your `sync()` and `getEstimatedTradeValue()` are never called within your core contracts.

I noticed the `getEstimatedTradeValue()` function is called within your tests. In this case, you can consider writing a custom function within your test suite that serves the same purpose, and that you don't have to put into your production contracts.

Consider removing or implementing your `sync()` and `getEstimatedTradeValue()` functions.

**[Extra Feature-2]** Redundant reentrancy guards

You include a reentrancy guards in both your LiquidityPool (`lock()`) and your SpaceRouter (`isRunning()`) contracts. You include guards on all of the functions that have any external calls: LiquidityPool: `mint()`, `burn()`, `swapSPCtoETH()`, and `swapETHtoSPC()` (as well as `sync()`, which is never called). SpaceRouter: `deposit()`, `withdraw()`, `swapSPCtoETH()`, and `swapETHtoSPC()`.

Reentrancy is a very serious vulnerability, especially when you're dealing with tokens/ETH, so this is great intuition.

However, in many of these cases, a reentrancy guard isn't needed. Reentrancy adds additional gas overhead to your protocol's function calls, and it's important to understand exactly when it's needed and when it isn't.

Whenever you make external calls that send eth (example: a `.call()`) and you don't implement the checks effects interaction pattern, a re-entrancy guard is needed. We don't know where the ETH is being sent to, and what it might trigger on receipt, so there is a risk for reentrancy. This means you do need a guard on the following functions: LiquidityPool: `burn()` and `swapSPCtoEth()`.

For LiquidityPool: `mint()` and `swapETHtoSPC()`, you are only ever calling out to SpaceToken.sol, which you wrote and know does not have a re entrancy risk. You're trusting yourself that you wrote both contracts to always update state before making any other external calls. For this reason, you _do not_ need a reentrancy guard on the `mint()` and `swapETHtoSPC()` functions.

If you look at Uniswap's code, they do include reentrancy guards on all of their mint, burn, and swap functions in their Pair contract. The reason: their code must work for any arbitrary ERC-20 that someone creates a pool for. Uniswap can't vouch for the transfer() and transferFrom() functions in any new coin that creates a pool. This was actually an issue in Uniswap V1: https://medium.com/amber-group/preventing-re-entrancy-attacks-lessons-from-history-c2d96480fac3.

You also do not need reentrancy guards on your Router's functions, since those are only ever calling your LiquidityPool functions. And since we have already established which of the LiquidityPool functions should have guards, you're set.

Consider removing reentrancy guards from the following functions: LiquidityPool: `mint()`, `swapETHtoSPC()`; SpaceRouter: `deposit()`, `withdraw()`, `swapSPCtoETH()`, and `swapETHtoSPC()`.

**[Q-1]** Single swap function in LiquidityPool contract

Currently you two have two functions to handle two separate swap scenarios: SPC to ETH, and ETH to SPC. This is totally functional and works great.

However, there is a fair amount of duplicated code between both functions, and there is a possibility to combine them into a singluar `swap()` function. You could include three parameters: `tokenOut`, `ethOut`, and `to`. Whenever you're not requesting either tokenOut or ethOut, that value can be zero.

Here is an example of code that combines both functions if you're interested!

```Solidity
/// @dev Trade between SPC/ETH, amounts must observe constant product formula
  function swap(
    uint256 _tokenOut,
    uint256 _ethOut,
    address _to
  ) external lock {
    require(_tokenOut > 0 || _ethOut > 0, "Pair: INSUFFICIENT_OUTPUT_AMOUNT");
    require(_tokenOut < tokenReserves && _ethOut < ethReserves, "Pair: INSUFFICIENT_RESERVES");
    if (_tokenOut > 0) ISpaceToken(spaceToken).transfer(_to, _tokenOut); // optimistically transfer
    if (_ethOut > 0) {
      (bool success, ) = _to.call{ value: _ethOut }(""); // optimistically transfer
      require(success, "Pair: FAILED_TO_SEND_ETH");
    }
    (uint256 tokenBalance, uint256 ethBalance) = _getBalances();
    uint256 tokenIn = tokenBalance > tokenReserves - _tokenOut ? tokenBalance - (tokenReserves - _tokenOut) : 0;
    uint256 ethIn = ethBalance > ethReserves - _ethOut ? ethBalance - (ethReserves - _ethOut) : 0;
    require(tokenIn > 0 || ethIn > 0, "Pair: INSUFFICIENT_OUTPUT_AMOUNT");
    uint256 tokenBalanceAdjusted = (tokenBalance * 100) - (tokenIn * 1);
    uint256 ethBalanceAdjusted = (ethBalance * 100) - (ethIn * 1);
    require(
      tokenBalanceAdjusted * ethBalanceAdjusted >= tokenReserves * ethReserves * 100**2,
      "Pair: INCORRECT_K_VALUE"
    );
    _updateReserves();
    emit Swap(msg.sender, tokenIn, ethIn, _tokenOut, _ethOut, _to);
  }
```

Consider combining your LiquidityPool's `swapSPCtoETH()` and `swapETHtoSPC()` functions into a single swap function.

# Nitpicks

- It may be helpful to include the contract's name in your error messages to know where the error is throwing from. For instance: `Project.sol: ONLY_CALLABLE_BY_CREATOR`
- Great intuition in minting a minimum liquidity for a new pool. Uniswap does this as well. That said, Uniswap does this to prevent the value of a single unit of LP token becoming so valuable it becomes prohibitively expensive to interact with the protocol. We do not need this for and ETH-SPC pool, because ETH, SPC, and the LP Token (assuming it inherits from OZ’s ERC20) all use 18 decimals and so the value of a single unit of either asset will be infinitesimally small.
- Great work implementing interfaces!

# Score

| Reason                     | Score |
| -------------------------- | ----- |
| Late                       | -     |
| Unfinished features        | -     |
| Extra features             | 3     |
| Vulnerability              | 2     |
| Unanswered design exercise | -     |
| Insufficient tests         | -     |
| Technical mistake          | 1     |

Total: 6

Good job!