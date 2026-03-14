import {
  nanosToDate,
  formatNumber,
  formatSide,
} from '../../src/utils/helpers';

describe('nanosToDate', () => {
  it('converts nanosecond timestamp to ISO date string', () => {
    // 2024-01-01T00:00:00.000Z in nanoseconds
    const nanos = (1704067200000n * 1_000_000n).toString();
    const result = nanosToDate(nanos);
    expect(result).toBe('2024-01-01T00:00:00.000Z');
  });

  it('returns "-" for undefined', () => {
    expect(nanosToDate(undefined)).toBe('-');
  });

  it('returns "-" for "0"', () => {
    expect(nanosToDate('0')).toBe('-');
  });

  it('handles recent timestamps correctly', () => {
    const now = Date.now();
    const nanos = (BigInt(now) * 1_000_000n).toString();
    const result = nanosToDate(nanos);
    // Should be a valid date string
    expect(new Date(result).getTime()).toBeCloseTo(now, -2);
  });
});

describe('formatNumber', () => {
  it('formats a decimal number', () => {
    expect(formatNumber('65000.12340000')).toBe('65000.1234');
  });

  it('formats an integer', () => {
    expect(formatNumber('65000')).toBe('65000');
  });

  it('returns "-" for undefined', () => {
    expect(formatNumber(undefined)).toBe('-');
  });

  it('returns original for non-numeric string', () => {
    expect(formatNumber('abc')).toBe('abc');
  });

  it('respects decimals parameter', () => {
    expect(formatNumber('1.23456789', 2)).toBe('1.23');
  });

  it('trims trailing zeros', () => {
    expect(formatNumber('100.0000', 4)).toBe('100');
  });
});

describe('formatSide', () => {
  it('returns BUY for true', () => {
    expect(formatSide(true)).toBe('BUY');
  });

  it('returns SELL for false', () => {
    expect(formatSide(false)).toBe('SELL');
  });

  it('returns SELL for undefined', () => {
    expect(formatSide(undefined)).toBe('SELL');
  });
});
