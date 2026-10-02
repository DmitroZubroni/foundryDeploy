// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Vault.sol";
import "./tokens.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";

contract Market is ERC4626Upgradeable {

    string public title;
    // calculating in %, e.g. 1 token1 = 1 token2 => cost = 100 (%)
    uint public USDT_UCDC_cost;
    uint public USD1_USDC_cost;
    uint public USDC_USD_cost;
    uint public DAI_USDC_cost; 
    // calculating in % (e.g. 70% LLTV = 70)
    uint public LLTV;
    uint public blocksPerYear;
    uint public lastAccureBlock;
    uint public currentBorrowIndex;
    uint public InterestRate;
    address public vault; // address which will receive 70% from fee 
    address public admin; // address which will receive 30% from fee
    Token public collateralToken;
    Token public borrowToken;
    Share public collateralShare;
    Share public borrowShare;
    uint public borrowPrice;
    uint public collateralPrice;
    mapping (address => uint) public userBorrowIndexAtEntry;

    function init(
        uint USDT_cost, uint USD1_cost, uint USDC_cost, uint DAI_cost, uint borrowIndex,
        string memory title_, string memory shareName_, uint LLTV_, address vault_, address admin_, uint InterestRate_, 
        Token collateralToken_, Token borrowToken_, uint64 version
    ) public reinitializer(version) {
        __ERC4626_init(IERC20(collateralToken_));
        __ERC20_init(shareName_, shareName_);
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
        borrowPrice = 100;
        collateralPrice = 100;
        collateralToken = collateralToken_;
        borrowToken     = borrowToken_;
        collateralShare = new Share(address(collateralToken_), shareName_, shareName_, collateralToken_.decimals());
        borrowShare     = new Share(address(borrowToken_), string(abi.encodePacked("borrow_", shareName_)), string(abi.encodePacked("b_", shareName_)), borrowToken_.decimals());
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
        return collateralShare.balanceOf(user) == 0 ? 0 :
        ( (borrowShare.balanceOf(user) + accruedInterest(user)) * borrowShare.convertToAssets(2**100) ) / 
        ( collateralShare.balanceOf(user) * collateralShare.convertToAssets(2**100) ) * 
        100; 
    }
    
    function supply(uint amount) public updateIndexAndLTV() {
        collateralToken.transfer(msg.sender, address(this), amount);
        collateralShare.mint(msg.sender, collateralShare.previewDeposit(amount));
    }

    function borrow(uint amount) public updateIndexAndLTV() {
        if (borrowShare.balanceOf(msg.sender) == 0) {
            userBorrowIndexAtEntry[msg.sender] = currentBorrowIndex;
        }
        borrowToken.transfer(address(this), msg.sender, amount);
        borrowShare.mint(msg.sender, borrowShare.previewDeposit(amount));
    }

    function repayPart(uint amount) public updateIndexAndLTV() {
        uint startInterest = accruedInterest(msg.sender);
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

    function liquidate(address borrower) external {
        require(borrowShare.balanceOf(borrower) > 0, "No debt to liquidate");
        require(LTV(borrower) >= LLTV, "Position is healthy");

        uint colAmount = collateralShare.balanceOf(borrower);
        uint liquidatorBonus = (colAmount * 20) / 100;
        uint protocolShare = colAmount - liquidatorBonus;

        collateralShare.burn(borrower, colAmount);
        borrowShare.burn(borrower, borrowShare.balanceOf(borrower));
        userBorrowIndexAtEntry[borrower] = 0;

        if (liquidatorBonus > 0) {
            collateralToken.transfer(address(this), msg.sender, liquidatorBonus);
        }
        if (protocolShare > 0) {
            collateralToken.transfer(address(this), admin, protocolShare);
        }
    }

    function getMarket() public view returns(
        string memory, uint, uint, uint, uint, uint, uint, uint, uint, uint,
        address, address, address, address, address, address, uint, uint
    ){
        return(
            title, USDT_UCDC_cost, USD1_USDC_cost, USDC_USD_cost, DAI_USDC_cost,
            LLTV, blocksPerYear, lastAccureBlock, currentBorrowIndex, InterestRate,
            vault, admin, address(collateralToken), address(borrowToken),
            address(collateralShare), address(borrowShare),
            borrowToken.balanceOf(address(this)), collateralToken.balanceOf(address(this))
        );
    }

    function getUserMarket() public view returns(uint, uint, uint, uint, uint, uint){
        return(
            userBorrowIndexAtEntry[msg.sender],
            collateralShare.balanceOf(msg.sender),
            borrowShare.balanceOf(msg.sender),
            LTV(msg.sender),
            borrowToken.balanceOf(msg.sender),
            collateralToken.balanceOf(msg.sender)
        );
    }
}
