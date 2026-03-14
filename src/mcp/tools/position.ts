import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IApiPositionsRequest } from '@grvt/client/interfaces';
import { createAuthClient, mcpText, mcpError, withErrorHandling } from '../helpers';

export function registerPositionTools(server: McpServer): void {

  server.tool(
    'list_positions',
    'List all open positions. Shows instrument, size (positive=long, negative=short), entry price, mark price, unrealized PnL, and liquidation price. Optionally filter by instrument kind.',
    {
      kind: z.enum(['PERPETUAL', 'FUTURE', 'CALL', 'PUT']).optional().describe('Filter by instrument kind'),
    },
    async (params) => withErrorHandling(async () => {
      const auth = createAuthClient();
      if ('error' in auth) return auth.error;
      const { client, config } = auth;

      if (!config.subAccountId) {
        return mcpError('Sub-account ID is not configured.');
      }

      const request: IApiPositionsRequest = { sub_account_id: config.subAccountId };
      if (params.kind) request.kind = [params.kind as any];

      const response = await client.getPositions(request);
      return mcpText(JSON.stringify(response.result, null, 2));
    }),
  );
}
