import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  const marketAbi = JSON.parse(fs.readFileSync(path.join(__dirname, "../../front/src/service/marketABI.json"), "utf8"));
  const vaultAbi = JSON.parse(fs.readFileSync(path.join(__dirname, "../../front/src/service/vaultABI.json"), "utf8"));
  const addresses = JSON.parse(fs.readFileSync(path.join(__dirname, "../../front/src/service/addresses.json"), "utf8"));

  const proxyUSDT = new ethers.Contract(addresses.market1, marketAbi, provider);
  const proxyUSD1 = new ethers.Contract(addresses.market2, marketAbi, provider);
  const proxyDAI = new ethers.Contract(addresses.market3, marketAbi, provider);
  const vaultUSDC = new ethers.Contract(addresses.vault1, vaultAbi, provider);
  const vaultPryUSD = new ethers.Contract(addresses.vault2, vaultAbi, provider);

  console.log("=== Market 1 (USDT) ===");
  const m1 = await proxyUSDT.getMarket();
  console.log("Address:", addresses.market1, "| Title:", m1[0], "| LLTV:", m1[3].toString() + "%");

  console.log("\n=== Market 2 (USD1) ===");
  const m2 = await proxyUSD1.getMarket();
  console.log("Address:", addresses.market2, "| Title:", m2[0], "| LLTV:", m2[3].toString() + "%");

  console.log("\n=== Market 3 (DAI) ===");
  const m3 = await proxyDAI.getMarket();
  console.log("Address:", addresses.market3, "| Title:", m3[0], "| LLTV:", m3[3].toString() + "%");

  console.log("\n=== Vault 1 (USDC) ===");
  const v1 = await vaultUSDC.getVault();
  console.log("Address:", addresses.vault1, "| Title:", v1[2]);

  console.log("\n=== Vault 2 (PryUSD) ===");
  const v2 = await vaultPryUSD.getVault();
  console.log("Address:", addresses.vault2, "| Title:", v2[2]);
}

main().catch(console.error);
