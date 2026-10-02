import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig, overrideTask } from "hardhat/config";
import { definePlugin } from "hardhat/plugins";

const syncFrontendPlugin = definePlugin({
  id: "sync-frontend-plugin",
  npmPackage: null,
  dependencies: () => [import("@nomicfoundation/hardhat-ignition")],
  tasks: [
    overrideTask(["ignition", "deploy"])
      .setAction(() => import("./scripts/deploy-task-action.js"))
      .build(),
    overrideTask("compile")
      .setAction(() => import("./scripts/compile-task-action.js"))
      .build(),
  ],
});

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin, syncFrontendPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.34",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
      production: {
        version: "0.8.34",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
      accounts: "remote", // либо массив приватных ключей ["0x..."]
    },
  },
  ignition: {
    requiredConfirmations: 1,
  },
});
