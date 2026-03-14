import { Command } from 'commander';
import { IApiCancelAllOrdersRequest, IApiOpenOrdersRequest, IApiOrderHistoryRequest } from '@grvt/client/interfaces';
import { IOrder } from '@grvt/client/interfaces/codegen/data.interface';
import { signOrder, InstrumentInfo } from '../signing/order-signer';
import { output, getOutputFormat } from '../output/formatter';
import { handleError, requireConfig } from '../output/error';
import { formatNumber, formatSide, nanosToDate, parseIntStrict } from '../utils/helpers';
import { withAuth } from './_helpers';

export function registerOrderCommands(program: Command): void {
  const orderCmd = program
    .command('order')
    .description('Order management');

  orderCmd
    .command('create')
    .description('Create a new order')
    .requiredOption('--instrument <name>', 'Instrument (e.g., BTC_USDT_Perp)')
    .requiredOption('--side <side>', 'Order side (buy, sell)')
    .requiredOption('--size <amount>', 'Order size')
    .option('--type <type>', 'Order type (limit, market)', 'limit')
    .option('--price <price>', 'Limit price (required for limit orders)')
    .option('--reduce-only', 'Reduce-only order', false)
    .option('--post-only', 'Post-only order (maker only)', false)
    .option('--time-in-force <tif>', 'Time in force (GOOD_TILL_TIME, IMMEDIATE_OR_CANCEL, FILL_OR_KILL)', 'GOOD_TILL_TIME')
    .option('--client-order-id <id>', 'Client order ID')
    .option('--yes', 'Skip confirmation prompt', false)
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (options) => {
      try {
        const { config, client } = withAuth(options);
        requireConfig(config.apiSecret, 'API secret', '--api-secret <your-secret>');

        const isMarket = options.type === 'market';
        if (!isMarket && !options.price) {
          throw new Error('--price is required for limit orders');
        }

        const side = options.side.toLowerCase();
        if (side !== 'buy' && side !== 'sell') {
          throw new Error('--side must be "buy" or "sell"');
        }

        // For market orders, force IMMEDIATE_OR_CANCEL time-in-force
        const timeInForce = isMarket ? 'IMMEDIATE_OR_CANCEL' : options.timeInForce.toUpperCase();

        const instResp = await client.getInstrument({ instrument: options.instrument });
        const inst = instResp.result;
        if (!inst) {
          throw new Error(`Instrument not found: ${options.instrument}`);
        }
        const instrumentInfo: InstrumentInfo = {
          instrument: inst.instrument || options.instrument,
          instrument_hash: inst.instrument_hash || '',
          base_decimals: inst.base_decimals ?? 9,
        };

        const signedOrder = await signOrder(
          {
            subAccountId: config.subAccountId!,
            isMarket,
            timeInForce,
            postOnly: options.postOnly,
            reduceOnly: options.reduceOnly,
            legs: [
              {
                instrument: options.instrument,
                size: options.size,
                limitPrice: options.price || '0',
                isBuyingAsset: side === 'buy',
              },
            ],
            instruments: { [options.instrument]: instrumentInfo },
          },
          config.apiSecret!,
          config.env
        );

        // Override client_order_id if provided
        if (options.clientOrderId) {
          signedOrder.metadata.client_order_id = options.clientOrderId;
        }

        const response = await client.createOrder({
          order: signedOrder as IOrder,
        });

        const format = getOutputFormat(options);
        if (format === 'json') {
          output(response.result, format);
          return;
        }

        const result = response.result;
        if (!result) {
          process.stdout.write('Order submitted (no result returned)\n');
          return;
        }

        output({
          orderId: result.order_id === '0x00' ? '(pending)' : result.order_id || '',
          clientOrderId: result.metadata?.client_order_id || '',
          instrument: result.legs?.[0]?.instrument || options.instrument,
          side: formatSide(result.legs?.[0]?.is_buying_asset),
          size: result.legs?.[0]?.size || options.size,
          price: result.legs?.[0]?.limit_price || options.price || 'MARKET',
          type: result.is_market ? 'MARKET' : 'LIMIT',
          status: result.state?.status || 'PENDING',
          timeInForce: result.time_in_force || timeInForce,
        }, format);
      } catch (err) {
        handleError(err);
      }
    });

  orderCmd
    .command('cancel')
    .description('Cancel an order')
    .requiredOption('--order-id <id>', 'Order ID to cancel')
    .option('--sub-account-id <id>', 'Sub-account ID (overrides default)')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (options) => {
      try {
        const { client, subAccountId } = withAuth(options);

        const response = await client.cancelOrder({
          sub_account_id: subAccountId,
          order_id: options.orderId,
        });

        const format = getOutputFormat(options);
        if (format === 'json') {
          output(response.result, format);
          return;
        }

        const result = response.result;
        output({
          orderId: result?.order_id || options.orderId,
          status: result?.state?.status || 'CANCELLED',
        }, format);
      } catch (err) {
        handleError(err);
      }
    });

  orderCmd
    .command('cancel-all')
    .description('Cancel all open orders')
    .option('--instrument <name>', 'Filter by instrument')
    .option('--kind <kind>', 'Filter by kind (PERPETUAL, FUTURE, CALL, PUT)')
    .option('--sub-account-id <id>', 'Sub-account ID (overrides default)')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (options) => {
      try {
        const { client, subAccountId } = withAuth(options);

        const request: IApiCancelAllOrdersRequest = { sub_account_id: subAccountId };
        if (options.kind) request.kind = [options.kind.toUpperCase()];

        const response = await client.cancelAllOrders(request);
        const format = getOutputFormat(options);
        if (format === 'json') {
          output(response.result, format);
          return;
        }
        output({ status: 'All orders cancelled' }, format);
      } catch (err) {
        handleError(err);
      }
    });

  orderCmd
    .command('get')
    .description('Get order details')
    .requiredOption('--order-id <id>', 'Order ID')
    .option('--sub-account-id <id>', 'Sub-account ID (overrides default)')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (options) => {
      try {
        const { client, subAccountId } = withAuth(options);

        const response = await client.getOrder({
          sub_account_id: subAccountId,
          order_id: options.orderId,
        });

        const format = getOutputFormat(options);
        if (format === 'json') {
          output(response.result, format);
          return;
        }

        const order = response.result;
        if (!order) {
          process.stdout.write('Order not found\n');
          return;
        }

        output({
          orderId: order.order_id || '',
          instrument: order.legs?.[0]?.instrument || '',
          side: formatSide(order.legs?.[0]?.is_buying_asset),
          size: order.legs?.[0]?.size || '',
          price: order.legs?.[0]?.limit_price || '',
          type: order.is_market ? 'MARKET' : 'LIMIT',
          status: order.state?.status || '',
          tradedSize: order.state?.traded_size?.join(', ') || '0',
          avgFillPrice: order.state?.avg_fill_price?.join(', ') || '-',
          createdAt: nanosToDate(order.metadata?.create_time),
          updatedAt: nanosToDate(order.state?.update_time),
        }, format);
      } catch (err) {
        handleError(err);
      }
    });

  orderCmd
    .command('list')
    .description('List open orders')
    .option('--instrument <name>', 'Filter by instrument')
    .option('--kind <kind>', 'Filter by kind (PERPETUAL, FUTURE, CALL, PUT)')
    .option('--sub-account-id <id>', 'Sub-account ID (overrides default)')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (options) => {
      try {
        const { client, subAccountId } = withAuth(options);

        const request: IApiOpenOrdersRequest = { sub_account_id: subAccountId };
        if (options.kind) request.kind = [options.kind.toUpperCase()];

        const response = await client.getOpenOrders(request);
        const format = getOutputFormat(options);

        if (format === 'json') {
          output(response.result, format);
          return;
        }

        const orders = response.result || [];
        if (orders.length === 0) {
          process.stdout.write('No open orders\n');
          return;
        }

        const rows = orders.map((o) => ({
          orderId: (o.order_id || '').slice(0, 12) + '...',
          instrument: o.legs?.[0]?.instrument || '',
          side: formatSide(o.legs?.[0]?.is_buying_asset),
          size: o.legs?.[0]?.size || '',
          price: formatNumber(o.legs?.[0]?.limit_price),
          type: o.is_market ? 'MKT' : 'LMT',
          status: o.state?.status || '',
          created: nanosToDate(o.metadata?.create_time),
        }));
        output(rows, format);
      } catch (err) {
        handleError(err);
      }
    });

  orderCmd
    .command('history')
    .description('Get order history')
    .option('--instrument <name>', 'Filter by instrument')
    .option('--kind <kind>', 'Filter by kind')
    .option('--sub-account-id <id>', 'Sub-account ID (overrides default)')
    .option('--limit <n>', 'Number of results', '20')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (options) => {
      try {
        const { client, subAccountId } = withAuth(options);

        const request: IApiOrderHistoryRequest = {
          sub_account_id: subAccountId,
          limit: parseIntStrict(options.limit, 'limit'),
        };
        if (options.kind) request.kind = [options.kind.toUpperCase()];

        const response = await client.getOrderHistory(request);
        const format = getOutputFormat(options);

        if (format === 'json') {
          output(response.result, format);
          return;
        }

        const orders = response.result || [];
        if (orders.length === 0) {
          process.stdout.write('No order history\n');
          return;
        }

        const rows = orders.map((o) => ({
          orderId: (o.order_id || '').slice(0, 12) + '...',
          instrument: o.legs?.[0]?.instrument || '',
          side: formatSide(o.legs?.[0]?.is_buying_asset),
          size: o.legs?.[0]?.size || '',
          price: formatNumber(o.legs?.[0]?.limit_price),
          type: o.is_market ? 'MKT' : 'LMT',
          status: o.state?.status || '',
          avgFill: o.state?.avg_fill_price?.[0] || '-',
          created: nanosToDate(o.metadata?.create_time),
        }));
        output(rows, format);
      } catch (err) {
        handleError(err);
      }
    });
}
