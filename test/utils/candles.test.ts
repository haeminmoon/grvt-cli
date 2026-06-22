import { ECandlestickInterval } from '@grvt/client/interfaces/codegen/enums/candlestick-interval';
import { ECandlestickType } from '@grvt/client/interfaces/codegen/enums/candlestick-type';
import { IApiCandlestickRequest, ICandlestick } from '@grvt/client/interfaces/codegen/data.interface';
import {
  CANDLE_MAX_LIMIT,
  CANDLE_INTERVAL_NAMES,
  CANDLE_TYPE_NAMES,
  resolveInterval,
  resolveType,
  toNanos,
  clampLimit,
  fetchAllCandles,
} from '../../src/utils/candles';

describe('CANDLE_MAX_LIMIT', () => {
  it('is the documented GRVT per-request cap', () => {
    expect(CANDLE_MAX_LIMIT).toBe(1000);
  });
});

describe('CANDLE_INTERVAL_NAMES', () => {
  it('exposes all 18 API-supported intervals', () => {
    expect(CANDLE_INTERVAL_NAMES).toEqual([
      '1m', '3m', '5m', '15m', '30m',
      '1h', '2h', '4h', '6h', '8h', '12h',
      '1d', '3d', '5d',
      '1w', '2w', '3w', '4w',
    ]);
  });
});

describe('resolveInterval', () => {
  it('maps user-friendly names to the enum', () => {
    expect(resolveInterval('1h')).toBe(ECandlestickInterval.CI_1_H);
    expect(resolveInterval('15m')).toBe(ECandlestickInterval.CI_15_M);
    expect(resolveInterval('1d')).toBe(ECandlestickInterval.CI_1_D);
    expect(resolveInterval('4w')).toBe(ECandlestickInterval.CI_4_W);
  });

  it('is case-insensitive', () => {
    expect(resolveInterval('1H')).toBe(ECandlestickInterval.CI_1_H);
  });

  it('throws on an unknown interval', () => {
    expect(() => resolveInterval('7h')).toThrow(/Invalid interval/);
  });
});

describe('resolveType', () => {
  it('maps type names to the enum', () => {
    expect(resolveType('TRADE')).toBe(ECandlestickType.TRADE);
    expect(resolveType('mark')).toBe(ECandlestickType.MARK);
    expect(resolveType('Index')).toBe(ECandlestickType.INDEX);
    expect(resolveType('MID')).toBe(ECandlestickType.MID);
  });

  it('exposes all four types', () => {
    expect(CANDLE_TYPE_NAMES).toEqual(['TRADE', 'MARK', 'INDEX', 'MID']);
  });

  it('throws on an unknown type', () => {
    expect(() => resolveType('FOO')).toThrow(/Invalid type/);
  });
});

describe('toNanos', () => {
  it('returns undefined for empty input', () => {
    expect(toNanos(undefined)).toBeUndefined();
    expect(toNanos('')).toBeUndefined();
  });

  it('treats pure digits as epoch milliseconds', () => {
    expect(toNanos('1704067200000')).toBe('1704067200000000000');
  });

  it('parses ISO-8601 to nanoseconds', () => {
    // 2024-01-01T00:00:00.000Z = 1704067200000 ms
    expect(toNanos('2024-01-01T00:00:00.000Z')).toBe('1704067200000000000');
  });

  it('throws on an unparseable timestamp', () => {
    expect(() => toNanos('not-a-date')).toThrow(/Invalid timestamp/);
  });
});

describe('clampLimit', () => {
  it('clamps above the cap', () => {
    expect(clampLimit(5000)).toBe(CANDLE_MAX_LIMIT);
  });

  it('passes through values within range', () => {
    expect(clampLimit(500)).toBe(500);
    expect(clampLimit(1000)).toBe(1000);
  });

  it('coerces zero / negative to 1', () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-10)).toBe(1);
  });

  it('floors fractional values', () => {
    expect(clampLimit(10.9)).toBe(10);
  });
});

/** Build a fake candle with a given open_time (nanoseconds). */
function candle(openTime: number): ICandlestick {
  return {
    open_time: String(openTime),
    close_time: String(openTime + 1),
    open: '100',
    high: '110',
    low: '90',
    close: '105',
    volume_b: '1',
    volume_q: '105',
    trades: 1,
  };
}

/**
 * Build a fetcher backed by a fixed pool of historical candles spaced 1ns
 * apart. Mimics the GRVT kline endpoint: it returns the newest `limit` bars at
 * or below the request's `end_time` (descending order, newest first), so the
 * helper must roll `end_time` backward to page through history.
 */
