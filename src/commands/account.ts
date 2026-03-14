import { Command } from 'commander';
import { output, getOutputFormat } from '../output/formatter';
import { handleError } from '../output/error';
import { formatNumber } from '../utils/helpers';
import { withAuth } from './_helpers';

export function registerAccountCommands(program: Command): void {
  const accountCmd = program
    .command('account')
    .description('Account information');

  accountCmd
    .command('summary')
    .description('Get funding account summary')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (options) => {
      try {
        const { client } = withAuth({ requireSubAccount: false });

        const response = await client.getFundingAccountSummary();
        const format = getOutputFormat(options);

        if (format === 'json') {
          output(response.result, format);
          return;
        }

        const summary = response.result;
        if (!summary) {
          process.stdout.write('No account summary data\n');
          return;
        }

        output({
          mainAccountId: summary.main_account_id || '',
          totalEquity: formatNumber(summary.total_equity, 2),
        }, format);

        // Display spot balances if available
        if (summary.spot_balances && summary.spot_balances.length > 0) {
          process.stdout.write('\n  Spot Balances:\n');
          for (const balance of summary.spot_balances) {
            process.stdout.write(
              `    ${(balance.currency || '').padEnd(8)} ${formatNumber(balance.balance, 4)}\n`
            );
          }
        }
      } catch (err) {
        handleError(err);
      }
    });

  accountCmd
    .command('sub-account')
    .description('Get sub-account summary')
    .option('--id <subAccountId>', 'Sub-account ID (overrides default)')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (options) => {
      try {
        const { client, subAccountId } = withAuth({ subAccountId: options.id });

        const response = await client.getSubAccountSummary({
          sub_account_id: subAccountId,
        });

        const format = getOutputFormat(options);
        if (format === 'json') {
          output(response.result, format);
          return;
        }

        const summary = response.result;
        if (!summary) {
          process.stdout.write('No sub-account data\n');
          return;
        }

        output({
          subAccountId: summary.sub_account_id || subAccountId,
          marginType: summary.margin_type || '',
          totalEquity: formatNumber(summary.total_equity, 2),
          initialMargin: formatNumber(summary.initial_margin, 2),
          availableBalance: formatNumber(summary.available_balance, 2),
          unrealizedPnl: formatNumber(summary.unrealized_pnl, 2),
        }, format);
      } catch (err) {
        handleError(err);
      }
    });
}
