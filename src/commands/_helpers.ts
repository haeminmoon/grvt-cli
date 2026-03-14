import { getEffectiveConfig, loadSession, CliConfig, SessionData } from '../config/store';
import { CliApiClient } from '../client/api-client';
import { ActionableError, requireConfig } from '../output/error';

interface AuthenticatedContext {
  config: CliConfig;
  session: SessionData;
  client: CliApiClient;
  subAccountId: string;
}

/**
 * Initialize an authenticated API client. Validates session and sub-account ID.
 * Use this in any command that requires authentication.
 *
 * By default, sub-account ID is required. Pass `requireSubAccount: false` for
 * commands (like account summary) that don't need one.
 */
export function withAuth(options?: { subAccountId?: string; requireSubAccount?: boolean }): AuthenticatedContext {
  const config = getEffectiveConfig();
  const session = loadSession();
  if (!session) {
    throw new ActionableError('Not authenticated.', 'grvt-cli auth login');
  }

  const client = new CliApiClient(config);
  client.setSession(session);

  if (options?.requireSubAccount !== false) {
    const subAccountId = options?.subAccountId || config.subAccountId;
    requireConfig(subAccountId, 'Sub-account ID', '--sub-account-id <id>');
    return { config, session, client, subAccountId: subAccountId! };
  }

  return { config, session, client, subAccountId: config.subAccountId || '' };
}
