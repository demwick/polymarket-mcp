# Polymarket Copy Trader

MCP server for Claude Code that discovers top Polymarket traders and copies their trades proportionally.

## Features

- **Trader Discovery** — Scan Polymarket leaderboard for top performers by PnL and volume
- **Wallet Monitoring** — Track selected traders' wallets every 30 seconds for new trades
- **Proportional Copy Trading** — Automatically copy trades with conviction-based sizing
- **Preview Mode** — Simulate all trades without risking real money (default)
- **Live Mode** — Execute real trades via Polymarket CLOB API
- **Web Dashboard** — Real-time dashboard at localhost:3847
- **Free/Pro Tiers** — Core features free, advanced features with Pro license

## Free vs Pro

| Feature | Free | Pro |
|---------|------|-----|
| Discover traders | 1 page, top 10 | Full leaderboard |
| Watchlist | Max 3 wallets | Unlimited |
| Dashboard | Basic stats | Full trades + logs |
| Monitor & copy | - | 30s auto-copy |
| Trade history | - | Full history |
| Live trading | - | Real orders |
| Config management | - | Full control |

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment config:
   ```bash
   cp .env.example .env
   ```

3. Build:
   ```bash
   npm run build
   ```

4. Add to Claude Code settings (`~/.claude/settings.json`):
   ```json
   {
     "mcpServers": {
       "polymarket-copy-trader": {
         "command": "node",
         "args": ["/path/to/polymarket-copy-trader/dist/index.js"],
         "env": {
           "MCP_LICENSE_KEY": "mcp_live_..."
         }
       }
     }
   }
   ```

5. Restart Claude Code.

## Usage

Talk to Claude naturally:

- "Find the best Polymarket traders"
- "Add 0xABC...DEF to my watchlist"
- "Show my watchlist"
- "Start monitoring"
- "Show me the dashboard"
- "What's my trade history?"
- "Set daily budget to 30"
- "Go live"

## Preview Mode

By default, all trades are simulated. No real money is used until you explicitly say "go live" (requires Pro + API credentials).

## Web Dashboard

Open http://localhost:3847 while the MCP server is running for a real-time visual dashboard.

## Getting API Credentials (for Live mode)

1. Go to https://polymarket.com and connect your wallet
2. Fund your account with USDC on Polygon
3. Export your private key
4. Derive API keys using the CLOB client
5. Add all credentials to `.env`

## License

MIT
