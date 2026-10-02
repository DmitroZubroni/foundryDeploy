import { syncAddresses } from "./sync-addresses.js";

export default async function deployAction(args: any, hre: any, runSuper: any) {
  const result = await runSuper(args);
  try {
    syncAddresses();
  } catch (e) {
    console.warn("[Sync] Failed to sync addresses to frontend:", e);
  }
  return result;
}
