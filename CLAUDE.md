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

MCP server for Polymarket copy trading. Three-layer design: **Tools → Services → Database**.

### Entry Point & MCP Server

`src/index.ts` bootstraps everything: opens SQLite DB, creates service instances (BudgetManager, TradeExecutor, WalletMonitor, PositionTracker), registers 21 MCP tools, and handles graceful shutdown (SIGINT/SIGTERM). Dashboard is a separate project (`polymarket-dashboard`).

### Layers

**Tools** (`src/tools/*.ts`): Each file exports a Zod schema and an async handler function. Tools validate input, check license tier (free vs Pro), call services, and return markdown-formatted strings. All tools are registered in `index.ts` via `server.tool()`.

**Services** (`src/services/*.ts`): Business logic layer.
- `WalletMonitor` — polls watched wallets on an interval, calls `filterNewTrades` to find copy candidates, uses `BudgetManager` to size positions, executes via `TradeExecutor`. Has tick-lock to prevent overlapping executions.
- `TradeExecutor` — preview mode records simulated trades in DB; live mode uses `@polymarket/clob-client` to place real orders. Supports atomic trade+budget recording via `recordTradeWithBudget`.
- `PositionTracker` — checks open positions for trader exits (data API) and market resolutions (gamma API), updates P&L.
- `BudgetManager` — daily spending limits with conviction-based multipliers (low/normal/high).

**Database** (`src/db/`): SQLite via better-sqlite3 with WAL mode. `schema.ts` creates tables + indexes. `queries.ts` has all prepared statements. Tables: `watchlist`, `trades`, `daily_budget`, `config`.

**Utils** (`src/utils/`): `fetchWithRetry` (10s timeout, 2 retries with backoff), `logger` (writes to stderr, MCP uses stdout for JSON-RPC), `license` (MCP Marketplace verification with explicit offline override), `config` (dotenv + Zod validation singleton).

### Key Patterns

- **ESM throughout** — `"type": "module"` in package.json, all imports use `.js` extensions
- **Zod for input validation** — every tool has a schema; `getConfig()` validates env vars
- **License gating** — `checkLicense()` is async (calls external API), cached after first call. Free tier has limits (3 wallets, 1 leaderboard page). Pro features: monitor, trade history, go_live, set_config, close_position.
- **Dual execution mode** — `COPY_MODE=preview` (default) simulates trades in DB; `COPY_MODE=live` requires Polymarket API credentials and places real orders.

### External APIs

- **Data API** (`data-api.polymarket.com`) — trader activity, positions, leaderboard
- **Gamma API** (`gamma-api.polymarket.com`) — market metadata, prices, resolution status
- **CLOB API** (`clob.polymarket.com`) — order book, live order placement
- **MCP Marketplace** (`mcp-marketplace.io`) — license verification

### Test Structure

Tests mirror source: `tests/db/`, `tests/services/`, `tests/tools/`, `tests/utils/`. Uses vitest with in-memory SQLite (`new Database(":memory:")`). External API calls are mocked via `vi.spyOn(globalThis, "fetch")`. Services using `fetchWithRetry` need `vi.mock("../../src/utils/fetch.js")` to bypass retry delays. License checks in tool tests are mocked via `vi.mock("../../src/utils/license.js")`.
