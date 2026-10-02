// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Vault.sol";
import "./tokens.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";

contract Market is ERC4626Upgradeable {

    string title;
    // calculating in %, e.g. 1 token1 = 1 token2 => cost = 100 (%)
    uint USDT_UCDC_cost;
    uint USD1_USDC_cost;
    uint USDC_USD_cost;
    uint DAI_USDC_cost; 
    // calculating in % (e.g. 70% LLTV = 70)
    uint LLTV;
    uint blocksPerYear;
    uint lastAccureBlock;
    uint currentBorrowIndex;
    uint InterestRate;
    address vault; // address which will receive 70% from fee 
    address admin; // address which will receive 30% from fee

    Token collateralToken;
    Token borrowToken;
    Share collateralShare;
    Share borrowShare;

    mapping (address => uint) userBorrowIndexAtEntry;

    // constructor()
    function init(
        uint USDT_cost, uint USD1_cost, uint USDC_cost, uint DAI_cost, uint borrowIndex,
        string memory title_, uint LLTV_, address vault_, address admin_, uint InterestRate_, 
        Token collateralToken_, Token borrowToken_, uint64 version
    ) public reinitializer(version) {
        __ERC4626_init(IERC20(collateralToken_));
        __ERC20_init(collateralToken_.name(), collateralToken_.symbol());
        title = title_;
        USDT_UCDC_cost = USDT_cost;
        USD1_USDC_cost = USD1_cost;
        USDC_USD_cost  = USDC_cost;
        DAI_USDC_cost  = DAI_cost;
        LLTV = LLTV_;
        blocksPerYear = 2102400;
        lastAccureBlock = block.number;
        currentBorrowIndex = borrowIndex;
        InterestRate = InterestRate_;
        vault = vault_;
        admin = admin_;
        collateralToken = collateralToken_;
        borrowToken     = borrowToken_;
        collateralShare = new Share(address(collateralToken_), collateralToken_.name(), collateralToken_.symbol(), collateralToken_.decimals());
        borrowShare     = new Share(address(borrowToken_),     borrowToken_.name(),     borrowToken_.symbol(),     borrowToken_.decimals()    );
    }

    modifier updateIndexAndLTV() {
        currentBorrowIndex += currentBorrowIndex * InterestRate * (block.number - lastAccureBlock) / blocksPerYear;
        _;
        require(LTV(msg.sender) <= LLTV, "LTV is larger than LLTV");
    }

    function accruedInterest(address user) public view returns(uint){
        return borrowShare.balanceOf(user) * ( currentBorrowIndex - userBorrowIndexAtEntry[user] );
    }

    function LTV(address user) public view returns(uint){
        return 
        ( (borrowShare.balanceOf(user) + accruedInterest(user)) * borrowShare.convertToAssets(2**100) ) / 
        ( collateralShare.balanceOf(user) * collateralShare.convertToAssets(2**100) ) * 
        100; 
    }
    
    function supply(uint amount) public updateIndexAndLTV() {
        collateralToken.transfer(msg.sender, address(this), amount);
        collateralShare.mint(collateralShare.previewDeposit(amount), msg.sender);
    }

    function borrow(uint amount) public updateIndexAndLTV() {
        borrowToken.transfer(address(this), msg.sender, amount);
        borrowShare.mint(borrowShare.previewDeposit(amount), msg.sender);
    }

    function repayPart(uint amount) public updateIndexAndLTV() {
        uint startInterest = accruedInterest(msg.sender);
        // paying only %, doesnt burn any shares
        if(amount <= startInterest){
            borrowToken.transfer(msg.sender, address(vault), (amount * 7 / 10));
            borrowToken.transfer(msg.sender, admin, (amount * 3 / 10));
            Vault(vault).increaseAssets(amount * 7 / 10);
            userBorrowIndexAtEntry[msg.sender] = currentBorrowIndex - ( (startInterest - amount) / borrowShare.balanceOf(msg.sender) );
        } 
        else {
            borrowToken.transfer(msg.sender, address(vault), (startInterest * 7 / 10));
            borrowToken.transfer(msg.sender, admin, (startInterest * 3 / 10));
            Vault(vault).increaseAssets(startInterest * 7 / 10);
            userBorrowIndexAtEntry[msg.sender] = currentBorrowIndex;
            uint payment = amount - startInterest;
            borrowToken.transfer(msg.sender, address(this), payment);
            borrowShare.burn(msg.sender, borrowShare.previewWithdraw(payment));
        }
    }

    function repayFull() public updateIndexAndLTV() {
        uint interest = accruedInterest(msg.sender);
        borrowToken.transfer(msg.sender, address(vault), (interest * 7 / 10));
        borrowToken.transfer(msg.sender, admin, (interest * 3 / 10));
        Vault(vault).increaseAssets(interest * 7 / 10);
        userBorrowIndexAtEntry[msg.sender] = currentBorrowIndex;
        uint payment = borrowShare.maxWithdraw(msg.sender);
        borrowToken.transfer(msg.sender, address(this), payment);
        borrowShare.burn(msg.sender, borrowShare.previewWithdraw(payment));
        lastAccureBlock = block.number;
    }

    function withdrawPart(uint amount) public updateIndexAndLTV() {
        collateralToken.transfer(address(this), msg.sender, amount);
        collateralShare.burn(msg.sender, collateralShare.previewWithdraw(amount));
    }

    function withdrawFull() public updateIndexAndLTV() {
        uint amount = collateralShare.maxWithdraw(msg.sender);
        collateralToken.transfer(address(this), msg.sender, amount);
        collateralShare.burn(msg.sender, collateralShare.previewWithdraw(amount));
    }
}
