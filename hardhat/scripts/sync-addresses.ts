import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function syncAddresses() {
  const depPath = path.join(__dirname, "../ignition/deployments/chain-1337/deployed_addresses.json");
  if (!fs.existsSync(depPath)) return;

  const deployed = JSON.parse(fs.readFileSync(depPath, "utf-8"));

  const addresses = {
    market1: deployed["ProtocolModule#ProxyMarketUSDT"] || "",
    market2: deployed["ProtocolModule#ProxyMarketUSD1"] || "",
    market3: deployed["ProtocolModule#ProxyMarketDAI"] || "",
    vault1: deployed["ProtocolModule#VaultUSDC"] || "",
    vault2: deployed["ProtocolModule#VaultPryUSD"] || "",
  };

  const frontPath = path.join(__dirname, "../../front/src/service/addresses.json");
  fs.writeFileSync(frontPath, JSON.stringify(addresses, null, 2));
  console.log("[Sync] Updated front/src/service/addresses.json with new addresses!");
}

if (process.argv.some((arg) => arg.includes("sync-addresses"))) {
  syncAddresses();
}
