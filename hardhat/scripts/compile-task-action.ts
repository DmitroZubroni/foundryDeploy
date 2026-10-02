import { syncAbisToFrontend } from "./sync-frontend.js";

export default async function compileAction(args: any, hre: any, runSuper: any) {
  const result = await runSuper(args);
  try {
    console.log("\n[Sync] Auto-propagating compiled ABIs to frontend...");
    syncAbisToFrontend();
  } catch (e) {
    console.warn("[Sync] Failed to sync ABIs to frontend:", e);
  }
  return result;
}
