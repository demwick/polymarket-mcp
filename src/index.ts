#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

import { initializeDb } from "./db/schema.js";
import { getConfig, hasLiveCredentials, validateLiveCredentials } from "./utils/config.js";
import { log } from "./utils/logger.js";

import { BudgetManager } from "./services/budget-manager.js";
import { TradeExecutor } from "./services/trade-executor.js";
import { WalletMonitor } from "./services/wallet-monitor.js";

import { discoverTradersSchema, handleDiscoverTraders } from "./tools/discover-traders.js";
import { watchWalletSchema, handleWatchWallet } from "./tools/watch-wallet.js";
import { handleListWatchlist } from "./tools/list-watchlist.js";
import { startMonitorSchema, handleStartMonitor } from "./tools/start-monitor.js";
import { handleStopMonitor } from "./tools/stop-monitor.js";
import { handleGetDashboard } from "./tools/get-dashboard.js";
import { tradeHistorySchema, handleGetTradeHistory } from "./tools/get-trade-history.js";
import { setConfigSchema, handleSetConfig } from "./tools/set-config.js";
import { goLiveSchema, handleGoLive } from "./tools/go-live.js";

import { PositionTracker } from "./services/position-tracker.js";
import { analyzeTraderSchema, handleAnalyzeTrader } from "./tools/analyze-trader.js";
import { getTraderPositionsSchema, handleGetTraderPositions } from "./tools/get-trader-positions.js";
import { getPositionsSchema, handleGetPositions } from "./tools/get-positions.js";
import { closePositionSchema, handleClosePosition } from "./tools/close-position.js";
import { discoverMarketsSchema, handleDiscoverMarkets } from "./tools/discover-markets.js";
import { getPriceSchema, handleGetPrice } from "./tools/get-price.js";
import { discoverWtaSchema, handleDiscoverWta } from "./tools/discover-wta.js";
import { placeStinkBidSchema, handlePlaceStinkBid } from "./tools/place-stink-bid.js";
import { cancelOrdersSchema, handleCancelOrders } from "./tools/cancel-orders.js";
import { logCycleSchema, handleLogCycle } from "./tools/log-cycle.js";
import { handleCheckExits } from "./tools/check-exits.js";

import { startWebDashboard } from "./web/server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "copytrader.db");

const config = getConfig();
const db = new Database(DB_PATH);
initializeDb(db);

const budgetManager = new BudgetManager(db, config.DAILY_BUDGET);
const tradeExecutor = new TradeExecutor(db, config.COPY_MODE);
const positionTracker = new PositionTracker(db);
const walletMonitor = new WalletMonitor(db, budgetManager, tradeExecutor, config.MIN_CONVICTION, 300, positionTracker);

const server = new McpServer({
  name: "polymarket-copy-trader",
  version: "1.0.0",
});

server.tool(
  "discover_traders",
  "Discover top traders from Polymarket leaderboard by PnL, volume, and ROI",
  discoverTradersSchema.shape,
  async (input) => ({ content: [{ type: "text" as const, text: await handleDiscoverTraders(db, discoverTradersSchema.parse(input)) }] })
);

server.tool(
  "watch_wallet",
  "Add or remove a wallet address from the watchlist",
  watchWalletSchema.shape,
  async (input) => ({ content: [{ type: "text" as const, text: await handleWatchWallet(db, watchWalletSchema.parse(input)) }] })
);

server.tool(
  "list_watchlist",
  "Show all watched wallet addresses",
  {},
  async () => ({ content: [{ type: "text" as const, text: handleListWatchlist(db) }] })
);

server.tool(
  "start_monitor",
  "Start the wallet monitoring loop to detect and copy new trades (Pro)",
  startMonitorSchema.shape,
  async (input) => ({ content: [{ type: "text" as const, text: await handleStartMonitor(db, walletMonitor, startMonitorSchema.parse(input)) }] })
);

server.tool(
  "stop_monitor",
  "Stop the wallet monitoring loop (Pro)",
  {},
  async () => ({ content: [{ type: "text" as const, text: await handleStopMonitor(walletMonitor) }] })
);

server.tool(
  "get_dashboard",
  "Get a terminal-formatted dashboard with budget, P&L, trades, and watchlist status",
  {},
  async () => ({ content: [{ type: "text" as const, text: await handleGetDashboard(db, budgetManager, walletMonitor, tradeExecutor.getMode()) }] })
);

server.tool(
  "get_trade_history",
  "Get trade history with optional filters (Pro)",
  tradeHistorySchema.shape,
  async (input) => ({ content: [{ type: "text" as const, text: await handleGetTradeHistory(db, tradeHistorySchema.parse(input)) }] })
);

