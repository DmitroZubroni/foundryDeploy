// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "./tokens.sol";

contract MyProxy is TransparentUpgradeableProxy{

    // same params order as Market
    string public title;
    uint public LLTV;
    uint public blocksPerYear;
    uint public lastAccureBlock;
    uint public currentBorrowIndex;
    uint public InterestRate;
    address public vault;
    address public admin;
    uint public borrowPrice;
    uint public collateralPrice;
    uint public WAD;
    uint public precition;
    Token public collateralToken;
    Token public borrowToken;
    Share public collateralShare;
    Share public borrowShare;
    mapping (address => uint) public userBorrowIndexAtEntry;

    constructor(address impl, bytes memory data) TransparentUpgradeableProxy(impl, msg.sender, data) payable {}

    function getProxyAdmin() public view returns(address){
        return super._proxyAdmin();
    }

    function getProxyImplementation() public view returns(address){
        return super._implementation();
    }

    function callOtherMethodBytes(bytes memory methodData) public returns(bytes memory){
        (bool success, bytes memory returnData) = getProxyImplementation().delegatecall(methodData); 
        require(success, "error while calling method (bytes)");
        return returnData;
    }

    function callOtherMethodString(string memory funcSig) public returns(bytes memory){
        (bool success, bytes memory returnData) = getProxyImplementation().delegatecall(abi.encodeWithSignature(funcSig)); 
        require(success, "error while calling method (string)");
        return returnData;
    }

    receive() external payable{}
}
