// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IRewardToken{
    function transfer(address, uint256) external returns(bool);
}

contract Farm is AccessControl {
    mapping(address => uint256) public addressToDepositedAmount;
    mapping(address => uint256) public addressToReward;

    uint256 public tvl; // Total value locked
    address[] public arrayWithStakers;
    uint256 public constant limitOfTokenReward = 1000000000000000000000; //1_000
    uint256 public constant rewardPerPerdiod = 10000000000000000000; //10
    uint256 public mintedReward = 0;

    bytes32 public constant REWARD_ROLE = keccak256("REWARD_ROLE");

    IRewardToken public rewardToken;

    constructor(address rewardTokenAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        rewardToken = IRewardToken(rewardTokenAddress);
    }

    function deposit() public payable {
        require(msg.value >= 100000000000000000, "Minimal deposit value is 0.1 ETH"); // 0.1 ETH
        if(addressToDepositedAmount[msg.sender] == 0) {
            arrayWithStakers.push(msg.sender);
        }
        addressToDepositedAmount[msg.sender] += msg.value;
        tvl += msg.value;
    }

    function withdraw() external {
        require(addressToDepositedAmount[msg.sender] > 0, "No ETH to withdraw");

        uint256 amountEthToWithdraw = addressToDepositedAmount[msg.sender];
        uint256 amountRewardToWithdraw = addressToReward[msg.sender];
        
        arrayWithStakers[getIndexByElement(msg.sender)] = arrayWithStakers[arrayWithStakers.length-1];
        arrayWithStakers.pop();

        delete(addressToDepositedAmount[msg.sender]);
        delete(addressToReward[msg.sender]);
        tvl -= amountEthToWithdraw;

        (bool success,) = payable(msg.sender).call{value: amountEthToWithdraw}("");
        require(success, "ETH transfer faild");

        (success) = rewardToken.transfer(msg.sender, amountRewardToWithdraw);
        require(success, "RewardToken transfer faild");
    }

    function distrubuteRewards() external onlyRole(REWARD_ROLE) {
        require(arrayWithStakers.length > 0, "No addreses to distribute Reward Tokens");
        require(mintedReward < limitOfTokenReward, "All tokens has beed distributed");
        
        uint256 distributedTokens = 0;
        mintedReward += rewardPerPerdiod;
        
        for(uint256 i=0; i<arrayWithStakers.length; i++) {
            uint256 reward = (addressToDepositedAmount[arrayWithStakers[i]]*1000/tvl) * rewardPerPerdiod / 1000;
            addressToReward[arrayWithStakers[i]] += reward;
            distributedTokens += reward;
        }

        // @dev If any tokens are left, then oldest depositer gets rest tokens as gratitude
        if(rewardPerPerdiod - distributedTokens > 0) {
            addressToReward[arrayWithStakers[0]] += rewardPerPerdiod - distributedTokens;
        }
    }

    //@dev function is public for testing purposes, in deployment should be changed to private
    function getIndexByElement(address _element) public view returns(uint256) {
        for(uint256 i=0; i<arrayWithStakers.length; i++) {
            if (arrayWithStakers[i] == _element) {
                return i;
            }
        }
        revert("Element not in array");
    }

    // @dev helper function for tests
    function getArrayWithStakersLength() public view returns(uint256) {
        return arrayWithStakers.length;
    }

    receive() external payable {
        (bool success, ) = address(this).delegatecall(abi.encodeWithSelector(this.deposit.selector));
        require(success, "Minimal deposit value is 0.1 ETH");
    }
}