# Polymarket MCP Server

MCP server for trading, analyzing, and automating Polymarket prediction markets through Claude Code or any MCP-compatible client.

## Features

- **Direct Trading** — Buy and sell on any Polymarket market with market or limit orders
- **Market Search** — Find markets by keyword, category, or end date
- **Copy Trading** — Watch top traders and automatically copy their trades
- **Smart Money Flow** — Detect when multiple top traders converge on the same market
- **Backtest** — Simulate copying any trader's historical trades before committing capital
- **Conviction Scoring** — 0-100 score based on win rate, consistency, experience, and diversity
- **Market Quality Filter** — Auto-skip illiquid markets based on spread, depth, and price range
- **Stop-Loss / Take-Profit** — Set automated exit rules on any position
- **Auto-Rebalance** — Remove underperforming traders from your watchlist
- **Price History** — Historical price data with sparkline charts
- **34 MCP Tools** — Full control via natural language through Claude Code

## Quick Start

### Prerequisites

- Node.js 18+
- Claude Code CLI (or any MCP client)

### Installation

```bash
npm install -g polymarket-mcp
```

Or add to Claude Code config (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "polymarket": {
      "command": "npx",
      "args": ["polymarket-mcp"]
    }
  }
}
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COPY_MODE` | No | `preview` | `preview` (simulated) or `live` (real orders) |
| `DAILY_BUDGET` | No | `20` | Max daily spend in USDC |
| `MIN_CONVICTION` | No | `3` | Min trade size to copy ($) |
| `POLY_PRIVATE_KEY` | Live only | - | Polymarket wallet private key |
| `POLY_API_KEY` | Live only | - | CLOB API key |
| `POLY_API_SECRET` | Live only | - | CLOB API secret |
| `POLY_API_PASSPHRASE` | Live only | - | CLOB API passphrase |
| `MCP_LICENSE_KEY` | Pro | - | Marketplace license key |

## Tools

### Discovery
| Tool | Description |
|------|-------------|
| `search_markets` | Search markets by keyword (bitcoin, election, UFC...) |
| `discover_traders` | Find top traders by PnL and volume |
| `discover_markets` | Find markets by end date and category |
| `discover_wta` | Find WTA tennis markets with stink bid prices |
| `discover_flow` | Smart money signals — multiple top traders buying same market |

### Trading
| Tool | Description |
|------|-------------|
| `buy` | Buy shares on any market — direct trading |
| `sell` | Sell an open position |
| `place_stink_bid` | Place limit orders at discount |
| `cancel_orders` | Cancel all open orders |
| `go_live` | Switch from preview to live mode |

### Copy Trading
| Tool | Description |
|------|-------------|
| `watch_wallet` | Add/remove traders from watchlist |
| `start_monitor` | Start copy trading loop |
| `stop_monitor` | Stop copy trading loop |
| `rebalance` | Remove underperforming traders |

### Analysis
| Tool | Description |
|------|-------------|
| `analyze_trader` | Detailed trader profile with win rate and P&L |
| `score_trader` | Conviction score (0-100) across 5 dimensions |
| `backtest_trader` | Simulate copying past trades |
| `check_market` | Market quality check (spread, depth) |
| `get_price` | Live bid/ask/spread prices |
| `get_price_history` | Historical prices with sparkline (1h-1m) |

### Portfolio
| Tool | Description |
|------|-------------|
| `get_balance` | Account balance, budget, and P&L summary |
| `get_portfolio` | Multi-wallet overview with P&L per trader |
| `get_positions` | Open/closed positions |
| `close_position` | Manually close a position |
| `set_exit_rules` | Set stop-loss and take-profit levels |
| `check_exits` | Check positions for resolution |
| `watch_market` | Market watchlist with price alerts |

### Utilities
| Tool | Description |
|------|-------------|
| `get_dashboard` | Terminal-formatted dashboard |
| `get_trade_history` | Trade history with filters |
| `set_config` | Update bot settings |
| `list_watchlist` | Show watched wallets |
| `log_cycle` | Log agent cycle for dashboard tracking |

## Free vs Pro

| Feature | Free | Pro |
|---------|------|-----|
| Discover traders | 1 page | Full |
| Watch wallets | 3 max | Unlimited |
| Monitor | - | Full |
| Trade history | - | Full |
| Backtest | - | Full |
| Smart flow | - | Full |
| Rebalance | - | Full |

Get a Pro license at [mcp-marketplace.io](https://mcp-marketplace.io/server/polymarket-mcp).

## Development

```bash
git clone https://github.com/demwick/polymarket-mcp.git
cd polymarket-mcp
npm install
npm run build
npm test         # 200+ tests
```

## License

MIT
