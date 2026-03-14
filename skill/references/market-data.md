# Market Data Reference

All market data commands are public and do not require authentication. Use them freely for price checks, research, and strategy development.

## Instruments

GRVT offers 90+ perpetual instruments across crypto, equities, and commodities.

### List All Instruments

```bash
grvt-cli market instruments -o json
```

### Filter Instruments

```bash
# By kind
grvt-cli market instruments --kind PERPETUAL -o json
grvt-cli market instruments --kind FUTURE -o json

# By base currency
grvt-cli market instruments --base BTC -o json
grvt-cli market instruments --base ETH -o json

# Combined
grvt-cli market instruments --base SOL --kind PERPETUAL -o json
```

Valid kinds: `PERPETUAL`, `FUTURE`, `CALL`, `PUT`

### Instrument Response Fields

| Field | Description | Example |
|-------|-------------|---------|
| `instrument` | Full name | `BTC_USDT_Perp` |
| `kind` | Type | `PERPETUAL` |
| `base` | Base currency | `BTC` |
| `quote` | Quote currency | `USDT` |
| `tickSize` | Minimum price increment | `0.1` |
| `minSize` | Minimum order size | `0.001` |

**Critical:** Always check `minSize` before placing orders. Orders with `size < minSize` will be rejected. Also check minimum notional = `size * price`.

### Popular Instruments

| Category | Examples |
|----------|---------|
| Crypto Majors | `BTC_USDT_Perp`, `ETH_USDT_Perp`, `SOL_USDT_Perp` |
| Crypto Alts | `DOGE_USDT_Perp`, `ARB_USDT_Perp`, `LINK_USDT_Perp` |
| Equities | `TSLA_USDT_Perp`, `AMZN_USDT_Perp`, `MSTR_USDT_Perp` |
| Commodities | `XAU_USDT_Perp`, `XAG_USDT_Perp`, `COPPER_USDT_Perp` |

## Ticker

Real-time price, volume, and funding data for a single instrument.

```bash
grvt-cli market ticker BTC_USDT_Perp -o json
```

### Ticker Response Fields

| Field | Description |
|-------|-------------|
| `last_price` | Last traded price |
| `mark_price` | Mark price (used for PnL, margin, and liquidation calculations) |
| `index_price` | Index price (spot reference from external sources) |
| `mid_price` | Midpoint between best bid and ask |
| `best_bid_price` | Highest buy order price |
| `best_bid_size` | Size available at best bid |
| `best_ask_price` | Lowest sell order price |
| `best_ask_size` | Size available at best ask |
| `funding_rate` | Current funding rate (percentage) |
| `funding_rate_8h_curr` | Current 8-hour funding rate |
| `funding_rate_8h_avg` | Average 8-hour funding rate |
| `next_funding_time` | Next funding settlement (nanosecond timestamp) |
| `buy_volume_24h_b` | 24h buy volume in base currency |
| `sell_volume_24h_b` | 24h sell volume in base currency |
| `buy_volume_24h_q` | 24h buy volume in quote currency (USDT) |
| `sell_volume_24h_q` | 24h sell volume in quote currency (USDT) |
| `high_price` | 24h high price |
| `low_price` | 24h low price |
| `open_price` | 24h opening price |
| `open_interest` | Total open interest in base currency |
| `long_short_ratio` | Ratio of long to short positions |

### Key Price Types

- **Last Price:** Most recent trade price. Can be stale in low-liquidity markets.
- **Mark Price:** Calculated from index price + basis. Used for unrealized PnL, margin requirements, and liquidation. This is the "true" price for risk purposes.
- **Index Price:** Aggregated spot price from multiple external exchanges. Represents the "fair" underlying price.
- **Mid Price:** (best_bid + best_ask) / 2. Best estimate of current market price.

## Orderbook

View the order book (bids and asks) for an instrument.

```bash
# Default 10 levels
grvt-cli market orderbook BTC_USDT_Perp -o json

# 20 levels
grvt-cli market orderbook BTC_USDT_Perp --depth 20 -o json
```

### Interpreting the Orderbook

