//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.9;

interface ISpaceRouter {

    event EstimatedTradeValue(uint256 _amountIn, uint256 _amountOut, uint8 _expectedTokenID);
    event LiquidityAdded(
        address indexed _sender,
        address indexed _liquidityProvider,
        uint256 _amountSPCIn,
        uint256 _amountETHIn,
        uint256 _liquidityOut
    );
    event LiquidityRemoved(
        address indexed _sender,
        address indexed _liquidityBurner,
        uint256 _amountSPCOut,
        uint256 _amountETHOut,
        uint256 _liquidityIn
    );
    event SwappedToken(
        string indexed _action,
        address indexed _tokenSwapper,
        address indexed _recepient,
        uint256 _depositedAmount,
        uint256 _amountOut
    );

    function deposit(uint256 _depositedSPC, address _to) external payable 
        returns (uint256 _amountSPC, uint256 _amountETH, uint256 _liquidity);
    function withdraw(uint256 _liquidity, address _to) external returns (uint256 _amountSPC, uint256 _amountETH);
    function swapSPCtoETH(uint256 _depositedSPC, uint256 _minETHAmount, address _to) external;
    function swapETHtoSPC(uint256 _minSPCAmount, address _to) external payable;
    function getEstimatedTradeVal(uint256 _amountIn, uint8 _expectedTokenID) external returns (uint _amountOut);
}