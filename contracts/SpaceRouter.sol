//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.9;

import "./ILiquidityPool.sol";
import "./ISpaceRouter.sol";
import "./ISpaceCoinICO.sol";

contract SpaceRouter is ISpaceRouter {

    uint8 private constant TRADING_FEE_PERCENTAGE = 1;

    address private immutable SPC_ADDRESS;
    address private immutable LP_ADDRESS;
    bool private semaphore = true;
    ILiquidityPool liquidityPool;
    ISpaceCoinICO spaceCoinICO;

    constructor(address payable _liquidityPool, address payable _spaceCoinICO) {
        liquidityPool = ILiquidityPool(_liquidityPool);
        spaceCoinICO = ISpaceCoinICO(_spaceCoinICO);
        LP_ADDRESS = _liquidityPool;
        SPC_ADDRESS = _spaceCoinICO;
    }

    modifier isRunning() {
        require(semaphore, "LOCKED_FOR_EXECUTION");
        semaphore = false;
        _;
        semaphore = true;
    }

    function _sendEther(address payable _to, uint256 _value) private {
        if(_value > 0) {
            (bool _success, bytes memory _data) = _to.call{value: _value}("");
            require(_success && (_data.length == 0 || abi.decode(_data, (bool))), "ETH_TRANSFER_FAILED");
        }
    }

    function _quote(uint256 _amountA, uint256 _reserveA, uint256 _reserveB) private pure returns (uint256 _amountB) {
        require(_amountA > 0, "INSUFFICIENT_AMOUNT");
        require(_reserveA > 0 && _reserveB > 0, "INSUFFICIENT_LIQUIDITY");
        _amountB = (_amountA * _reserveB) / _reserveA;
    }

    function _getAmountOut(uint256 _amountIn, uint256 _reserveIn, uint256 _reserveOut) private pure 
    returns (uint256 _amountOut) {
        require(_amountIn > 0 && _reserveOut > 0, "INSUFFICIENT_LIQUIDITY");
        uint256 _netAmountIn = _amountIn * (100 - TRADING_FEE_PERCENTAGE);
        uint256 _numerator = _netAmountIn * _reserveOut;
        uint256 _denominator = (_reserveIn * 100) + _netAmountIn;
        _amountOut = _numerator / _denominator;

        /*  base formula without fee
            _amountOut = _reserveOut - (K / (_reserveIn + _amountIn))
            spc * eth = k
            _amountOut = eth - k/spc + 1
            x*y1 = k = x2*y2
        */
    }

    function deposit(uint256 _depositedSPC, address _to) 
    external payable override isRunning() returns (uint256 _netSPCIn, uint256 _netETHIn, uint256 _liquidityOut) {
        (uint256 _reserveSPC, uint256 _reserveETH) = liquidityPool.getReserves();

        // add liquidity for the first time
        if (_reserveSPC == 0 && _reserveETH == 0) {
            (_netSPCIn, _netETHIn) = (_depositedSPC, msg.value);
        } else {
            // calculate the actual ETH/ SPC in amount based on current reserve & deposited amount
            uint256 _calculatedETHIn = _quote(_depositedSPC, _reserveSPC, _reserveETH);
            
            if (_calculatedETHIn <= msg.value) {
                (_netSPCIn, _netETHIn) = (_depositedSPC, _calculatedETHIn);
            } else {
                uint256 _calculatedSPCIn = _quote(msg.value, _reserveETH, _reserveSPC);

                if (_calculatedSPCIn <= _depositedSPC) {
                    (_netSPCIn, _netETHIn) = (_calculatedSPCIn, msg.value);
                }
            }
        }
        
        // transfer the SPC to LP
        spaceCoinICO.transferFrom(msg.sender, LP_ADDRESS, _netSPCIn);

        // transfer the ETH to LP
        _sendEther(payable(LP_ADDRESS), _netETHIn);

        // send excess ETH back to the msg.sender
        if (_netETHIn < msg.value) {
            _sendEther(payable(msg.sender), (msg.value - _netETHIn));
        }

        _liquidityOut = liquidityPool.mint(_to);

        emit LiquidityAdded(msg.sender, _to, _netSPCIn, _netETHIn, _liquidityOut);
    }

    function withdraw(uint256 _liquidityIn, address _to) 
    external override isRunning() returns (uint256 _amountSPCOut, uint256 _amountETHOut) {
        require(_liquidityIn > 0, "INCORRECT_LIQUIDITY_VALUE");

        liquidityPool.transferFrom(msg.sender, LP_ADDRESS, _liquidityIn);

        (_amountSPCOut, _amountETHOut) = liquidityPool.burn(_to);

        emit LiquidityRemoved(msg.sender, _to, _amountSPCOut, _amountETHOut, _liquidityIn);
    }

    function swapSPCtoETH(uint256 _depositedSPC, uint256 _minExpectedETHOut, address _to) external override isRunning() {
        require(_depositedSPC > 0, "INVALID_SPC_AMOUNT");

        (uint256 _reserveSPC, uint256 _reserveETH) = liquidityPool.getReserves();

        uint256 _amountETHOut = _getAmountOut(_depositedSPC, _reserveSPC, _reserveETH);
        require(_amountETHOut > 0 && _amountETHOut >= _minExpectedETHOut, "BELOW_USER_DEFINED_LIMIT");

        spaceCoinICO.transferFrom(msg.sender, LP_ADDRESS, _depositedSPC);

        liquidityPool.swapSPCtoETH(_amountETHOut, _to);

        emit SwappedToken("SPC == > ETH",msg.sender, _to, _depositedSPC, _amountETHOut);
    }

    function swapETHtoSPC(uint256 _minExpectedSPCOut, address _to) external payable override isRunning() {
        require(msg.value > 0, "INVALID_ETH_AMOUNT");

        (uint256 _reserveSPC, uint256 _reserveETH) = liquidityPool.getReserves();

        uint256 _amountSPCOut = _getAmountOut(msg.value, _reserveETH, _reserveSPC);
        require(_amountSPCOut > 0 && _amountSPCOut >= _minExpectedSPCOut, "BELOW_USER_DEFINED_LIMIT");

        _sendEther(payable(LP_ADDRESS), msg.value);

        liquidityPool.swapETHtoSPC(_amountSPCOut, _to);

        emit SwappedToken("ETH == > SPC",msg.sender, _to, msg.value, _amountSPCOut);
    }

    function getEstimatedTradeVal(uint256 _amountIn, uint8 _expectedTokenID) external override returns (uint _amountOut) {
        (uint256 _reserveSPC, uint256 _reserveETH) = liquidityPool.getReserves();

        // 0 for SPC to ETH, else any positive number
        if(_expectedTokenID > 0) {
            _amountOut = _getAmountOut(_amountIn, _reserveETH, _reserveSPC);
        } else {
            _amountOut = _getAmountOut(_amountIn, _reserveSPC, _reserveETH);
        }

        emit EstimatedTradeValue(_amountIn, _amountOut, _expectedTokenID);
    }

    receive() external payable {
        revert("USE METHOD: DEPOSIT");
    }

    fallback() external payable {
        revert("USE METHOD: DEPOSIT");
    }
}