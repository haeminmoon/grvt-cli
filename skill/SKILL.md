---
name: grvt
description: >-
  Trade perpetual futures on the GRVT derivatives exchange via CLI or MCP server.
  Use when the user wants to: trade crypto perpetuals (BTC, ETH, SOL, and 90+ instruments),
  check prices or funding rates, view orderbooks, place limit or market orders,
  cancel orders, manage positions, check account balances or margin,
  view order/fill/trade history, monitor funding payments,
  or automate derivatives trading strategies.
  GRVT is a hybrid decentralized exchange on ZKsync with institutional-grade performance,
  sub-cent spreads, and deep liquidity.
  Also available as an MCP server (grvt-mcp) for Claude, Cursor, and other AI agents.
license: MIT
compatibility: >-
  Requires Node.js >= 20. Works on macOS, Linux, and Windows.
  Network access to grvt.io required.
metadata:
  author: 2oolkit
  version: "0.1.1"
  exchange: grvt
  openclaw:
    emoji: "📈"
    homepage: "https://grvt.io"
    primaryEnv: "GRVT_API_KEY"
    requires:
      bins: ["grvt-cli", "grvt-mcp"]
      env: ["GRVT_API_KEY", "GRVT_SECRET_KEY", "GRVT_SUB_ACCOUNT_ID"]
    install:
      - id: "grvt-cli-npm"
        kind: "npm"
        package: "@2oolkit/grvt-cli"
        bins: ["grvt-cli", "grvt-mcp"]
        label: "Install grvt-cli & grvt-mcp via npm"
  clawdbot:
    emoji: "📈"
    homepage: "https://grvt.io"
    primaryEnv: "GRVT_API_KEY"
    requires:
      bins: ["grvt-cli", "grvt-mcp"]
      env: ["GRVT_API_KEY", "GRVT_SECRET_KEY", "GRVT_SUB_ACCOUNT_ID"]
    install:
      - id: "grvt-cli-npm"
        kind: "npm"
        package: "@2oolkit/grvt-cli"
        bins: ["grvt-cli"]
        label: "Install grvt-cli via npm"
---

# GRVT

