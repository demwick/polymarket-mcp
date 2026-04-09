# Permissions & Capabilities

This document declares what `polymarket-trader-mcp` accesses at runtime. No hidden behavior — everything is listed here.

## Network Access

| Endpoint | Protocol | Purpose | When |
|----------|----------|---------|------|
| `data-api.polymarket.com` | HTTPS | Trader activity, positions, leaderboard | Discovery & analysis tools |
| `gamma-api.polymarket.com` | HTTPS | Market metadata, prices, resolution status | Market search & info tools |
| `clob.polymarket.com` | HTTPS | Order book, order placement, price history | Trading & price tools |
| `wss://ws-subscriptions-clob.polymarket.com` | WSS | Real-time price streaming | `watch_market` price alerts |
| `mcp-marketplace.io` | HTTPS | License key verification | Startup (optional) |

No other network connections are made. All HTTP requests use `fetch` with a 10-second timeout and automatic retry (max 2 retries with exponential backoff).

## Environment Variables

| Variable | Contains | Required | Used For |
|----------|----------|----------|----------|
| `POLY_PRIVATE_KEY` | Wallet private key | Live mode only | Signing transactions on Polymarket |
| `POLY_API_KEY` | CLOB API key | Live mode only | Authenticating with CLOB API |
| `POLY_API_SECRET` | CLOB API secret | Live mode only | Authenticating with CLOB API |
| `POLY_API_PASSPHRASE` | CLOB API passphrase | Live mode only | Authenticating with CLOB API |
| `POLY_FUNDER_ADDRESS` | Wallet address | Live mode only | Identifying funder account |
| `DAILY_BUDGET` | Number (USDC) | No (default: 20) | Daily spending limit |
| `MIN_CONVICTION` | Number (USDC) | No (default: 3) | Minimum trade size to copy |
| `COPY_MODE` | `preview` or `live` | No (default: preview) | Execution mode |
| `CHAIN_ID` | Number | No (default: 137) | Polygon chain ID |
| `MCP_LICENSE_KEY` | License string | No | MCP Marketplace license verification |
| `MCP_API_KEY` | Bearer token | No | HTTP transport authentication |
| `PORT` | Number | No (default: 3000) | HTTP server port |

All environment variables are validated at startup using Zod schemas. Sensitive credentials are never logged, stored in the database, or transmitted except to their designated API endpoints.

## Filesystem Access

| Path | Access | Purpose |
|------|--------|---------|
| `./copytrader.db` (or `DB_PATH`) | Read/Write | SQLite database for trades, watchlist, config, and budget tracking |
| `.env` | Read | Environment variable loading via dotenv (startup only) |

No other files are read or written. No temporary files are created.

## Process Execution

This package does **not** spawn child processes. The `exec()` calls in the codebase are `better-sqlite3`'s `Database.exec()` method for executing SQL statements — not `child_process.exec()`.

## Data Storage

All data is stored locally in a single SQLite database file:

| Table | Contains | Sensitive |
|-------|----------|-----------|
| `watchlist` | Tracked wallet addresses and stats | No |
| `trades` | Trade history (simulated and live) | No |
| `daily_budget` | Daily spending records | No |
| `config` | User-set configuration key/value pairs | No |
| `agent_cycles` | Agent automation logs | No |
| `market_watchlist` | Price alert watchlist | No |

No data is sent to external analytics, telemetry, or third-party services.

## What This Package Does NOT Do

- Does not spawn child processes or execute shell commands
- Does not access the filesystem beyond the SQLite database and `.env`
- Does not send telemetry or analytics data
- Does not modify system configuration
- Does not install additional packages at runtime
- Does not use `eval()`, `Function()`, or dynamic code execution
- Does not access clipboard, camera, microphone, or other system resources
