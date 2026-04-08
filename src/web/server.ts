import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import Database from "better-sqlite3";
import { getWatchlist, getTradeHistory, getTradeStats, addToWatchlist, removeFromWatchlist } from "../db/queries.js";
import { BudgetManager } from "../services/budget-manager.js";
import { WalletMonitor } from "../services/wallet-monitor.js";
import { TradeExecutor } from "../services/trade-executor.js";
import { discoverTraders } from "../services/leaderboard.js";
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

  app.post("/api/monitor/start", (_req, res) => {
    if (monitor.getStatus().running) {
      res.json({ ok: true, message: "Already running" });
    } else {
      monitor.start(30_000);
      res.json({ ok: true, message: "Monitor started" });
    }
  });

  app.post("/api/monitor/stop", (_req, res) => {
    if (!monitor.getStatus().running) {
      res.json({ ok: true, message: "Already stopped" });
    } else {
      monitor.stop();
      res.json({ ok: true, message: "Monitor stopped" });
    }
  });

  app.use(express.json());

  // Agent cycles API
  app.get("/api/agents", (_req, res) => {
    const agents = db.prepare(`
      SELECT agent_name, strategy,
        MAX(created_at) as last_cycle,
        COUNT(*) as total_cycles
      FROM agent_cycles
      GROUP BY agent_name
      ORDER BY last_cycle DESC
    `).all();
    res.json({ ok: true, agents });
  });

  app.get("/api/agents/:name/cycles", (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const cycles = db.prepare(
      "SELECT * FROM agent_cycles WHERE agent_name = ? ORDER BY created_at DESC LIMIT ?"
    ).all(req.params.name, limit);
    res.json({ ok: true, cycles });
  });

  app.get("/api/agents/summary", (_req, res) => {
    // Latest cycle per agent
    const latest = db.prepare(`
      SELECT ac.* FROM agent_cycles ac
      INNER JOIN (
        SELECT agent_name, MAX(id) as max_id FROM agent_cycles GROUP BY agent_name
      ) latest ON ac.id = latest.max_id
      ORDER BY ac.created_at DESC
    `).all();

    // Global stats
    const stats = getTradeStats(db);
    const remaining = budgetManager.getRemainingBudget();
    const dailyLimit = budgetManager.getDailyLimit();

    res.json({
      ok: true,
      agents: latest,
      global: {
        totalPnl: stats.totalPnl,
        winRate: stats.winRate,
        totalTrades: stats.total,
        wins: stats.wins,
        losses: stats.losses,
        budgetUsed: dailyLimit - remaining,
        budgetLimit: dailyLimit,
        budgetRemaining: remaining,
      },
    });
  });

  app.get("/api/discover-traders", async (req, res) => {
    try {
      const period = (req.query.period as string) === "WEEK" ? "WEEK" : "ALL";
      const minVolume = parseInt(req.query.min_volume as string) || 1000;
      const minPnl = parseInt(req.query.min_pnl as string) || 0;
      const traders = await discoverTraders({ pages: 2, period, minVolume, minPnl });
      res.json({ ok: true, traders });
    } catch (err) {
      log("error", `Discover traders API error: ${err}`);
      res.json({ ok: false, traders: [], error: String(err) });
    }
  });

  app.post("/api/watchlist/add", (req, res) => {
    try {
      const { address, alias, volume, pnl } = req.body;
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        res.json({ ok: false, error: "Invalid address" });
        return;
      }
      addToWatchlist(db, { address, alias: alias || null, roi: 0, volume: volume || 0, pnl: pnl || 0, trade_count: 0 });
      log("info", `Watchlist: added ${alias || address} via dashboard`);
      res.json({ ok: true });
    } catch (err) {
      res.json({ ok: false, error: String(err) });
    }
  });

  app.post("/api/watchlist/remove", (req, res) => {
    try {
      const { address } = req.body;
      if (!address) { res.json({ ok: false, error: "Missing address" }); return; }
      removeFromWatchlist(db, address);
      log("info", `Watchlist: removed ${address} via dashboard`);
      res.json({ ok: true });
    } catch (err) {
      res.json({ ok: false, error: String(err) });
    }
  });

  app.listen(port, () => {
    log("info", `API server running at http://localhost:${port}`);
  });
}
