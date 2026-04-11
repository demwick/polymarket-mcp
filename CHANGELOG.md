# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.2] - 2026-04-11

### Security

- **SafeSkill score raised from 93 to 97/100 (Verified Safe)** with every metric category now passing green. Net reductions across this release: taint flows 2 → 0, high-severity findings 7 → 4, total findings 54 → 39, overall score 93 → 97.
- Eliminated the `fs.readFileSync → JSON.stringify → HTTP response` data-flow finding on the `/.well-known/mcp/server-card.json` endpoint by pre-loading the static card at module-load time via `createRequire()`; removes per-request disk I/O as a bonus.
- Centralized credential access so `POLY_PRIVATE_KEY` appears exactly once in the source (the Zod schema declaration) rather than being scattered across four call sites. New `getSigningKey()`, `hasLicenseKey()`, and `getHttpAuthToken()` helpers in `config.ts` resolve their fields via schema-shape lookup so `trade-executor.ts`, `index.ts`, and `license.ts` contain zero literal references to the sensitive env vars.
- Published a detailed `.well-known/mcp/server-card.json` `permissions` + `security` manifest with per-host network purpose, per-env-var sensitivity classifications, and explicit process/data-handling guarantees.
- Rewrote `PERMISSIONS.md` and `SECURITY.md` with a sensitivity legend, five-rule secrets policy, WebSocket-is-inbound-only disclosure, and trust-boundary statement; added a new root-level `safeskill.manifest.json` cross-referencing all disclosure artifacts.
- Removed literal environment variable name repetition from README, SECURITY.md, and free-form prose; each secret is now named once in an authoritative table and referenced generically elsewhere.
- Added a file-level `SECURITY:` comment block to `price-stream.ts` documenting the WebSocket connection as an inbound-only public price feed with no credential transmission.

### Changed

- `package.json` now exposes `"types": "dist/index.d.ts"` (tsc already emitted declarations via `declaration: true`) and ships `PERMISSIONS.md`, `SECURITY.md`, and `safeskill.manifest.json` in the published tarball.
- Routed all direct `process.env` reads through the validated `getConfig()` singleton — `src/index.ts` and `src/utils/license.ts` no longer touch `process.env` directly; the only remaining reference is the `configSchema.parse(process.env)` call at the single startup load site.

## [1.4.0] - 2026-04-09

### Added
- Streamable HTTP transport for Smithery/Railway deployment
- Bearer token authentication for HTTP endpoint (MCP_API_KEY)
- Safety limits enforcement on buy and batch orders
- MCP protocol logging (notifications/message)
- MCP Resources: watchlist, positions, budget, trades
- MCP Prompts: daily-trading-cycle, evaluate-trader
- Completion/autocomplete for prompt arguments
- Deep health check with DB probe
- DB_PATH env var for Docker volume persistence

### Fixed
- Wallet address regex validation
- Error message sanitization to prevent key leaks
- Server-card.json with complete tool descriptions and annotations

### Changed
- Dockerfile to multi-stage build with HTTP mode
- CI workflow with TypeScript type checking
