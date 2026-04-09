#!/usr/bin/env node
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "http";
import { readFileSync } from "fs";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

import { initializeDb } from "./db/schema.js";
import { getWatchlist, getOpenPositions } from "./db/queries.js";
import { getConfig, hasLiveCredentials, validateLiveCredentials } from "./utils/config.js";
import { log, setMcpServer } from "./utils/logger.js";
import { safe } from "./utils/tool-wrapper.js";

import { BudgetManager } from "./services/budget-manager.js";
import { TradeExecutor } from "./services/trade-executor.js";
import { WalletMonitor } from "./services/wallet-monitor.js";
import { PriceStream } from "./services/price-stream.js";

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
import { watchPriceSchema, handleWatchPrice } from "./tools/watch-price.js";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "copytrader.db");

const config = getConfig();
const db = new Database(DB_PATH);
initializeDb(db);

const budgetManager = new BudgetManager(db, config.DAILY_BUDGET);
const tradeExecutor = new TradeExecutor(db, config.COPY_MODE);
const positionTracker = new PositionTracker(db);
const walletMonitor = new WalletMonitor(db, budgetManager, tradeExecutor, config.MIN_CONVICTION, 300, positionTracker);
const priceStream = new PriceStream();

const server = new McpServer({
  name: "polymarket-trader-mcp",
  version: pkg.version,
});
setMcpServer(server);

// MCP Prompts
server.prompt(
  "daily-trading-cycle",
  "Run a complete daily trading cycle: check portfolio, scan smart money, discover opportunities, and manage positions",
  () => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Run my daily Polymarket trading cycle:
1. Call get_dashboard for current status
2. Call get_portfolio to review open positions
3. Call check_exits to handle stop-loss/take-profit triggers
4. Call discover_flow to scan smart money convergence signals
5. Call trending_markets to find high-volume opportunities
6. Call assess_risk to check portfolio health
7. Summarize findings and suggest next actions`
      }
    }]
  })
);

server.prompt(
  "evaluate-trader",
  "Deep evaluation of a trader before adding to watchlist",
  { address: z.string().describe("Ethereum wallet address of the trader to evaluate") },
  (input) => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Evaluate trader ${input.address} for copy trading:
1. Call analyze_trader with this address for profile and stats
2. Call score_trader to get conviction score across 5 dimensions
3. Call get_trader_positions to see their current positions
4. Call backtest_trader to simulate historical performance
5. Based on all data, recommend whether to add this trader to the watchlist`
      }
    }]
  })
);

server.tool(
  "discover_traders",
  "Fetch top traders from the Polymarket leaderboard ranked by PnL, volume, and ROI. Use this to find profitable traders worth copying. Returns trader address, PnL, volume, and win rate. Use auto_watch to add them to your watchlist directly.",
  discoverTradersSchema.shape,
  safe("discover_traders", async (input) => ({ content: [{ type: "text" as const, text: await handleDiscoverTraders(db, discoverTradersSchema.parse(input)) }] }))
);

server.tool(
  "watch_wallet",
  "Add or remove an Ethereum wallet address from the copy trading watchlist. Watched wallets are monitored for new trades when the monitor is running. Use discover_traders first to find good wallets to watch.",
  watchWalletSchema.shape,
  safe("watch_wallet", async (input) => ({ content: [{ type: "text" as const, text: await handleWatchWallet(db, watchWalletSchema.parse(input)) }] }))
);

server.tool(
  "list_watchlist",
  "Show all wallet addresses currently on the copy trading watchlist with their aliases and status. Returns a table of watched wallets. No parameters needed.",
  {},
  safe("list_watchlist", async () => ({ content: [{ type: "text" as const, text: await handleListWatchlist(db) }] }))
);

server.tool(
  "start_monitor",
  "Start a background loop that polls watched wallets for new trades and automatically copies them. Runs continuously at the specified interval until stop_monitor is called. Requires at least one wallet on the watchlist. Pro feature.",
  startMonitorSchema.shape,
  safe("start_monitor", async (input) => ({ content: [{ type: "text" as const, text: await handleStartMonitor(db, walletMonitor, startMonitorSchema.parse(input)) }] }))
);

