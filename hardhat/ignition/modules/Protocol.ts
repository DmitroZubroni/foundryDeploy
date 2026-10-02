import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ProtocolModule", (m) => {
  // Аккаунты для первичного минта токенов (по 5000 каждого токена)
  const admin = m.getAccount(0);
  const user1 = m.getAccount(1);
  const user2 = m.getAccount(2);
  const user3 = m.getAccount(3);

  // 1. Деплой токенов
  const usdc = m.contract("USDC", [user1, user2, user3]);
  const pryUsd = m.contract("PryUSD", [user1, user2, user3]);
  const usdt = m.contract("USDT", [user1, user2, user3]);
  const usd1 = m.contract("USD1", [user1, user2, user3]);
  const dai = m.contract("DAI", [user1, user2, user3]);

  // 2. Деплой Vault 1 и Vault 2
  // Vault 1: Title "Vault1", Share name "profiUSDC1", базовый токен USDC, APY 10%
  const vaultUSDC = m.contract("Vault", [usdc, "Vault1", "profiUSDC1", "profiUSDC1"], {
    id: "VaultUSDC",
  });

  // Vault 2: Title "Vault 2", Share name "profiUSDC2", базовый токен PryUSD, APY 10%
  const vaultPryUSD = m.contract("Vault", [pryUsd, "Vault 2", "profiUSDC2", "profiUSDC2"], {
    id: "VaultPryUSD",
  });

  // 3. Деплой имплементации маркета
  const marketImpl = m.contract("Market", [], {
    id: "MarketImplementation",
  });

  // Общие параметры спецификации Protogen2.0
  const usdtCost = 100n;
  const usd1Cost = 100n;
  const usdcCost = 100n;
  const daiCost = 100n;
  const currentBorrowIndex = 1_000_000_000_000_000_000n; // 1 * 1e18
  const version = 1n;

  // 4. Инициализация и деплой Proxy для Market1 (залог: USDT, заём: USDC)
  // Title: "Market1", Share name: "shareMarket1", LLTV: 75%, InterestRate: 317 * 1e8
  const initDataMarket1 = m.encodeFunctionCall(
    marketImpl,
    "init",
    [
      usdtCost,
      usd1Cost,
      usdcCost,
      daiCost,
      currentBorrowIndex,
      "Market1",
      "shareMarket1",
      75n, // 75%
      vaultUSDC,
      admin,
      31_700_000_000n, // 317 * 1e8
      usdt,
      usdc,
      version,
    ],
    { id: "EncodeInitMarket1" }
  );

  const proxyMarket1 = m.contract("MyProxy", [marketImpl, initDataMarket1], {
    id: "ProxyMarketUSDT",
  });

  // 5. Инициализация и деплой Proxy для Market2 (залог: USD1, заём: USDC)
  // Title: "Market2", Share name: "shareMarket2", LLTV: 80%, InterestRate: 500 * 1e8
  const initDataMarket2 = m.encodeFunctionCall(
    marketImpl,
    "init",
    [
      usdtCost,
      usd1Cost,
      usdcCost,
      daiCost,
      currentBorrowIndex,
      "Market2",
      "shareMarket2",
      80n, // 80%
      vaultUSDC,
      admin,
      50_000_000_000n, // 500 * 1e8
      usd1,
      usdc,
      version,
    ],
    { id: "EncodeInitMarket2" }
  );

  const proxyMarket2 = m.contract("MyProxy", [marketImpl, initDataMarket2], {
    id: "ProxyMarketUSD1",
  });

  // 6. Инициализация и деплой Proxy для Market3 (залог: DAI, заём: USDC)
  // Title: "Market3", Share name: "shareMarket3", LLTV: 85%, InterestRate: 350 * 1e8
  const initDataMarket3 = m.encodeFunctionCall(
    marketImpl,
    "init",
    [
      usdtCost,
      usd1Cost,
      usdcCost,
      daiCost,
      currentBorrowIndex,
      "Market3",
      "shareMarket3",
      85n, // 85%
      vaultUSDC,
      admin,
      35_000_000_000n, // 350 * 1e8
      dai,
      usdc,
      version,
    ],
    { id: "EncodeInitMarket3" }
  );

  const proxyMarket3 = m.contract("MyProxy", [marketImpl, initDataMarket3], {
    id: "ProxyMarketDAI",
  });

  // 7. Распределение первичной ликвидности из Vault 1 (USDC) по трем маркетам
  m.call(
    vaultUSDC,
    "destributeToMarkets",
    [proxyMarket1, proxyMarket2, proxyMarket3],
    { id: "DistributeUSDCLiquidity" }
  );

  return {
    usdc,
    pryUsd,
    usdt,
    usd1,
    dai,
    vaultUSDC,
    vaultPryUSD,
    marketImpl,
    proxyMarket1,
    proxyMarket2,
    proxyMarket3,
  };
});
