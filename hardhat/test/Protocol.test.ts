import { expect } from "chai";
import hre from "hardhat";

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

  const LLTV = 75n;
  const RATE_317 = 317n;
  const INITIAL_BORROW_INDEX = 1_000_000_000_000_000_000n; // 1e18

  beforeEach(async function () {
    const connection = await hre.network.create();
    ethers = connection.ethers;
    [admin, user, other] = await ethers.getSigners();

    // 1. Deploy Tokens
    const usdcFactory = await ethers.getContractFactory("USDC");
    usdc = await usdcFactory.deploy(admin.address, user.address, other.address);

    const usdtFactory = await ethers.getContractFactory("USDT");
    usdt = await usdtFactory.deploy(admin.address, user.address, other.address);

    // 2. Deploy Vault
    const vaultFactory = await ethers.getContractFactory("Vault");
    vault = await vaultFactory.deploy(await usdc.getAddress(), "Vault1");

    // 3. Deploy Market Implementation
    const marketFactory = await ethers.getContractFactory("Market");
    marketImpl = await marketFactory.deploy();

    // 4. Initialize Market through Proxy
    const initData = marketImpl.interface.encodeFunctionData("init", [
      INITIAL_BORROW_INDEX,
      "Market1",
      LLTV,
      await vault.getAddress(),
      admin.address,
      RATE_317,
      await usdt.getAddress(),
      await usdc.getAddress(),
      1n,
    ]);

    const proxyFactory = await ethers.getContractFactory("MyProxy");
    proxy = await proxyFactory.deploy(await marketImpl.getAddress(), initData);

    // Market interface attached to Proxy address
    market = await ethers.getContractAt("Market", await proxy.getAddress());

    // 5. Fund Market with USDC from Vault (simulating distributeToMarkets)
    await usdc.connect(admin)["transfer(address,address,uint256)"](
      await vault.getAddress(),
      await market.getAddress(),
      ethers.parseEther("1000")
    );
  });

  describe("1. Vault Contract", function () {
    it("should initialize with correct title, APY, and 10000 minted tokens", async function () {
      const info = await vault.getVault();
      expect(info[0]).to.equal(await usdc.getAddress());
      expect(info[1]).to.equal(10n); // 10% APY
      expect(info[2]).to.equal("Vault1");
      expect(info[3]).to.equal(0n); // initial assets tracked
      expect(info[5]).to.equal(ethers.parseEther("9000")); // 10000 minted - 1000 sent to market
    });

    it("should revert if deposit is below minimum 10 tokens", async function () {
      const lowAmount = ethers.parseEther("9");
      await expect(vault.connect(user)["deposit(uint256)"](lowAmount)).to.be.revertedWith(
        "minimal deposit is 10 asset tokens"
      );
    });

    it("should accept valid deposit and track shares and totalAssets", async function () {
      const depositAmount = ethers.parseEther("50");
      await vault.connect(user)["deposit(uint256)"](depositAmount);

      expect(await vault.totalAssets()).to.equal(depositAmount);
      const userVault = await vault.connect(user).getUserVault();
      expect(userVault[1]).to.be.gt(0n); // user received shares
    });

    it("should allow partial withdraw (withdrawPart)", async function () {
      const depositAmount = ethers.parseEther("100");
      await vault.connect(user)["deposit(uint256)"](depositAmount);

      const withdrawAmount = ethers.parseEther("30");
      await vault.connect(user).withdrawPart(withdrawAmount);

      expect(await vault.totalAssets()).to.equal(ethers.parseEther("70"));
    });

    it("should allow full withdraw (withdrawFull)", async function () {
      const depositAmount = ethers.parseEther("100");
      await vault.connect(user)["deposit(uint256)"](depositAmount);

      await vault.connect(user).withdrawFull();

      expect(await vault.totalAssets()).to.equal(0n);
      const userVault = await vault.connect(user).getUserVault();
      expect(userVault[1]).to.equal(0n); // all shares burned
    });

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

  describe("2. Market Contract", function () {
    it("should return correct configuration via getMarket()", async function () {
      const info = await market.getMarket();
      expect(info[0]).to.equal("Market1");
      expect(info[1]).to.equal(100n); // borrowPrice
      expect(info[2]).to.equal(100n); // collateralPrice
      expect(info[3]).to.equal(75n);  // LLTV
      expect(info[4]).to.equal(2102400n); // blocksPerYear
      expect(info[6]).to.equal(INITIAL_BORROW_INDEX);
      expect(info[8]).to.equal(await vault.getAddress());
      expect(info[9]).to.equal(admin.address);
      expect(info[10]).to.equal(await usdt.getAddress());
      expect(info[11]).to.equal(await usdc.getAddress());
    });

    it("should allow supplying collateral and mint collateral shares", async function () {
      const supplyAmount = ethers.parseEther("200");
      await market.connect(user).supply(supplyAmount);

      const userMarket = await market.connect(user).getUserMarket();
      expect(userMarket[1]).to.equal(supplyAmount); // collateral shares
      expect(userMarket[2]).to.equal(0n);           // borrow shares
      expect(userMarket[3]).to.equal(0n);           // LTV
    });

    it("should allow borrowing within healthy LTV", async function () {
      const supplyAmount = ethers.parseEther("100");
      await market.connect(user).supply(supplyAmount);

      // Borrow 40 USDC -> LTV = 40% <= 75% LLTV
      const borrowAmount = ethers.parseEther("40");
      await market.connect(user).borrow(borrowAmount);

      const ltv = await market.connect(user).LTV(user.address);
      expect(ltv).to.be.oneOf([39n, 40n]);

      const debt = await market.totalDept(user.address);
      expect(debt).to.be.at.most(borrowAmount);
      expect(debt).to.be.at.least(borrowAmount - 1000n);
    });

    it("should revert if borrow exceeds LLTV", async function () {
      const supplyAmount = ethers.parseEther("100");
      await market.connect(user).supply(supplyAmount);

      // Borrow 80 USDC -> LTV = 80% > 75% LLTV -> Must revert
      const overBorrowAmount = ethers.parseEther("80");
      await expect(market.connect(user).borrow(overBorrowAmount)).to.be.revertedWith(
        "LTV is larger than LLTV"
      );
    });

    it("should allow partial repayment (repayPart)", async function () {
      await market.connect(user).supply(ethers.parseEther("100"));
      await market.connect(user).borrow(ethers.parseEther("50"));

      // Repay 20 USDC
      await market.connect(user).repayPart(ethers.parseEther("20"));

      const ltv = await market.connect(user).LTV(user.address);
      expect(ltv).to.equal(30n); // 30 remaining debt / 100 collateral = 30%
    });

    it("should allow full repayment (repayFull)", async function () {
      await market.connect(user).supply(ethers.parseEther("100"));
      await market.connect(user).borrow(ethers.parseEther("50"));

      await market.connect(user).repayFull();

      const ltv = await market.connect(user).LTV(user.address);
      expect(ltv).to.equal(0n);
      expect(await market.totalDept(user.address)).to.equal(0n);
    });

    it("should allow partial and full collateral withdrawal", async function () {
      await market.connect(user).supply(ethers.parseEther("100"));
      await market.connect(user).borrow(ethers.parseEther("40")); // 40% LTV

      // Withdraw 20 USDT collateral -> LTV = 40 / 80 = 50% <= 75% LLTV
      await market.connect(user).withdrawPart(ethers.parseEther("20"));
      expect(await market.connect(user).LTV(user.address)).to.equal(50n);

      // Repay all debt first
      await market.connect(user).repayFull();

      // Withdraw remaining collateral
      await market.connect(user).withdrawFull();
      const userMarket = await market.connect(user).getUserMarket();
      expect(userMarket[1]).to.equal(0n);
    });
  });

  describe("3. Transparent Upgradeable Proxy", function () {
    it("should correctly report proxy implementation and proxy admin", async function () {
      const proxyContract = await ethers.getContractAt("MyProxy", await proxy.getAddress());
      const adminAddress = await proxyContract.getProxyAdmin();
      const implAddress = await proxyContract.getProxyImplementation();

      expect(adminAddress).to.not.equal(ethers.ZeroAddress);
      expect(implAddress).to.equal(await marketImpl.getAddress());
    });
  });
});
