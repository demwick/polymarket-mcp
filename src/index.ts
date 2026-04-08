#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

import { initializeDb } from "./db/schema.js";
import { getConfig, hasLiveCredentials, validateLiveCredentials } from "./utils/config.js";
import { log } from "./utils/logger.js";
import { safe } from "./utils/tool-wrapper.js";

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
import { setExitRulesSchema, handleSetExitRules } from "./tools/set-exit-rules.js";
import { handleGetPortfolio } from "./tools/get-portfolio.js";
import { backtestTraderSchema, handleBacktestTrader } from "./tools/backtest-trader.js";
import { discoverFlowSchema, handleDiscoverFlow } from "./tools/discover-flow.js";
import { getPriceHistorySchema, handleGetPriceHistory } from "./tools/get-price-history.js";
import { watchMarketSchema, handleWatchMarket } from "./tools/watch-market.js";
import { rebalanceSchema, handleRebalance } from "./tools/rebalance.js";
import { scoreTraderSchema, handleScoreTrader } from "./tools/score-trader.js";
import { checkMarketSchema, handleCheckMarket } from "./tools/check-market.js";
import { buySchema, handleBuy } from "./tools/buy.js";
import { sellSchema, handleSell } from "./tools/sell.js";
import { handleGetBalance } from "./tools/get-balance.js";
import { searchMarketsSchema, handleSearchMarkets } from "./tools/search-markets.js";
import { detectArbitrageSchema, handleDetectArbitrage } from "./tools/detect-arbitrage.js";
import { findRelatedSchema, handleFindRelated } from "./tools/find-related.js";
import { getTopHoldersSchema, handleGetTopHolders } from "./tools/get-top-holders.js";
import { trendingMarketsSchema, handleTrendingMarkets } from "./tools/trending-markets.js";
import { analyzeOpportunitySchema, handleAnalyzeOpportunity } from "./tools/analyze-opportunity.js";
import { handleAssessRisk } from "./tools/assess-risk.js";
import { batchOrderSchema, handleBatchOrder } from "./tools/batch-order.js";
import { setSafetyLimitsSchema, handleSetSafetyLimits } from "./tools/set-safety-limits.js";
import { handleGetOpenOrders } from "./tools/get-open-orders.js";
import { getOrderStatusSchema, handleGetOrderStatus } from "./tools/get-order-status.js";
import { getMarketEventsSchema, handleGetMarketEvents } from "./tools/get-market-events.js";
import { compareMarketsSchema, handleCompareMarkets } from "./tools/compare-markets.js";
import { featuredMarketsSchema, handleFeaturedMarkets } from "./tools/featured-markets.js";
import { optimizePortfolioSchema, handleOptimizePortfolio } from "./tools/optimize-portfolio.js";


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
  name: "polymarket-trader-mcp",
  version: pkg.version,
});

server.tool(
  "discover_traders",
  "Discover top traders from Polymarket leaderboard by PnL, volume, and ROI",
  discoverTradersSchema.shape,
  safe("discover_traders", async (input) => ({ content: [{ type: "text" as const, text: await handleDiscoverTraders(db, discoverTradersSchema.parse(input)) }] }))
);

server.tool(
  "watch_wallet",
  "Add or remove a wallet address from the watchlist",
  watchWalletSchema.shape,
  safe("watch_wallet", async (input) => ({ content: [{ type: "text" as const, text: await handleWatchWallet(db, watchWalletSchema.parse(input)) }] }))
);

server.tool(
  "list_watchlist",
  "Show all watched wallet addresses",
  {},
  safe("list_watchlist", async () => ({ content: [{ type: "text" as const, text: await handleListWatchlist(db) }] }))
);

server.tool(
  "start_monitor",
  "Start the wallet monitoring loop to detect and copy new trades (Pro)",
  startMonitorSchema.shape,
  safe("start_monitor", async (input) => ({ content: [{ type: "text" as const, text: await handleStartMonitor(db, walletMonitor, startMonitorSchema.parse(input)) }] }))
);

server.tool(
  "stop_monitor",
  "Stop the wallet monitoring loop (Pro)",
  {},
  safe("stop_monitor", async () => ({ content: [{ type: "text" as const, text: await handleStopMonitor(walletMonitor) }] }))
);

server.tool(
  "get_dashboard",
  "Get a terminal-formatted dashboard with budget, P&L, trades, and watchlist status",
  {},
  safe("get_dashboard", async () => ({ content: [{ type: "text" as const, text: await handleGetDashboard(db, budgetManager, walletMonitor, tradeExecutor.getMode()) }] }))
);

