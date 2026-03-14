/**
 * Convert a nanosecond timestamp string to a human-readable date string.
 */
export function nanosToDate(nanos: string | undefined): string {
  if (!nanos || nanos === '0') return '-';
  const ms = Math.floor(Number(nanos) / 1_000_000);
  return new Date(ms).toISOString();
}

/**
 * Format a numeric string for display (trim trailing zeros).
 */
export function formatNumber(value: string | undefined, decimals = 4): string {
  if (!value) return '-';
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Format a side string from is_buying_asset boolean.
 */
export function formatSide(isBuying: boolean | undefined): string {
  return isBuying ? 'BUY' : 'SELL';
}

/**
 * Parse an integer string strictly. Throws if the value is not a valid integer.
 */
export function parseIntStrict(value: string, name: string): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid value for ${name}: "${value}" is not a valid integer`);
  }
  return parsed;
}
