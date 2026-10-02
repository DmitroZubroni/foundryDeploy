import { syncToFrontend } from "./sync-frontend.js";

export default async function deployAction(args: any, hre: any, runSuper: any) {
  const result = await runSuper(args);
  try {
    console.log("\n[Sync] Auto-propagating deployed contract addresses to frontend...");
    syncToFrontend(args?.deploymentId);
  } catch (e) {
    console.warn("[Sync] Failed to auto-sync to frontend:", e);
  }
  return result;
}