server.tool(
  "get_trade_history",
  "Get trade history with optional filters (Pro)",
  tradeHistorySchema.shape,
  safe("get_trade_history", async (input) => ({ content: [{ type: "text" as const, text: await handleGetTradeHistory(db, tradeHistorySchema.parse(input)) }] }))
);

server.tool(
  "set_config",
  "Update bot configuration like daily_budget or min_conviction (Pro)",
  setConfigSchema.shape,
  safe("set_config", async (input) => ({ content: [{ type: "text" as const, text: await handleSetConfig(db, budgetManager, setConfigSchema.parse(input)) }] }))
);

server.tool(
  "go_live",
  "Switch from preview to live mode — requires API credentials in .env (Pro)",
  goLiveSchema.shape,
  safe("go_live", async (input) => ({ content: [{ type: "text" as const, text: await handleGoLive(tradeExecutor, goLiveSchema.parse(input)) }] }))
);

server.tool(
  "analyze_trader",
  "Get detailed analysis of a trader's profile, win rate, and recent activity",
  analyzeTraderSchema.shape,
  safe("analyze_trader", async (input) => ({ content: [{ type: "text" as const, text: await handleAnalyzeTrader(analyzeTraderSchema.parse(input)) }] }))
);

server.tool(
  "get_trader_positions",
  "View a trader's current open positions on Polymarket (Pro)",
  getTraderPositionsSchema.shape,
  safe("get_trader_positions", async (input) => ({ content: [{ type: "text" as const, text: await handleGetTraderPositions(getTraderPositionsSchema.parse(input)) }] }))
);

server.tool(
  "get_positions",
  "View your copy trading positions — open, closed, or all",
  getPositionsSchema.shape,
  safe("get_positions", async (input) => ({ content: [{ type: "text" as const, text: await handleGetPositions(db, getPositionsSchema.parse(input)) }] }))
);

server.tool(
  "close_position",
  "Manually close a copy trading position (Pro)",
  closePositionSchema.shape,
  safe("close_position", async (input) => ({ content: [{ type: "text" as const, text: await handleClosePosition(db, closePositionSchema.parse(input)) }] }))
);

server.tool(
  "discover_markets",
  "Find active markets by end date (today/this_week/all) and category — great for finding fast-resolving markets",
  discoverMarketsSchema.shape,
  safe("discover_markets", async (input) => ({ content: [{ type: "text" as const, text: await handleDiscoverMarkets(discoverMarketsSchema.parse(input)) }] }))
);

server.tool(
  "get_price",
  "Get live market prices (bid/ask/spread) or current value of all open positions",
  getPriceSchema.shape,
  safe("get_price", async (input) => ({ content: [{ type: "text" as const, text: await handleGetPrice(db, getPriceSchema.parse(input)) }] }))
);

server.tool(
  "discover_wta",
  "Find today's WTA tennis matches on Polymarket with stink bid prices (favorite at discount)",
  discoverWtaSchema.shape,
  safe("discover_wta", async (input) => ({ content: [{ type: "text" as const, text: await handleDiscoverWta(discoverWtaSchema.parse(input)) }] }))
);

server.tool(
  "place_stink_bid",
  "Place stink bids (limit orders at discount) on all today's WTA favorites (Pro)",
  placeStinkBidSchema.shape,
  safe("place_stink_bid", async (input) => ({ content: [{ type: "text" as const, text: await handlePlaceStinkBid(db, tradeExecutor, placeStinkBidSchema.parse(input)) }] }))
);

server.tool(
  "cancel_orders",
  "Cancel all open/pending limit orders on Polymarket (Pro, live mode only)",
  cancelOrdersSchema.shape,
  safe("cancel_orders", async () => ({ content: [{ type: "text" as const, text: await handleCancelOrders(tradeExecutor) }] }))
);

server.tool(
  "check_exits",
  "Check all open positions for resolution (market resolved or trader exit) and update P&L",
  {},
  safe("check_exits", async () => ({ content: [{ type: "text" as const, text: await handleCheckExits(db) }] }))
);

server.tool(
  "log_cycle",
  "Log an agent cycle result to the database for dashboard tracking",
  logCycleSchema.shape,
  safe("log_cycle", (input) => ({ content: [{ type: "text" as const, text: handleLogCycle(db, logCycleSchema.parse(input)) }] }))
);

