# Trading Reference

Detailed guide for order placement, management, and position handling on GRVT.

## Order Types

### Limit Order

Places an order at a specific price. Only executes at the specified price or better. Default order type.

```bash
grvt-cli order create \
  --instrument BTC_USDT_Perp \
  --side buy \
  --size 0.01 \
  --price 65000
```

**When to use:** When you want price certainty and are willing to wait for fills.

### Market Order

Executes immediately at the best available price. Time-in-force is automatically set to `IMMEDIATE_OR_CANCEL`.

```bash
grvt-cli order create \
  --instrument BTC_USDT_Perp \
  --side buy \
  --size 0.01 \
  --type market
```

**When to use:** When speed matters more than price. Be aware of slippage on large orders.

### Post-Only Order

Rejected immediately if it would match against existing orders (guarantees maker fee). Use for maker strategies where you want to provide liquidity.

```bash
grvt-cli order create \
  --instrument BTC_USDT_Perp \
  --side buy \
  --size 0.01 \
  --price 65000 \
  --post-only
```

**When to use:** When you want guaranteed maker fees. If the price has moved and your order would take liquidity, it gets rejected instead of filling — protecting you from unexpected taker fees.

### Reduce-Only Order

Can only reduce an existing position, never increase or open a new one. Critical for take-profit and stop-loss orders.

```bash
grvt-cli order create \
  --instrument BTC_USDT_Perp \
  --side sell \
  --size 0.01 \
  --type market \
  --reduce-only
```

**When to use:** Always use for closing positions. Without `--reduce-only`, a sell order on a long position could overshoot and accidentally open a short position.

## Time-in-Force Options

| Value | Behavior | Best For |
|-------|----------|----------|
| `GOOD_TILL_TIME` | Remains on book until filled or cancelled | Default. Limit orders you want to keep open |
| `IMMEDIATE_OR_CANCEL` | Fills what it can immediately, cancels the rest | Partial fills OK, no resting order |
| `FILL_OR_KILL` | Must fill completely or is entirely cancelled | All-or-nothing execution |

```bash
# Fill-or-kill: either get the full 1.0 ETH or nothing
grvt-cli order create \
  --instrument ETH_USDT_Perp \
  --side buy \
  --size 1.0 \
  --price 3000 \
  --time-in-force FILL_OR_KILL
```

## Position Management

### Viewing Positions

```bash
# All positions
grvt-cli position list -o json

# Filter by instrument
grvt-cli position list --instrument BTC_USDT_Perp -o json

# Filter by kind
grvt-cli position list --kind PERPETUAL -o json
```

**Key position fields:**
- `instrument` — Instrument name
- `size` — Position size (positive = long, negative = short)
- `entry_price` — Average entry price
- `mark_price` — Current mark price
- `unrealized_pnl` — Unrealized profit/loss in quote currency
- `liquidation_price` — Estimated liquidation price

### Closing a Long Position

If you are long 0.01 BTC, sell 0.01 BTC with reduce-only:

```bash
grvt-cli order create \
  --instrument BTC_USDT_Perp \
  --side sell \
  --size 0.01 \
  --type market \
  --reduce-only
```

### Closing a Short Position

If you are short 0.5 ETH, buy 0.5 ETH with reduce-only:

```bash
grvt-cli order create \
  --instrument ETH_USDT_Perp \
  --side buy \
  --size 0.5 \
  --type market \
  --reduce-only
```

### Partially Closing a Position

You can close part of a position by specifying a smaller size:

```bash
# Close half of a 1.0 BTC long
grvt-cli order create \
  --instrument BTC_USDT_Perp \
  --side sell \
  --size 0.5 \
  --type market \
  --reduce-only
```

### Closing All Positions

There is no single command to close all positions. Follow this workflow:

1. Get all positions: `grvt-cli position list -o json`
2. For each position:
   - If `size > 0` (long): sell that size with `--reduce-only`
   - If `size < 0` (short): buy that absolute size with `--reduce-only`

```bash
# Example: close all
grvt-cli position list -o json
# For each position in the result:
grvt-cli order create --instrument <instrument> --side <opposite_side> --size <abs_size> --type market --reduce-only
```

## Order Management

### View Open Orders

```bash
grvt-cli order list -o json
```

### View Order Details

```bash
grvt-cli order get --order-id 0x0101010503abc123... -o json
```

Key fields: `order_id`, `status` (OPEN, FILLED, CANCELLED), `traded_size`, `avg_fill_price`.

### Cancel a Specific Order

```bash
grvt-cli order cancel --order-id 0x0101010503abc123...
```

### Cancel All Orders