server.tool(
  "stop_monitor",
  "Stop the background wallet monitoring loop started by start_monitor. No parameters needed. Safe to call even if monitor is not running.",
  {},
  safe("stop_monitor", async () => ({ content: [{ type: "text" as const, text: await handleStopMonitor(walletMonitor) }] }))
);

server.tool(
  "get_dashboard",
  "Get a comprehensive dashboard showing daily budget usage, total P&L, recent trades, watchlist status, and monitor state. No parameters needed. Use this for a quick overview of your trading activity.",
  {},
  safe("get_dashboard", async () => ({ content: [{ type: "text" as const, text: await handleGetDashboard(db, budgetManager, walletMonitor, tradeExecutor.getMode()) }] }))
);

server.tool(
  "get_trade_history",
  "Retrieve past copy trades from the database with optional filters by trader address or status. Returns trade details including entry price, P&L, and market info. Pro feature.",
  tradeHistorySchema.shape,
  safe("get_trade_history", async (input) => ({ content: [{ type: "text" as const, text: await handleGetTradeHistory(db, tradeHistorySchema.parse(input)) }] }))
);

server.tool(
  "set_config",
  "Update bot configuration at runtime. Supports daily_budget (max USDC per day) and min_conviction (minimum trade size to copy). Changes take effect immediately and persist across restarts. Pro feature.",
  setConfigSchema.shape,
  safe("set_config", async (input) => ({ content: [{ type: "text" as const, text: await handleSetConfig(db, budgetManager, setConfigSchema.parse(input)) }] }))
);

server.tool(
  "go_live",
  "Switch from preview (simulated) to live trading mode where real orders are placed on Polymarket. Requires POLY_API_KEY, POLY_API_SECRET, POLY_API_PASSPHRASE, and POLY_PRIVATE_KEY in environment. This action uses real money. Pro feature.",
  goLiveSchema.shape,
  safe("go_live", async (input) => ({ content: [{ type: "text" as const, text: await handleGoLive(tradeExecutor, goLiveSchema.parse(input)) }] }))
);

server.tool(
  "analyze_trader",
  "Analyze a Polymarket trader by wallet address. Returns profile stats, active positions, win rate, volume, PnL, and recent trade activity. Use before adding a trader to your watchlist to assess their quality.",
  analyzeTraderSchema.shape,
  safe("analyze_trader", async (input) => ({ content: [{ type: "text" as const, text: await handleAnalyzeTrader(analyzeTraderSchema.parse(input)) }] }))
);

server.tool(
  "get_trader_positions",
  "View another trader's current open positions on Polymarket by their wallet address. Shows market name, outcome, size, and current price. Useful for due diligence before copy trading. Pro feature.",
  getTraderPositionsSchema.shape,
  safe("get_trader_positions", async (input) => ({ content: [{ type: "text" as const, text: await handleGetTraderPositions(getTraderPositionsSchema.parse(input)) }] }))
);

server.tool(
  "get_positions",
  "View your own copy trading positions filtered by status (open, closed, or all). Returns market name, entry price, current price, P&L, and exit rules for each position.",
  getPositionsSchema.shape,
  safe("get_positions", async (input) => ({ content: [{ type: "text" as const, text: await handleGetPositions(db, getPositionsSchema.parse(input)) }] }))
);

server.tool(
  "close_position",
  "Manually close a copy trading position by trade ID. In live mode, places a sell order on Polymarket. In preview mode, marks the position as closed in the database. Use get_positions to find the trade_id. Pro feature.",
  closePositionSchema.shape,
  safe("close_position", async (input) => ({ content: [{ type: "text" as const, text: await handleClosePosition(db, closePositionSchema.parse(input)) }] }))
);

server.tool(
  "discover_markets",
  "Find active Polymarket prediction markets filtered by resolution deadline and category. Returns market question, price, volume, and end date. Use ending='today' for fast-resolving markets, or 'all' to browse everything.",
  discoverMarketsSchema.shape,
  safe("discover_markets", async (input) => ({ content: [{ type: "text" as const, text: await handleDiscoverMarkets(discoverMarketsSchema.parse(input)) }] }))
);

server.tool(
  "get_price",
  "Get live bid/ask/spread prices from the CLOB order book for a specific market by condition_id. If no condition_id is given and show_positions is true, returns current prices for all open positions.",
  getPriceSchema.shape,
  safe("get_price", async (input) => ({ content: [{ type: "text" as const, text: await handleGetPrice(db, getPriceSchema.parse(input)) }] }))
);

