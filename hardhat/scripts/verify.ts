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

  const proxyUSDT = new ethers.Contract("0x8ee15B395f6c18eFECbde6806507637499693D23", marketArtifact.abi, provider);
  const proxyUSD1 = new ethers.Contract("0xE1866ebc74355F8E62383957bDd0eD26F47f88e1", marketArtifact.abi, provider);
  const proxyDAI = new ethers.Contract("0x30809E2bBD6c82C7ae10737e5f6F6e723D06ca73", marketArtifact.abi, provider);
  const vaultUSDC = new ethers.Contract("0x57b69fB7cB4a9029fAb81e634940097CEe0553b5", vaultArtifact.abi, provider);
  const vaultPryUSD = new ethers.Contract("0x0bEa56F4C9d4E1e0A78eDA5b7960ff12bd8737F7", vaultArtifact.abi, provider);

  console.log("=== Market 1 (USDT) ===");
  const m1 = await proxyUSDT.getMarket();
  console.log("Title:", m1[0], "| LLTV:", m1[3].toString() + "%", "| BorrowToken Bal (USDC):", ethers.formatEther(m1[14]));

  console.log("=== Market 2 (USD1) ===");
  const m2 = await proxyUSD1.getMarket();
  console.log("Title:", m2[0], "| LLTV:", m2[3].toString() + "%", "| BorrowToken Bal (USDC):", ethers.formatEther(m2[14]));

  console.log("=== Market 3 (DAI) ===");
  const m3 = await proxyDAI.getMarket();
  console.log("Title:", m3[0], "| LLTV:", m3[3].toString() + "%", "| BorrowToken Bal (USDC):", ethers.formatEther(m3[14]));

  console.log("=== Vault 1 (USDC) ===");
  const v1 = await vaultUSDC.getVault();
  console.log("Title:", v1[2], "| Token:", v1[0], "| Remaining USDC Bal:", ethers.formatEther(v1[5]));

  console.log("=== Vault 2 (PryUSD) ===");
  const v2 = await vaultPryUSD.getVault();
  console.log("Title:", v2[2], "| Token:", v2[0], "| PryUSD Bal:", ethers.formatEther(v2[5]));
}

main().catch(console.error);
