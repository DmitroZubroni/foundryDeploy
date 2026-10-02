import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ProtocolModule", (m) => {
  // Аккаунты пользователей для первичного минта токенов (5000 каждого токена)
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

  // 2. Деплой Vault 1 (на базе USDC) и Vault 2 (на базе PryUSD)
  const vaultUSDC = m.contract("Vault", [usdc, "Vault USDC"], {
    id: "VaultUSDC",
  });

  const vaultPryUSD = m.contract("Vault", [pryUsd, "Vault PryUSD"], {
    id: "VaultPryUSD",
  });

  // 3. Деплой имплементации маркета
  const marketImpl = m.contract("Market", [], {
    id: "MarketImplementation",
  });

  // Общие параметры инициализации маркетов:
  // курсы (100 = 100%), начальный borrowIndex = 100, LLTV = 70%, InterestRate = 10%
  const usdtCost = 100n;
  const usd1Cost = 100n;
  const usdcCost = 100n;
  const daiCost = 100n;
  const borrowIndex = 100n;
  const lltv = 70n;
  const interestRate = 10n;
  const version = 1n;

  // 4. Инициализация и деплой Proxy для Маркета 1 (залог: USDT, заём: USDC)
  const initDataMarket1 = m.encodeFunctionCall(
    marketImpl,
    "init",
    [
      usdtCost,
      usd1Cost,
      usdcCost,
      daiCost,
      borrowIndex,
      "Market USDT/USDC",
      lltv,
      vaultUSDC,
      admin,
      interestRate,
      usdt,
      usdc,
      version,
    ],
    { id: "EncodeInitMarket1" }
  );

  const proxyMarket1 = m.contract("MyProxy", [marketImpl, initDataMarket1], {
    id: "ProxyMarketUSDT",
  });

  // 5. Инициализация и деплой Proxy для Маркета 2 (залог: USD1, заём: USDC)
  const initDataMarket2 = m.encodeFunctionCall(
    marketImpl,
    "init",
    [
      usdtCost,
      usd1Cost,
      usdcCost,
      daiCost,
      borrowIndex,
      "Market USD1/USDC",
      lltv,
      vaultUSDC,
      admin,
      interestRate,
      usd1,
      usdc,
      version,
    ],
    { id: "EncodeInitMarket2" }
  );

  const proxyMarket2 = m.contract("MyProxy", [marketImpl, initDataMarket2], {
    id: "ProxyMarketUSD1",
  });

  // 6. Инициализация и деплой Proxy для Маркета 3 (залог: DAI, заём: USDC)
  const initDataMarket3 = m.encodeFunctionCall(
    marketImpl,
    "init",
    [
      usdtCost,
      usd1Cost,
      usdcCost,
      daiCost,
      borrowIndex,
      "Market DAI/USDC",
      lltv,
      vaultUSDC,
      admin,
      interestRate,
      dai,
      usdc,
      version,
    ],
    { id: "EncodeInitMarket3" }
  );

  const proxyMarket3 = m.contract("MyProxy", [marketImpl, initDataMarket3], {
    id: "ProxyMarketDAI",
  });

  // 7. Распределение первичной ликвидности из Vault USDC по трем маркетам
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
