export class ActionableError extends Error {
  constructor(
    message: string,
    public suggestedCommand?: string,
  ) {
    super(message);
    this.name = 'ActionableError';
  }
}

export function handleError(err: unknown): never {
  if (err instanceof ActionableError) {
    process.stderr.write(`ERROR: ${err.message}\n`);
    if (err.suggestedCommand) {
      process.stderr.write(
        `\nTo fix this, run:\n  ${err.suggestedCommand}\n`
      );
    }
  } else if (err instanceof Error) {
    process.stderr.write(`ERROR: ${err.message}\n`);

    // Show sanitized Axios response data (only code + message fields)
    const axiosErr = err as any;
    if (axiosErr.response?.data) {
      const raw = axiosErr.response.data;
      const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
      if (parsed && typeof parsed === 'object') {
        const safe: Record<string, unknown> = {};
        if (parsed.code !== undefined) safe.code = parsed.code;
        if (parsed.message !== undefined) safe.message = parsed.message;
        if (parsed.error !== undefined) safe.error = parsed.error;
        if (Object.keys(safe).length > 0) {
          process.stderr.write(`DETAIL:\n${JSON.stringify(safe, null, 2)}\n`);
        }
      } else if (typeof raw === 'string') {
        // Plain string error — truncate to prevent excessive output
        process.stderr.write(`DETAIL:\n${raw.slice(0, 500)}\n`);
      }
    }

    if (err.message.includes('api_key') || err.message.includes('401') || err.message.includes('Unauthorized')) {
      process.stderr.write(
        `\nTo fix this, run:\n  grvt-cli auth login\n`
      );
    }
  } else {
    process.stderr.write(`ERROR: ${String(err)}\n`);
  }
  process.exit(1);
}

export function requireConfig(
  value: string | undefined,
  name: string,
  setCommand: string
): asserts value is string {
  if (!value) {
    throw new ActionableError(
      `${name} is not configured.`,
      `grvt-cli config set ${setCommand}`
    );
  }
}