server.tool(
  "discover_wta",
  "Find today's WTA tennis match markets on Polymarket where the favorite is available at a discount. Returns matches with current price vs fair price and the discount percentage. Use place_stink_bid to act on these opportunities. Pro feature.",
  discoverWtaSchema.shape,
  safe("discover_wta", async (input) => ({ content: [{ type: "text" as const, text: await handleDiscoverWta(discoverWtaSchema.parse(input)) }] }))
);

server.tool(
  "place_stink_bid",
  "Place limit orders (stink bids) at a discount on WTA tennis match favorites. Orders sit in the order book until filled at your target price. In preview mode, simulates the orders. In live mode, places real CLOB orders. Pro feature.",
  placeStinkBidSchema.shape,
  safe("place_stink_bid", async (input) => ({ content: [{ type: "text" as const, text: await handlePlaceStinkBid(db, tradeExecutor, placeStinkBidSchema.parse(input)) }] }))
);

server.tool(
  "cancel_orders",
  "Cancel all open/pending limit orders on Polymarket. Only works in live mode. Returns the number of cancelled orders. No parameters needed. Pro feature.",
  cancelOrdersSchema.shape,
  safe("cancel_orders", async () => ({ content: [{ type: "text" as const, text: await handleCancelOrders(tradeExecutor) }] }))
);

server.tool(
  "check_exits",
  "Scan all open positions for exit conditions: market resolution, stop-loss/take-profit triggers, or the original trader exiting. Updates P&L and closes positions that meet exit criteria. No parameters needed.",
  {},
  safe("check_exits", async () => ({ content: [{ type: "text" as const, text: await handleCheckExits(db) }] }))
);

server.tool(
  "log_cycle",
  "Record an AI agent's trading cycle metrics to the database for dashboard tracking and performance analysis. Stores PnL, win rate, positions, budget usage, and notes. Call this after each automated trading cycle.",
  logCycleSchema.shape,
  safe("log_cycle", (input) => ({ content: [{ type: "text" as const, text: handleLogCycle(db, logCycleSchema.parse(input)) }] }))
);

server.tool(
  "set_exit_rules",
  "Set stop-loss and/or take-profit price levels on an open position. When the market price crosses these levels, check_exits will automatically close the position. Use get_positions to find trade IDs. Pro feature.",
  setExitRulesSchema.shape,
  safe("set_exit_rules", async (input) => ({ content: [{ type: "text" as const, text: await handleSetExitRules(db, setExitRulesSchema.parse(input)) }] }))
);

server.tool(
  "get_portfolio",
  "Get a comprehensive portfolio overview showing all positions grouped by copied wallet, with per-wallet P&L, individual position details, and active exit rules. No parameters needed.",
  {},
  safe("get_portfolio", async () => ({ content: [{ type: "text" as const, text: await handleGetPortfolio(db) }] }))
);

server.tool(
  "backtest_trader",
  "Simulate copying a trader's historical trades to calculate hypothetical P&L. Shows what you would have earned if you had copy-traded this wallet. Use before adding a trader to your watchlist to validate their performance. Pro feature.",
  backtestTraderSchema.shape,
  safe("backtest_trader", async (input) => ({ content: [{ type: "text" as const, text: await handleBacktestTrader(backtestTraderSchema.parse(input)) }] }))
);

server.tool(
  "score_trader",
  "Calculate a conviction score (0-100) for a trader across 5 dimensions: win rate, volume, consistency, experience, and diversity. Higher scores indicate more reliable traders for copy trading. Pro feature.",
  scoreTraderSchema.shape,
  safe("score_trader", async (input) => ({ content: [{ type: "text" as const, text: await handleScoreTrader(scoreTraderSchema.parse(input)) }] }))
);

server.tool(
  "check_market",
  "Evaluate market quality by checking bid/ask spread, order book depth, and price range. Returns a pass/fail with specific reasons. Use before placing trades to avoid illiquid or wide-spread markets. Pro feature.",
  checkMarketSchema.shape,
  safe("check_market", async (input) => ({ content: [{ type: "text" as const, text: await handleCheckMarket(checkMarketSchema.parse(input)) }] }))
);

