# Polymarket MCP Server

## Tagline
Trade, analyze, and automate Polymarket prediction markets via AI

## Description
🛡️ Verified Safe — SafeSkill 97/100 (audited 2026-04-11, zero taint flows, all metric categories passing). See SECURITY.md and PERMISSIONS.md for full disclosure.

Full-featured MCP server for Polymarket — search markets, execute trades, copy top traders, analyze smart money flow, backtest strategies, and manage your portfolio. All through natural language via Claude Code, Cursor, or any MCP-compatible AI assistant. Includes 48 tools spanning direct trading, market discovery, trader analysis, copy trading automation, and portfolio management with stop-loss/take-profit.

## Setup Requirements
- `MCP_LICENSE_KEY` (optional): License key for Pro features. Get it at https://mcp-marketplace.io/server/polymarket-trader-mcp
- `COPY_MODE` (optional): Set to `preview` (default, simulated) or `live` (real orders)
- `DAILY_BUDGET` (optional): Max daily spend in USDC (default: $20)
- `POLY_PRIVATE_KEY` (optional): Polygon wallet private key — required for live trading
- `POLY_API_KEY` (optional): Polymarket CLOB API key — required for live trading
- `POLY_API_SECRET` (optional): Polymarket CLOB API secret — required for live trading
- `POLY_API_PASSPHRASE` (optional): Polymarket CLOB API passphrase — required for live trading

## Category
Finance

## Features
- Search and discover Polymarket markets by keyword, category, or end date
- Buy and sell directly on any market with market or limit orders
- Discover top traders from the leaderboard by PnL and volume
- Smart money flow detection — find markets where multiple top traders are buying
- Copy trading with automatic wallet monitoring and proportional sizing
- Conviction scoring (0-100) across 5 dimensions for any trader
- Backtest any trader's history to simulate copy results before committing
- Market quality filter — auto-skip illiquid markets (spread, depth, price checks)
- Stop-loss and take-profit automation on any position
- Multi-wallet portfolio overview with per-trader P&L breakdown
- Auto-rebalance — remove underperforming traders based on score thresholds
- Price history with OHLC and sparkline charts (1h to 1m intervals)
- Market watchlist with configurable price alerts
- WTA tennis market discovery with stink bid pricing
- Preview mode for risk-free simulation (default)
- Live mode for real order execution via Polymarket CLOB API
- Daily budget management with conviction-based multipliers
- Separate monitoring dashboard (polymarket-dashboard project)
- Free tier: market search, basic discovery, 3 wallet watchlist
- Pro tier: full copy trading, backtest, smart flow, rebalance, unlimited wallets

## Getting Started
- "Search for bitcoin markets" — finds active Polymarket markets about Bitcoin
- "Buy $5 on this market" — places a direct trade (preview mode by default)
- "Find the best traders this week" — discovers top performers from leaderboard
- "Score this trader" — calculates conviction score (0-100) with breakdown
- "Backtest this trader with $10 per trade" — simulates copying their past trades
- "Show smart money flow" — scans top 30 traders for convergence signals
- "Check market quality" — analyzes spread, depth, and liquidity
- "Set stop loss at 0.30 on position #1" — automated exit rule
- "Show my portfolio" — multi-wallet overview with P&L
- "Rebalance my watchlist" — remove underperforming traders
- Tool: search_markets — Keyword search across all markets
- Tool: buy — Direct buy on any market
- Tool: sell — Sell an open position
- Tool: discover_flow — Smart money convergence signals
- Tool: score_trader — Conviction scoring with visual bars
- Tool: backtest_trader — Historical trade simulation
- Tool: get_price_history — Price charts with sparklines

## Tags
polymarket, trading, prediction-markets, mcp, finance, copy-trading, smart-money, backtest, ai-agent, defi, crypto, portfolio, market-analysis, automation

## Documentation URL
https://github.com/demwick/polymarket-trader-mcp
