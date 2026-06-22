import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IApiGetFilteredInstrumentsRequest, IApiOrderbookLevelsRequest } from '@grvt/client/interfaces';
import { IApiCandlestickRequest } from '@grvt/client/interfaces/codegen/data.interface';
import { createPublicClient, mcpText, withErrorHandling } from '../helpers';
import {
  CANDLE_MAX_LIMIT,
  CANDLE_INTERVAL_NAMES,
  CANDLE_TYPE_NAMES,
  DEFAULT_CANDLE_INTERVAL,
  DEFAULT_CANDLE_TYPE,
  resolveInterval,
  resolveType,
  toNanos,
  clampLimit,
  fetchAllCandles,
} from '../../utils/candles';

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
      instrument: z.string().regex(/^[A-Za-z0-9_]+$/, 'Invalid instrument name format').describe('Instrument name (e.g., BTC_USDT_Perp, ETH_USDT_Perp)'),
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
      instrument: z.string().regex(/^[A-Za-z0-9_]+$/, 'Invalid instrument name format').describe('Instrument name (e.g., BTC_USDT_Perp)'),
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

  server.tool(
    'get_candlesticks',
    `Get historical candlestick / OHLCV data for an instrument. Returns open/high/low/close prices and volume per interval. ` +
      `The API returns up to ${CANDLE_MAX_LIMIT} bars per request (the 'limit' field is clamped to this maximum). ` +
      `To fetch more than ${CANDLE_MAX_LIMIT} bars, set 'count' — the tool auto-paginates via the response cursor (deduped, sorted ascending by time). ` +
      `Timestamps in the response (open_time, close_time) are nanosecond strings.`,
    {
      instrument: z.string().regex(/^[A-Za-z0-9_]+$/, 'Invalid instrument name format').describe('Instrument name (e.g., BTC_USDT_Perp)'),
      interval: z.enum(CANDLE_INTERVAL_NAMES as [string, ...string[]]).default(DEFAULT_CANDLE_INTERVAL).describe('Candle interval'),
      type: z.enum(CANDLE_TYPE_NAMES as [string, ...string[]]).default(DEFAULT_CANDLE_TYPE).describe('Price type: TRADE (last trade), MARK, INDEX, or MID'),
      start: z.string().optional().describe('Start time, ISO-8601 (e.g. 2024-01-01T00:00:00Z) or epoch milliseconds'),
      end: z.string().optional().describe('End time, ISO-8601 or epoch milliseconds'),
      limit: z.number().int().min(1).max(CANDLE_MAX_LIMIT).default(CANDLE_MAX_LIMIT).describe(`Bars per single request (max ${CANDLE_MAX_LIMIT})`),
      count: z.number().int().min(1).optional().describe(`Total bars to fetch; auto-paginates via cursor when greater than ${CANDLE_MAX_LIMIT} (no cap)`),
      cursor: z.string().optional().describe('Pagination cursor from a previous response (advanced; usually omit and use count)'),
    },
    async (params) => withErrorHandling(async () => {
      const client = createPublicClient();

      const baseRequest: IApiCandlestickRequest = {
        instrument: params.instrument,
        interval: resolveInterval(params.interval),
        type: resolveType(params.type),
        limit: clampLimit(params.limit),
      };
      const startTime = toNanos(params.start);
      const endTime = toNanos(params.end);
      if (startTime) baseRequest.start_time = startTime;
      if (endTime) baseRequest.end_time = endTime;
      if (params.cursor) baseRequest.cursor = params.cursor;

      if (params.count !== undefined) {
        const candles = await fetchAllCandles(
          (req) => client.getCandlestick(req),
          baseRequest,
          params.count
        );
        return mcpText(JSON.stringify(candles, null, 2));
      }

      const response = await client.getCandlestick(baseRequest);
      return mcpText(JSON.stringify({ result: response.result || [], next: response.next }, null, 2));
    }),
  );
}
