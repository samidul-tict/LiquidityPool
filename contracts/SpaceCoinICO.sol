//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "./SpaceCoin.sol";
import "./ISpaceCoinICO.sol";
import "hardhat/console.sol";

contract SpaceCoinICO is ISpaceCoinICO, SpaceCoin {

    uint256 constant private GOAL = 30000 ether;
    uint256 constant private SEED_GOAL = 15000 ether;
    uint256 constant private INDIV_SEED_LIMIT = 1500 ether;
    uint256 constant private INDIV_GENERAL_LIMIT = 1000 ether;
    uint8 constant private TAX_RATE_PERCENTAGE = 2;
    uint8 constant private SPC_PER_ETHER = 5;
    bytes4 private constant SELECTOR = bytes4(keccak256(bytes('transfer(address,uint256)')));

    address public owner;
    address payable public treasury;
    bool private semaphore = true;
    bool public canDeductTax = false;
    bool public pauseICO = false;
    uint256 public totalContribution;
    uint256 public currentICOBalance;
    Phase public currentPhase;

    // store the total contribution of each person
    mapping (address => uint256) totalInvestmentByUser;

    // maintain the whitelisted address
    mapping (address => bool) seedWhitelist;
    
    constructor(address payable _treasury, address[] memory _seedWhitelist) SpaceCoin(address(this)) {
        owner = msg.sender;
        treasury = _treasury;
        currentPhase = Phase.SEED;
        uint256 len = _seedWhitelist.length;

        for(uint256 i = 0; i < len; ++i) {
            seedWhitelist[_seedWhitelist[i]] = true;
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier isRunning() {
        require(semaphore, "LOCKED_FOR_EXECUTION");
        semaphore = false;
        _;
        semaphore = true;
    }

    // transfer SPC to user/ contract
    function _transfer(address _from, address _to, uint256 _amount) internal virtual override {
        console.log(_from);
        require(currentPhase == Phase.OPEN, "NOT_READY_TO_TRANSFER");
        require(balanceOf(_from) >= _amount, "NOT_ENOUGH_TOKEN");

        if(canDeductTax) {
            uint256 netTax = (_amount * TAX_RATE_PERCENTAGE) / 100;
            _amount -= netTax;
            super._transfer(_from, treasury, netTax);
            emit Transferred(_from, treasury, netTax);
        }
        super._transfer(_from, _to, _amount);
        emit Transferred(_from, _to, _amount);
    }

    // invest ETH to get SPC token
    function _investInSPC(address _from, uint256 _amount) internal {
        require(!pauseICO, "NOT_READY_FOR_SELL");
        
        uint256 _tokenRewarded = 0;
        totalInvestmentByUser[_from] += _amount;
        totalContribution += _amount;
        currentICOBalance = totalContribution;

        if(currentPhase == Phase.SEED) {
            require(seedWhitelist[_from], "NOT_WHITELISTED");
            require(totalInvestmentByUser[_from] <= INDIV_SEED_LIMIT, "SEED_CAP_REACHED");
            require(totalContribution <= SEED_GOAL, "SEED_GOAL_REACHED");
        } else if(currentPhase == Phase.GENERAL) {
            require(totalInvestmentByUser[_from] <= INDIV_GENERAL_LIMIT, "GENERAL_CAP_REACHED");
            require(totalContribution <= GOAL, "GOAL_REACHED");
        } else {
            require(totalContribution <= GOAL, "GOAL_REACHED");
            _tokenRewarded = claimToken(_from);
        }
        emit InvestedInSPC(_from, _amount, _tokenRewarded);
    }

    // claim token by investor
    function claimToken(address _owner) public returns(uint256 _availableToken) {
        require(currentPhase == Phase.OPEN, "NOT_READY_TO_CLAIM");
        require(totalInvestmentByUser[_owner] > 0, "NOT_ENOUGH_BALANCE");

        _availableToken = totalInvestmentByUser[_owner] * SPC_PER_ETHER;
        totalInvestmentByUser[_owner] = 0;
        _transfer(address(this), _owner, _availableToken);
        return _availableToken;
    }

    function withdrawFund(address _to) external override onlyOwner() isRunning() {
        require(currentICOBalance > 0 && currentPhase == Phase.OPEN, "CANNOT_BE_WITHDRAWN");
        
        uint256 _amount = currentICOBalance;
        currentICOBalance = 0;

        (bool _success, bytes memory _data) = address(this).call(abi.encodeWithSelector(SELECTOR, _to, _amount));
        require(_success && (_data.length == 0 || abi.decode(_data, (bool))), "WITHDRAWAL_FAILURE");

        emit FundWithdrawn(msg.sender, _to, _amount);
    }

    // toggle TAX deduction flag
    function toggleTaxFlag() external override onlyOwner() {
        canDeductTax = !canDeductTax;
        emit ToggleTaxFlag(msg.sender, canDeductTax);
    }

    // hold or resume ICO
    function toggleICOStatus() external override onlyOwner() {
        pauseICO = !pauseICO;
        emit ToggleICOStatus(msg.sender, pauseICO);
    }

    // function to change ICO phase by owner only
    function changeICOStage(uint8 _desiredPhase) external override onlyOwner() {
        require(uint8(currentPhase) != _desiredPhase, "ICO_IS_IN_SAME_PHASE_ONLY");
        require(currentPhase != Phase.OPEN, "NO_MORE_PHASE");
        Phase prevPhase = currentPhase;
        if(currentPhase == Phase.SEED) {
            currentPhase = Phase.GENERAL;
        } else if(currentPhase == Phase.GENERAL) {
            currentPhase = Phase.OPEN;
        }
        emit ChangeICOStage(msg.sender, prevPhase, currentPhase);
    }

    function investInSPC() external override payable {
        _investInSPC(msg.sender, msg.value);
    }

    receive() external payable {
        _investInSPC(msg.sender, msg.value);
    }

    fallback() external payable {
        _investInSPC(msg.sender, msg.value);
    }
}