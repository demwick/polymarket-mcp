# Contributing to Polymarket Trader MCP

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/demwick/polymarket-trader-mcp.git
cd polymarket-trader-mcp

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Build
npm run build

# Run tests
npm test
```

### Prerequisites

- Node.js >= 18
- npm

## Project Structure

```
src/
  index.ts          # MCP server entry point
  tools/            # MCP tool definitions (Zod schema + handler)
  services/         # Business logic layer
  db/               # SQLite schema & queries
  utils/            # Shared utilities
tests/              # Mirrors src/ structure
```

## Making Changes

1. **Fork** the repo and create a branch from `develop`:
   ```bash
   git checkout -b feature/your-feature develop
   ```

2. **Write code** following existing patterns:
   - ESM imports with `.js` extensions
   - Zod schemas for all tool inputs
   - TypeScript strict mode

3. **Add tests** for new functionality:
   ```bash
   # Run all tests
   npm test

   # Run a single test file
   npx vitest run tests/services/your-test.test.ts

   # Type-check
   npx tsc --noEmit
   ```

4. **Commit** with a clear message:
   ```
   feat: add market correlation tool
   fix: handle empty order book in price check
   docs: update tool reference table
   ```
   We follow [Conventional Commits](https://www.conventionalcommits.org/).

5. **Open a PR** against `develop` branch.

## Adding a New MCP Tool

1. Create `src/tools/your-tool.ts` with a Zod schema and handler
2. Register it in `src/index.ts` via `server.tool()`
3. Add tests in `tests/tools/your-tool.test.ts`
4. Update the tool count badge and tool reference table in `README.md`

## Testing Guidelines

- Use in-memory SQLite (`new Database(":memory:")`) for DB tests
- Mock external API calls with `vi.spyOn(globalThis, "fetch")`
- Mock `fetchWithRetry` with `vi.mock("../../src/utils/fetch.js")` to bypass retry delays
- Mock license checks with `vi.mock("../../src/utils/license.js")` in tool tests

## Code Review

All submissions require review. We use GitHub pull requests for this.

## Reporting Issues

- **Bugs**: Use the [Bug Report](https://github.com/demwick/polymarket-trader-mcp/issues/new?template=bug_report.yml) template
- **Features**: Use the [Feature Request](https://github.com/demwick/polymarket-trader-mcp/issues/new?template=feature_request.yml) template
- **Security**: See [SECURITY.md](SECURITY.md) — do NOT open a public issue

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
