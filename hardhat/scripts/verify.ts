import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  const marketArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/Market.sol/Market.json"), "utf8")
  );
  const vaultArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/Vault.sol/Vault.json"), "utf8")
  );

  // Read addresses from synced front service
  const frontContractsPath = path.join(__dirname, "../../front/src/service/contracts.js");
  const frontContent = fs.readFileSync(frontContractsPath, "utf-8");

  // Read deployed_addresses.json
  const deployedPath = path.join(__dirname, "../ignition/deployments/chain-1337/deployed_addresses.json");
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf-8"));

  const proxyUSDT = new ethers.Contract(deployed["ProtocolModule#ProxyMarketUSDT"], marketArtifact.abi, provider);
  const proxyUSD1 = new ethers.Contract(deployed["ProtocolModule#ProxyMarketUSD1"], marketArtifact.abi, provider);
  const proxyDAI = new ethers.Contract(deployed["ProtocolModule#ProxyMarketDAI"], marketArtifact.abi, provider);
  const vaultUSDC = new ethers.Contract(deployed["ProtocolModule#VaultUSDC"], vaultArtifact.abi, provider);
  const vaultPryUSD = new ethers.Contract(deployed["ProtocolModule#VaultPryUSD"], vaultArtifact.abi, provider);

  console.log("=== Market 1 (USDT) ===");
  const m1 = await proxyUSDT.getMarket();
  console.log("Address:", deployed["ProtocolModule#ProxyMarketUSDT"]);
  console.log("Title:", m1[0], "| LLTV:", m1[3].toString() + "%", "| BorrowToken Bal (USDC):", ethers.formatEther(m1[14]));

  console.log("\n=== Market 2 (USD1) ===");
  const m2 = await proxyUSD1.getMarket();
  console.log("Address:", deployed["ProtocolModule#ProxyMarketUSD1"]);
  console.log("Title:", m2[0], "| LLTV:", m2[3].toString() + "%", "| BorrowToken Bal (USDC):", ethers.formatEther(m2[14]));

  console.log("\n=== Market 3 (DAI) ===");
  const m3 = await proxyDAI.getMarket();
  console.log("Address:", deployed["ProtocolModule#ProxyMarketDAI"]);
  console.log("Title:", m3[0], "| LLTV:", m3[3].toString() + "%", "| BorrowToken Bal (USDC):", ethers.formatEther(m3[14]));

  console.log("\n=== Vault 1 (USDC) ===");
  const v1 = await vaultUSDC.getVault();
  console.log("Address:", deployed["ProtocolModule#VaultUSDC"]);
  console.log("Title:", v1[2], "| Token:", v1[0], "| Remaining USDC Bal:", ethers.formatEther(v1[5]));

  console.log("\n=== Vault 2 (PryUSD) ===");
  const v2 = await vaultPryUSD.getVault();
  console.log("Address:", deployed["ProtocolModule#VaultPryUSD"]);
  console.log("Title:", v2[2], "| Token:", v2[0], "| PryUSD Bal:", ethers.formatEther(v2[5]));
}

main().catch(console.error);
