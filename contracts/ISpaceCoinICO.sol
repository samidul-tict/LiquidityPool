//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISpaceCoinICO is IERC20 {
    enum Phase {SEED, GENERAL, OPEN}

    event ToggleICOStatus(address indexed _owner, bool indexed _pauseICO);
    event ToggleTaxFlag(address indexed _owner, bool indexed _canDeductTax);
    event Transferred(address indexed _sender, address indexed _receiver, uint256 indexed _token);
    event FundWithdrawn(address indexed _sender, address indexed _receiver, uint256 indexed _amount);
    event ChangeICOStage(address indexed _owner, Phase indexed _prevPhase, Phase indexed _currentPhase);
    event InvestedInSPC(address indexed _investor, uint256 indexed _amount, uint256 indexed _tokenRewarded);

    function withdrawFund(address _to) external;

    // toggle TAX deduction flag
    function toggleTaxFlag() external;

    // hold or resume ICO
    function toggleICOStatus() external;

    // function to change ICO phase by owner only
    function changeICOStage(uint8 _desiredPhase) external;

    function investInSPC() external payable;
}