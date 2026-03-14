import { getEffectiveConfig, loadSession, CliConfig, SessionData } from '../config/store';
import { CliApiClient } from '../client/api-client';

/**
 * MCP response helper — wraps text in the expected MCP content format.
 */
export function mcpText(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

/**
 * MCP error response helper.
 */
export function mcpError(message: string) {
  return { content: [{ type: 'text' as const, text: `ERROR: ${message}` }], isError: true as const };
}

/**
 * Create an unauthenticated API client (for public market data).
 */
export function createPublicClient(): CliApiClient {
  const config = getEffectiveConfig();
  return new CliApiClient(config);
}

/**
 * Create an authenticated API client. Returns error response if not authenticated.
 */
export function createAuthClient(): { client: CliApiClient; config: CliConfig; session: SessionData } | { error: ReturnType<typeof mcpError> } {
  const config = getEffectiveConfig();
  const session = loadSession();
  if (!session) {
    return { error: mcpError('Not authenticated. Run: grvt-cli auth login') };
  }
  const client = new CliApiClient(config);
  client.setSession(session);
  return { client, config, session };
}

/**
 * Wrap an async tool handler with error handling.
 */
export async function withErrorHandling(fn: () => Promise<ReturnType<typeof mcpText>>): Promise<ReturnType<typeof mcpText> | ReturnType<typeof mcpError>> {
  try {
    return await fn();
  } catch (err: unknown) {
    const axiosErr = err as any;
    if (axiosErr?.response?.data) {
      const detail = typeof axiosErr.response.data === 'string'
        ? axiosErr.response.data
        : JSON.stringify(axiosErr.response.data, null, 2);
      return mcpError(`${(err as Error).message}\n${detail}`);
    }
    return mcpError(err instanceof Error ? err.message : String(err));
  }
}
