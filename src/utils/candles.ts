import { ECandlestickInterval } from '@grvt/client/interfaces/codegen/enums/candlestick-interval';
import { ECandlestickType } from '@grvt/client/interfaces/codegen/enums/candlestick-type';
import { IApiCandlestickRequest, ICandlestick } from '@grvt/client/interfaces/codegen/data.interface';

/**
 * Maximum number of candlesticks the GRVT kline endpoint returns in a single
 * request. Values above this are silently capped server-side, so we clamp the
 * per-request `limit` locally and auto-paginate (via cursor) for larger counts.
 */
export const CANDLE_MAX_LIMIT = 1000;

/**
 * User-friendly interval names mapped to the GRVT ECandlestickInterval enum.
 * Exposes every interval the API supports.
 */
export const CANDLE_INTERVALS: Record<string, ECandlestickInterval> = {
  '1m': ECandlestickInterval.CI_1_M,
  '3m': ECandlestickInterval.CI_3_M,
  '5m': ECandlestickInterval.CI_5_M,
  '15m': ECandlestickInterval.CI_15_M,
  '30m': ECandlestickInterval.CI_30_M,
  '1h': ECandlestickInterval.CI_1_H,
  '2h': ECandlestickInterval.CI_2_H,
  '4h': ECandlestickInterval.CI_4_H,
  '6h': ECandlestickInterval.CI_6_H,
  '8h': ECandlestickInterval.CI_8_H,
  '12h': ECandlestickInterval.CI_12_H,
  '1d': ECandlestickInterval.CI_1_D,
  '3d': ECandlestickInterval.CI_3_D,
  '5d': ECandlestickInterval.CI_5_D,
  '1w': ECandlestickInterval.CI_1_W,
  '2w': ECandlestickInterval.CI_2_W,
  '3w': ECandlestickInterval.CI_3_W,
  '4w': ECandlestickInterval.CI_4_W,
};

/** Ordered list of valid interval names for help text / validation messages. */
export const CANDLE_INTERVAL_NAMES = Object.keys(CANDLE_INTERVALS);

export const DEFAULT_CANDLE_INTERVAL = '1h';

/** Candlestick price types the API supports. */
export const CANDLE_TYPES: Record<string, ECandlestickType> = {
  TRADE: ECandlestickType.TRADE,
  MARK: ECandlestickType.MARK,
  INDEX: ECandlestickType.INDEX,
  MID: ECandlestickType.MID,
};

export const CANDLE_TYPE_NAMES = Object.keys(CANDLE_TYPES);

export const DEFAULT_CANDLE_TYPE = 'TRADE';

/**
 * Resolve a user-friendly interval name (e.g. "1h", "15m") to the GRVT enum.
 * Throws on an unknown name so callers can surface a clear error.
 */
export function resolveInterval(name: string): ECandlestickInterval {
  const interval = CANDLE_INTERVALS[name.toLowerCase()];
  if (!interval) {
    throw new Error(
      `Invalid interval "${name}". Valid intervals: ${CANDLE_INTERVAL_NAMES.join(', ')}`
    );
  }
  return interval;
}

/**
 * Resolve a candlestick type name (e.g. "TRADE", "MARK") to the GRVT enum.
 * Throws on an unknown name so callers can surface a clear error.
 */
export function resolveType(name: string): ECandlestickType {
  const type = CANDLE_TYPES[name.toUpperCase()];
  if (!type) {
    throw new Error(
      `Invalid type "${name}". Valid types: ${CANDLE_TYPE_NAMES.join(', ')}`
    );
  }
  return type;
}

/**
 * Convert a timestamp expressed as ISO-8601 or epoch milliseconds into the
 * nanosecond string the GRVT API expects. Returns undefined for empty input.
 */
