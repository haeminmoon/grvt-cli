import { Command } from 'commander';
import { IApiFundingRateRequest, IApiFundingPaymentHistoryRequest } from '@grvt/client/interfaces';
import { getEffectiveConfig } from '../config/store';
import { CliApiClient } from '../client/api-client';
import { output, getOutputFormat } from '../output/formatter';
import { handleError } from '../output/error';
import { formatNumber, nanosToDate, parseIntStrict } from '../utils/helpers';
import { withAuth } from './_helpers';

export function registerFundingCommands(program: Command): void {
  const fundingCmd = program
    .command('funding')
    .description('Funding rate information');

  fundingCmd
    .command('rate')
    .description('Get current funding rate for an instrument')
    .argument('<instrument>', 'Instrument name (e.g., BTC_USDT_Perp)')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (instrument, options) => {
      try {
        const config = getEffectiveConfig();
        const client = new CliApiClient(config);

        const request: IApiFundingRateRequest = { instrument };
        const response = await client.getFundingRate(request);
        const format = getOutputFormat(options);

        // API returns an array of funding rate entries; take the most recent one
        const results = response.result;
        if (!results || (Array.isArray(results) && results.length === 0)) {
          process.stdout.write('No funding rate data\n');
          return;
        }

        const latest = Array.isArray(results) ? results[0] : results;

        if (format === 'json') {
          output(latest, format);
          return;
        }

        output({
          instrument: latest.instrument || instrument,
          fundingRate: latest.funding_rate || '-',
          fundingRate8hAvg: latest.funding_rate_8_h_avg || '-',
          fundingTime: nanosToDate(latest.funding_time),
          markPrice: formatNumber(latest.mark_price),
          intervalHours: latest.funding_interval_hours || '-',
        }, format);
      } catch (err) {
        handleError(err);
      }
    });

  fundingCmd
    .command('history')
    .description('Get funding payment history')
    .option('--instrument <name>', 'Filter by instrument')
    .option('--sub-account-id <id>', 'Sub-account ID (overrides default)')
    .option('--limit <n>', 'Number of results', '20')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (options) => {
      try {
        const { client, subAccountId } = withAuth(options);

        const request: IApiFundingPaymentHistoryRequest = {
          sub_account_id: subAccountId,
          limit: parseIntStrict(options.limit, 'limit'),
        };
        const response = await client.getFundingPaymentHistory(request);

        const format = getOutputFormat(options);
        if (format === 'json') {
          output(response.result, format);
          return;
        }

        const payments = response.result || [];
        if (payments.length === 0) {
          process.stdout.write('No funding payment history\n');
          return;
        }

        const rows = payments.map((p) => ({
          instrument: p.instrument || '',
          amount: formatNumber(p.amount, 6),
          currency: p.currency || '',
          time: nanosToDate(p.event_time),
        }));
        output(rows, format);
      } catch (err) {
        handleError(err);
      }
    });
}
