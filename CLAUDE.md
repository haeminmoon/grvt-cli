# CLAUDE.md

## Project Overview

**`@2oolkit/grvt-cli`** — CLI + MCP server for trading perpetual futures on [GRVT](https://grvt.io), a hybrid decentralized derivatives exchange on ZKsync.

One npm package (`@2oolkit/grvt-cli`), three interfaces:

| Interface | Binary | Purpose |
|-----------|--------|---------|
| CLI | `grvt-cli` | Terminal trading, scripting, automation |
| MCP Server | `grvt-mcp` | AI agents (Claude, Cursor, Windsurf) via Model Context Protocol |
| OpenClaw Skill | `skill/SKILL.md` | AI agent skill ecosystems (OpenClaw, ClawdBot) |

90+ perpetual instruments: crypto (BTC, ETH, SOL), equities (TSLA, AMZN), commodities (XAU, XAG).

## Tech Stack

- **Language:** TypeScript
- **CLI Framework:** Commander.js
- **Build:** tsup (esbuild) → two bundles: `dist/index.js` (CLI), `dist/mcp.js` (MCP)
- **GRVT SDK:** `@grvt/client` (API types/methods) + `@grvt/sdk` (auth, signing, domain)
- **Signing:** EIP-712 typed data signing via `ethers` + `@metamask/eth-sig-util`
- **MCP:** `@modelcontextprotocol/sdk`
- **Validation:** `zod` (MCP tool input schemas)
- **Tests:** Jest + ts-jest

## Architecture

```
src/
├── index.ts              # CLI entry (Commander)
├── mcp.ts                # MCP server entry
├── commands/             # CLI command handlers (auth, market, order, position, funding, account, config)
├── mcp/tools/            # MCP tool definitions (mirrors commands/)
├── mcp/helpers.ts        # MCP response/error helpers
├── client/api-client.ts  # GrvtClient wrapper (auth, cookies, session)
├── config/store.ts       # Config/session file I/O (~/.grvt-cli/)
├── config/constants.ts   # Environment domains, chain IDs
├── signing/order-signer.ts   # EIP-712 order signing (CSPRNG nonce)
├── signing/builder-signer.ts # EIP-712 builder auth signing
├── output/formatter.ts   # JSON/table output
├── output/error.ts       # Actionable error messages
└── utils/helpers.ts      # Number formatting, timestamp conversion
```

## Key Design Decisions

- **Shared credentials:** CLI and MCP read the same `~/.grvt-cli/config.json` and `session.json`. Users must run `grvt-cli config init` + `grvt-cli auth login` before MCP tools work.
- **File permissions:** Config dir `0700`, config/session files `0600`.
- **CSPRNG nonces:** Order signing uses `crypto.randomInt()`, NOT the SDK's `Math.random()`.
- **No withdrawal features:** By design, for security.
- **Output:** Table (human default) + JSON (`-o json` for agents/scripts). Errors go to stderr.
- **Auth flow:** API key login → session cookie stored locally → auto-refresh on expiry.
- **EIP-712 signing:** Orders are signed client-side with the user's private key (apiSecret). The key never leaves the machine.

## Commands & Scripts

```bash
npm run build       # tsup → dist/index.js + dist/mcp.js
npm run dev         # ts-node src/index.ts
npm test            # jest --verbose
npm run lint        # tsc --noEmit
```

## Publishing

```bash
npm publish --access public --registry https://registry.npmjs.org/ --//registry.npmjs.org/:_authToken=<token>
```

npm package: `@2oolkit/grvt-cli` (public, scoped under `@2oolkit`)

## Important Files

| File | Purpose |
|------|---------|
| `PLAN.md` | Implementation plan & progress checklist |
| `skill/SKILL.md` | OpenClaw/ClawdBot skill definition |
| `skill/references/` | Detailed reference docs (trading, market-data, authentication) |
| `.mcp.json` | Project-level MCP config (sequential-thinking, context7) |

## Environments

| Environment | Domain | Chain ID |
|-------------|--------|----------|
| PRODUCTION | grvt.io | 325 |
| TESTNET | testnet.grvt.io | 326 |
| DEV | dev.gravitymarkets.io | 327 |
| STAGING | staging.gravitymarkets.io | 327 |

## User Preferences

- Primary language for conversation: Korean
- Commit messages: English
- Documentation: English (for public repo)