export function toNanos(value: string | undefined): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  // Pure digits → treat as epoch milliseconds.
  if (/^\d+$/.test(value)) {
    return (BigInt(value) * 1_000_000n).toString();
  }

  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid timestamp "${value}". Use ISO-8601 (e.g. 2024-01-01T00:00:00Z) or epoch milliseconds.`);
  }
  return (BigInt(ms) * 1_000_000n).toString();
}

/**
 * Clamp a requested per-request limit to the GRVT maximum. Anything <= 0 is
 * coerced to 1; anything above the cap is clamped to the cap.
 */
export function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit < 1) return 1;
  return Math.min(Math.floor(limit), CANDLE_MAX_LIMIT);
}

/** A function that performs a single kline request. */
export type CandlestickFetcher = (
  request: IApiCandlestickRequest
) => Promise<{ result?: ICandlestick[]; next?: string }>;

/**
 * Fetch up to `count` candlesticks, auto-paginating when `count` exceeds the
 * per-request cap. Each page requests up to CANDLE_MAX_LIMIT bars.
 *
 * Pagination walks backward in time: after each page we set the next page's
 * `end_time` to (oldest open_time on this page − 1ns), so the next page
 * returns the block of bars immediately older than the current one. We prefer
 * the server `next` cursor when it advances the window, but fall back to the
 * end_time walk — the GRVT kline cursor only steps back a single bar without
 * an explicit window, so the end_time walk is what actually returns full pages.
 *
 * The loop stops when the target is reached, a page returns no rows, or a page
 * adds no new bars (history exhausted). Results are deduped by open_time and
 * sorted ascending; the returned array never exceeds `count`.
 */
export async function fetchAllCandles(
  fetcher: CandlestickFetcher,
  baseRequest: IApiCandlestickRequest,
  count: number
): Promise<ICandlestick[]> {
  const target = Math.max(1, Math.floor(count));
  const byTime = new Map<string, ICandlestick>();

  // The lower bound (oldest bar) the caller is willing to go back to, if any.
  const floorTime = baseRequest.start_time ? BigInt(baseRequest.start_time) : undefined;
  // Rolling upper bound for the window; starts at the caller's end_time if set.
  let endTime: bigint | undefined = baseRequest.end_time ? BigInt(baseRequest.end_time) : undefined;

  // Guard against runaway loops: pages needed for `target` plus a safety margin.
  const maxPages = Math.ceil(target / CANDLE_MAX_LIMIT) + 5;
  let pages = 0;

  while (byTime.size < target && pages < maxPages) {
    const remaining = target - byTime.size;
    const request: IApiCandlestickRequest = {
      ...baseRequest,
      limit: clampLimit(Math.min(remaining, CANDLE_MAX_LIMIT)),
    };
    // The cursor is set per-page below; never carry the caller's stale cursor.
    delete request.cursor;
    if (endTime !== undefined) {
      request.end_time = endTime.toString();
    }

    const response = await fetcher(request);
    const candles = response.result || [];
    pages += 1;

    let added = 0;
    let oldest: bigint | undefined;
    for (const candle of candles) {
      const ot = candle.open_time;
      const key = ot ?? `idx-${byTime.size}`;
      if (!byTime.has(key)) {
        byTime.set(key, candle);
        added += 1;
      }
      if (ot !== undefined) {
        const t = BigInt(ot);
        if (oldest === undefined || t < oldest) oldest = t;
      }
    }

    // Stop when the server returns nothing, no new bars, or a short page —
    // a page smaller than the requested limit means history is exhausted.
    if (
      candles.length === 0 ||
      added === 0 ||
      oldest === undefined ||
      candles.length < (request.limit ?? CANDLE_MAX_LIMIT)
    ) {
      break;
    }

    // Walk the window backward: next page ends just before this page's oldest bar.
    const nextEnd = oldest - 1n;
    if (floorTime !== undefined && nextEnd < floorTime) break;
    endTime = nextEnd;
  }

  const sorted = Array.from(byTime.values()).sort((a, b) => {
    const at = BigInt(a.open_time ?? '0');
    const bt = BigInt(b.open_time ?? '0');
    return at < bt ? -1 : at > bt ? 1 : 0;
  });

  return sorted.slice(0, target);
}
