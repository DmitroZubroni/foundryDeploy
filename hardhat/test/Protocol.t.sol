// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/src/Test.sol";
import "../contracts/tokens.sol";
import "../contracts/Vault.sol";
import "../contracts/Market.sol";
import "../contracts/MyProxy.sol";

/**
 * @title ProtocolTest
 * @notice Набор интеграционных и юнит-тестов протокола на Solidity (с использованием forge-std).
 * Проверяет корректность работы всех контрактов:
 *  1. Vault (ERC4626 хранилище активов с начислением APY)
 *  2. Market (Кредитный рынок с залогом, займами, расчетом LTV и процентной ставкой)
 *  3. MyProxy (Прозрачный обновляемый прокси Transparent Upgradeable Proxy)
 */
contract ProtocolTest is Test {
    // Инстансы тестируемых контрактов
    USDC usdc;
    USDT usdt;
    Vault vault;
    Market marketImpl;
    MyProxy proxy;
    Market market;

    // Тестовые аккаунты
    address admin = address(0x1111);
    address user = address(0x2222);
    address receiver2 = address(0x3333);

    /**
     * @notice Функция первоначальной настройки тестового окружения перед каждым тестом:
     * 1. Развертывание тестовых токенов USDC и USDT с начальной эмиссией на адреса.
     * 2. Развертывание хранилища Vault для USDC с базовой эмиссией 10 000 токенов.
     * 3. Развертывание базовой логики Market (Implementation).
     * 4. Инициализация рынка через прозрачный прокси Transparent Upgradeable Proxy.
     * 5. Перевод 1000 USDC из хранилища в рынок (симуляция распределения ликвидности).
     */
    function setUp() public {
        // 1. Создаем токены USDC и USDT (каждому получателю начисляется по 5000 токенов)
        usdc = new USDC(admin, user, receiver2);
        usdt = new USDT(admin, user, receiver2);

        // 2. Создаем Vault на базе USDC (хранилище автоматически минтит себе 10 000 токенов)
        vault = new Vault(Token(address(usdc)), "Vault1");

        // 3. Создаем логику рынка (Market implementation)
        marketImpl = new Market();

        // 4. Формируем закодированные данные вызова метода init()
        bytes memory initData = abi.encodeWithSelector(
            Market.init.selector,
            1e18,                 // Начальный индекс займа (currentBorrowIndex = 1.0)
            "Market1",            // Название рынка
            75,                   // LLTV: Максимальный допустимый порог ликвидации 75%
            address(vault),       // Адрес связанного хранилища
            admin,                // Адрес администратора протокола
            317,                  // Процентная ставка 3.17% годовых
            Token(address(usdt)), // Залоговый токен (collateral)
            Token(address(usdc)), // Токен займа (borrow token)
            1                     // Версия инициализатора (reinitializer)
        );

        // 5. Развертываем прозрачный прокси с вызовом initData
        proxy = new MyProxy(address(marketImpl), initData);

        // Приводим адрес прокси к интерфейсу Market для вызовов
        market = Market(payable(address(proxy)));

        // 6. Переводим 1000 USDC из Vault в Market для обеспечения ликвидности займов
        vm.prank(address(vault));
        usdc.transfer(address(vault), address(market), 1000 * 1e18);
    }

    // =========================================================================
    // ТЕСТЫ ХРАНИЛИЩА (VAULT)
    // =========================================================================

    /**
     * @notice Проверка начальных параметров хранилища:
     * - Адрес базового актива (USDC)
     * - Годовая ставка APY (10%)
     * - Название ("Vault1")
     * - Отслеживаемые пользовательские активы (начальное значение 0)
     * - Баланс токенов (10000 начальных минус 1000, переданных в рынок = 9000)
     */
    function test_Vault_InitialState() public view {
        (address token, uint apy, string memory title, uint assets, , uint bal) = vault.getVault();
        assertEq(token, address(usdc), "Vault asset token should be USDC");
        assertEq(apy, 10, "Vault APY should be 10%");
        assertEq(title, "Vault1", "Vault title should match");
        assertEq(assets, 0, "Initial tracked assets should be 0");
        assertEq(bal, 9000 * 1e18, "Remaining balance in vault should be 9000 USDC");
    }

    /**
     * @notice Проверка ограничения минимального депозита.
     * Контракт Vault требует: require(amount >= 10 * 10 ** assetToken.decimals(), "minimal deposit is 10 asset tokens");
     * При депозите 9 токенов транзакция должна отклониться с соответствующей ошибкой.
     */
    function test_Vault_RevertDepositUnderMinimum() public {
        vm.startPrank(user);
        // Ожидаем revert с точным сообщением об ошибке
        vm.expectRevert("minimal deposit is 10 asset tokens");
        vault.deposit(9 * 1e18);
        vm.stopPrank();
    }

    /**
     * @notice Проверка успешного депозита и частичного вывода:
     * 1. Пользователь вносит 100 USDC (проверяем увеличение totalAssets и начисление shares).
     * 2. Пользователь выводит 40 USDC через withdrawPart (проверяем уменьшение totalAssets до 60).
     */
    function test_Vault_DepositAndWithdrawPart() public {
        vm.startPrank(user);
        uint depAmount = 100 * 1e18;
        vault.deposit(depAmount);

        // Проверяем, что активы хранилища увеличились на сумму депозита
        assertEq(vault.totalAssets(), depAmount, "Total assets must equal deposited amount");

        // Проверяем, что пользователю начислены доли (shares > 0)
        (, uint shares) = vault.getUserVault();
        assertGt(shares, 0, "User must receive vault shares");

        // Выполняем частичный вывод 40 токенов
        uint withdrawAmount = 40 * 1e18;
        vault.withdrawPart(withdrawAmount);

        // Проверяем, что оставшиеся активы равны 60 токенам
        assertEq(vault.totalAssets(), depAmount - withdrawAmount, "Total assets should decrease by withdrawn amount");
        vm.stopPrank();
    }

    /**
     * @notice Проверка полного вывода средств через withdrawFull():
     * После полного вывода все доли пользователя (shares) сжигаются, а totalAssets обнуляются.
     */
    function test_Vault_WithdrawFull() public {
        vm.startPrank(user);
        vault.deposit(50 * 1e18);

        // Полный вывод всех вложенных средств
        vault.withdrawFull();

        // Проверяем, что доли пользователя обнулены и активы хранилища равны 0
        (, uint shares) = vault.getUserVault();
        assertEq(shares, 0, "All user shares must be burned after full withdraw");
        assertEq(vault.totalAssets(), 0, "Total assets must be 0 after full withdrawal");
        vm.stopPrank();
    }

    /**
     * @notice Проверка распределения ликвидности хранилища по рынкам (destributeToMarkets):
     * Метод destributeToMarkets делит текущий баланс хранилища на 6 и отправляет по 1/6 каждому из трех рынков.
     */
    function test_Vault_DistributeToMarkets() public {
        address m1 = address(0xAA);
        address m2 = address(0xBB);
        address m3 = address(0xCC);

        uint balBefore = usdc.balanceOf(address(vault));
        vault.destributeToMarkets(m1, m2, m3);

        // Каждый рынок должен получить ровно 1/6 часть исходного баланса
        uint transferAmount = balBefore / 6;
        assertEq(usdc.balanceOf(m1), transferAmount, "Market 1 should receive 1/6th of vault balance");
        assertEq(usdc.balanceOf(m2), transferAmount, "Market 2 should receive 1/6th of vault balance");
        assertEq(usdc.balanceOf(m3), transferAmount, "Market 3 should receive 1/6th of vault balance");
    }

    // =========================================================================
    // ТЕСТЫ РЫНКА (MARKET)
    // =========================================================================

    /**
     * @notice Проверка корректности параметров рынка через getMarket():
     * Сверяем название, цены залога и займа, порог ликвидации LLTV, количество блоков в году,
     * начальный индекс заимствования, адреса хранилища, админа и токенов.
     */
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

        assertEq(title, "Market1", "Market title must match");
        assertEq(borrowPrice, 100, "Borrow price should be 100");
        assertEq(collateralPrice, 100, "Collateral price should be 100");
        assertEq(lltv, 75, "Liquidation threshold LLTV should be 75%");
        assertEq(blocksPerYear, 2102400, "Blocks per year should be 2102400");
        assertEq(currentBorrowIndex, 1e18, "Initial borrow index should be 1e18");
        assertEq(vaultAddr, address(vault), "Vault address must match");
        assertEq(adminAddr, admin, "Admin address must match");
        assertEq(colToken, address(usdt), "Collateral token must be USDT");
        assertEq(borToken, address(usdc), "Borrow token must be USDC");
        assertEq(borBal, 1000 * 1e18, "Market should have 1000 USDC balance");
        assertEq(colBal, 0, "Initial collateral balance should be 0");
    }

    /**
     * @notice Проверка внесения залога через supply():
     * Пользователь вносит 200 USDT залога и получает ровно 200 долей залога (collateral shares).
     * До момента взятия займа LTV пользователя равен 0.
     */
    function test_Market_SupplyCollateral() public {
        vm.startPrank(user);
        uint supplyAmount = 200 * 1e18;
        market.supply(supplyAmount);

        // Проверяем состояние пользователя на рынке
        (, uint colShares, uint borShares, uint ltv, , ) = market.getUserMarket();
        assertEq(colShares, supplyAmount, "Collateral shares must equal supplied amount");
        assertEq(borShares, 0, "Borrow shares must be 0 prior to borrowing");
        assertEq(ltv, 0, "LTV must be 0 when no borrow exists");
        vm.stopPrank();
    }

    /**
     * @notice Проверка успешного заимствования в пределах допустимого LLTV (75%):
     * 1. Вносим 100 USDT залога (цена залога = 100, цена займа = 100).
     * 2. Берем займ 50 USDC.
     * 3. Формула LTV: 100 * (50 * 100) / (100 * 100) = 50% <= 75% LLTV.
     * Займ успешен, проверяем LTV = 50 и долг (totalDept) = 50 USDC.
     */
    function test_Market_BorrowHealthy() public {
        vm.startPrank(user);
        market.supply(100 * 1e18);

        // Запрашиваем заем 50 USDC (LTV составит 50%)
        uint borrowAmount = 50 * 1e18;
        market.borrow(borrowAmount);

        // Проверяем LTV и общий долг
        uint ltv = market.LTV(user);
        assertEq(ltv, 50, "LTV should be 50%");

        uint debt = market.totalDept(user);
        assertEq(debt, borrowAmount, "Total debt should match borrowed amount");
        vm.stopPrank();
    }

    /**
     * @notice Проверка защиты от превышения лимита заимствования (LLTV):
     * При залоге 100 USDT попытка занять 80 USDC приведет к LTV = 80% > 75% LLTV.
     * Модификатор updateIndexAndLTV() должен отклонить транзакцию с ошибкой "LTV is larger than LLTV".
     */
    function test_Market_BorrowExceedingLLTVReverts() public {
        vm.startPrank(user);
        market.supply(100 * 1e18);

        // Попытка взять 80 USDC займа (LTV 80% превышает лимит 75%)
        vm.expectRevert("LTV is larger than LLTV");
        market.borrow(80 * 1e18);
        vm.stopPrank();
    }

    /**
     * @notice Проверка частичного погашения долга через repayPart():
     * 1. Залог: 100 USDT, Займ: 50 USDC (исходный LTV = 50%).
     * 2. Погашаем 20 USDC.
     * 3. Остаток долга: 30 USDC, новый LTV = 30%.
     */
    function test_Market_RepayPart() public {
        vm.startPrank(user);
        market.supply(100 * 1e18);
        market.borrow(50 * 1e18);

        // Частично погашаем 20 USDC
        market.repayPart(20 * 1e18);

        // Проверяем, что LTV снизился до 30%
        uint ltvAfter = market.LTV(user);
        assertEq(ltvAfter, 30, "LTV should drop to 30% after repaying 20 USDC");
        vm.stopPrank();
    }

    /**
     * @notice Проверка полного погашения долга через repayFull():
     * При вызове repayFull() погашается весь остаток долга с начисленными процентами,
     * все долговые доли сжигаются, LTV и общий долг становятся равны 0.
     */
    function test_Market_RepayFull() public {
        vm.startPrank(user);
        market.supply(100 * 1e18);
        market.borrow(50 * 1e18);

        // Полностью гасим долг
        market.repayFull();

        // Проверяем обнуление долга и LTV
        uint ltvAfter = market.LTV(user);
        assertEq(ltvAfter, 0, "LTV must be 0 after full repayment");
        assertEq(market.totalDept(user), 0, "Debt must be 0 after full repayment");
        vm.stopPrank();
    }

    /**
     * @notice Проверка частичного и полного вывода залога:
     * 1. Вносим 100 USDT, берем займ 40 USDC (LTV = 40%).
     * 2. Выводим 20 USDT залога -> остаток залога 80 USDT, новый LTV = 40 / 80 = 50% <= 75% LLTV (безопасно).
     * 3. Полностью гасим заем (repayFull).
     * 4. Выводим весь оставшийся залог (withdrawFull) -> баланс залоговых долей становится равным 0.
     */
    function test_Market_WithdrawCollateral() public {
        vm.startPrank(user);
        market.supply(100 * 1e18);
        market.borrow(40 * 1e18); // LTV = 40%

        // Частичный вывод 20 USDT залога (LTV возрастает до 50%, что ниже 75%)
        market.withdrawPart(20 * 1e18);
        assertEq(market.LTV(user), 50, "LTV should be 50% after withdrawing partial collateral");

        // Перед полным выводом залога погашаем весь долг
        market.repayFull();

        // Полный вывод оставшегося залога (80 USDT)
        market.withdrawFull();
        (, uint colShares, , , , ) = market.getUserMarket();
        assertEq(colShares, 0, "All collateral shares must be burned after full withdraw");
        vm.stopPrank();
    }

    // =========================================================================
    // ТЕСТЫ ПРОКСИ (TRANSPARENT UPGRADEABLE PROXY)
    // =========================================================================

    /**
     * @notice Проверка прозрачного прокси:
     * - getProxyAdmin() возвращает валидный адрес контракта ProxyAdmin, созданный OpenZeppelin v5.
     * - getProxyImplementation() указывает на ранее развернутый контракт Market (логику).
     */
    function test_Proxy_AdminAndImplementation() public view {
        assertTrue(proxy.getProxyAdmin() != address(0), "ProxyAdmin address must not be zero");
        assertEq(proxy.getProxyImplementation(), address(marketImpl), "Proxy implementation must point to Market");
    }
}
