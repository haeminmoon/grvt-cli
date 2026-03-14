import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IApiGetFilteredInstrumentsRequest, IApiOrderbookLevelsRequest } from '@grvt/client/interfaces';
import { createPublicClient, mcpText, withErrorHandling } from '../helpers';

export function registerMarketTools(server: McpServer): void {

  server.tool(
    'get_instruments',
    'List available trading instruments on GRVT. Returns instrument names, tick sizes, minimum order sizes, and other specs. Use this before placing orders to verify instrument existence and constraints.',
    {
      kind: z.enum(['PERPETUAL', 'FUTURE', 'CALL', 'PUT']).optional().describe('Filter by instrument kind'),
      base: z.string().optional().describe('Filter by base currency (e.g., BTC, ETH, SOL)'),
      quote: z.string().optional().describe('Filter by quote currency (e.g., USDT)'),
    },
    async (params) => withErrorHandling(async () => {
      const client = createPublicClient();
      const hasFilter = params.kind || params.base || params.quote;

      let instruments;
      if (hasFilter) {
        const request: IApiGetFilteredInstrumentsRequest = {};
        if (params.kind) request.kind = [params.kind as any];
        if (params.base) request.base = [params.base.toUpperCase()];
        if (params.quote) request.quote = [params.quote.toUpperCase()];
        const response = await client.getInstruments(request);
        instruments = response.result || [];
      } else {
        const response = await client.getAllInstruments({});
        instruments = response.result || [];
      }

      return mcpText(JSON.stringify(instruments, null, 2));
    }),
  );

  server.tool(
    'get_ticker',
    'Get real-time ticker data for a specific instrument including last price, mark price, index price, best bid/ask, 24h volume, funding rate, and open interest.',
    {
      instrument: z.string().describe('Instrument name (e.g., BTC_USDT_Perp, ETH_USDT_Perp)'),
    },
    async (params) => withErrorHandling(async () => {
      const client = createPublicClient();
      const response = await client.getTicker({ instrument: params.instrument });
      return mcpText(JSON.stringify(response.result, null, 2));
    }),
  );

  server.tool(
    'get_orderbook',
    'Get the order book (bids and asks) for an instrument. Shows price levels, sizes, and number of orders at each level. Use to assess liquidity before placing large orders.',
    {
      instrument: z.string().describe('Instrument name (e.g., BTC_USDT_Perp)'),
      depth: z.number().min(1).max(20).default(10).describe('Number of price levels to return (1-20)'),
    },
    async (params) => withErrorHandling(async () => {
      const client = createPublicClient();
      const request: IApiOrderbookLevelsRequest = {
        instrument: params.instrument,
        depth: params.depth,
      };
      const response = await client.getOrderbook(request);
      return mcpText(JSON.stringify(response.result, null, 2));
    }),
  );
}