server.tool(
  "set_exit_rules",
  "Set stop-loss and/or take-profit price levels on an open position (Pro)",
  setExitRulesSchema.shape,
  safe("set_exit_rules", async (input) => ({ content: [{ type: "text" as const, text: await handleSetExitRules(db, setExitRulesSchema.parse(input)) }] }))
);

server.tool(
  "get_portfolio",
  "View multi-wallet portfolio overview with per-wallet P&L, positions, and exit rules",
  {},
  safe("get_portfolio", async () => ({ content: [{ type: "text" as const, text: await handleGetPortfolio(db) }] }))
);

server.tool(
  "backtest_trader",
  "Simulate copying a trader's past trades to see hypothetical P&L (Pro)",
  backtestTraderSchema.shape,
  safe("backtest_trader", async (input) => ({ content: [{ type: "text" as const, text: await handleBacktestTrader(backtestTraderSchema.parse(input)) }] }))
);

server.tool(
  "score_trader",
  "Calculate conviction score (0-100) for a trader based on win rate, volume, consistency, experience, and diversity",
  scoreTraderSchema.shape,
  safe("score_trader", async (input) => ({ content: [{ type: "text" as const, text: await handleScoreTrader(scoreTraderSchema.parse(input)) }] }))
);

server.tool(
  "check_market",
  "Check market quality — spread, liquidity depth, and price range for safe trading",
  checkMarketSchema.shape,
  safe("check_market", async (input) => ({ content: [{ type: "text" as const, text: await handleCheckMarket(checkMarketSchema.parse(input)) }] }))
);

server.tool(
  "discover_flow",
  "Scan top traders for smart money signals — find markets where multiple top traders are buying simultaneously (Pro)",
  discoverFlowSchema.shape,
  safe("discover_flow", async (input) => ({ content: [{ type: "text" as const, text: await handleDiscoverFlow(discoverFlowSchema.parse(input)) }] }))
);

server.tool(
  "get_price_history",
  "Get historical price data for a market token (1h/6h/1d/1w/1m intervals with sparkline)",
  getPriceHistorySchema.shape,
  safe("get_price_history", async (input) => ({ content: [{ type: "text" as const, text: await handleGetPriceHistory(getPriceHistorySchema.parse(input)) }] }))
);

server.tool(
  "watch_market",
  "Add/remove/list markets on your market watchlist with optional price alerts",
  watchMarketSchema.shape,
  safe("watch_market", async (input) => ({ content: [{ type: "text" as const, text: await handleWatchMarket(db, watchMarketSchema.parse(input)) }] }))
);

server.tool(
  "rebalance",
  "Analyze watchlist traders and remove underperformers based on conviction score and win rate (Pro)",
  rebalanceSchema.shape,
  safe("rebalance", async (input) => ({ content: [{ type: "text" as const, text: await handleRebalance(db, rebalanceSchema.parse(input)) }] }))
);

server.tool(
  "buy",
  "Buy shares on a Polymarket market — provide condition_id and amount",
  buySchema.shape,
  safe("buy", async (input) => ({ content: [{ type: "text" as const, text: await handleBuy(db, tradeExecutor, buySchema.parse(input)) }] }))
);

server.tool(
  "sell",
  "Sell an open position — by trade_id or condition_id",
  sellSchema.shape,
  safe("sell", async (input) => ({ content: [{ type: "text" as const, text: await handleSell(db, tradeExecutor, sellSchema.parse(input)) }] }))
);

server.tool(
  "get_balance",
  "View account balance, daily budget usage, invested amount, and P&L summary",
  {},
  safe("get_balance", async () => ({ content: [{ type: "text" as const, text: await handleGetBalance(db, budgetManager) }] }))
);

server.tool(
  "search_markets",
  "Search Polymarket markets by keyword (e.g. 'bitcoin', 'election', 'UFC')",
  searchMarketsSchema.shape,
  safe("search_markets", async (input) => ({ content: [{ type: "text" as const, text: await handleSearchMarkets(searchMarketsSchema.parse(input)) }] }))
);

server.tool(
  "detect_arbitrage",
  "Scan top markets for arbitrage — find where YES+NO prices don't sum to $1.00",
  detectArbitrageSchema.shape,
  safe("detect_arbitrage", async (input) => ({ content: [{ type: "text" as const, text: await handleDetectArbitrage(detectArbitrageSchema.parse(input)) }] }))
);

