# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Email **talhademirell@outlook.com** with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. You will receive an acknowledgment within 48 hours.
4. A fix will be developed and released as soon as possible.
5. Responsible disclosure will be credited in release notes.

## Scope

This project is an MCP server for Polymarket trading. Security-relevant areas include:

- **API credential handling** — wallet private keys, API tokens
- **Trade execution** — order placement, position management
- **Database** — SQLite storage of trade history, configuration
- **Input validation** — all MCP tool inputs are validated via Zod schemas

## Data Handling & Secrets

`polymarket-trader-mcp` is designed to run as a single-tenant local process. The following guarantees are enforced by the codebase and are the standard this project holds itself to:

### Secrets

- **The wallet signing key** is loaded from the environment at startup into the validated config singleton and is used **only** to locally sign EIP-712 CLOB order payloads. It is:
  - Never written to the SQLite database
  - Never written to any file on disk
  - Never written to logs (stdout or stderr)
  - Never transmitted anywhere except as part of the signed order payload sent to `clob.polymarket.com` over HTTPS
  - Held exclusively in process memory for the lifetime of the server
- **The CLOB API credentials and the optional Marketplace license key** follow the same five-rule policy: in memory only, never logged, never persisted, single destination, scrubbed from error messages.
- The authoritative list of environment variable names (and their sensitivity classifications) lives in [PERMISSIONS.md](./PERMISSIONS.md); the machine-readable form is in [`.well-known/mcp/server-card.json`](./.well-known/mcp/server-card.json).
- There is no code path that serializes the validated config object to disk, a log sink, or an outbound HTTP body other than the designated endpoints.

### Network

Only five hosts are ever contacted:

1. `data-api.polymarket.com` (HTTPS, read-only)
2. `gamma-api.polymarket.com` (HTTPS, read-only)
3. `clob.polymarket.com` (HTTPS, reads + signed order writes in live mode)
4. `ws-subscriptions-clob.polymarket.com` (WSS, inbound-only public price stream)
5. `mcp-marketplace.io` (HTTPS, optional one-time license verification)

There is no analytics, telemetry, crash reporting, or update-check traffic. The WebSocket connection is purely inbound — it subscribes to Polymarket's public price feed and receives updates; no wallet or credential is transmitted. See [PERMISSIONS.md](./PERMISSIONS.md) for the complete manifest.

### Storage

The SQLite database (`./copytrader.db` by default, overridable via `DB_PATH`) stores only watchlists, trade records, budget usage, and user-set configuration. It contains **no** credentials, **no** PII, and **no** data that is not already public on-chain.

### Default Mode

The server starts in `COPY_MODE=preview` by default. In preview mode, trades are recorded in the local database as simulations and **no** request is ever signed or sent to the CLOB trading endpoint. Live trading requires an explicit `COPY_MODE=live` plus all four Polymarket CLOB secrets listed in PERMISSIONS.md.

## Trust Boundary

This package is designed for **single-tenant** use — one operator, one wallet, one local process. It is explicitly **not** designed to be hosted as a multi-user service. The optional HTTP transport (protected by the bearer-token environment variable documented in PERMISSIONS.md) is intended for trusted private deployments only. See the README for the full deployment warning.

## Best Practices for Users

- Never commit `.env` files or API keys to version control
- Use `COPY_MODE=preview` (default) until you've verified your configuration
- Keep dependencies up to date
- Store the wallet signing key in a dedicated secrets manager (1Password, `pass`, `macOS` keychain) — not in a shell profile
- Set `DAILY_BUDGET` conservatively while evaluating copy targets
- Run the server on a machine whose full disk is encrypted
- Review [PERMISSIONS.md](./PERMISSIONS.md) before enabling live mode
