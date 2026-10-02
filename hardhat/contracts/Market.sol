// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Vault.sol";
import "./tokens.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";

contract Market is ERC4626Upgradeable {

    string title;

    uint LLTV;
    uint blocksPerYear;
    uint lastAccureBlock;
    uint currentBorrowIndex;
    uint InterestRate;

    address vault; // address which will receive 70% from fee 
    address admin; // address which will receive 30% from fee

    // calculating in % (e.g. 70% LLTV = 70)
    uint borrowPrice; // %
    uint collateralPrice; // %

    uint WAD;
    uint precition;

    Token collateralToken;
    Token borrowToken;
    Share collateralShare;
    Share borrowShare;

    mapping (address => uint) userBorrowIndexAtEntry;

    // constructor()
    function init(
        uint borrowIndex,   string memory title_,   uint LLTV_,         address vault_,  address admin_, 
        uint InterestRate_, Token collateralToken_, Token borrowToken_, uint64 version
    ) public reinitializer(version) {
        __ERC4626_init(IERC20(collateralToken_));
        __ERC20_init(collateralToken_.name(), collateralToken_.symbol());
        title = title_;
        LLTV = LLTV_;
        blocksPerYear = 2102400;
        lastAccureBlock = block.number;
        currentBorrowIndex = currentBorrowIndex == 0 ? 1e18 : borrowIndex;
        InterestRate = InterestRate_ * 1e8;
        vault = vault_;
        admin = admin_;
        borrowPrice = 100;
        collateralPrice = 100;
        WAD = 1e18;
        precition = 1e12;
        collateralToken = collateralToken_;
        borrowToken     = borrowToken_;
        collateralShare = new Share(address(collateralToken_), collateralToken_.name(), collateralToken_.symbol(), collateralToken_.decimals());
        borrowShare     = new Share(address(borrowToken_),     borrowToken_.name(),     borrowToken_.symbol(),     borrowToken_.decimals()    );
    }

    modifier updateIndexAndLTV() {
        currentBorrowIndex += currentBorrowIndex * InterestRate * (block.number - lastAccureBlock) / (blocksPerYear * precition);
        lastAccureBlock = block.number;
        _;
        require(LTV(msg.sender) <= LLTV, "LTV is larger than LLTV");
    }

    function accruedInterest(address user) public view returns(uint){
        return borrowShare.balanceOf(user) * (currentBorrowIndex - userBorrowIndexAtEntry[user]) / WAD;
    }

    function totalDept(address user) public view returns(uint){
        return borrowShare.balanceOf(user) * currentBorrowIndex / WAD;
    }

    function LTV(address user) public view returns(uint){
        // formula : 100(%) * (borrowAmount * borrowPrice) / (collateralAmount * collateralPrice)
        if(borrowShare.balanceOf(msg.sender) == 0) return 0;
        if(collateralShare.balanceOf(user) == 0) return LLTV + 1;
        return ( 100 * totalDept(user) * borrowPrice ) / 
               ( collateralShare.balanceOf(user) * collateralPrice ); 
    }
    
    function supply(uint amount) public updateIndexAndLTV() {
        collateralToken.transfer(msg.sender, address(this), amount);
        collateralShare.mint(msg.sender, amount);
    }

    function borrow(uint amount) public updateIndexAndLTV() {
        if(borrowShare.balanceOf(msg.sender) == 0)
            userBorrowIndexAtEntry[msg.sender] = currentBorrowIndex;
        borrowToken.transfer(address(this), msg.sender, amount);
        borrowShare.mint(msg.sender, amount * WAD / currentBorrowIndex);
    }

    function repayPart(uint amount) public updateIndexAndLTV() {
        uint startInterest = accruedInterest(msg.sender);
        uint amountToVault;
        uint amountToAdmin;
        // paying only %, doesnt burn any shares (payment will be after if-else)
        if(amount <= startInterest){
            amountToVault = amount * 7 / 10;
            amountToAdmin = amount - amountToVault;
            // increasing entry borrow index to reduce user dept percentage, other params used in % formula shouldn't be changed
            // formula : currentInterest = borrowShares * (currentIndex - startIndex)
            // -> (currentInterest / borrowShares) = currentIndex - startIndex
            // -> startIndex + (currentInterest / borrowShares) = currentIndex
            // -> startIndex = currentIndex - (currentInterest / borrowShares)
            // since we decreased interest, currentInterest is startInterest minus amount we payed
            // so if we payed same amount as %, formula for % will give 0
            userBorrowIndexAtEntry[msg.sender] = currentBorrowIndex - ( (startInterest - amount) / borrowShare.balanceOf(msg.sender) );
        } 
        // paying all % + some amount of dept (first we pay dept body then % themself)
        else {
            amountToVault = startInterest * 7 / 10;
            amountToAdmin = startInterest - amountToVault;
            // clearing dept percentage
            userBorrowIndexAtEntry[msg.sender] = currentBorrowIndex;
            // calculating amount of tokens which will reduce dept body
            uint payment = amount - startInterest;
            // transfering tokens to market and burning shares to reduce dept
            borrowToken.transfer(msg.sender, address(this), payment);
            borrowShare.burn(msg.sender, payment * WAD / currentBorrowIndex);
        }
        // transfering fee to vault and admin in 70:30 ratio
        borrowToken.transfer(msg.sender, vault, amountToVault);
        borrowToken.transfer(msg.sender, admin, amountToAdmin);
        // telling vault that we sended him tokens
        Vault(vault).increaseAssets(amountToVault);
    }

    function repayFull() public updateIndexAndLTV() {
        // dept percentage
        uint interest = accruedInterest(msg.sender);
        // transfering fee to vault and admin in 70:30 ratio
        borrowToken.transfer(msg.sender, vault, interest * 7 / 10);
        borrowToken.transfer(msg.sender, admin, interest * 3 / 10);
        // telling vault that we sended him tokens
        Vault(vault).increaseAssets(interest * 7 / 10);
        // clearing dept percentage
        userBorrowIndexAtEntry[msg.sender] = currentBorrowIndex;
        // transfering dept body to market and burning all shares
        borrowToken.transfer(msg.sender, address(this), totalDept(msg.sender) - interest);
        borrowShare.burn(msg.sender, borrowShare.balanceOf(msg.sender));
    }

    function withdrawPart(uint amount) public updateIndexAndLTV() {
        collateralToken.transfer(address(this), msg.sender, amount);
        collateralShare.burn(msg.sender, amount);
    }

    function withdrawFull() public updateIndexAndLTV() {
        uint amount = collateralShare.balanceOf(msg.sender);
        collateralToken.transfer(address(this), msg.sender, amount);
        collateralShare.burn(msg.sender, amount);
    }

    function getMarket() public view returns(
        string memory,
        uint,
        uint,
        uint,
        uint,
        uint,
        uint,
        uint,
        address,
        address,
        address,
        address,
        address,
        address,
        uint,
        uint
    ){
        return(
            title,
            borrowPrice,
            collateralPrice,
            LLTV,
            blocksPerYear,
            lastAccureBlock,
            currentBorrowIndex,
            InterestRate * 100 / precition,
            vault,
            admin,
            address(collateralToken),
            address(borrowToken),
            address(collateralShare),
            address(borrowShare),
            borrowToken.balanceOf(address(this)),
            collateralToken.balanceOf(address(this))
        );
    }

    function getUserMarket() public view returns(
        uint,
        uint,
        uint,
        uint,
        uint,
        uint
    ){
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
