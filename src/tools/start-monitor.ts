import { z } from "zod";
import Database from "better-sqlite3";
import { WalletMonitor } from "../services/wallet-monitor.js";
import { getWatchlistCount } from "../db/queries.js";
import { checkLicense, requirePro } from "../utils/license.js";

export const startMonitorSchema = z.object({
  interval_seconds: z.number().int().min(10).max(300).optional().default(30),
});

export type StartMonitorInput = z.infer<typeof startMonitorSchema>;

export async function handleStartMonitor(db: Database.Database, monitor: WalletMonitor, input: StartMonitorInput): Promise<string> {
  const isPro = await checkLicense();
  if (!isPro) {
    return requirePro("start_monitor");
  }

  const status = monitor.getStatus();
  if (status.running) {
    return "Monitor is already running.";
  }

  const walletCount = getWatchlistCount(db);
  monitor.start(input.interval_seconds * 1000);

  let msg = `Monitor started. Checking wallets every ${input.interval_seconds} seconds.`;
  if (walletCount === 0) {
    msg += "\n\n**Note:** Your watchlist is empty. Use `watch_wallet` to add traders or `discover_traders` to find top performers.";
  }
  return msg;
}