- **Asks (sell orders):** Sorted from lowest (nearest to market) to highest price. These are prices at which you can buy.
- **Bids (buy orders):** Sorted from highest (nearest to market) to lowest price. These are prices at which you can sell.
- **Spread:** `best_ask_price - best_bid_price`. Tighter spreads indicate better liquidity.
- **Depth:** Total size available at each level. More depth = less slippage for large orders.

### Spread Analysis

```bash
# Get orderbook in JSON
grvt-cli market orderbook BTC_USDT_Perp -o json
# Calculate: spread = asks[0].price - bids[0].price
# Calculate: spread_bps = (spread / mid_price) * 10000
```

## Funding Rates

### Current Funding Rate

```bash
grvt-cli funding rate BTC_USDT_Perp -o json
```

### Response Fields

| Field | Description |
|-------|-------------|
| `funding_rate` | Current period funding rate |
| `funding_rate_8_h_avg` | 8-hour average rate |
| `funding_time` | Last settlement time (nanosecond timestamp) |
| `mark_price` | Mark price at funding time |
| `funding_interval_hours` | Settlement interval (typically 8 hours) |

### Funding Rate Interpretation

| Rate Value | Direction | Market Sentiment | Implication |
|------------|-----------|------------------|-------------|
| Positive (e.g., +0.01%) | Longs pay shorts | Bullish (premium over index) | Shorting earns funding |
| Negative (e.g., -0.01%) | Shorts pay longs | Bearish (discount to index) | Longing earns funding |
| Large positive (> +0.05%) | Longs pay heavily | Very bullish, possible overextension | Strong contrarian short signal |
| Large negative (< -0.05%) | Shorts pay heavily | Very bearish, possible oversold | Strong contrarian long signal |
| Near zero | Balanced | No strong directional bias | No funding opportunity |

### Funding Payment Calculation

```
Payment per settlement = Position Size × Funding Rate × Mark Price
```

Example: If you hold 1 BTC long and funding rate is -0.01%:
- You RECEIVE: 1 × 0.0001 × 70,000 = $7.00 per 8-hour period
- Annual (approx): $7.00 × 3 × 365 = $7,665

### Funding Payment History

```bash
# All payment history
grvt-cli funding history -o json

# Filter by instrument
grvt-cli funding history --instrument BTC_USDT_Perp -o json

# Limit results
grvt-cli funding history --instrument BTC_USDT_Perp --limit 10 -o json
```

Response fields:
- `instrument` — Instrument name
- `amount` — Payment amount (positive = received, negative = paid)
- `currency` — Payment currency (USDT)
- `event_time` — Settlement time

## Common Market Data Workflows

### Pre-Trade Checklist

Before placing any order, verify:

```bash
# 1. Check instrument exists and get min size
grvt-cli market instruments --base BTC -o json

# 2. Check current price
grvt-cli market ticker BTC_USDT_Perp -o json

# 3. Check liquidity
grvt-cli market orderbook BTC_USDT_Perp -o json
```

### Multi-Instrument Dashboard

```bash
# Price check across majors
grvt-cli market ticker BTC_USDT_Perp -o json
grvt-cli market ticker ETH_USDT_Perp -o json
grvt-cli market ticker SOL_USDT_Perp -o json

# Funding rate comparison
grvt-cli funding rate BTC_USDT_Perp -o json
grvt-cli funding rate ETH_USDT_Perp -o json
grvt-cli funding rate SOL_USDT_Perp -o json
```

### Liquidity Assessment

Before placing a large order, check orderbook depth:

```bash
grvt-cli market orderbook BTC_USDT_Perp --depth 20 -o json
# Sum bid sizes for total buy-side liquidity
# Sum ask sizes for total sell-side liquidity
# If your order size > 10% of visible depth, expect significant slippage
```

## Timestamp Format

GRVT uses **nanosecond timestamps** (19-digit numbers like `1773420334500000000`). To convert:
- Divide by 1,000,000,000 to get Unix seconds
- The CLI's table output automatically converts to ISO dates
- In JSON output, timestamps remain as nanosecond strings for precision
