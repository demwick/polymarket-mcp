# Polymarket Copy Trader

## Tagline
AI-powered copy trading bot for Polymarket prediction markets

## Description
Discover top Polymarket traders from the leaderboard, monitor their wallets, and automatically copy their trades proportionally. Runs as an MCP server controlled via natural language through Claude Code, Cursor, or any MCP-compatible AI assistant. Includes preview mode for risk-free simulation and a real-time web dashboard.

## Setup Requirements
- `MCP_LICENSE_KEY` (optional): License key for Pro features. Get it at https://mcp-marketplace.io/server/polymarket-copy-trader
- `POLY_PRIVATE_KEY` (optional): Your Polygon wallet private key for live trading
- `POLY_API_KEY` (optional): Polymarket CLOB API key for live trading
- `POLY_API_SECRET` (optional): Polymarket CLOB API secret for live trading
- `POLY_API_PASSPHRASE` (optional): Polymarket CLOB API passphrase for live trading

## Category
Finance

## Features
- Discover top traders from Polymarket leaderboard by PnL and volume
- Monitor selected traders' wallets every 30 seconds for new BUY trades
- Copy trades proportionally with conviction-based sizing
- Preview mode simulates all trades without real money (default)
- Live mode executes real orders via Polymarket CLOB API
- Real-time web dashboard at localhost:3847
- Daily budget management with configurable limits
- Filters: BUY-only, max 5 min age, minimum conviction ($3-5)
- Free tier: discover traders, basic watchlist, dashboard overview
- Pro tier: unlimited watchlist, auto-monitoring, copy trading, live mode

## Getting Started
- "Find the best Polymarket traders" — discovers top performers from the leaderboard
- "Add 0xABC...DEF to my watchlist" — starts tracking a trader's wallet
- "Show my watchlist" — displays all tracked wallets
- "Start monitoring" — begins 30-second copy trading loop (Pro)
- "Show me the dashboard" — displays real-time stats and trade history
- Tool: discover_traders — Scan leaderboard for top traders by PnL
- Tool: watch_wallet — Add/remove wallet from monitoring list
- Tool: start_monitor — Begin automatic copy trading (Pro)
- Tool: get_dashboard — Real-time performance overview

## Tags
polymarket, copy-trading, prediction-markets, trading-bot, defi, polygon, crypto, ai-agent, mcp, finance

## Documentation URL
https://github.com/talhademirel/polymarket-copy-trader