server.tool(
  "find_related",
  "Find markets related to a given market or topic",
  findRelatedSchema.shape,
  safe("find_related", async (input) => ({ content: [{ type: "text" as const, text: await handleFindRelated(findRelatedSchema.parse(input)) }] }))
);

server.tool(
  "get_top_holders",
  "See the biggest position holders in a market — who's betting big",
  getTopHoldersSchema.shape,
  safe("get_top_holders", async (input) => ({ content: [{ type: "text" as const, text: await handleGetTopHolders(getTopHoldersSchema.parse(input)) }] }))
);

server.tool(
  "trending_markets",
  "Show trending markets by volume — 24h, 7d, or 30d with optional category filter",
  trendingMarketsSchema.shape,
  safe("trending_markets", async (input) => ({ content: [{ type: "text" as const, text: await handleTrendingMarkets(trendingMarketsSchema.parse(input)) }] }))
);

server.tool(
  "analyze_opportunity",
  "AI-powered BUY/SELL/HOLD recommendation for a market based on price, spread, trend, and liquidity",
  analyzeOpportunitySchema.shape,
  safe("analyze_opportunity", async (input) => ({ content: [{ type: "text" as const, text: await handleAnalyzeOpportunity(analyzeOpportunitySchema.parse(input)) }] }))
);

server.tool(
  "assess_risk",
  "Portfolio risk assessment — concentration, diversification, protection coverage, and budget usage",
  {},
  safe("assess_risk", async () => ({ content: [{ type: "text" as const, text: await handleAssessRisk(db, budgetManager) }] }))
);

server.tool(
  "batch_order",
  "Execute multiple buy/sell orders at once (max 10)",
  batchOrderSchema.shape,
  safe("batch_order", async (input) => ({ content: [{ type: "text" as const, text: await handleBatchOrder(db, tradeExecutor, batchOrderSchema.parse(input)) }] }))
);

server.tool(
  "set_safety_limits",
  "Configure trading safety limits — max order size, exposure cap, spread tolerance",
  setSafetyLimitsSchema.shape,
  safe("set_safety_limits", (input) => ({ content: [{ type: "text" as const, text: handleSetSafetyLimits(db, setSafetyLimitsSchema.parse(input)) }] }))
);

server.tool(
  "get_open_orders",
  "View all pending limit orders (live mode only)",
  {},
  safe("get_open_orders", async () => ({ content: [{ type: "text" as const, text: await handleGetOpenOrders(tradeExecutor) }] }))
);

server.tool(
  "get_order_status",
  "Check the status of a specific order by ID (live mode only)",
  getOrderStatusSchema.shape,
  safe("get_order_status", async (input) => ({ content: [{ type: "text" as const, text: await handleGetOrderStatus(tradeExecutor, getOrderStatusSchema.parse(input)) }] }))
);

server.tool(
  "get_market_events",
  "Browse event groups — find all markets under an event (e.g. 'election', 'UFC', 'NBA')",
  getMarketEventsSchema.shape,
  safe("get_market_events", async (input) => ({ content: [{ type: "text" as const, text: await handleGetMarketEvents(getMarketEventsSchema.parse(input)) }] }))
);

server.tool(
  "compare_markets",
  "Side-by-side comparison of 2-5 markets — price, spread, depth, quality",
  compareMarketsSchema.shape,
  safe("compare_markets", async (input) => ({ content: [{ type: "text" as const, text: await handleCompareMarkets(compareMarketsSchema.parse(input)) }] }))
);

server.tool(
  "featured_markets",
  "Top markets by liquidity — filter by category (politics, sports, crypto, pop-culture, business, science)",
  featuredMarketsSchema.shape,
  safe("featured_markets", async (input) => ({ content: [{ type: "text" as const, text: await handleFeaturedMarkets(featuredMarketsSchema.parse(input)) }] }))
);

server.tool(
  "optimize_portfolio",
  "AI-powered portfolio optimization with conservative/balanced/aggressive strategies — SL/TP suggestions, concentration warnings, cut/hold/take-profit recommendations",
  optimizePortfolioSchema.shape,
  safe("optimize_portfolio", async (input) => ({ content: [{ type: "text" as const, text: await handleOptimizePortfolio(db, optimizePortfolioSchema.parse(input)) }] }))
);

// Start MCP server
async function main() {
  log("info", "Starting Polymarket Trader MCP Server");
  log("info", `Mode: ${config.COPY_MODE} | Budget: $${config.DAILY_BUDGET}/day`);

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
