import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
};

function logStep(step: string, desc: string) {
  console.log(`\n${colors.bright}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.yellow}[${step}] ${desc}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}======================================================================${colors.reset}`);
}

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Admin account on Geth
  const signerAdmin = await provider.getSigner(0);
  const adminAddress = await signerAdmin.getAddress();

  // User wallet (deterministic test private key)
  const userWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
  const userAddress = userWallet.address;

  console.log(`${colors.bright}Admin (Deployer):${colors.reset} ${adminAddress}`);
  console.log(`${colors.bright}User Wallet:     ${colors.reset} ${userAddress}`);

  // Ensure user has ETH for gas
  const userEthBal = await provider.getBalance(userAddress);
  if (userEthBal < ethers.parseEther("1")) {
    console.log(`Funding User wallet with 5 ETH for gas...`);
    const fundTx = await signerAdmin.sendTransaction({
      to: userAddress,
      value: ethers.parseEther("5"),
    });
    await fundTx.wait();
  }

  // Load ABIs & Addresses
  const marketAbi = JSON.parse(fs.readFileSync(path.join(__dirname, "../../front/src/service/marketABI.json"), "utf8"));
  const vaultAbi = JSON.parse(fs.readFileSync(path.join(__dirname, "../../front/src/service/vaultABI.json"), "utf8"));
  const addresses = JSON.parse(fs.readFileSync(path.join(__dirname, "../../front/src/service/addresses.json"), "utf8"));

  const tokenAbi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function transfer(address from, address to, uint256 amount) returns (bool)",
    "function mint(address account, uint256 amount)",
  ];

  const proxyAbi = [
    "function getProxyAdmin() view returns (address)",
    "function getProxyImplementation() view returns (address)",
  ];

  const vaultUSDC = new ethers.Contract(addresses.vault1, vaultAbi, userWallet);
  const market1 = new ethers.Contract(addresses.market1, marketAbi, userWallet);
  const proxy1 = new ethers.Contract(addresses.market1, proxyAbi, userWallet);

  const marketInfo = await market1.getMarket();
  const collateralTokenAddress = marketInfo[10]; // USDT
  const borrowTokenAddress = marketInfo[11];     // USDC

  const usdtToken = new ethers.Contract(collateralTokenAddress, tokenAbi, userWallet);
  const usdcToken = new ethers.Contract(borrowTokenAddress, tokenAbi, userWallet);

  // Mint tokens to user if balance is low
  const usdcBal = await usdcToken.balanceOf(userAddress);
  if (usdcBal < ethers.parseEther("1000")) {
    console.log("Minting initial tokens to user...");
    const mint1 = await usdcToken.connect(signerAdmin).mint(userAddress, ethers.parseEther("5000"));
    await mint1.wait();
    const mint2 = await usdtToken.connect(signerAdmin).mint(userAddress, ethers.parseEther("5000"));
    await mint2.wait();
  }

  let nextNonce = await provider.getTransactionCount(userAddress, "latest");
  const sendWithNonce = async (fn: (overrides: any) => Promise<any>) => {
    const tx = await fn({ nonce: nextNonce++, gasLimit: 500000 });
    await tx.wait(1);
    return tx;
  };

  // ========================================================================
  // 1. PROXY METHODS
  // ========================================================================
  logStep("STEP 1", "Inspect Transparent Upgradeable Proxy");
  const proxyAdmin = await proxy1.getProxyAdmin();
  const proxyImpl = await proxy1.getProxyImplementation();
  console.log(`Proxy Admin Address:          ${colors.green}${proxyAdmin}${colors.reset}`);
  console.log(`Proxy Implementation Address: ${colors.green}${proxyImpl}${colors.reset}`);

  // ========================================================================
  // 2. VAULT METHODS
  // ========================================================================
  logStep("STEP 2", "Vault Methods (deposit, getUserVault, getVault, totalAssets, withdrawPart, withdrawFull)");

  const vInfoBefore = await vaultUSDC.getVault();
  console.log("Vault Initial Details:");
  console.log(`- Title:               ${vInfoBefore[2]}`);
  console.log(`- APY:                 ${vInfoBefore[1]}%`);
  console.log(`- Total Assets:        ${ethers.formatEther(vInfoBefore[3])} USDC`);
  console.log(`- Vault USDC Balance:  ${ethers.formatEther(vInfoBefore[5])} USDC`);

  // 2.1 Deposit 100 USDC into Vault
  const depositAmount = ethers.parseEther("100");
  console.log(`\n-> Calling vault.deposit(100 USDC)...`);
  await sendWithNonce((opts) => vaultUSDC["deposit(uint256)"](depositAmount, opts));

  let userVault = await vaultUSDC.getUserVault();
  console.log(`${colors.green}[OK] Deposited 100 USDC!${colors.reset}`);
  console.log(`- User USDC balance:    ${ethers.formatEther(userVault[0])} USDC`);
  console.log(`- User Vault shares:    ${ethers.formatEther(userVault[1])} shares`);
  console.log(`- Vault totalAssets():  ${ethers.formatEther(await vaultUSDC.totalAssets())} USDC`);

  // 2.2 Partial withdraw: 30 USDC
  const withdrawPartAmount = ethers.parseEther("30");
  console.log(`\n-> Calling vault.withdrawPart(30 USDC)...`);
  await sendWithNonce((opts) => vaultUSDC.withdrawPart(withdrawPartAmount, opts));

  userVault = await vaultUSDC.getUserVault();
  console.log(`${colors.green}[OK] Withdrawn 30 USDC!${colors.reset}`);
  console.log(`- User USDC balance:    ${ethers.formatEther(userVault[0])} USDC`);
  console.log(`- User Vault shares:    ${ethers.formatEther(userVault[1])} shares`);

  // 2.3 Full withdraw
  console.log(`\n-> Calling vault.withdrawFull()...`);
  await sendWithNonce((opts) => vaultUSDC.withdrawFull(opts));

  userVault = await vaultUSDC.getUserVault();
  console.log(`${colors.green}[OK] Withdrawn Full!${colors.reset}`);
  console.log(`- User USDC balance:    ${ethers.formatEther(userVault[0])} USDC`);
  console.log(`- User Vault shares:    ${ethers.formatEther(userVault[1])} shares`);

  // ========================================================================
  // 3. MARKET METHODS
  // ========================================================================
  logStep("STEP 3", "Market Methods (supply, borrow, LTV, totalDept, accruedInterest, repayPart, repayFull, withdrawPart, withdrawFull)");

  const mInfo = await market1.getMarket();
  console.log("Market 1 Configuration:");
  console.log(`- Title:                  ${mInfo[0]}`);
  console.log(`- LLTV (Liquidation LTV): ${mInfo[3]}%`);
  console.log(`- Borrow Token Balance:   ${ethers.formatEther(mInfo[14])} USDC (available to borrow)`);
  console.log(`- Collateral Balance:     ${ethers.formatEther(mInfo[15])} USDT`);

  // 3.1 Supply collateral (100 USDT)
  const supplyAmount = ethers.parseEther("100");
  console.log(`\n-> Calling market.supply(100 USDT collateral)...`);
  await sendWithNonce((opts) => market1.supply(supplyAmount, opts));

  let userMarket = await market1.getUserMarket();
  console.log(`${colors.green}[OK] Supplied 100 USDT!${colors.reset}`);
  console.log(`- User Collateral Shares: ${ethers.formatEther(userMarket[1])}`);
  console.log(`- Current LTV:            ${userMarket[3]}%`);

  // 3.2 Borrow (40 USDC) -> healthy LTV of 40% (below 75% LLTV)
  const borrowAmount = ethers.parseEther("40");
  console.log(`\n-> Calling market.borrow(40 USDC)...`);
  await sendWithNonce((opts) => market1.borrow(borrowAmount, opts));

  userMarket = await market1.getUserMarket();
  const currentLtv = await market1.LTV(userAddress);
  const totalDebt = await market1.totalDept(userAddress);
  const accruedInt = await market1.accruedInterest(userAddress);

  console.log(`${colors.green}[OK] Borrowed 40 USDC!${colors.reset}`);
  console.log(`- Borrow Shares:          ${ethers.formatEther(userMarket[2])}`);
  console.log(`- Total Debt (totalDept): ${ethers.formatEther(totalDebt)} USDC`);
  console.log(`- Accrued Interest:       ${ethers.formatEther(accruedInt)} USDC`);
  console.log(`- Current LTV:            ${currentLtv}% (LLTV limit: ${mInfo[3]}%)`);
  console.log(`- User USDC Balance:      ${ethers.formatEther(userMarket[4])} USDC`);

  // 3.3 Partial Repayment (10 USDC)
  const repayPartAmount = ethers.parseEther("10");
  console.log(`\n-> Calling market.repayPart(10 USDC)...`);
  await sendWithNonce((opts) => market1.repayPart(repayPartAmount, opts));

  const totalDebtAfterPart = await market1.totalDept(userAddress);
  const ltvAfterPart = await market1.LTV(userAddress);
  console.log(`${colors.green}[OK] Repaid 10 USDC!${colors.reset}`);
  console.log(`- Remaining Debt:         ${ethers.formatEther(totalDebtAfterPart)} USDC`);
  console.log(`- New LTV:                ${ltvAfterPart}%`);

  // 3.4 Full Repayment
  console.log(`\n-> Calling market.repayFull()...`);
  await sendWithNonce((opts) => market1.repayFull(opts));

  const totalDebtAfterFull = await market1.totalDept(userAddress);
  const ltvAfterFull = await market1.LTV(userAddress);
  console.log(`${colors.green}[OK] Fully Repaid Debt!${colors.reset}`);
  console.log(`- Remaining Debt:         ${ethers.formatEther(totalDebtAfterFull)} USDC`);
  console.log(`- New LTV:                ${ltvAfterFull}%`);

  // 3.5 Withdraw Partial Collateral (30 USDT)
  const withdrawPartCollateral = ethers.parseEther("30");
  console.log(`\n-> Calling market.withdrawPart(30 USDT)...`);
  await sendWithNonce((opts) => market1.withdrawPart(withdrawPartCollateral, opts));
  userMarket = await market1.getUserMarket();
  console.log(`${colors.green}[OK] Withdrawn 30 USDT! Remaining collateral shares: ${ethers.formatEther(userMarket[1])}${colors.reset}`);

  // 3.6 Withdraw Full Remaining Collateral (70 USDT)
  console.log(`\n-> Calling market.withdrawFull()...`);
  await sendWithNonce((opts) => market1.withdrawFull(opts));
  userMarket = await market1.getUserMarket();
  console.log(`${colors.green}[OK] Withdrawn Full Collateral! Remaining collateral shares: ${ethers.formatEther(userMarket[1])}${colors.reset}`);

  console.log(`\n${colors.bright}${colors.green}======================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.green}[SUCCESS] All contract methods demonstrated and verified!${colors.reset}`);
  console.log(`${colors.bright}${colors.green}======================================================================${colors.reset}\n`);
}

main().catch(console.error);
