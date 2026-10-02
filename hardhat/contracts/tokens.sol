// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20{
    uint8 immutable _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_, address address1, address address2, address address3) ERC20(name, symbol){
        _decimals = decimals_;
        _mint(address1, 5000 * 10 ** _decimals);
        _mint(address2, 5000 * 10 ** _decimals);
        _mint(address3, 5000 * 10 ** _decimals);
    }

    function decimals() public view override returns(uint8){
        return _decimals;
    }

    function mint(address account, uint amount) public {
        super._mint(account, amount);
    }

    function burn(address account, uint amount) public {
        super._burn(account, amount);
    }

    function transfer(address from, address to, uint amount) public{
        super._transfer(from, to, amount);
    }
}

contract USDC is Token{
    constructor(address address1, address address2, address address3) Token("USDC", "USDC", 18, address1, address2, address3){}
}

contract PryUSD is Token{
    constructor(address address1, address address2, address address3) Token("PryUSD", "PryUSD", 18, address1, address2, address3){}
}

contract USD1 is Token{
    constructor(address address1, address address2, address address3) Token("USD1", "USD1", 18, address1, address2, address3){}
}

contract USD is Token{
    constructor(address address1, address address2, address address3) Token("USD", "USD", 18, address1, address2, address3){}
}

contract USDT is Token{
    constructor(address address1, address address2, address address3) Token("USDT", "USDT", 18, address1, address2, address3){}
}

contract UCDC is Token{
    constructor(address address1, address address2, address address3) Token("UCDC", "UCDC", 18, address1, address2, address3){}
}

contract DAI is Token{
    constructor(address address1, address address2, address address3) Token("DAI", "DAI", 18, address1, address2, address3){}
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

contract Share is ERC4626{
    uint8 immutable _decimals;

    constructor(address asset, string memory name, string memory symbol, uint8 decimals_) ERC4626(IERC20(asset)) ERC20(name, symbol){
        _decimals = decimals_;
    }

    function decimals() public view override returns(uint8){
        return _decimals;
    }

    function burn(address account, uint amount) public {
        super._burn(account, amount);
    }

    function mint(address account, uint amount) public {
        super._mint(account, amount);
    }
}
