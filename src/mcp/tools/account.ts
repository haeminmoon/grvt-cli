import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createAuthClient, mcpText, mcpError, withErrorHandling } from '../helpers';

export function registerAccountTools(server: McpServer): void {

  server.tool(
    'get_account_summary',
    'Get the funding account summary including total equity and spot balances.',
    {},
    async () => withErrorHandling(async () => {
      const auth = createAuthClient();
      if ('error' in auth) return auth.error;
      const { client } = auth;

      const response = await client.getFundingAccountSummary();
      return mcpText(JSON.stringify(response.result, null, 2));
    }),
  );

  server.tool(
    'get_sub_account_summary',
    'Get sub-account summary including margin type, total equity, initial margin, available balance, and unrealized PnL. Essential for checking available margin before trading.',
    {
      sub_account_id: z.string().optional().describe('Sub-account ID (uses configured default if not provided)'),
    },
    async (params) => withErrorHandling(async () => {
      const auth = createAuthClient();
      if ('error' in auth) return auth.error;
      const { client, config } = auth;

      const subAccountId = params.sub_account_id || config.subAccountId;
      if (!subAccountId) {
        return mcpError('Sub-account ID is not configured.');
      }

      const response = await client.getSubAccountSummary({ sub_account_id: subAccountId });
      return mcpText(JSON.stringify(response.result, null, 2));
    }),
  );
}
