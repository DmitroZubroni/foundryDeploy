import { expect } from "chai";
import hre from "hardhat";

/**
 * @title Protocol TypeScript Test Suite
 * @notice Набор интеграционных и модульных тестов протокола на TypeScript (Mocha + Chai + Ethers v6).
 * Демонстрирует вызовы методов смарт-контрактов со стороны клиентского приложения (Web3 / Frontend):
 *  1. Vault: депозит, вывод, доли (shares), распределение средств.
 *  2. Market: залог, заем, расчет LTV, частичное и полное погашение, возврат залога.
 *  3. MyProxy: проверка прозрачного прокси (ProxyAdmin и Implementation).
 */
describe("Protocol TypeScript Test Suite", function () {
  let ethers: any;
  let admin: any;
  let user: any;
  let other: any;

  let usdc: any;
  let usdt: any;
  let vault: any;
  let marketImpl: any;
  let proxy: any;
  let market: any;

  // Константы протокола
  const LLTV = 75n;                                       // Максимальный порог ликвидации: 75%
  const RATE_317 = 317n;                                  // Годовая процентная ставка: 3.17%
  const INITIAL_BORROW_INDEX = 1_000_000_000_000_000_000n; // 1e18 (базовый индекс займа 1.0)

  beforeEach(async function () {
    // Инициализация соединения и signers в Hardhat 3
    const connection = await hre.network.create();
    ethers = connection.ethers;
    [admin, user, other] = await ethers.getSigners();

    // 1. Деплой тестовых токенов USDC и USDT (каждому участнику минтится по 5000 токенов)
    const usdcFactory = await ethers.getContractFactory("USDC");
    usdc = await usdcFactory.deploy(admin.address, user.address, other.address);

    const usdtFactory = await ethers.getContractFactory("USDT");
    usdt = await usdtFactory.deploy(admin.address, user.address, other.address);

    // 2. Деплой хранилища Vault (автоматически создает 10 000 USDC себе на баланс)
    const vaultFactory = await ethers.getContractFactory("Vault");
    vault = await vaultFactory.deploy(await usdc.getAddress(), "Vault1");

    // 3. Деплой логики кредитного рынка (Market Implementation)
    const marketFactory = await ethers.getContractFactory("Market");
    marketImpl = await marketFactory.deploy();

    // 4. Подготовка данных инициализации рынка через прокси (метод init)
    const initData = marketImpl.interface.encodeFunctionData("init", [
      INITIAL_BORROW_INDEX,   // Начальный индекс займа (1e18)
      "Market1",              // Название рынка
      LLTV,                   // Порог ликвидации LLTV = 75%
      await vault.getAddress(),// Адрес связанного хранилища
      admin.address,          // Адрес администратора
      RATE_317,               // Ставка 3.17%
      await usdt.getAddress(),// Токен залога (USDT)
      await usdc.getAddress(),// Токен займа (USDC)
      1n,                     // Версия инициализации
    ]);

    // Развертывание Transparent Upgradeable Proxy
    const proxyFactory = await ethers.getContractFactory("MyProxy");
    proxy = await proxyFactory.deploy(await marketImpl.getAddress(), initData);

    // Подключение интерфейса Market к адресу развернутого прокси
    market = await ethers.getContractAt("Market", await proxy.getAddress());

    // 5. Перевод 1000 USDC из хранилища в рынок для обеспечения ликвидности займов.
    // Примечание: В контракте Token перегружена функция transfer:
    // 1) transfer(address to, uint256 amount)
    // 2) transfer(address from, address to, uint256 amount)
    // В Ethers v6 для перегруженных функций вызывается явная сигнатура.
    await usdc.connect(admin)["transfer(address,address,uint256)"](
      await vault.getAddress(),
      await market.getAddress(),
      ethers.parseEther("1000")
    );
  });

  // ===========================================================================
  // 1. ТЕСТЫ ХРАНИЛИЩА (VAULT)
  // ===========================================================================
  describe("1. Vault Contract", function () {
    /**
     * @notice Проверка корректности начального состояния хранилища:
     * - Адрес базового токена (USDC)
     * - APY = 10%
     * - Название = "Vault1"
     * - Активы пользователя = 0
     * - Баланс токенов в хранилище = 9000 USDC (10000 - 1000 переведено в рынок)
     */
    it("should initialize with correct title, APY, and 10000 minted tokens", async function () {
      const info = await vault.getVault();
      expect(info[0]).to.equal(await usdc.getAddress());
      expect(info[1]).to.equal(10n); // 10% APY
      expect(info[2]).to.equal("Vault1");
      expect(info[3]).to.equal(0n); // начальные отслеживаемые активы
      expect(info[5]).to.equal(ethers.parseEther("9000")); // баланс хранилища
    });

    /**
     * @notice Проверка защиты от микро-депозитов:
     * Минимальный депозит в контракте Vault равен 10 asset-токенам.
     * При попытке внести 9 токенов транзакция должна отклониться.
     */
    it("should revert if deposit is below minimum 10 tokens", async function () {
      const lowAmount = ethers.parseEther("9");
      // Используем явную сигнатуру ["deposit(uint256)"], так как в ERC4626 есть и deposit(uint256,address)
      await expect(vault.connect(user)["deposit(uint256)"](lowAmount)).to.be.revertedWith(
        "minimal deposit is 10 asset tokens"
      );
    });

    /**
     * @notice Проверка успешного депозита и начисления долей:
     * Вносим 50 USDC -> totalAssets увеличивается до 50 USDC,
     * а баланс долей (shares) пользователя становится больше нуля.
     */
    it("should accept valid deposit and track shares and totalAssets", async function () {
      const depositAmount = ethers.parseEther("50");
      await vault.connect(user)["deposit(uint256)"](depositAmount);

      expect(await vault.totalAssets()).to.equal(depositAmount);
      const userVault = await vault.connect(user).getUserVault();
      expect(userVault[1]).to.be.gt(0n); // Пользователю начислены доли
    });

    /**
     * @notice Проверка частичного вывода средств через withdrawPart():
     * Вносим 100 USDC, затем выводим 30 USDC -> в хранилище остается ровно 70 USDC.
     */
    it("should allow partial withdraw (withdrawPart)", async function () {
      const depositAmount = ethers.parseEther("100");
      await vault.connect(user)["deposit(uint256)"](depositAmount);

      const withdrawAmount = ethers.parseEther("30");
      await vault.connect(user).withdrawPart(withdrawAmount);

      expect(await vault.totalAssets()).to.equal(ethers.parseEther("70"));
    });

    /**
     * @notice Проверка полного вывода средств через withdrawFull():
     * При полном выводе все доли сжигаются, а учтенные активы (totalAssets) обнуляются.
     */
    it("should allow full withdraw (withdrawFull)", async function () {
      const depositAmount = ethers.parseEther("100");
      await vault.connect(user)["deposit(uint256)"](depositAmount);

      await vault.connect(user).withdrawFull();

      expect(await vault.totalAssets()).to.equal(0n);
      const userVault = await vault.connect(user).getUserVault();
      expect(userVault[1]).to.equal(0n); // Все доли сожжены
    });

    /**
     * @notice Проверка распределения ликвидности по трем рынкам:
     * Метод destributeToMarkets отправляет 1/6 часть доступного баланса каждому из трех рынков.
     */
    it("should distribute 1/6th of balance to 3 markets", async function () {
      const m1 = ethers.Wallet.createRandom().address;
      const m2 = ethers.Wallet.createRandom().address;
      const m3 = ethers.Wallet.createRandom().address;

      const balBefore = await usdc.balanceOf(await vault.getAddress());
      await vault.destributeToMarkets(m1, m2, m3);

      const sixth = balBefore / 6n;
      expect(await usdc.balanceOf(m1)).to.equal(sixth);
      expect(await usdc.balanceOf(m2)).to.equal(sixth);
      expect(await usdc.balanceOf(m3)).to.equal(sixth);
    });
  });

  // ===========================================================================
  // 2. ТЕСТЫ КРЕДИТНОГО РЫНКА (MARKET)
  // ===========================================================================
  describe("2. Market Contract", function () {
    /**
     * @notice Проверка конфигурации рынка через getMarket():
     * Сверяем название, цены залога и займа, порог ликвидации LLTV, количество блоков в году,
     * начальный индекс заимствования, адреса хранилища, админа и токенов.
     */
    it("should return correct configuration via getMarket()", async function () {
      const info = await market.getMarket();
      expect(info[0]).to.equal("Market1");
      expect(info[1]).to.equal(100n); // borrowPrice = 100
      expect(info[2]).to.equal(100n); // collateralPrice = 100
      expect(info[3]).to.equal(75n);  // LLTV = 75%
      expect(info[4]).to.equal(2102400n); // blocksPerYear
      expect(info[6]).to.equal(INITIAL_BORROW_INDEX);
      expect(info[8]).to.equal(await vault.getAddress());
      expect(info[9]).to.equal(admin.address);
      expect(info[10]).to.equal(await usdt.getAddress());
      expect(info[11]).to.equal(await usdc.getAddress());
    });

    /**
     * @notice Проверка внесения залога через supply():
     * Пользователь вносит 200 USDT, получает 200 collateralShare.
     * При отсутствии займа LTV и borrow shares равны 0.
     */
    it("should allow supplying collateral and mint collateral shares", async function () {
      const supplyAmount = ethers.parseEther("200");
      await market.connect(user).supply(supplyAmount);

      const userMarket = await market.connect(user).getUserMarket();
      expect(userMarket[1]).to.equal(supplyAmount); // Доли залога
      expect(userMarket[2]).to.equal(0n);           // Доли займа
      expect(userMarket[3]).to.equal(0n);           // LTV = 0
    });

    /**
     * @notice Проверка заимствования в безопасных границах LTV:
     * 1. Вносим 100 USDT залога.
     * 2. Берем 40 USDC займа.
     * Расчетный LTV = 100 * (40 * 100) / (100 * 100) = 40% <= 75% (LLTV).
     * В локальном EVM с продвижением блоков индекс займа может дать небольшую погрешность округления (39-40%).
     */
    it("should allow borrowing within healthy LTV", async function () {
      const supplyAmount = ethers.parseEther("100");
      await market.connect(user).supply(supplyAmount);

      // Занимаем 40 USDC
      const borrowAmount = ethers.parseEther("40");
      await market.connect(user).borrow(borrowAmount);

      // Проверяем LTV (подключаем signer пользователя, т.к. метод LTV проверяет msg.sender)
      const ltv = await market.connect(user).LTV(user.address);
      expect(ltv).to.be.oneOf([39n, 40n]);

      // Проверяем общий долг пользователя
      const debt = await market.totalDept(user.address);
      expect(debt).to.be.at.most(borrowAmount);
      expect(debt).to.be.at.least(borrowAmount - 1000n);
    });

    /**
     * @notice Проверка защиты от превышения кредитного плеча (LTV > LLTV):
     * При залоге 100 USDT попытка занять 80 USDC дает LTV = 80% > 75% LLTV.
     * Контракт должен отклонить транзакцию с сообщением "LTV is larger than LLTV".
     */
    it("should revert if borrow exceeds LLTV", async function () {
      const supplyAmount = ethers.parseEther("100");
      await market.connect(user).supply(supplyAmount);

      // Попытка занять 80 USDC (превышает лимит 75%)
      const overBorrowAmount = ethers.parseEther("80");
      await expect(market.connect(user).borrow(overBorrowAmount)).to.be.revertedWith(
        "LTV is larger than LLTV"
      );
    });

    /**
     * @notice Проверка частичного погашения займа через repayPart():
     * 1. Залог: 100 USDT, Займ: 50 USDC (LTV = 50%).
     * 2. Гасим 20 USDC -> остаток долга 30 USDC, новый LTV = 30%.
     */
    it("should allow partial repayment (repayPart)", async function () {
      await market.connect(user).supply(ethers.parseEther("100"));
      await market.connect(user).borrow(ethers.parseEther("50"));

      // Погашаем 20 USDC
      await market.connect(user).repayPart(ethers.parseEther("20"));

      // Проверяем, что LTV снизился до 30%
      const ltv = await market.connect(user).LTV(user.address);
      expect(ltv).to.equal(30n); // 30 долга / 100 залога = 30%
    });

    /**
     * @notice Проверка полного погашения займа через repayFull():
     * При вызове repayFull() долг полностью погашается, доли сжигаются, LTV = 0.
     */
    it("should allow full repayment (repayFull)", async function () {
      await market.connect(user).supply(ethers.parseEther("100"));
      await market.connect(user).borrow(ethers.parseEther("50"));

      // Полное погашение
      await market.connect(user).repayFull();

      // Проверяем обнуление показателей
      const ltv = await market.connect(user).LTV(user.address);
      expect(ltv).to.equal(0n);
      expect(await market.totalDept(user.address)).to.equal(0n);
    });

    /**
     * @notice Проверка вывода залога:
     * 1. Вносим 100 USDT, занимаем 40 USDC (LTV = 40%).
     * 2. Выводим часть залога (20 USDT) -> залог становится 80 USDT, LTV = 40 / 80 = 50% <= 75% LLTV (безопасно).
     * 3. Полностью гасим долг (repayFull).
     * 4. Выводим весь оставшийся залог (withdrawFull) -> все доли залога сжигаются.
     */
    it("should allow partial and full collateral withdrawal", async function () {
      await market.connect(user).supply(ethers.parseEther("100"));
      await market.connect(user).borrow(ethers.parseEther("40")); // LTV = 40%

      // Частичный вывод 20 USDT залога
      await market.connect(user).withdrawPart(ethers.parseEther("20"));
      expect(await market.connect(user).LTV(user.address)).to.equal(50n);

      // Полное погашение займа перед полным выводом залога
      await market.connect(user).repayFull();

      // Полный вывод оставшегося залога
      await market.connect(user).withdrawFull();
      const userMarket = await market.connect(user).getUserMarket();
      expect(userMarket[1]).to.equal(0n); // Доли залога обнулены
    });
  });

  // ===========================================================================
  // 3. ТЕСТЫ ПРОЗРАЧНОГО ОБНОВЛЯЕМОГО ПРОКСИ (MYPROXY)
  // ===========================================================================
  describe("3. Transparent Upgradeable Proxy", function () {
    /**
     * @notice Проверка корректности работы Transparent Upgradeable Proxy:
     * - getProxyAdmin() возвращает ненулевой адрес внутреннего ProxyAdmin OpenZeppelin.
     * - getProxyImplementation() указывает на контракт Market Implementation.
     */
    it("should correctly report proxy implementation and proxy admin", async function () {
      const proxyContract = await ethers.getContractAt("MyProxy", await proxy.getAddress());
      const adminAddress = await proxyContract.getProxyAdmin();
      const implAddress = await proxyContract.getProxyImplementation();

      expect(adminAddress).to.not.equal(ethers.ZeroAddress);
      expect(implAddress).to.equal(await marketImpl.getAddress());
    });
  });
});
