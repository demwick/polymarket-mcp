# Polymarket Trader MCP Server

<a href="https://glama.ai/mcp/servers/demwick/polymarket-trader-mcp">
  <img src="https://glama.ai/mcp/servers/demwick/polymarket-trader-mcp/badges/card.svg" alt="polymarket-trader-mcp MCP server" />
</a>

[![MCP Marketplace](https://mcp-marketplace.io/api/badge?slug=polymarket-mcp-server)](https://mcp-marketplace.io/server/polymarket-mcp-server)
[![Node.js](https://img.shields.io/badge/node-18%2B-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![MCP Protocol](https://img.shields.io/badge/MCP-1.0-purple)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-200%2B%20passing-brightgreen)]()
[![Tools](https://img.shields.io/badge/tools-48-orange)]()
[![SafeSkill 94/100](https://img.shields.io/badge/SafeSkill-94%2F100_Verified%20Safe-brightgreen)](https://safeskill.dev/scan/demwick-polymarket-trader-mcp)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/demwick/polymarket-trader-mcp/badge)](https://securityscorecards.dev/viewer/?uri=github.com/demwick/polymarket-trader-mcp)
[![Socket Badge](https://socket.dev/api/badge/npm/package/polymarket-trader-mcp)](https://socket.dev/npm/package/polymarket-trader-mcp)
[![Snyk](https://snyk.io/test/github/demwick/polymarket-trader-mcp/badge.svg)](https://snyk.io/test/github/demwick/polymarket-trader-mcp)

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

### One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/demwick/polymarket-trader-mcp/main/install.sh | bash
```

### npm Install

```bash
npm install -g polymarket-trader-mcp
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
      "args": ["polymarket-trader-mcp"]
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
| **stdio** (default) | `npx polymarket-trader-mcp` | Claude Code, Cursor, local MCP clients |
| **HTTP** | `--http` flag or `PORT` env var | Smithery, Railway, Docker, remote hosting |

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
| `/.well-known/mcp/server-card.json` | GET | Server discovery card for Smithery |
| `/` | GET | Server info with version and endpoint list |

### Authentication

Set `MCP_API_KEY` to require Bearer token auth on the `/mcp` endpoint:

```bash
MCP_API_KEY=my-secret-key node dist/index.js --http
# Clients must send: Authorization: Bearer my-secret-key
```

When `MCP_API_KEY` is not set, the `/mcp` endpoint is open (suitable for local/private networks).

### Docker deployment

The included `Dockerfile` builds a multi-stage production image that runs in HTTP mode:

```bash
docker build -t polymarket-mcp .
docker run -p 3000:3000 -v mcp-data:/app/data \
  -e MCP_API_KEY=my-secret-key \
  -e DAILY_BUDGET=50 \
  polymarket-mcp
```

`DB_PATH` (default `/app/data/copytrader.db`) controls where SQLite data is persisted — mount a volume to keep it across restarts.

---

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COPY_MODE` | No | `preview` | `preview` (simulated) or `live` (real orders) |
| `DAILY_BUDGET` | No | `20` | Max daily spend in USDC |
| `MIN_CONVICTION` | No | `3` | Min trade size to copy ($) |
| `POLY_PRIVATE_KEY` | Live only | - | Polymarket wallet private key |
| `POLY_API_KEY` | Live only | - | CLOB API key |
| `POLY_API_SECRET` | Live only | - | CLOB API secret |
| `POLY_API_PASSPHRASE` | Live only | - | CLOB API passphrase |

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

## Development

```bash
git clone https://github.com/demwick/polymarket-trader-mcp.git
cd polymarket-trader-mcp
npm install
npm run build
npm test         # 200+ tests
```

---

## License

MIT - see [LICENSE](LICENSE)
