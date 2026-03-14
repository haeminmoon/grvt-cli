export type OutputFormat = 'json' | 'table';

export function output(data: unknown, format: OutputFormat = 'table'): void {
  if (format === 'json') {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    return;
  }
  printTable(data);
}

function printTable(data: unknown): void {
  if (data === null || data === undefined) {
    process.stdout.write('No data\n');
    return;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      process.stdout.write('No results\n');
      return;
    }
    console.table(data);
    return;
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) {
      process.stdout.write('(empty)\n');
      return;
    }
    const maxKeyLen = Math.max(...entries.map(([k]) => k.length));
    for (const [key, value] of entries) {
      const displayValue =
        typeof value === 'object' && value !== null
          ? JSON.stringify(value)
          : String(value ?? '');
      process.stdout.write(`  ${key.padEnd(maxKeyLen)}  ${displayValue}\n`);
    }
    return;
  }

  process.stdout.write(String(data) + '\n');
}

export function getOutputFormat(options: { output?: string }): OutputFormat {
  if (options.output === 'json') return 'json';
  return 'table';
}
