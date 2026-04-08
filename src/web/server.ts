import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { getWatchlist, getTradeHistory, getTradeStats } from "../db/queries.js";
import { BudgetManager } from "../services/budget-manager.js";
import { WalletMonitor } from "../services/wallet-monitor.js";
import { TradeExecutor } from "../services/trade-executor.js";
import { getRecentLogs } from "../utils/logger.js";
import { log } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function startWebDashboard(
  db: Database.Database,
  budgetManager: BudgetManager,
  monitor: WalletMonitor,
  executor: TradeExecutor,
  port: number
): void {
  const app = express();

  app.use(express.static(path.join(__dirname, "public")));

  app.get("/api/dashboard", (_req, res) => {
    const stats = getTradeStats(db);
    const remaining = budgetManager.getRemainingBudget();
    const dailyLimit = budgetManager.getDailyLimit();
    const watchlist = getWatchlist(db);
    const recentTrades = getTradeHistory(db, { limit: 20 });
    const monitorStatus = monitor.getStatus();
    const logs = getRecentLogs(20);

    res.json({
      mode: executor.getMode(),
      budget: { spent: dailyLimit - remaining, limit: dailyLimit, remaining },
      stats,
      watchlist,
      recentTrades,
      monitor: monitorStatus,
      logs,
    });
  });

  app.listen(port, () => {
    log("info", `Web dashboard running at http://localhost:${port}`);
  });
}