Trade perpetual futures on [GRVT](https://grvt.io), a hybrid decentralized derivatives exchange built on ZKsync Validium. Execute orders, manage positions, monitor markets, and automate trading strategies — via CLI or MCP server.

GRVT offers 90+ perpetual instruments including crypto (BTC, ETH, SOL), equities (TSLA, AMZN), and commodities (XAU, XAG) with institutional-grade matching engine performance.

**Available interfaces:**
- **CLI** (`grvt-cli`) — Terminal trading, scripting, automation
- **MCP Server** (`grvt-mcp`) — AI agents via Model Context Protocol (Claude, Cursor, Windsurf)

## Getting Started

### Install

```bash
npm install -g @2oolkit/grvt-cli
```

Or with bun:

```bash
bun install -g @2oolkit/grvt-cli
```

Verify installation:

```bash
grvt-cli --version
```

### First-Time Setup

Run the interactive setup wizard:

```bash
grvt-cli config init
```

You will be prompted for three values:

| Field | Description | Where to Find |
|-------|-------------|---------------|
| **API Key** | Your GRVT API key | [Dashboard](https://grvt.io) > Settings > API Keys |
| **API Secret** | Private key for signing orders | Shown once when creating the API key |
| **Sub-account ID** | Numeric sub-account ID for trading | [Dashboard](https://grvt.io) > Sub-accounts |

The wizard saves your config and automatically logs you in. Environment is set to production by default.

**Alternative: Environment Variables**

```bash
export GRVT_API_KEY=<your-api-key>
export GRVT_SECRET_KEY=<your-api-secret>
export GRVT_SUB_ACCOUNT_ID=<your-sub-account-id>
grvt-cli auth login
```

**Alternative: Manual Config**

```bash
grvt-cli config set --api-key <key> --api-secret <secret> --sub-account-id <id>
grvt-cli auth login
```

Environment variables override config file values. Config file values override defaults.

### Verify Setup

```bash
# Check authentication
grvt-cli auth status

# Check account balance
grvt-cli account sub-account

# Test with a market data query (no auth needed)
grvt-cli market ticker BTC_USDT_Perp
```

## Output Format

**Always use `-o json` when parsing command output programmatically.** Table format is for human display only.

```bash
# JSON output (for agents and scripts)
grvt-cli market ticker BTC_USDT_Perp -o json

# Table output (default, for humans)
grvt-cli market ticker BTC_USDT_Perp

# Pipe JSON to other tools
grvt-cli order list -o json | jq '.[].order_id'
```

All commands support `-o json`. Data goes to stdout, errors go to stderr.

## Command Reference

### Market Data (No Authentication Required)

These commands work without login. Use them for price checks, instrument discovery, and market analysis.

| Command | Description |
|---------|-------------|
| `grvt-cli market instruments` | List all available instruments |
| `grvt-cli market instruments --kind PERPETUAL` | Filter by kind (PERPETUAL, FUTURE, CALL, PUT) |
| `grvt-cli market instruments --base BTC` | Filter by base currency |
| `grvt-cli market instruments --base ETH --kind PERPETUAL` | Combine filters |
| `grvt-cli market ticker <instrument>` | Price, volume, funding rate, open interest |
| `grvt-cli market orderbook <instrument>` | Orderbook with bids and asks (10 levels) |
| `grvt-cli market orderbook <instrument> --depth 20` | 20 levels of depth |

### Trading (Authentication Required)

All trading commands require a valid session. Run `grvt-cli auth login` first.

#### Create Orders

| Command | Description |
|---------|-------------|
| `grvt-cli order create --instrument <name> --side buy --size <n> --price <p>` | Limit buy |
| `grvt-cli order create --instrument <name> --side sell --size <n> --price <p>` | Limit sell |
| `grvt-cli order create --instrument <name> --side buy --size <n> --type market` | Market buy |
| `grvt-cli order create --instrument <name> --side sell --size <n> --type market` | Market sell |
| `grvt-cli order create ... --post-only` | Maker-only (rejected if would take) |
| `grvt-cli order create ... --reduce-only` | Can only reduce position, never increase |
| `grvt-cli order create ... --time-in-force FILL_OR_KILL` | Fill entirely or cancel |
| `grvt-cli order create ... --time-in-force IMMEDIATE_OR_CANCEL` | Fill what's available, cancel rest |

**Order create options:**

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--instrument <name>` | Yes | Instrument name (e.g., `BTC_USDT_Perp`) | -- |
| `--side <buy\|sell>` | Yes | Order side | -- |
| `--size <amount>` | Yes | Order size in base currency | -- |
| `--type <limit\|market>` | No | Order type | `limit` |
| `--price <price>` | Limit only | Limit price (required for limit orders) | -- |
| `--post-only` | No | Maker-only order | `false` |
| `--reduce-only` | No | Reduce-only order | `false` |
| `--time-in-force <tif>` | No | GOOD_TILL_TIME, IMMEDIATE_OR_CANCEL, FILL_OR_KILL | `GOOD_TILL_TIME` |
| `--client-order-id <id>` | No | Custom client order ID | auto-generated |

#### Manage Orders

| Command | Description |
|---------|-------------|
| `grvt-cli order list` | List all open orders |
| `grvt-cli order get --order-id <id>` | Get details of a specific order |
| `grvt-cli order cancel --order-id <id>` | Cancel a specific order |
| `grvt-cli order cancel-all` | Cancel all open orders |
| `grvt-cli order cancel-all --kind PERPETUAL` | Cancel all perpetual orders |
| `grvt-cli order history --limit <n>` | Order history (default 20) |

### Positions

| Command | Description |
|---------|-------------|
| `grvt-cli position list` | List all open positions |
| `grvt-cli position list --kind PERPETUAL` | Filter by instrument kind |
| `grvt-cli position list --instrument <name>` | Filter by specific instrument |

### Account

| Command | Description |
|---------|-------------|
| `grvt-cli account summary` | Funding account (total equity, spot balances) |
| `grvt-cli account sub-account` | Sub-account (margin, available balance, unrealized PnL) |

### Funding Rates

| Command | Description |
|---------|-------------|
| `grvt-cli funding rate <instrument>` | Current funding rate for an instrument |
| `grvt-cli funding history` | All funding payment history |
| `grvt-cli funding history --instrument <name>` | Filter by instrument |
| `grvt-cli funding history --limit <n>` | Limit number of results |

### Authentication & Config

| Command | Description |
|---------|-------------|
| `grvt-cli auth login` | Login with API key, create session |
| `grvt-cli auth status` | Check session status and expiry |
| `grvt-cli auth logout` | Clear saved session |
| `grvt-cli config init` | Interactive setup wizard |
| `grvt-cli config set --api-key <key>` | Update a single config value |
| `grvt-cli config list` | Show current config (secrets masked) |
| `grvt-cli config get <key>` | Get a specific config value |

## Instrument Naming

Instruments follow the pattern `{BASE}_{QUOTE}_{Type}`:

| Instrument | Description |
|------------|-------------|
| `BTC_USDT_Perp` | Bitcoin perpetual |
| `ETH_USDT_Perp` | Ethereum perpetual |
| `SOL_USDT_Perp` | Solana perpetual |
| `TSLA_USDT_Perp` | Tesla equity perpetual |
| `XAU_USDT_Perp` | Gold perpetual |

Use `grvt-cli market instruments --kind PERPETUAL -o json` to get the full list with tick sizes and minimum order sizes.

**Important:** Always check `minSize` and `tickSize` before placing orders. Orders below minimum notional (size * price) will be rejected.

## Common Workflows

### Check Price and Place Order

```bash
# 1. Check current BTC price
grvt-cli market ticker BTC_USDT_Perp -o json

# 2. Place a limit buy below current price
grvt-cli order create --instrument BTC_USDT_Perp --side buy --size 0.002 --price 68000

# 3. Verify the order is open
grvt-cli order list
```

### Close a Position

```bash
# 1. Check your positions
grvt-cli position list -o json

# 2. Close a long position with a market sell (reduce-only)
grvt-cli order create --instrument BTC_USDT_Perp --side sell --size 0.002 --type market --reduce-only

# 3. Close a short position with a market buy (reduce-only)
grvt-cli order create --instrument ETH_USDT_Perp --side buy --size 0.5 --type market --reduce-only
```

**Always use `--reduce-only` when closing positions** to prevent accidentally opening a position in the opposite direction.

### Bracket Order (Entry + Take-Profit)

```bash
# 1. Enter long via market order
grvt-cli order create --instrument BTC_USDT_Perp --side buy --size 0.01 --type market

# 2. Set take-profit as a reduce-only limit sell
grvt-cli order create --instrument BTC_USDT_Perp --side sell --size 0.01 --price 75000 --reduce-only
```

### Scale-In (Dollar-Cost Average)

```bash
# Place multiple limit buys at different levels
grvt-cli order create --instrument ETH_USDT_Perp --side buy --size 1.0 --price 2900
grvt-cli order create --instrument ETH_USDT_Perp --side buy --size 1.0 --price 2850
grvt-cli order create --instrument ETH_USDT_Perp --side buy --size 1.0 --price 2800
```

### Funding Rate Arbitrage

```bash
# 1. Check funding rate
grvt-cli funding rate BTC_USDT_Perp -o json
# Negative rate = shorts pay longs

# 2. If funding is very negative, go long to collect
grvt-cli order create --instrument BTC_USDT_Perp --side buy --size 0.1 --type market

# 3. Monitor funding payments
grvt-cli funding history --instrument BTC_USDT_Perp --limit 5 -o json
```

### Multi-Instrument Funding Scan

```bash
# Scan funding rates across major instruments
grvt-cli funding rate BTC_USDT_Perp -o json
grvt-cli funding rate ETH_USDT_Perp -o json
grvt-cli funding rate SOL_USDT_Perp -o json
# Compare rates to find extreme funding (potential arbitrage)
```

### Portfolio Health Check

```bash
# 1. Check margin and available balance
grvt-cli account sub-account -o json

# 2. Check all open positions
grvt-cli position list -o json

# 3. Check all open orders
grvt-cli order list -o json

# 4. Review recent order history
grvt-cli order history --limit 10 -o json
```

### Risk Management — Close Losing Positions

```bash
# 1. Get all positions
grvt-cli position list -o json
# Check unrealized_pnl for each position

# 2. Close positions with losses exceeding threshold
# For a long position, sell reduce-only:
grvt-cli order create --instrument ETH_USDT_Perp --side sell --size 5.0 --type market --reduce-only

# 3. Verify position is closed
grvt-cli position list -o json
```

### Cancel Everything and Flatten

```bash
# 1. Cancel all open orders
grvt-cli order cancel-all

# 2. Close all positions (for each position, create opposite reduce-only market order)
grvt-cli position list -o json
# Then for each position with size > 0 (long):
grvt-cli order create --instrument <name> --side sell --size <position_size> --type market --reduce-only
# For each position with size < 0 (short):
grvt-cli order create --instrument <name> --side buy --size <abs_position_size> --type market --reduce-only
```

## Funding Rate Interpretation

| Rate | Direction | Meaning |
|------|-----------|---------|
| Positive | Longs pay shorts | Market is bullish (trading at premium) |
| Negative | Shorts pay longs | Market is bearish (trading at discount) |
| High absolute value | Strong directional bias | Consider contrarian position to collect funding |
| Near zero | Balanced market | No significant funding opportunity |

Funding is settled every 8 hours. Payment = position size * funding rate * mark price.

## Error Handling

Errors are written to stderr with actionable recovery instructions. When you encounter an error, read the suggested command and execute it, then retry the original command.

### Common Errors and Recovery

| Error | Cause | Recovery |
|-------|-------|----------|
| `Not authenticated` | Session expired or not logged in | `grvt-cli auth login` |
| `API key is not configured` | No API key set | `grvt-cli config init` |
| `API secret is not configured` | No secret set | `grvt-cli config set --api-secret <secret>` |
| `Order below minimum notional` | size * price too small | Increase `--size` or `--price` |
| `Instrument not found` | Wrong instrument name | `grvt-cli market instruments --kind PERPETUAL` |
| `--price is required for limit orders` | Missing price for limit | Add `--price <amount>` or use `--type market` |
| `--side must be "buy" or "sell"` | Invalid side value | Use `--side buy` or `--side sell` |
| `Request failed with status code 400` | Bad request parameters | Check the DETAIL output for specifics |
| `Request failed with status code 401` | Auth issue | `grvt-cli auth login` |

### Error Output Format

```
ERROR: <message>

To fix this, run:
  <suggested command>
```

For API errors, additional detail is shown:

```
ERROR: Request failed with status code 400
DETAIL:
{
  "code": 2066,
  "message": "Order below minimum notional. Please try again with a higher price or size."
}
```

## Safety Rules

1. **Never place orders without explicit user intent.** Unless the user has specifically requested autonomous execution, always confirm before placing orders.
2. **Verify instrument names** using `grvt-cli market instruments` before placing orders. Typos will fail with "Instrument not found."
3. **Check account balance** with `grvt-cli account sub-account -o json` before placing large orders. Ensure `available_balance` is sufficient.
4. **Use `--reduce-only`** when closing positions to prevent accidentally opening a new position in the opposite direction.
5. **Start with small sizes** when testing strategies or executing unfamiliar operations.
6. **Check minimum order sizes** with `grvt-cli market instruments -o json`. Orders below `minSize` or minimum notional will be rejected.
7. **Never expose the API secret.** It is used locally for EIP-712 order signing and is never sent to any server.
8. **Use Trade-only API keys.** Never use withdrawal-enabled keys with the CLI.

## Configuration Files

| File | Path | Description |
|------|------|-------------|
| Config | `~/.grvt-cli/config.json` | API key, secret, sub-account ID |
| Session | `~/.grvt-cli/session.json` | Login session (auto-managed) |

Both files are created with `0600` permissions (owner read/write only). Sessions expire after ~24 hours and are automatically refreshed when needed.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GRVT_API_KEY` | API key (overrides config file) |
| `GRVT_SECRET_KEY` | API secret / private key (overrides config file) |
| `GRVT_SUB_ACCOUNT_ID` | Default sub-account ID (overrides config file) |

## Tips

### For New Users

- Start with market data commands — no auth needed: `grvt-cli market ticker BTC_USDT_Perp`
- Run `grvt-cli config init` for guided setup
- Place your first order with a small size and a limit price far from market
- Use `grvt-cli order list` and `grvt-cli order cancel-all` to manage test orders
- Always check `minSize` with `grvt-cli market instruments --base BTC -o json`

### For Experienced Users

- Use `-o json` with `jq` for scripted workflows
- Combine funding rate checks with automated position entry
- Use `--post-only` for guaranteed maker orders (lower fees)
- Monitor positions with `grvt-cli position list -o json` in automation loops
- Use `--reduce-only` for all exit orders to prevent position flips

### For AI Agents

- **Always use `-o json`** — table format cannot be reliably parsed
- Read error messages from stderr — they contain recovery commands
- Check `grvt-cli auth status -o json` before trading — if expired, run `grvt-cli auth login`
- Verify instrument exists before placing orders
- Use `--reduce-only` for closing positions — this is critical for preventing unintended exposure
- There is no single "close all positions" command — iterate over `position list` results

## Detailed References

For in-depth guides on specific topics:

- **[references/trading.md](references/trading.md)** — Order types, time-in-force, position management, bracket orders, scaling strategies
- **[references/market-data.md](references/market-data.md)** — Instrument discovery, ticker fields, orderbook analysis, funding rate strategies
- **[references/authentication.md](references/authentication.md)** — Setup methods, session management, security best practices, credential rotation

## Troubleshooting

### CLI Not Found

```bash
# Verify installation
which grvt-cli

# Reinstall
npm install -g @2oolkit/grvt-cli
```

### Authentication Issues

```bash
# Check current auth state
grvt-cli auth status

# Re-login
grvt-cli auth login

# Full re-setup
grvt-cli config init
```

### Order Rejected

```bash
# Check minimum size for the instrument
grvt-cli market instruments --base BTC -o json
# Look at minSize and tickSize

# Check your balance
grvt-cli account sub-account -o json
# Look at available_balance
```

### No Open Positions Showing

Positions only appear when you have active exposure. If you placed a limit order, it may not have filled yet:

```bash
# Check if orders are still pending
grvt-cli order list

# Check order history for fills
grvt-cli order history --limit 5
```

### Session Keeps Expiring

Sessions last ~24 hours. The CLI automatically refreshes sessions when needed. If issues persist:

```bash
# Clear and re-login
grvt-cli auth logout
grvt-cli auth login
```

## MCP Server

For AI agents that support MCP (Model Context Protocol), this package also ships `grvt-mcp`:

```bash
# Claude Code
claude mcp add grvt-mcp -- grvt-mcp

# Claude Desktop / Cursor / Windsurf — add to MCP config:
{
  "mcpServers": {
    "grvt": { "command": "grvt-mcp" }
  }
}
```

The MCP server exposes 17 tools: `get_instruments`, `get_ticker`, `get_orderbook`, `create_order`, `cancel_order`, `cancel_all_orders`, `get_order`, `list_open_orders`, `get_order_history`, `list_positions`, `get_account_summary`, `get_sub_account_summary`, `get_funding_rate`, `get_funding_payment_history`, `auth_login`, `auth_status`, `auth_logout`.

Credentials are shared with the CLI — set up once with `grvt-cli config init`.

## Resources

- **GRVT Exchange**: https://grvt.io
- **npm Package**: https://www.npmjs.com/package/@2oolkit/grvt-cli
- **GitHub**: https://github.com/haeminmoon/grvt-cli
- **GRVT API Docs**: https://docs.grvt.io/api

---

**Quick Win:** Start by checking a price (`grvt-cli market ticker BTC_USDT_Perp`) to verify the CLI works, then place a small limit order away from market price to test the full flow.

**Security:** Keep your API secret private. Never commit config files to version control. Only use Trade-only API keys — never keys with withdrawal permissions.
