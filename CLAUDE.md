# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
npm run build          # tsc
npm run start          # run MCP server (node dist/index.js)
npm run dev            # tsc --watch
npm test               # vitest run (all tests)
npm run test:watch     # vitest watch mode
npx vitest run tests/services/budget-manager.test.ts  # single test file
npx tsc --noEmit       # type-check without emitting
```

## Architecture

MCP server for Polymarket trading and automation. Three-layer design: **Tools → Services → Database**.

### Entry Point & MCP Server

`src/index.ts` bootstraps everything: opens SQLite DB, creates service instances (BudgetManager, TradeExecutor, WalletMonitor, PositionTracker), registers 48 MCP tools, and handles graceful shutdown (SIGINT/SIGTERM). Dashboard is a separate project (`polymarket-dashboard`).

### Layers

**Tools** (`src/tools/*.ts`): Each file exports a Zod schema and an async handler function. Tools validate input, check license tier (free vs Pro), call services, and return markdown-formatted strings. All tools are registered in `index.ts` via `server.tool()`.

**Services** (`src/services/*.ts`): Business logic layer.
- `WalletMonitor` — polls watched wallets on an interval, calls `filterNewTrades` to find copy candidates, runs market quality filter, uses `BudgetManager` to size positions, executes via `TradeExecutor`. Has tick-lock to prevent overlapping executions.
- `TradeExecutor` — preview mode records simulated trades in DB; live mode uses `@polymarket/clob-client` to place real orders. Validates CLOB responses. Supports atomic trade+budget recording via `recordTradeWithBudget`.
- `PositionTracker` — checks open positions for stop-loss/take-profit, trader exits (data API), and market resolutions (CLOB API). Recycles budget on close.
- `BudgetManager` — daily spending limits with conviction-based multipliers (low/normal/high).
- `ConvictionScorer` — 0-100 score across 5 dimensions (win rate, volume, consistency, experience, diversity).
- `MarketFilter` — spread, bid/ask depth, price range checks. Auto-integrated into WalletMonitor.
- `Backtester` — simulates copying a trader's historical trades.
- `SmartFlow` — scans top N traders for convergence signals (multiple traders buying same market).
- `PriceHistory` — historical price data from CLOB API with OHLC.

**Database** (`src/db/`): SQLite via better-sqlite3 with WAL mode. `schema.ts` creates tables + indexes + safe migrations. `queries.ts` has all prepared statements. Tables: `watchlist`, `trades`, `daily_budget`, `config`, `agent_cycles`, `market_watchlist`.

**Utils** (`src/utils/`): `fetchWithRetry` (10s timeout, 2 retries with backoff, 429 rate limit handling), `logger` (writes to stderr, MCP uses stdout for JSON-RPC), `license` (MCP Marketplace verification with explicit offline override), `config` (dotenv + Zod validation singleton).

### Key Patterns

- **ESM throughout** — `"type": "module"` in package.json, all imports use `.js` extensions
- **Zod for input validation** — every tool has a schema; `getConfig()` validates env vars
- **License gating** — `checkLicense()` is async (calls external API), cached after first call. Free tier has limits (3 wallets, 1 leaderboard page). Pro features: monitor, trade history, go_live, set_config, close_position, backtest, discover_flow, rebalance.
- **Dual execution mode** — `COPY_MODE=preview` (default) simulates trades in DB; `COPY_MODE=live` requires Polymarket API credentials and places real orders.

### External APIs

- **Data API** (`data-api.polymarket.com`) — trader activity, positions, leaderboard
- **Gamma API** (`gamma-api.polymarket.com`) — market metadata, prices, resolution status
- **CLOB API** (`clob.polymarket.com`) — order book, live order placement, price history, market resolution
- **MCP Marketplace** (`mcp-marketplace.io`) — license verification

### Test Structure

Tests mirror source: `tests/db/`, `tests/services/`, `tests/tools/`, `tests/utils/`. Uses vitest with in-memory SQLite (`new Database(":memory:")`). External API calls are mocked via `vi.spyOn(globalThis, "fetch")`. Services using `fetchWithRetry` need `vi.mock("../../src/utils/fetch.js")` to bypass retry delays. License checks in tool tests are mocked via `vi.mock("../../src/utils/license.js")`.
