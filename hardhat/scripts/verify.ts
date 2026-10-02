import { ethers } from "ethers";
import * as fs from "fs";

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  const marketArtifact = JSON.parse(
    fs.readFileSync("artifacts/contracts/Market.sol/Market.json", "utf8")
  );
  const vaultArtifact = JSON.parse(
    fs.readFileSync("artifacts/contracts/Vault.sol/Vault.json", "utf8")
  );

  const proxyUSDT = new ethers.Contract("0xAd271B210f336Ee377c220DB1Afcdf44d23270eE", marketArtifact.abi, provider);
  const proxyUSD1 = new ethers.Contract("0x95DBCa6Ede428Aa05d2dD1E3A59d27979E05Cc65", marketArtifact.abi, provider);
  const proxyDAI = new ethers.Contract("0xF0b1b2A91AF3B0a0a5389eA80bFfDC42CF86B7e3", marketArtifact.abi, provider);
  const vaultUSDC = new ethers.Contract("0x90Ea96DBA5bbbb4D2F798C47FE23453054c0FAB4", vaultArtifact.abi, provider);

  console.log("=== Market 1 (USDT) ===");
  const m1 = await proxyUSDT.getMarket();
  console.log("Title:", m1[0], "| LLTV:", m1[3].toString() + "%", "| BorrowToken Bal (USDC):", ethers.formatEther(m1[14]));

  console.log("=== Market 2 (USD1) ===");
  const m2 = await proxyUSD1.getMarket();
  console.log("Title:", m2[0], "| LLTV:", m2[3].toString() + "%", "| BorrowToken Bal (USDC):", ethers.formatEther(m2[14]));

  console.log("=== Market 3 (DAI) ===");
  const m3 = await proxyDAI.getMarket();
  console.log("Title:", m3[0], "| LLTV:", m3[3].toString() + "%", "| BorrowToken Bal (USDC):", ethers.formatEther(m3[14]));

  console.log("=== Vault USDC ===");
  const v1 = await vaultUSDC.getVault();
  console.log("Title:", v1[2], "| Remaining USDC Bal:", ethers.formatEther(v1[5]));
}

main().catch(console.error);
