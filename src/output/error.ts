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

    // Show Axios response data if available
    const axiosErr = err as any;
    if (axiosErr.response?.data) {
      const raw = axiosErr.response.data;
      let detail: string;
      if (typeof raw === 'string') {
        try {
          detail = JSON.stringify(JSON.parse(raw), null, 2);
        } catch {
          detail = raw;
        }
      } else {
        detail = JSON.stringify(raw, null, 2);
      }
      process.stderr.write(`DETAIL:\n${detail}\n`);
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