server.tool(
  "discover_flow",
  "Scan top leaderboard traders for smart money convergence signals. Identifies markets where multiple top traders are buying the same outcome simultaneously, indicating strong conviction. Pro feature.",
  discoverFlowSchema.shape,
  safe("discover_flow", async (input) => ({ content: [{ type: "text" as const, text: await handleDiscoverFlow(discoverFlowSchema.parse(input)) }] }))
);

server.tool(
  "get_price_history",
  "Fetch historical OHLC price data for a market token over a configurable time window (1h to 1m). Returns price points with a sparkline visualization showing the price trend. Pro feature.",
  getPriceHistorySchema.shape,
  safe("get_price_history", async (input) => ({ content: [{ type: "text" as const, text: await handleGetPriceHistory(getPriceHistorySchema.parse(input)) }] }))
);

server.tool(
  "watch_market",
  "Manage your market watchlist: add, remove, or list watched markets with optional price alert thresholds. When a market crosses your alert price, it shows up in check_exits.",
  watchMarketSchema.shape,
  safe("watch_market", async (input) => ({ content: [{ type: "text" as const, text: await handleWatchMarket(db, watchMarketSchema.parse(input)) }] }))
);

server.tool(
  "rebalance",
  "Analyze all traders on your watchlist and remove underperformers whose conviction score or win rate falls below your threshold. Use to keep your watchlist focused on high-quality traders. Pro feature.",
  rebalanceSchema.shape,
  safe("rebalance", async (input) => ({ content: [{ type: "text" as const, text: await handleRebalance(db, rebalanceSchema.parse(input)) }] }))
);

server.tool(
  "buy",
  "Buy outcome shares on a Polymarket market. Specify condition_id, USDC amount, and optionally a limit price. Runs a market quality check before executing. In preview mode, simulates the trade. In live mode, places a real CLOB order.",
  buySchema.shape,
  safe("buy", async (input) => ({ content: [{ type: "text" as const, text: await handleBuy(db, tradeExecutor, buySchema.parse(input)) }] }))
);

server.tool(
  "sell",
  "Sell an open position by trade_id (from get_positions) or condition_id. In live mode, places a sell order on Polymarket. In preview mode, marks the position as sold in the database and calculates realized P&L.",
  sellSchema.shape,
  safe("sell", async (input) => ({ content: [{ type: "text" as const, text: await handleSell(db, tradeExecutor, sellSchema.parse(input)) }] }))
);

server.tool(
  "get_balance",
  "View account balance summary: daily budget remaining, total invested, realized and unrealized P&L. No parameters needed. Use this to check how much budget is left before placing new trades.",
  {},
  safe("get_balance", async () => ({ content: [{ type: "text" as const, text: await handleGetBalance(db, budgetManager) }] }))
);

server.tool(
  "search_markets",
  "Search Polymarket markets by keyword query. Returns matching markets with question, price, volume, and condition_id. Use the condition_id from results with buy, get_price, or analyze_opportunity.",
  searchMarketsSchema.shape,
  safe("search_markets", async (input) => ({ content: [{ type: "text" as const, text: await handleSearchMarkets(searchMarketsSchema.parse(input)) }] }))
);

server.tool(
  "detect_arbitrage",
  "Scan active Polymarket markets for arbitrage opportunities where YES + NO prices don't sum to $1.00. Returns markets with the price gap and potential profit percentage.",
  detectArbitrageSchema.shape,
  safe("detect_arbitrage", async (input) => ({ content: [{ type: "text" as const, text: await handleDetectArbitrage(detectArbitrageSchema.parse(input)) }] }))
);

server.tool(
  "find_related",
  "Find Polymarket markets related to a given condition_id or topic keyword. Useful for discovering correlated markets or building a diversified position across related events.",
  findRelatedSchema.shape,
  safe("find_related", async (input) => ({ content: [{ type: "text" as const, text: await handleFindRelated(findRelatedSchema.parse(input)) }] }))
);

server.tool(
  "get_top_holders",
  "View the largest position holders in a Polymarket market by condition_id. Shows wallet address, position size, and side (YES/NO). Useful for gauging smart money sentiment on a market.",
  getTopHoldersSchema.shape,
  safe("get_top_holders", async (input) => ({ content: [{ type: "text" as const, text: await handleGetTopHolders(getTopHoldersSchema.parse(input)) }] }))
);

