// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/src/Test.sol";
import "../contracts/tokens.sol";
import "../contracts/Vault.sol";
import "../contracts/Market.sol";
import "../contracts/MyProxy.sol";

contract ProtocolTest is Test {
    USDC usdc;
    USDT usdt;
    Vault vault;
    Market marketImpl;
    MyProxy proxy;
    Market market;

    address admin = address(0x1111);
    address user = address(0x2222);
    address receiver2 = address(0x3333);

    function setUp() public {
        usdc = new USDC(admin, user, receiver2);
        usdt = new USDT(admin, user, receiver2);

        vault = new Vault(Token(address(usdc)), "Vault1");
        marketImpl = new Market();

        bytes memory initData = abi.encodeWithSelector(
            Market.init.selector,
            1e18,
            "Market1",
            75, // 75% LLTV
            address(vault),
            admin,
            317, // 3.17%
            Token(address(usdt)),
            Token(address(usdc)),
            1
        );

        proxy = new MyProxy(address(marketImpl), initData);
        market = Market(payable(address(proxy)));

        // Fund market with USDC from vault (simulate distribution)
        vm.prank(address(vault));
        usdc.transfer(address(vault), address(market), 1000 * 1e18);
    }

    // =========================================================================
    // VAULT TESTS
    // =========================================================================

    function test_Vault_InitialState() public view {
        (address token, uint apy, string memory title, uint assets, , uint bal) = vault.getVault();
        assertEq(token, address(usdc));
        assertEq(apy, 10);
        assertEq(title, "Vault1");
        assertEq(assets, 0);
        assertEq(bal, 9000 * 1e18); // 10000 minted minus 1000 sent to market
    }

    function test_Vault_RevertDepositUnderMinimum() public {
        vm.startPrank(user);
        // Minimal deposit is 10 tokens
        vm.expectRevert("minimal deposit is 10 asset tokens");
        vault.deposit(9 * 1e18);
        vm.stopPrank();
    }

    function test_Vault_DepositAndWithdrawPart() public {
        vm.startPrank(user);
        uint depAmount = 100 * 1e18;
        vault.deposit(depAmount);

        assertEq(vault.totalAssets(), depAmount);
        (, uint shares) = vault.getUserVault();
        assertGt(shares, 0);

        uint withdrawAmount = 40 * 1e18;
        vault.withdrawPart(withdrawAmount);

        assertEq(vault.totalAssets(), depAmount - withdrawAmount);
        vm.stopPrank();
    }

    function test_Vault_WithdrawFull() public {
        vm.startPrank(user);
        vault.deposit(50 * 1e18);
        vault.withdrawFull();

        (, uint shares) = vault.getUserVault();
        assertEq(shares, 0);
        assertEq(vault.totalAssets(), 0);
        vm.stopPrank();
    }

    function test_Vault_DistributeToMarkets() public {
        address m1 = address(0xAA);
        address m2 = address(0xBB);
        address m3 = address(0xCC);

        uint balBefore = usdc.balanceOf(address(vault));
        vault.destributeToMarkets(m1, m2, m3);

        uint transferAmount = balBefore / 6;
        assertEq(usdc.balanceOf(m1), transferAmount);
        assertEq(usdc.balanceOf(m2), transferAmount);
        assertEq(usdc.balanceOf(m3), transferAmount);
    }

    // =========================================================================
    // MARKET TESTS
    // =========================================================================

    function test_Market_InitialConfiguration() public view {
        (
            string memory title,
            uint borrowPrice,
            uint collateralPrice,
            uint lltv,
            uint blocksPerYear,
            ,
            uint currentBorrowIndex,
            ,
            address vaultAddr,
            address adminAddr,
            address colToken,
            address borToken,
            ,
            ,
            uint borBal,
            uint colBal
        ) = market.getMarket();

        assertEq(title, "Market1");
        assertEq(borrowPrice, 100);
        assertEq(collateralPrice, 100);
        assertEq(lltv, 75);
        assertEq(blocksPerYear, 2102400);
        assertEq(currentBorrowIndex, 1e18);
        assertEq(vaultAddr, address(vault));
        assertEq(adminAddr, admin);
        assertEq(colToken, address(usdt));
        assertEq(borToken, address(usdc));
        assertEq(borBal, 1000 * 1e18);
        assertEq(colBal, 0);
    }

    function test_Market_SupplyCollateral() public {
        vm.startPrank(user);
        uint supplyAmount = 200 * 1e18;
        market.supply(supplyAmount);

        (, uint colShares, uint borShares, uint ltv, , ) = market.getUserMarket();
        assertEq(colShares, supplyAmount);
        assertEq(borShares, 0);
        assertEq(ltv, 0);
        vm.stopPrank();
    }

    function test_Market_BorrowHealthy() public {
        vm.startPrank(user);
        market.supply(100 * 1e18);

        // Borrow 50 USDC -> LTV = (100 * 50 * 100) / (100 * 100) = 50% <= 75% LLTV
        uint borrowAmount = 50 * 1e18;
        market.borrow(borrowAmount);

        uint ltv = market.LTV(user);
        assertEq(ltv, 50);

        uint debt = market.totalDept(user);
        assertEq(debt, borrowAmount);
        vm.stopPrank();
    }

    function test_Market_BorrowExceedingLLTVReverts() public {
        vm.startPrank(user);
        market.supply(100 * 1e18);

        // Try to borrow 80 USDC -> LTV would be 80% > 75% LLTV
        vm.expectRevert("LTV is larger than LLTV");
        market.borrow(80 * 1e18);
        vm.stopPrank();
    }

    function test_Market_RepayPart() public {
        vm.startPrank(user);
        market.supply(100 * 1e18);
        market.borrow(50 * 1e18);

        // Repay 20 USDC
        market.repayPart(20 * 1e18);

        uint ltvAfter = market.LTV(user);
        assertEq(ltvAfter, 30); // 30 USDC remaining debt / 100 collateral = 30%
        vm.stopPrank();
    }

    function test_Market_RepayFull() public {
        vm.startPrank(user);
        market.supply(100 * 1e18);
        market.borrow(50 * 1e18);

        market.repayFull();

        uint ltvAfter = market.LTV(user);
        assertEq(ltvAfter, 0);
        assertEq(market.totalDept(user), 0);
        vm.stopPrank();
    }

    function test_Market_WithdrawCollateral() public {
        vm.startPrank(user);
        market.supply(100 * 1e18);
        market.borrow(40 * 1e18); // 40% LTV

        // Withdraw 20 USDT collateral -> LTV becomes 40 / 80 = 50% <= 75% LLTV
        market.withdrawPart(20 * 1e18);
        assertEq(market.LTV(user), 50);

        // Repay remaining debt
        market.repayFull();

        // Withdraw all remaining collateral
        market.withdrawFull();
        (, uint colShares, , , , ) = market.getUserMarket();
        assertEq(colShares, 0);
        vm.stopPrank();
    }

    // =========================================================================
    // PROXY TESTS
    // =========================================================================

    function test_Proxy_AdminAndImplementation() public view {
        assertTrue(proxy.getProxyAdmin() != address(0)); // ProxyAdmin is deployed by TransparentUpgradeableProxy
        assertEq(proxy.getProxyImplementation(), address(marketImpl));
    }
}
