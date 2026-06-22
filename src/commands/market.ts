import { Command } from 'commander';
import { EKind } from '@grvt/client/interfaces/codegen/enums/kind';
import { IApiGetFilteredInstrumentsRequest, IApiOrderbookLevelsRequest } from '@grvt/client/interfaces';
import { IApiCandlestickRequest } from '@grvt/client/interfaces/codegen/data.interface';
import { getEffectiveConfig } from '../config/store';
import { CliApiClient } from '../client/api-client';
import { output, getOutputFormat } from '../output/formatter';
import { handleError } from '../output/error';
import { formatNumber, nanosToDate, parseIntStrict } from '../utils/helpers';
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
} from '../utils/candles';

export function registerMarketCommands(program: Command): void {
  const marketCmd = program
    .command('market')
    .description('Market data queries');

  marketCmd
    .command('instruments')
    .description('List available instruments')
    .option('--kind <kind>', 'Filter by kind (PERPETUAL, FUTURE, CALL, PUT)')
    .option('--base <currency>', 'Filter by base currency (e.g., BTC, ETH)')
    .option('--quote <currency>', 'Filter by quote currency (e.g., USDT)')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (options) => {
      try {
        const config = getEffectiveConfig();
        const client = new CliApiClient(config);

        const request: IApiGetFilteredInstrumentsRequest = {};
        if (options.kind) {
          request.kind = [options.kind.toUpperCase() as EKind];
        }
        if (options.base) {
          request.base = [options.base.toUpperCase()];
        }
        if (options.quote) {
          request.quote = [options.quote.toUpperCase()];
        }

        const response = options.kind || options.base || options.quote
          ? await client.getInstruments(request)
          : await client.getAllInstruments({});

        const format = getOutputFormat(options);
        const instruments = response.result || [];

        if (format === 'json') {
          output(instruments, format);
          return;
        }

        const rows = instruments.map((inst) => ({
          instrument: inst.instrument || '',
          kind: inst.kind || '',
          base: inst.base || '',
          quote: inst.quote || '',
          tickSize: inst.tick_size || '',
          minSize: inst.min_size || '',
        }));
        output(rows, format);
      } catch (err) {
        handleError(err);
      }
    });

  marketCmd
    .command('ticker')
    .description('Get ticker data for an instrument')
    .argument('<instrument>', 'Instrument name (e.g., BTC_USDT_Perp)')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (instrument, options) => {
      try {
        const config = getEffectiveConfig();
        const client = new CliApiClient(config);
        const response = await client.getTicker({ instrument });
        const format = getOutputFormat(options);

        if (format === 'json') {
          output(response.result, format);
          return;
        }

        const ticker = response.result;
        if (!ticker) {
          process.stdout.write('No ticker data\n');
          return;
        }

        output({
          instrument: ticker.instrument || instrument,
          lastPrice: formatNumber(ticker.last_price),
          markPrice: formatNumber(ticker.mark_price),
          indexPrice: formatNumber(ticker.index_price),
          bid: `${formatNumber(ticker.best_bid_price)} (${formatNumber(ticker.best_bid_size, 3)})`,
          ask: `${formatNumber(ticker.best_ask_price)} (${formatNumber(ticker.best_ask_size, 3)})`,
          volume24hBase: `${formatNumber(ticker.buy_volume_24h_b)} buy / ${formatNumber(ticker.sell_volume_24h_b)} sell`,
          volume24hQuote: `${formatNumber(ticker.buy_volume_24h_q, 0)} buy / ${formatNumber(ticker.sell_volume_24h_q, 0)} sell`,
          high24h: formatNumber(ticker.high_price),
          low24h: formatNumber(ticker.low_price),
          openPrice: formatNumber(ticker.open_price),
          openInterest: formatNumber(ticker.open_interest),
          fundingRate: ticker.funding_rate || '-',
        }, format);
      } catch (err) {
        handleError(err);
      }
    });

  marketCmd
    .command('orderbook')
    .description('Get orderbook for an instrument')
    .argument('<instrument>', 'Instrument name (e.g., BTC_USDT_Perp)')
    .option('--depth <number>', 'Number of levels (10 or 20)', '10')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (instrument, options) => {
      try {
        const config = getEffectiveConfig();
        const client = new CliApiClient(config);
        const request: IApiOrderbookLevelsRequest = {
          instrument,
          depth: parseIntStrict(options.depth, 'depth'),
        };
        const response = await client.getOrderbook(request);
        const format = getOutputFormat(options);

        if (format === 'json') {
          output(response.result, format);
          return;
        }

        const book = response.result;
        if (!book) {
          process.stdout.write('No orderbook data\n');
          return;
        }

        process.stdout.write(`\n  Orderbook: ${instrument}\n\n`);
        process.stdout.write('  ASKS (sell orders):\n');
        const asks = (book.asks || []).reverse();
        for (const level of asks) {
          process.stdout.write(
            `    ${formatNumber(level.price, 2).padStart(12)}  ${formatNumber(level.size, 4).padStart(12)}  (${level.num_orders || 0} orders)\n`
          );
        }
        process.stdout.write('  ---\n');
        process.stdout.write('  BIDS (buy orders):\n');
        const bids = book.bids || [];
        for (const level of bids) {
          process.stdout.write(
            `    ${formatNumber(level.price, 2).padStart(12)}  ${formatNumber(level.size, 4).padStart(12)}  (${level.num_orders || 0} orders)\n`
          );
        }
        process.stdout.write('\n');
      } catch (err) {
        handleError(err);
      }
    });

  marketCmd
    .command('candles')
    .description(
      `Get candlestick / OHLCV data for an instrument.\n` +
        `Up to ${CANDLE_MAX_LIMIT} bars per request (--limit); use --count to fetch more via auto-pagination (cursor).`
    )
    .argument('<instrument>', 'Instrument name (e.g., BTC_USDT_Perp)')
    .option(
      '-i, --interval <interval>',
      `Candle interval (${CANDLE_INTERVAL_NAMES.join(', ')})`,
      DEFAULT_CANDLE_INTERVAL
    )
    .option(
      '--type <type>',
      `Price type (${CANDLE_TYPE_NAMES.join(', ')})`,
      DEFAULT_CANDLE_TYPE
    )
    .option('--start <time>', 'Start time (ISO-8601 or epoch ms)')
    .option('--end <time>', 'End time (ISO-8601 or epoch ms)')
    .option(
      '--limit <n>',
      `Bars in a single request (max ${CANDLE_MAX_LIMIT}, clamped)`,
      String(CANDLE_MAX_LIMIT)
    )
    .option(
      '--count <n>',
      `Total bars to fetch; auto-paginates via cursor when > ${CANDLE_MAX_LIMIT} (no cap)`
    )
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (instrument, options) => {
      try {
        const config = getEffectiveConfig();
        const client = new CliApiClient(config);

        const interval = resolveInterval(options.interval);
        const type = resolveType(options.type);
        const startTime = toNanos(options.start);
        const endTime = toNanos(options.end);

        const baseRequest: IApiCandlestickRequest = {
          instrument,
          interval,
          type,
          limit: clampLimit(parseIntStrict(options.limit, 'limit')),
        };
        if (startTime) baseRequest.start_time = startTime;
        if (endTime) baseRequest.end_time = endTime;

        let candles;
        if (options.count !== undefined) {
          const count = parseIntStrict(options.count, 'count');
          if (count < 1) {
            throw new Error('--count must be a positive integer');
          }
          candles = await fetchAllCandles(
            (req) => client.getCandlestick(req),
            baseRequest,
            count
          );
        } else {
          const response = await client.getCandlestick(baseRequest);
          candles = response.result || [];
        }

        const format = getOutputFormat(options);
        if (format === 'json') {
          output(candles, format);
          return;
        }

        if (candles.length === 0) {
          process.stdout.write('No candlestick data\n');
          return;
        }

        const rows = candles.map((c) => ({
          time: nanosToDate(c.open_time),
          open: formatNumber(c.open, 2),
          high: formatNumber(c.high, 2),
          low: formatNumber(c.low, 2),
          close: formatNumber(c.close, 2),
          volume: formatNumber(c.volume_b, 4),
        }));
        output(rows, format);
      } catch (err) {
        handleError(err);
      }
    });
}