server.tool(
  "trending_markets",
  "List trending Polymarket markets ranked by trading volume over a configurable period (24h, 7d, or 30d). Filter by category to focus on specific topics. Returns market question, price, and volume.",
  trendingMarketsSchema.shape,
  safe("trending_markets", async (input) => ({ content: [{ type: "text" as const, text: await handleTrendingMarkets(trendingMarketsSchema.parse(input)) }] }))
);

server.tool(
  "analyze_opportunity",
  "Generate a BUY/SELL/HOLD recommendation for a Polymarket market by analyzing price, spread, price trend, and liquidity depth. Returns a score with detailed reasoning. Read-only analysis, does not place trades.",
  analyzeOpportunitySchema.shape,
  safe("analyze_opportunity", async (input) => ({ content: [{ type: "text" as const, text: await handleAnalyzeOpportunity(analyzeOpportunitySchema.parse(input)) }] }))
);

server.tool(
  "assess_risk",
  "Assess portfolio risk across 4 dimensions: position concentration, market diversification, stop-loss/take-profit coverage, and daily budget utilization. Returns a risk score with specific warnings. No parameters needed.",
  {},
  safe("assess_risk", async () => ({ content: [{ type: "text" as const, text: await handleAssessRisk(db, budgetManager) }] }))
);

server.tool(
  "batch_order",
  "Execute multiple buy/sell orders in a single call (max 10 orders). Each order specifies a condition_id, amount, optional price, and side. Returns per-order results with success/failure status.",
  batchOrderSchema.shape,
  safe("batch_order", async (input) => ({ content: [{ type: "text" as const, text: await handleBatchOrder(db, tradeExecutor, batchOrderSchema.parse(input)) }] }))
);

server.tool(
  "set_safety_limits",
  "Configure trading safety guardrails: maximum order size in USDC, total exposure cap, and maximum spread tolerance. These limits are enforced on all subsequent buy/sell operations. Changes persist in the database.",
  setSafetyLimitsSchema.shape,
  safe("set_safety_limits", (input) => ({ content: [{ type: "text" as const, text: handleSetSafetyLimits(db, setSafetyLimitsSchema.parse(input)) }] }))
);

server.tool(
  "get_open_orders",
  "View all pending limit orders on Polymarket that have not yet been filled. Only returns results in live mode. No parameters needed.",
  {},
  safe("get_open_orders", async () => ({ content: [{ type: "text" as const, text: await handleGetOpenOrders(tradeExecutor) }] }))
);

server.tool(
  "get_order_status",
  "Check the current status of a specific Polymarket order by order ID. Returns fill status, price, and amount. Only works in live mode.",
  getOrderStatusSchema.shape,
  safe("get_order_status", async (input) => ({ content: [{ type: "text" as const, text: await handleGetOrderStatus(tradeExecutor, getOrderStatusSchema.parse(input)) }] }))
);

server.tool(
  "get_market_events",
  "Browse Polymarket event groups to find all markets under a single event (e.g. 'US Election', 'UFC 300', 'NBA Finals'). Returns the event with all its sub-markets and their current prices.",
  getMarketEventsSchema.shape,
  safe("get_market_events", async (input) => ({ content: [{ type: "text" as const, text: await handleGetMarketEvents(getMarketEventsSchema.parse(input)) }] }))
);

server.tool(
  "compare_markets",
  "Compare 2-5 Polymarket markets side by side. Shows price, spread, order book depth, volume, and quality score for each market. Useful for choosing the best market to trade among similar options.",
  compareMarketsSchema.shape,
  safe("compare_markets", async (input) => ({ content: [{ type: "text" as const, text: await handleCompareMarkets(compareMarketsSchema.parse(input)) }] }))
);

server.tool(
  "featured_markets",
  "List top Polymarket markets ranked by liquidity with optional category filter (politics, sports, crypto, pop-culture, business, science). Returns the most liquid and actively traded markets.",
  featuredMarketsSchema.shape,
  safe("featured_markets", async (input) => ({ content: [{ type: "text" as const, text: await handleFeaturedMarkets(featuredMarketsSchema.parse(input)) }] }))
);

