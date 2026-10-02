// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./tokens.sol";

contract Vault is ERC4626 {

    Token assetToken;
    uint8 APY; // 10% instead of 0.1
    string title;
    uint assets;

    constructor(
        Token assetToken_,
        string memory title_,
        string memory shareName_,
        string memory shareSymbol_
    ) ERC4626(IERC20(assetToken_)) ERC20(shareName_, shareSymbol_) {
        title = title_;
        assetToken = assetToken_;
        assetToken.mint(address(this), 10000 * 10 ** assetToken.decimals());
        APY = 10;
    }

    function totalAssets() public view override returns(uint){
        return assets;
    }

    function destributeToMarkets(address proxyMarket1, address proxyMarket2, address proxyMarket3) public { //distribute
        uint transferAmount = assetToken.balanceOf(address(this)) / 6;
        assetToken.transfer(address(this), proxyMarket1, transferAmount);
        assetToken.transfer(address(this), proxyMarket2, transferAmount);
        assetToken.transfer(address(this), proxyMarket3, transferAmount);
    }

    function deposit(uint amount) public {
        if(amount < 10 * 10 ** assetToken.decimals()){ // 10 * 10 ** decimals = minimal deposit (10 asset tokens)
            revert("minimal deposit is 10 asset tokens");
        }
        assetToken.transfer(msg.sender, address(this), amount);
        _mint(msg.sender, previewDeposit(amount));
        assets += amount;
    }

    function withdrawPart(uint amount) public {
        if(amount > assets){
            revert("number of available assets is lower then requested amount");
        }
        uint shares = previewWithdraw(amount);
        if(shares > balanceOf(msg.sender)){
            revert("user is withdrawing more than he deposited");
        }
        assetToken.transfer(address(this), msg.sender, amount);
        _burn(msg.sender, shares);
        assets -= amount;
    }

    function withdrawFull() public {
        uint shares = balanceOf(msg.sender);
        uint userAssets = previewRedeem(shares);
        if(userAssets > assets){
            revert("number of available assets is lower then requested amount");
        }
        assetToken.transfer(address(this), msg.sender, userAssets);
        _burn(msg.sender, shares);
        assets -= userAssets;
    }

    function increaseAssets(uint amount) public {
        assets += amount;
    }

    function getVault() public view returns(address, uint, string memory, uint, uint, uint){
        return(address(assetToken), APY, title, assets, totalSupply(), assetToken.balanceOf(address(this)));
    }
    
    function getUserVault()  public view returns(uint, uint){
        return(assetToken.balanceOf(msg.sender), balanceOf(msg.sender));
    }
}
