import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IApiCancelAllOrdersRequest, IApiOpenOrdersRequest, IApiOrderHistoryRequest } from '@grvt/client/interfaces';
import { IOrder } from '@grvt/client/interfaces/codegen/data.interface';
import { signOrder, InstrumentInfo } from '../../signing/order-signer';
import { createAuthClient, mcpText, mcpError, withErrorHandling } from '../helpers';

export function registerOrderTools(server: McpServer): void {

  server.tool(
    'create_order',
    'Place a new order on GRVT. Supports limit and market orders with optional post-only and reduce-only flags. Always check instrument specs (min size, tick size) before placing orders. Use reduce-only for closing positions.',
    {
      instrument: z.string().describe('Instrument name (e.g., BTC_USDT_Perp)'),
      side: z.enum(['buy', 'sell']).describe('Order side'),
      size: z.string().describe('Order size in base currency (e.g., "0.01" for 0.01 BTC)'),
      type: z.enum(['limit', 'market']).default('limit').describe('Order type'),
      price: z.string().optional().describe('Limit price (required for limit orders)'),
      reduce_only: z.boolean().default(false).describe('If true, order can only reduce an existing position'),
      post_only: z.boolean().default(false).describe('If true, order is rejected if it would fill immediately (guarantees maker fee)'),
      time_in_force: z.enum(['GOOD_TILL_TIME', 'IMMEDIATE_OR_CANCEL', 'FILL_OR_KILL']).default('GOOD_TILL_TIME').describe('Time in force policy'),
      client_order_id: z.string().optional().describe('Custom client order ID for tracking'),
    },
    async (params) => withErrorHandling(async () => {
      const auth = createAuthClient();
      if ('error' in auth) return auth.error;
      const { client, config } = auth;

      if (!config.apiSecret) {
        return mcpError('API secret is not configured. Run: grvt-cli config set --api-secret <secret>');
      }
      if (!config.subAccountId) {
        return mcpError('Sub-account ID is not configured. Run: grvt-cli config set --sub-account-id <id>');
      }

      const isMarket = params.type === 'market';
      if (!isMarket && !params.price) {
        return mcpError('Price is required for limit orders');
      }

      const timeInForce = isMarket ? 'IMMEDIATE_OR_CANCEL' : params.time_in_force;

      // Fetch instrument info for signing
      const instResp = await client.getInstrument({ instrument: params.instrument });
      const inst = instResp.result;
      if (!inst) {
        return mcpError(`Instrument not found: ${params.instrument}`);
      }

      const instrumentInfo: InstrumentInfo = {
        instrument: inst.instrument || params.instrument,
        instrument_hash: inst.instrument_hash || '',
        base_decimals: inst.base_decimals ?? 9,
      };

      const signedOrder = await signOrder(
        {
          subAccountId: config.subAccountId,
          isMarket,
          timeInForce,
          postOnly: params.post_only,
          reduceOnly: params.reduce_only,
          legs: [{
            instrument: params.instrument,
            size: params.size,
            limitPrice: params.price || '0',
            isBuyingAsset: params.side === 'buy',
          }],
          instruments: { [params.instrument]: instrumentInfo },
        },
        config.apiSecret,
        config.env,
      );

      if (params.client_order_id) {
        signedOrder.metadata.client_order_id = params.client_order_id;
      }

      const response = await client.createOrder({ order: signedOrder as IOrder });
      return mcpText(JSON.stringify(response.result, null, 2));
    }),
  );

  server.tool(
    'cancel_order',
    'Cancel a specific open order by order ID.',
    {
      order_id: z.string().describe('Order ID to cancel (hex string starting with 0x)'),
    },
    async (params) => withErrorHandling(async () => {
      const auth = createAuthClient();
      if ('error' in auth) return auth.error;
      const { client, config } = auth;

      if (!config.subAccountId) {
        return mcpError('Sub-account ID is not configured.');
      }

      const response = await client.cancelOrder({
        sub_account_id: config.subAccountId,
        order_id: params.order_id,
      });
      return mcpText(JSON.stringify(response.result, null, 2));
    }),
  );

  server.tool(
    'cancel_all_orders',
    'Cancel all open orders. Optionally filter by instrument kind (PERPETUAL, FUTURE, CALL, PUT).',
    {
      kind: z.enum(['PERPETUAL', 'FUTURE', 'CALL', 'PUT']).optional().describe('Cancel only orders of this kind'),
    },
    async (params) => withErrorHandling(async () => {
      const auth = createAuthClient();
      if ('error' in auth) return auth.error;
      const { client, config } = auth;

      if (!config.subAccountId) {
        return mcpError('Sub-account ID is not configured.');
      }

      const request: IApiCancelAllOrdersRequest = { sub_account_id: config.subAccountId };
      if (params.kind) request.kind = [params.kind as any];

      const response = await client.cancelAllOrders(request);
      return mcpText(JSON.stringify(response.result ?? { status: 'All orders cancelled' }, null, 2));
    }),
  );

  server.tool(
    'get_order',
    'Get details of a specific order by order ID, including status, fill information, and timestamps.',
    {
      order_id: z.string().describe('Order ID (hex string starting with 0x)'),
    },
    async (params) => withErrorHandling(async () => {
      const auth = createAuthClient();
      if ('error' in auth) return auth.error;
      const { client, config } = auth;

      if (!config.subAccountId) {
        return mcpError('Sub-account ID is not configured.');
      }

      const response = await client.getOrder({
        sub_account_id: config.subAccountId,
        order_id: params.order_id,
      });
      return mcpText(JSON.stringify(response.result, null, 2));
    }),
  );

  server.tool(
    'list_open_orders',
    'List all currently open (unfilled) orders. Optionally filter by instrument kind.',
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

      const request: IApiOpenOrdersRequest = { sub_account_id: config.subAccountId };
      if (params.kind) request.kind = [params.kind as any];

      const response = await client.getOpenOrders(request);
      return mcpText(JSON.stringify(response.result, null, 2));
    }),
  );

  server.tool(
    'get_order_history',
    'Get historical orders (filled, cancelled, etc). Returns the most recent orders.',
    {
      kind: z.enum(['PERPETUAL', 'FUTURE', 'CALL', 'PUT']).optional().describe('Filter by instrument kind'),
      limit: z.number().min(1).max(100).default(20).describe('Number of orders to return'),
    },
    async (params) => withErrorHandling(async () => {
      const auth = createAuthClient();
      if ('error' in auth) return auth.error;
      const { client, config } = auth;

      if (!config.subAccountId) {
        return mcpError('Sub-account ID is not configured.');
      }

      const request: IApiOrderHistoryRequest = {
        sub_account_id: config.subAccountId,
        limit: params.limit,
      };
      if (params.kind) request.kind = [params.kind as any];

      const response = await client.getOrderHistory(request);
      return mcpText(JSON.stringify(response.result, null, 2));
    }),
  );
}