server.tool(
  "optimize_portfolio",
  "Analyze your open positions and generate optimization recommendations based on your chosen strategy (conservative, balanced, or aggressive). Returns SL/TP suggestions, concentration warnings, and cut/hold/take-profit actions for each position.",
  optimizePortfolioSchema.shape,
  safe("optimize_portfolio", async (input) => ({ content: [{ type: "text" as const, text: await handleOptimizePortfolio(db, optimizePortfolioSchema.parse(input)) }] }))
);

server.tool(
  "watch_price",
  "Manage live WebSocket price subscriptions for real-time market updates. Subscribe to a token_id to start streaming price changes, unsubscribe to stop, or check connection status.",
  watchPriceSchema.shape,
  safe("watch_price", (input) => ({ content: [{ type: "text" as const, text: handleWatchPrice(priceStream, watchPriceSchema.parse(input)) }] }))
);

// MCP Resources
server.resource(
  "watchlist",
  "polymarket://watchlist",
  { description: "Current copy trading watchlist with trader addresses, aliases, and performance stats", mimeType: "application/json" },
  async () => ({
    contents: [{
      uri: "polymarket://watchlist",
      mimeType: "application/json",
      text: JSON.stringify(getWatchlist(db), null, 2),
    }],
  })
);

server.resource(
  "positions",
  "polymarket://positions",
  { description: "All open trading positions with entry price, current status, and exit rules", mimeType: "application/json" },
  async () => ({
    contents: [{
      uri: "polymarket://positions",
      mimeType: "application/json",
      text: JSON.stringify(getOpenPositions(db), null, 2),
    }],
  })
);

server.resource(
  "budget",
  "polymarket://budget/today",
  { description: "Today's budget usage, remaining allowance, and daily limit", mimeType: "application/json" },
  async () => {
    const remaining = budgetManager.getRemainingBudget();
    const today = new Date().toISOString().slice(0, 10);
    const row = db.prepare("SELECT COALESCE(SUM(amount), 0) as spent FROM daily_budget WHERE date = ?").get(today) as { spent: number };
    return {
      contents: [{
        uri: "polymarket://budget/today",
        mimeType: "application/json",
        text: JSON.stringify({ daily_limit: config.DAILY_BUDGET, spent: row.spent, remaining, date: today }, null, 2),
      }],
    };
  }
);

server.resource(
  "trades",
  "polymarket://trades/recent",
  { description: "Recent trade history with P&L and execution details", mimeType: "application/json" },
  async () => ({
    contents: [{
      uri: "polymarket://trades/recent",
      mimeType: "application/json",
      text: JSON.stringify(db.prepare("SELECT * FROM trades ORDER BY created_at DESC LIMIT 50").all(), null, 2),
    }],
  })
);

// Start MCP server
const useHttp = process.argv.includes("--http") || !!process.env.PORT;

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

  if (useHttp) {
    await startHttpServer();
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

async function startHttpServer() {
  const port = parseInt(process.env.PORT || "3000", 10);

  const httpTransport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(httpTransport);

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // Server card for Smithery discovery
    if (url.pathname === "/.well-known/mcp/server-card.json") {
      try {
        const card = readFileSync(path.join(__dirname, "..", ".well-known", "mcp", "server-card.json"), "utf-8");
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(card);
      } catch {
        res.writeHead(404);
        res.end("Not Found");
      }
      return;
    }

    // Health check
    if (url.pathname === "/health") {
      try {
        db.prepare("SELECT 1").get();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", version: pkg.version, db: "connected" }));
      } catch {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "degraded", version: pkg.version, db: "error" }));
      }
      return;
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      // Bearer token auth when MCP_API_KEY is configured
      const apiKey = process.env.MCP_API_KEY;
      if (apiKey) {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized", message: "Valid Bearer token required" }));
          return;
        }
      }
      try {
        await httpTransport.handleRequest(req, res);
      } catch (err) {
        log("error", `MCP request error: ${err}`);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      }
      return;
    }

    // Root info
    if (url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        name: "polymarket-trader-mcp",
        version: pkg.version,
        mcp: "/mcp",
        health: "/health",
      }));
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  httpServer.listen(port, () => {
    log("info", `HTTP transport listening on port ${port}`);
    log("info", `MCP endpoint: http://localhost:${port}/mcp`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

// Graceful shutdown
function shutdown() {
  log("info", "Shutting down...");
  walletMonitor.stop();
  priceStream.disconnect();
  db.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
