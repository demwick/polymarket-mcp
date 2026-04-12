# Polymarket Agent MCP Server

[![npm version](https://img.shields.io/npm/v/polymarket-agent-mcp)](https://www.npmjs.com/package/polymarket-agent-mcp)
[![CI](https://github.com/demwick/polymarket-agent-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/demwick/polymarket-agent-mcp/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/demwick/polymarket-agent-mcp)](https://github.com/demwick/polymarket-agent-mcp)
[![GitHub last commit](https://img.shields.io/github/last-commit/demwick/polymarket-agent-mcp)](https://github.com/demwick/polymarket-agent-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-18%2B-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![MCP Protocol](https://img.shields.io/badge/MCP-1.0-purple)](https://modelcontextprotocol.io)
[![Tools](https://img.shields.io/badge/tools-48-orange)](#tool-overview)
[![Tests](https://img.shields.io/badge/tests-207%20passing-brightgreen)](tests/)
[![SafeSkill 97/100](https://img.shields.io/badge/SafeSkill-97%2F100_Verified%20Safe-brightgreen)](https://safeskill.dev/scan/demwick-polymarket-agent-mcp)
[![Socket Badge](https://socket.dev/api/badge/npm/package/polymarket-agent-mcp)](https://socket.dev/npm/package/polymarket-agent-mcp)
[![Snyk](https://snyk.io/test/github/demwick/polymarket-agent-mcp/badge.svg)](https://snyk.io/test/github/demwick/polymarket-agent-mcp)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/demwick/polymarket-agent-mcp/badge)](https://securityscorecards.dev/viewer/?uri=github.com/demwick/polymarket-agent-mcp)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12433/badge)](https://www.bestpractices.dev/projects/12433)
[![MCP Marketplace](https://mcp-marketplace.io/api/badge?slug=polymarket-mcp-server)](https://mcp-marketplace.io/server/polymarket-mcp-server)

**Trade, analyze, and automate Polymarket prediction markets through AI.**

The most comprehensive MCP server for Polymarket — 48 tools spanning direct trading, market discovery, smart money tracking, copy trading, backtesting, risk management, and portfolio optimization. Works with Claude Code, Cursor, or any MCP-compatible client.

---

## Tool Overview

| Category | Count | Highlights |
|----------|-------|------------|
| **Discovery** | 9 | Search, trending, featured, events, related markets, smart money flow |
| **Analysis** | 8 | AI opportunity scoring, conviction rating, price history, market quality, top holders, comparison |
| **Trading** | 8 | Buy, sell, batch orders, limit orders, order management, safety limits |
| **Copy Trading** | 5 | Watch traders, auto-monitor, auto-rebalance, backtest |
| **Portfolio** | 10 | Positions, P&L, balance, risk assessment, SL/TP, optimization, market alerts |
| **Utilities** | 8 | Dashboard, config, trade history, watchlists, agent logging |

---

## Quick Start

### npm Install

```bash
npm install -g polymarket-agent-mcp
```

### Docker

```bash
docker compose up
```

### Claude Code Config

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "polymarket": {
      "command": "npx",
      "args": ["polymarket-agent-mcp"]
    }
  }
}
```

---

## Usage Examples

Just talk naturally to your AI assistant:

> "What are the trending markets today?"

> "Search for bitcoin prediction markets"

> "Buy $5 on this market"

> "Score this trader — should I copy them?"

> "Backtest this trader with $10 per trade"

> "Show smart money flow — what are the top traders buying?"

> "Set stop-loss at 0.30 on my BTC position"

> "Optimize my portfolio with a balanced strategy"

> "Scan for arbitrage opportunities"

> "Compare these two markets side by side"

---

## All 48 Tools

### Discovery

| Tool | Description |
|------|-------------|
| `search_markets` | Search markets by keyword (bitcoin, election, UFC...) |
| `discover_traders` | Find top traders by PnL and volume |
| `discover_markets` | Find markets by end date and category |
| `trending_markets` | Top markets by 24h/7d/30d volume |
| `featured_markets` | Most liquid markets by category (politics, sports, crypto...) |
| `discover_wta` | WTA tennis markets with stink bid prices |
| `discover_flow` | Smart money signals — multiple top traders buying same market |
| `find_related` | Find markets related to a topic or market |
| `get_market_events` | Browse all markets under an event |

### Analysis

| Tool | Description |
|------|-------------|
| `analyze_opportunity` | AI-powered BUY/SELL/HOLD recommendation |
| `analyze_trader` | Detailed trader profile, win rate, P&L |
| `score_trader` | Conviction score (0-100) across 5 dimensions |
| `check_market` | Market quality — spread, depth, price range |
| `get_price` | Live bid/ask/spread prices |
| `get_price_history` | Historical prices with sparkline (1h to 1m) |
| `get_top_holders` | Biggest position holders in a market |
| `compare_markets` | Side-by-side comparison of 2-5 markets |

### Trading

| Tool | Description |
|------|-------------|
| `buy` | Buy shares on any market |
| `sell` | Sell an open position |
| `batch_order` | Execute up to 10 orders at once |
| `place_stink_bid` | Place limit orders at discount |
| `cancel_orders` | Cancel all open orders |
| `get_open_orders` | View pending limit orders |
| `get_order_status` | Check status of a specific order |
| `go_live` | Switch from preview to live mode |

### Copy Trading

| Tool | Description |
|------|-------------|
| `watch_wallet` | Add/remove traders from watchlist |
| `start_monitor` | Start automatic copy trading loop |
| `stop_monitor` | Stop monitoring |
| `rebalance` | Remove underperforming traders |
| `backtest_trader` | Simulate copying a trader's past trades |

### Portfolio & Risk

| Tool | Description |
|------|-------------|
| `get_balance` | Account balance, budget, and P&L |
| `get_portfolio` | Multi-wallet overview with P&L per trader |
| `get_positions` | Open/closed positions |
| `close_position` | Manually close a position |
| `set_exit_rules` | Set stop-loss and take-profit levels |
| `check_exits` | Check positions for resolution |
| `assess_risk` | Portfolio risk scoring and warnings |
| `optimize_portfolio` | AI-powered optimization (conservative/balanced/aggressive) |
| `watch_market` | Market watchlist with price alerts |
| `detect_arbitrage` | Find YES+NO price discrepancies |

### Configuration

| Tool | Description |
|------|-------------|
| `set_config` | Update bot settings |
| `set_safety_limits` | Max order size, exposure cap, spread tolerance |
| `get_dashboard` | Terminal-formatted dashboard |
| `get_trade_history` | Trade history with filters |
| `list_watchlist` | Show watched wallets |
| `log_cycle` | Log agent cycle for dashboard |
| `get_trader_positions` | View a trader's open positions |
| `discover_wta` | WTA tennis market discovery |

---

## Architecture

```
Claude Code / Cursor / AI Client
        |
        | MCP Protocol (stdio)
        v
+------------------+
|  MCP Server      |  48 tools registered
|  (index.ts)      |
+--------+---------+
         |
    +----+----+
    |         |
 Tools    Services
    |         |
    v         v
+-------+ +------------+
| Zod   | | Backtester |
| Input | | Scorer     |
| Valid. | | SmartFlow  |
+-------+ | Filter     |
          | Tracker    |
          | Executor   |
          +-----+------+
                |
        +-------+-------+
        |       |       |
     Data    Gamma    CLOB
     API      API     API
```

---

## HTTP Transport & Deployment

The server supports two transport modes:

| Mode | Activation | Use case |
|------|-----------|----------|
| **stdio** (default) | `npx polymarket-agent-mcp` | Claude Code, Cursor, local MCP clients |
| **HTTP** | `--http` flag or `PORT` env var | Self-hosted Docker, private VPS, single-user remote |

### Deployment model — read this first

This server is designed for **single-tenant use**. Each client runs its own instance with its own SQLite database (`copytrader.db`), watchlist, daily budget, trade history, and monitor loop. The stdio mode is the recommended path for most users — `npx polymarket-agent-mcp` or the Claude Code config above gives you a fully isolated, local-only instance.

> ⚠️ **Do not expose an HTTP instance publicly.** The server has no per-user isolation: watchlist, positions, budget, and the background monitor loop are shared across every client that connects. A public HTTP deployment is effectively a shared workspace, not a multi-tenant SaaS. If you enable live trading, a public endpoint can drain your Polymarket wallet from any caller. Always configure the HTTP bearer-token env var (see [PERMISSIONS.md](PERMISSIONS.md)) and keep the endpoint behind a firewall, VPN, or auth proxy.

### Starting in HTTP mode

```bash
# Flag
node dist/index.js --http

# Or set PORT (defaults to 3000)
PORT=8080 node dist/index.js
```

### Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/mcp` | POST | MCP protocol endpoint (Streamable HTTP transport) |
| `/health` | GET | Health check — returns `{ status, version, db }` |
| `/.well-known/mcp/server-card.json` | GET | MCP discovery card (tools, permissions, data handling) |
| `/` | GET | Server info with version and endpoint list |

### Authentication

The HTTP transport accepts an optional bearer token gated by an environment variable — the exact name is documented in [PERMISSIONS.md](PERMISSIONS.md). When set, clients must send `Authorization: Bearer <token>` on requests to `/mcp`; when unset the endpoint is open (suitable only for local or private networks).

### Docker deployment

The included `Dockerfile` builds a multi-stage production image that runs in HTTP mode:

```bash
docker build -t polymarket-mcp .
docker run -p 3000:3000 -v mcp-data:/app/data \
  -e DAILY_BUDGET=50 \
  polymarket-mcp
# To require bearer-token auth on /mcp, also pass the HTTP bearer env var
# listed in PERMISSIONS.md (e.g. `-e <VAR>=my-secret-key`).
```

`DB_PATH` (default `/app/data/copytrader.db`) controls where SQLite data is persisted — mount a volume to keep it across restarts.

---

## Configuration

All secrets stay in memory for the lifetime of the process — they are **never** written to the database, logs, or disk, and are only transmitted to their designated Polymarket API endpoint over HTTPS. The complete authoritative env var list, with per-variable sensitivity and scope, lives in **[PERMISSIONS.md](PERMISSIONS.md)** and **[SECURITY.md](SECURITY.md)**.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COPY_MODE` | No | `preview` | `preview` (simulated) or `live` (real orders) |
| `DAILY_BUDGET` | No | `20` | Max daily spend in USDC |
| `MIN_CONVICTION` | No | `3` | Min trade size to copy ($) |
| Wallet signing key | Live only | - | Locally signs CLOB order payloads, never persisted (see PERMISSIONS.md for exact env var name) |
| CLOB API credentials | Live only | - | API key / secret / passphrase — sent only to `clob.polymarket.com` (see PERMISSIONS.md for exact names) |

---

## Safety Features

- Configurable order size limits
- Total exposure caps
- Per-market position limits
- Minimum liquidity requirements
- Maximum spread tolerance
- Stop-loss / take-profit automation
- Preview mode (default) — no real money

---

## Permissions & Capabilities

This package has a transparent, minimal footprint. Full disclosure: **[PERMISSIONS.md](PERMISSIONS.md)** — machine-readable version in [`.well-known/mcp/server-card.json`](.well-known/mcp/server-card.json).

| Category | Scope |
|----------|-------|
| **Network (outbound)** | 3 Polymarket HTTPS APIs + 1 inbound-only WSS public price stream (`ws-subscriptions-clob.polymarket.com`) + optional license check (`mcp-marketplace.io`) |
| **Filesystem** | Single SQLite database file + `.env` read at startup — nothing else |
| **Environment** | API credentials (live mode only, in memory only), budget config, mode selection |
| **Processes** | None — no child processes, no shell commands, no `eval`/`Function` |
| **Telemetry** | None — no analytics, no crash reports, no update checks, no third-party data flow |

**WebSocket scope:** The WSS connection to Polymarket is **inbound-only** for public price updates. No wallet, credential, or user identity is transmitted — it carries the same public feed available to any browser client.

**Secrets scope:** Every secret environment variable is held in memory only, never logged, never persisted, and sent to exactly one host (see [SECURITY.md](SECURITY.md#data-handling--secrets)).

---

## Development

```bash
git clone https://github.com/demwick/polymarket-agent-mcp.git
cd polymarket-agent-mcp
npm install
npm run build
npm test         # 200+ tests
```

---

## License

MIT - see [LICENSE](LICENSE)
