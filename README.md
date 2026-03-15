# @2oolkit/grvt-cli

Trade perpetual futures on [GRVT](https://grvt.io) — a hybrid decentralized derivatives exchange on ZKsync — from your terminal or AI agent.

**One package, three interfaces:**

| Interface | Command | Use Case |
|-----------|---------|----------|
| **CLI** | `grvt-cli` | Terminal trading, scripting, automation |
| **MCP Server** | `grvt-mcp` | AI agents (Claude, Cursor, Windsurf, etc.) |
| **OpenClaw Skill** | [`skill/SKILL.md`](skill/SKILL.md) | AI agent ecosystem (OpenClaw, ClawdBot) |

90+ perpetual instruments: crypto (BTC, ETH, SOL), equities (TSLA, AMZN), commodities (XAU, XAG).

## Installation

```bash
npm install -g @2oolkit/grvt-cli
```

This installs both `grvt-cli` (CLI) and `grvt-mcp` (MCP server).

## Prerequisites

- **Node.js** >= 20
- A **GRVT account** at [grvt.io](https://grvt.io)
- An **API key** (Dashboard > Settings > API Keys)

---

## CLI Usage

### Quick Start

```bash
# 1. Interactive setup (prompts for API key, secret, sub-account ID)
grvt-cli config init

# 2. Check a price (no auth needed)
grvt-cli market ticker BTC_USDT_Perp

# 3. Place a limit buy
grvt-cli order create --instrument BTC_USDT_Perp --side buy --size 0.001 --price 60000

# 4. View open orders
grvt-cli order list
```

### Configuration

**Interactive setup (recommended):**

```bash
grvt-cli config init
```

Prompts for:

| Prompt | Description | Where to find it |
|---|---|---|
| **API Key** | Your GRVT API key | Dashboard > Settings > API Keys |
| **API Secret** | Private key for EIP-712 signing | Shown once when creating API key |
| **Sub-account ID** | Numeric sub-account ID | Dashboard > Sub-accounts |

**Manual setup:**

```bash
grvt-cli config set --api-key <key> --api-secret <secret> --sub-account-id <id>
grvt-cli auth login
```

**Environment variables (CI/CD, Docker):**

```bash
export GRVT_API_KEY=<your-api-key>
export GRVT_SECRET_KEY=<your-api-secret>
export GRVT_SUB_ACCOUNT_ID=<your-sub-account-id>
```

### Command Reference

#### Market Data (no auth required)

```bash
grvt-cli market instruments                        # List all instruments
grvt-cli market instruments --kind PERPETUAL       # Filter by kind
grvt-cli market instruments --base BTC             # Filter by base currency
grvt-cli market ticker BTC_USDT_Perp               # Price, volume, funding
grvt-cli market orderbook BTC_USDT_Perp            # Orderbook (10 levels)
grvt-cli market orderbook BTC_USDT_Perp --depth 20 # 20 levels
```

#### Orders (auth required)

```bash
# Create
grvt-cli order create --instrument BTC_USDT_Perp --side buy --size 0.001 --price 60000
grvt-cli order create --instrument BTC_USDT_Perp --side sell --size 0.001 --type market
grvt-cli order create --instrument ETH_USDT_Perp --side buy --size 0.1 --price 3000 --post-only
grvt-cli order create --instrument BTC_USDT_Perp --side sell --size 0.01 --type market --reduce-only

# Manage
grvt-cli order list                                # Open orders
grvt-cli order get --order-id <id>                 # Order details
grvt-cli order cancel --order-id <id>              # Cancel one
grvt-cli order cancel-all                          # Cancel all
grvt-cli order history --limit 50                  # Order history
```

**Order options:**

| Option | Required | Description | Default |
|---|---|---|---|
| `--instrument` | Yes | e.g., `BTC_USDT_Perp` | — |
| `--side` | Yes | `buy` or `sell` | — |
| `--size` | Yes | Size in base currency | — |
| `--type` | No | `limit` or `market` | `limit` |
| `--price` | Limit only | Limit price | — |
| `--post-only` | No | Maker-only | `false` |
| `--reduce-only` | No | Reduce-only | `false` |
| `--time-in-force` | No | `GOOD_TILL_TIME`, `IMMEDIATE_OR_CANCEL`, `FILL_OR_KILL` | `GOOD_TILL_TIME` |
| `--client-order-id` | No | Custom tracking ID | auto |

#### Positions, Account & Funding

```bash
grvt-cli position list                             # All open positions
grvt-cli position list --kind PERPETUAL            # Filter by kind

grvt-cli account summary                           # Funding account
grvt-cli account sub-account                       # Sub-account (margin, balance)

grvt-cli funding rate BTC_USDT_Perp                # Current funding rate
grvt-cli funding history --limit 10                # Payment history
```

#### Auth & Config

```bash
grvt-cli auth login                                # Login
grvt-cli auth status                               # Check session
grvt-cli auth logout                               # Clear session

grvt-cli config init                               # Setup wizard
grvt-cli config set --api-key <key>                # Update config
grvt-cli config list                               # Show config (masked)
grvt-cli config get <key>                          # Get specific value
```

### Output Formats

All commands support `-o json` for scripting and piping:

```bash
grvt-cli market ticker BTC_USDT_Perp -o json
grvt-cli order list -o json | jq '.[].order_id'
```

---

## MCP Server

The MCP (Model Context Protocol) server exposes all GRVT functionality as tools for AI agents. Works with Claude Code, Claude Desktop, Cursor, Windsurf, and any MCP-compatible client.

### Setup for Claude Code

```bash
claude mcp add grvt-mcp -- grvt-mcp
```

### Setup for Claude Desktop / Cursor / Windsurf

Add to your MCP config file:

```json
{
  "mcpServers": {
    "grvt": {
      "command": "grvt-mcp"
    }
  }
}
```

Or without global install:

```json
{
  "mcpServers": {
    "grvt": {
      "command": "npx",
      "args": ["-y", "-p", "@2oolkit/grvt-cli", "grvt-mcp"]
    }
  }
}
```

### Available Tools (17)

| Category | Tools | Auth Required |
|----------|-------|---------------|
| **Market Data** | `get_instruments`, `get_ticker`, `get_orderbook` | No |
| **Orders** | `create_order`, `cancel_order`, `cancel_all_orders`, `get_order`, `list_open_orders`, `get_order_history` | Yes |
| **Positions** | `list_positions` | Yes |
| **Account** | `get_account_summary`, `get_sub_account_summary` | Yes |
| **Funding** | `get_funding_rate`, `get_funding_payment_history` | Mixed |
| **Auth** | `auth_login`, `auth_status`, `auth_logout` | No |

Once configured, your AI agent can directly query prices, place orders, manage positions, and monitor your account on GRVT.

### MCP Prerequisites

Before using MCP tools that require authentication, set up credentials via the CLI:

```bash
grvt-cli config init    # Interactive setup
grvt-cli auth login     # Create session
```

The MCP server reads the same config and session files as the CLI (`~/.grvt-cli/`).

---

## OpenClaw Skill

This package includes an [OpenClaw](https://openclaw.dev) skill definition for AI agent ecosystems. The skill file is located at [`skill/SKILL.md`](skill/SKILL.md) with detailed reference docs in `skill/references/`.

Compatible with OpenClaw, ClawdBot, and other agent skill platforms.

---

## Instrument Naming

Instruments follow `{BASE}_{QUOTE}_{Type}`:

| Instrument | Description |
|---|---|
| `BTC_USDT_Perp` | Bitcoin perpetual |
| `ETH_USDT_Perp` | Ethereum perpetual |
| `SOL_USDT_Perp` | Solana perpetual |
| `TSLA_USDT_Perp` | Tesla equity perpetual |
| `XAU_USDT_Perp` | Gold perpetual |

Use `grvt-cli market instruments -o json` for the full list with tick sizes and minimum order sizes.

## Common Workflows

### Close a Position

```bash
# Long position → sell reduce-only
grvt-cli order create --instrument BTC_USDT_Perp --side sell --size 0.002 --type market --reduce-only

# Short position → buy reduce-only
grvt-cli order create --instrument ETH_USDT_Perp --side buy --size 0.5 --type market --reduce-only
```

Always use `--reduce-only` when closing positions to prevent accidentally opening the opposite direction.

### Bracket Order (Entry + Take-Profit)

```bash
grvt-cli order create --instrument BTC_USDT_Perp --side buy --size 0.01 --type market
grvt-cli order create --instrument BTC_USDT_Perp --side sell --size 0.01 --price 75000 --reduce-only
```

### Funding Rate Arbitrage

```bash
grvt-cli funding rate BTC_USDT_Perp -o json     # Check rate
grvt-cli order create --instrument BTC_USDT_Perp --side buy --size 0.1 --type market  # Go long if negative
grvt-cli funding history --instrument BTC_USDT_Perp --limit 5 -o json  # Monitor payments
```

### Portfolio Health Check

```bash
grvt-cli account sub-account -o json             # Margin & balance
grvt-cli position list -o json                    # Open positions
grvt-cli order list -o json                       # Open orders
```

### Cancel Everything

```bash
grvt-cli order cancel-all
grvt-cli position list -o json
# For each position, create opposite reduce-only market order
```

## Error Handling

Errors include actionable recovery instructions:

```
ERROR: Not authenticated. Session expired or not logged in.

To fix this, run:
  grvt-cli auth login
```

| Error | Recovery |
|---|---|
| `Not authenticated` | `grvt-cli auth login` |
| `API key is not configured` | `grvt-cli config init` |
| `Order below minimum notional` | Increase `--size` or `--price` |
| `Instrument not found` | `grvt-cli market instruments --kind PERPETUAL` |

## Safety Rules

1. **Use `--reduce-only` for all exit orders** — prevents accidental position flips
2. **Check instrument specs** before placing orders — verify `minSize` and `tickSize`
3. **Check account balance** before large orders — `grvt-cli account sub-account -o json`
4. **Start with small sizes** when testing strategies
5. **Never expose API secret** — it's used locally for signing, never sent to servers
6. **Use Trade-only API keys** — never use keys with withdrawal permissions

## Security

- **Secret input masking** — `config init` hides your API secret as you type (displays `*`)
- **Cryptographic nonce** — order signing uses a CSPRNG (`crypto.randomInt`), not `Math.random()`
- **File permissions** — config and session files are created with `0600` (owner read/write only)
- **Input validation** — MCP tool inputs (instrument, size, price, order ID) are validated with regex patterns
- **Error sanitization** — server error responses are filtered to prevent internal detail leakage
- **Expired session cleanup** — expired session files are automatically deleted on detection

## Configuration Files

| File | Path | Description |
|---|---|---|
| Config | `~/.grvt-cli/config.json` | API key, secret, sub-account ID |
| Session | `~/.grvt-cli/session.json` | Login session (auto-managed) |

Both files use `0600` permissions (owner read/write only). Sessions auto-refresh when needed.

## Environment Variables

| Variable | Description |
|---|---|
| `GRVT_API_KEY` | API key (fallback when config not set) |
| `GRVT_SECRET_KEY` | API secret / private key |
| `GRVT_SUB_ACCOUNT_ID` | Default sub-account ID |

## Resources

- **GRVT Exchange**: https://grvt.io
- **npm Package**: https://www.npmjs.com/package/@2oolkit/grvt-cli
- **GitHub**: https://github.com/haeminmoon/grvt-cli
- **GRVT API Docs**: https://docs.grvt.io/api

## License

MIT