function poolFetcher(pool: ICandlestick[]) {
  // pool sorted ascending by open_time
  const asc = [...pool].sort((a, b) => Number(BigInt(a.open_time!) - BigInt(b.open_time!)));
  return jest.fn(async (req: IApiCandlestickRequest) => {
    const limit = req.limit ?? CANDLE_MAX_LIMIT;
    const end = req.end_time ? BigInt(req.end_time) : undefined;
    const start = req.start_time ? BigInt(req.start_time) : undefined;
    let eligible = asc.filter((c) => {
      const t = BigInt(c.open_time!);
      if (end !== undefined && t > end) return false;
      if (start !== undefined && t < start) return false;
      return true;
    });
    // Newest first, take up to limit, return descending (as the API does).
    eligible = eligible.slice(-limit).reverse();
    return { result: eligible, next: eligible.length === limit ? 'NEXT' : '' };
  });
}

describe('fetchAllCandles', () => {
  it('returns a single page when count <= cap', async () => {
    const fetcher = poolFetcher([candle(1000), candle(2000), candle(3000)]);

    const result = await fetchAllCandles(fetcher, { instrument: 'X' }, 3);
    expect(result.map((c) => c.open_time)).toEqual(['1000', '2000', '3000']);
    expect(fetcher).toHaveBeenCalledTimes(1);
    // limit clamped to requested count (3), not the full cap
    expect(fetcher.mock.calls[0][0].limit).toBe(3);
  });

  it('auto-paginates backward via end_time until count is reached', async () => {
    // 2000 distinct bars available.
    const pool = Array.from({ length: 2000 }, (_v, i) => candle(1000 + i));
    const fetcher = poolFetcher(pool);

    const result = await fetchAllCandles(fetcher, { instrument: 'X' }, 2000);
    expect(result).toHaveLength(2000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    // First page requests the full cap with no end_time bound.
    expect(fetcher.mock.calls[0][0].limit).toBe(CANDLE_MAX_LIMIT);
    expect(fetcher.mock.calls[0][0].end_time).toBeUndefined();
    // Second page rolls end_time back to just before the first page's oldest bar.
    // First page returned the newest 1000 (open_time 2000..2999); oldest = 2000.
    expect(fetcher.mock.calls[1][0].end_time).toBe(String(2000 - 1));
    // Fully sorted ascending.
    expect(result[0].open_time).toBe('1000');
    expect(result[result.length - 1].open_time).toBe('2999');
  });

  it('stops when history is exhausted (fewer bars than requested)', async () => {
    const fetcher = poolFetcher(Array.from({ length: 500 }, (_v, i) => candle(1000 + i)));

    const result = await fetchAllCandles(fetcher, { instrument: 'X' }, 2000);
    // Only 500 available even though 2000 requested.
    expect(result).toHaveLength(500);
    // One page is enough (returned < limit -> exhausted).
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('dedupes by open_time and sorts ascending across pages', async () => {
    // A pool fetcher whose window is INCLUSIVE of end_time, so the boundary bar
    // reappears on the next page (a realistic overlap). 2500 bars available.
    const asc = Array.from({ length: 2500 }, (_v, i) => candle(1000 + i));
    const fetcher = jest.fn(async (req: IApiCandlestickRequest) => {
      const limit = req.limit ?? CANDLE_MAX_LIMIT;
      const end = req.end_time ? BigInt(req.end_time) + 1n : undefined; // inclusive overlap
      let eligible = asc.filter((c) => end === undefined || BigInt(c.open_time!) <= end);
      eligible = eligible.slice(-limit).reverse(); // newest first
      return { result: eligible, next: eligible.length === limit ? 'NEXT' : '' };
    });

    const result = await fetchAllCandles(fetcher, { instrument: 'X' }, 2000);
    const times = result.map((c) => Number(c.open_time));
    // Multiple overlapping pages were fetched.
    expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(2);
    // No duplicates despite overlapping pages, and never exceeds the count.
    expect(new Set(times).size).toBe(times.length);
    expect(times.length).toBeLessThanOrEqual(2000);
    expect(times.length).toBeGreaterThan(CANDLE_MAX_LIMIT);
    // Strictly ascending.
    expect(times.every((t, i) => i === 0 || t > times[i - 1])).toBe(true);
  });

  it('never exceeds the requested count even when a page overflows', async () => {
    // 2000 bars available but only 1500 requested.
    const pool = Array.from({ length: 2000 }, (_v, i) => candle(1000 + i));
    const result = await fetchAllCandles(poolFetcher(pool), { instrument: 'X' }, 1500);
    expect(result).toHaveLength(1500);
    // Ascending, capped at the requested count (the newest 1500 bars: 1500..2999).
    expect(result[0].open_time).toBe('1500');
    expect(result[result.length - 1].open_time).toBe('2999');
  });

  it('respects a start_time floor and stops walking past it', async () => {
    const pool = Array.from({ length: 2000 }, (_v, i) => candle(1000 + i));
    // Floor at 1800: only bars >= 1800 are eligible (1800..2999 = 1200 bars).
    const result = await fetchAllCandles(
      poolFetcher(pool),
      { instrument: 'X', start_time: '1800' },
      2000
    );
    expect(result).toHaveLength(1200);
    expect(result[0].open_time).toBe('1800');
    expect(result[result.length - 1].open_time).toBe('2999');
  });
});