```bash
# Cancel everything
grvt-cli order cancel-all

# Cancel only perpetual orders
grvt-cli order cancel-all --kind PERPETUAL
```

### Order History

```bash
# Last 20 orders (default)
grvt-cli order history -o json

# Last 50 orders
grvt-cli order history --limit 50 -o json
```

## Trading Patterns

### Bracket Order (Entry + Take-Profit)

```bash
# 1. Enter long position
grvt-cli order create --instrument BTC_USDT_Perp --side buy --size 0.01 --type market

# 2. Set take-profit at +5%
grvt-cli order create --instrument BTC_USDT_Perp --side sell --size 0.01 --price 75000 --reduce-only
```

Note: GRVT does not support native stop-loss orders via API. For stop-loss, you need to monitor the price and place a market sell when the stop level is hit.

### Scale-In (Dollar-Cost Average)

Place multiple limit orders at descending prices to average into a position:

```bash
grvt-cli order create --instrument ETH_USDT_Perp --side buy --size 1.0 --price 2900
grvt-cli order create --instrument ETH_USDT_Perp --side buy --size 1.0 --price 2850
grvt-cli order create --instrument ETH_USDT_Perp --side buy --size 1.0 --price 2800
grvt-cli order create --instrument ETH_USDT_Perp --side buy --size 1.0 --price 2750
```

### Scale-Out (Take Profit at Multiple Levels)

```bash
# Assuming 4.0 ETH long position
grvt-cli order create --instrument ETH_USDT_Perp --side sell --size 1.0 --price 3100 --reduce-only
grvt-cli order create --instrument ETH_USDT_Perp --side sell --size 1.0 --price 3200 --reduce-only
grvt-cli order create --instrument ETH_USDT_Perp --side sell --size 1.0 --price 3300 --reduce-only
grvt-cli order create --instrument ETH_USDT_Perp --side sell --size 1.0 --price 3500 --reduce-only
```

### Funding Rate Collection

When funding rate is significantly negative, longs receive payment from shorts:

```bash
# 1. Check funding rates across instruments
grvt-cli funding rate BTC_USDT_Perp -o json
grvt-cli funding rate ETH_USDT_Perp -o json
grvt-cli funding rate SOL_USDT_Perp -o json

# 2. Enter long on instrument with most negative funding
grvt-cli order create --instrument BTC_USDT_Perp --side buy --size 0.1 --type market

# 3. Monitor funding payments
grvt-cli funding history --instrument BTC_USDT_Perp --limit 5 -o json

# 4. Exit when funding normalizes
grvt-cli order create --instrument BTC_USDT_Perp --side sell --size 0.1 --type market --reduce-only
```

### Maker-Only Grid

Place post-only orders on both sides to earn maker fees:

```bash
# Bids (buy side)
grvt-cli order create --instrument BTC_USDT_Perp --side buy --size 0.002 --price 71000 --post-only
grvt-cli order create --instrument BTC_USDT_Perp --side buy --size 0.002 --price 70500 --post-only
grvt-cli order create --instrument BTC_USDT_Perp --side buy --size 0.002 --price 70000 --post-only

# Asks (sell side)
grvt-cli order create --instrument BTC_USDT_Perp --side sell --size 0.002 --price 72000 --post-only
grvt-cli order create --instrument BTC_USDT_Perp --side sell --size 0.002 --price 72500 --post-only
grvt-cli order create --instrument BTC_USDT_Perp --side sell --size 0.002 --price 73000 --post-only
```

## Common Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Order below minimum notional | size * price too small | Increase size or price. Check `minSize` with `grvt-cli market instruments` |
| Instrument not found | Typo in instrument name | Verify with `grvt-cli market instruments --kind PERPETUAL` |
| Insufficient margin | Not enough available balance | Check with `grvt-cli account sub-account -o json`, deposit or reduce positions |
| Post-only order rejected | Would have filled immediately | Price has moved; adjust your limit price |
| Order immediately cancelled | Fill-or-kill with insufficient liquidity | Use IMMEDIATE_OR_CANCEL or reduce size |

## Best Practices

1. **Always check instrument specs** before placing orders — especially `minSize` and `tickSize`
2. **Use `--reduce-only` for all exit orders** — prevents accidental position flips
3. **Use `--post-only` when providing liquidity** — guarantees maker fees
4. **Start with small sizes** — test your strategy with minimum sizes first
5. **Monitor margin** — check `grvt-cli account sub-account -o json` regularly
6. **Cancel all before deploying new strategy** — `grvt-cli order cancel-all` to clear stale orders
7. **Use limit orders when possible** — better prices and lower fees than market orders
