// SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SpaceCoin is ERC20 {

    uint256 constant private ONE_SPC = 10 ** 18;
    uint256 constant private MAX_SPC_SUPPLY = 500000 * ONE_SPC;

    constructor(address _owner) ERC20("Space Coin", "SPC") {
        _mint(_owner, MAX_SPC_SUPPLY);
    }
}