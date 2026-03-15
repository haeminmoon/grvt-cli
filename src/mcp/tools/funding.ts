import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IApiFundingPaymentHistoryRequest } from '@grvt/client/interfaces';
import { createPublicClient, createAuthClient, mcpText, mcpError, withErrorHandling } from '../helpers';

export function registerFundingTools(server: McpServer): void {

  server.tool(
    'get_funding_rate',
    'Get the current funding rate for a perpetual instrument. Shows funding rate, 8h average rate, mark price at funding time, and next settlement time. Positive rate means longs pay shorts; negative means shorts pay longs.',
    {
      instrument: z.string().regex(/^[A-Za-z0-9_]+$/, 'Invalid instrument name format').describe('Instrument name (e.g., BTC_USDT_Perp)'),
    },
    async (params) => withErrorHandling(async () => {
      const client = createPublicClient();
      const response = await client.getFundingRate({ instrument: params.instrument });

      const results = response.result;
      if (!results || (Array.isArray(results) && results.length === 0)) {
        return mcpText('No funding rate data available');
      }

      const latest = Array.isArray(results) ? results[0] : results;
      return mcpText(JSON.stringify(latest, null, 2));
    }),
  );

  server.tool(
    'get_funding_payment_history',
    'Get your funding payment history. Shows amounts received (positive) or paid (negative) per settlement period. Requires authentication.',
    {
      instrument: z.string().regex(/^[A-Za-z0-9_]+$/, 'Invalid instrument name format').optional().describe('Filter by instrument name'),
      limit: z.number().min(1).max(100).default(20).describe('Number of results to return'),
    },
    async (params) => withErrorHandling(async () => {
      const auth = createAuthClient();
      if ('error' in auth) return auth.error;
      const { client, config } = auth;

      if (!config.subAccountId) {
        return mcpError('Sub-account ID is not configured.');
      }

      const request: IApiFundingPaymentHistoryRequest = {
        sub_account_id: config.subAccountId,
        limit: params.limit,
      };

      const response = await client.getFundingPaymentHistory(request);
      return mcpText(JSON.stringify(response.result, null, 2));
    }),
  );
}
