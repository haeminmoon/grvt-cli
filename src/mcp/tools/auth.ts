import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getEffectiveConfig, loadSession, saveSession, clearSession } from '../../config/store';
import { CliApiClient } from '../../client/api-client';
import { mcpText, mcpError, withErrorHandling } from '../helpers';

export function registerAuthTools(server: McpServer): void {

  server.tool(
    'auth_login',
    'Login to GRVT and create a new session. Requires API key and secret to be configured. Sessions are valid for ~24 hours and auto-refresh.',
    {},
    async () => withErrorHandling(async () => {
      const config = getEffectiveConfig();
      if (!config.apiKey) {
        return mcpError('API key is not configured. Run: grvt-cli config set --api-key <key>');
      }

      const client = new CliApiClient(config);
      const session = await client.login();
      saveSession(session);

      return mcpText(JSON.stringify({
        status: 'Logged in',
        env: config.env,
        accountId: session.accountId || '(unknown)',
        expiresAt: new Date(session.expiresAt * 1000).toISOString(),
      }, null, 2));
    }),
  );

  server.tool(
    'auth_status',
    'Check current authentication status. Shows whether you are logged in, session expiry, and account ID.',
    {},
    async () => {
      const config = getEffectiveConfig();
      const session = loadSession();

      if (!session) {
        return mcpText(JSON.stringify({
          status: 'Not authenticated',
          env: config.env,
          apiKeyConfigured: !!config.apiKey,
        }, null, 2));
      }

      const expiresIn = session.expiresAt - Math.floor(Date.now() / 1000);
      return mcpText(JSON.stringify({
        status: 'Authenticated',
        env: config.env,
        accountId: session.accountId || '(unknown)',
        expiresIn: `${Math.floor(expiresIn / 60)} minutes`,
        expiresAt: new Date(session.expiresAt * 1000).toISOString(),
      }, null, 2));
    },
  );

  server.tool(
    'auth_logout',
    'Clear the current session. You will need to login again before making authenticated requests.',
    {},
    async () => {
      clearSession();
      return mcpText('Session cleared.');
    },
  );
}