server.tool(
  "set_config",
  "Update bot configuration like daily_budget or min_conviction (Pro)",
  setConfigSchema.shape,
  async (input) => ({ content: [{ type: "text" as const, text: await handleSetConfig(db, budgetManager, setConfigSchema.parse(input)) }] })
);

server.tool(
  "go_live",
  "Switch from preview to live mode — requires API credentials in .env (Pro)",
  goLiveSchema.shape,
  async (input) => ({ content: [{ type: "text" as const, text: await handleGoLive(tradeExecutor, goLiveSchema.parse(input)) }] })
);

server.tool(
  "analyze_trader",
  "Get detailed analysis of a trader's profile, win rate, and recent activity",
  analyzeTraderSchema.shape,
  async (input) => ({ content: [{ type: "text" as const, text: await handleAnalyzeTrader(analyzeTraderSchema.parse(input)) }] })
);

server.tool(
  "get_trader_positions",
  "View a trader's current open positions on Polymarket (Pro)",
  getTraderPositionsSchema.shape,
  async (input) => ({ content: [{ type: "text" as const, text: await handleGetTraderPositions(getTraderPositionsSchema.parse(input)) }] })
);

server.tool(
  "get_positions",
  "View your copy trading positions — open, closed, or all",
  getPositionsSchema.shape,
  async (input) => ({ content: [{ type: "text" as const, text: await handleGetPositions(db, getPositionsSchema.parse(input)) }] })
);

server.tool(
  "close_position",
  "Manually close a copy trading position (Pro)",
  closePositionSchema.shape,
  async (input) => ({ content: [{ type: "text" as const, text: await handleClosePosition(db, closePositionSchema.parse(input)) }] })
);

server.tool(
  "discover_markets",
  "Find active markets by end date (today/this_week/all) and category — great for finding fast-resolving markets",
  discoverMarketsSchema.shape,
  async (input) => ({ content: [{ type: "text" as const, text: await handleDiscoverMarkets(discoverMarketsSchema.parse(input)) }] })
);

server.tool(
  "get_price",
  "Get live market prices (bid/ask/spread) or current value of all open positions",
  getPriceSchema.shape,
  async (input) => ({ content: [{ type: "text" as const, text: await handleGetPrice(db, getPriceSchema.parse(input)) }] })
);

server.tool(
  "discover_wta",
  "Find today's WTA tennis matches on Polymarket with stink bid prices (favorite at discount)",
  discoverWtaSchema.shape,
  async (input) => ({ content: [{ type: "text" as const, text: await handleDiscoverWta(discoverWtaSchema.parse(input)) }] })
);

server.tool(
  "place_stink_bid",
  "Place stink bids (limit orders at discount) on all today's WTA favorites (Pro)",
  placeStinkBidSchema.shape,
  async (input) => ({ content: [{ type: "text" as const, text: await handlePlaceStinkBid(db, tradeExecutor, placeStinkBidSchema.parse(input)) }] })
);

server.tool(
  "cancel_orders",
  "Cancel all open/pending limit orders on Polymarket (Pro, live mode only)",
  cancelOrdersSchema.shape,
  async () => ({ content: [{ type: "text" as const, text: await handleCancelOrders(tradeExecutor) }] })
);

server.tool(
  "check_exits",
  "Check all open positions for resolution (market resolved or trader exit) and update P&L",
  {},
  async () => ({ content: [{ type: "text" as const, text: await handleCheckExits(db) }] })
);

server.tool(
  "log_cycle",
  "Log an agent cycle result to the database for dashboard tracking",
  logCycleSchema.shape,
  (input) => ({ content: [{ type: "text" as const, text: handleLogCycle(db, logCycleSchema.parse(input)) }] })
);

// Start web dashboard
startWebDashboard(db, budgetManager, walletMonitor, tradeExecutor, config.DASHBOARD_PORT);

// Start MCP server
async function main() {
  log("info", "Starting Polymarket Copy Trader MCP Server");
  log("info", `Mode: ${config.COPY_MODE} | Budget: $${config.DAILY_BUDGET}/day | Port: ${config.DASHBOARD_PORT}`);

  if (config.COPY_MODE === "live" && !hasLiveCredentials()) {
    const missing = validateLiveCredentials();
    log("warn", `Live mode enabled but missing credentials: ${missing.join(", ")}. Orders will fail until configured.`);
  }

  if (!config.MCP_LICENSE_KEY) {
    log("info", "No MCP_LICENSE_KEY set — running in Free tier. Pro features are locked.");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

// Graceful shutdown
function shutdown() {
  log("info", "Shutting down...");
  walletMonitor.stop();
  db.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
