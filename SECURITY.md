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

## Best Practices for Users

- Never commit `.env` files or API keys to version control
- Use `COPY_MODE=preview` (default) until you've verified your configuration
- Keep dependencies up to date
