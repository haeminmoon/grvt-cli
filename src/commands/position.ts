import { Command } from 'commander';
import { IApiPositionsRequest } from '@grvt/client/interfaces';
import { output, getOutputFormat } from '../output/formatter';
import { handleError } from '../output/error';
import { formatNumber } from '../utils/helpers';
import { withAuth } from './_helpers';

export function registerPositionCommands(program: Command): void {
  const positionCmd = program
    .command('position')
    .description('Position management');

  positionCmd
    .command('list')
    .description('List all positions')
    .option('--instrument <name>', 'Filter by instrument')
    .option('--kind <kind>', 'Filter by kind (PERPETUAL, FUTURE, CALL, PUT)')
    .option('--sub-account-id <id>', 'Sub-account ID (overrides default)')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (options) => {
      try {
        const { client, subAccountId } = withAuth(options);

        const request: IApiPositionsRequest = { sub_account_id: subAccountId };
        if (options.kind) request.kind = [options.kind.toUpperCase()];

        const response = await client.getPositions(request);
        const format = getOutputFormat(options);

        if (format === 'json') {
          output(response.result, format);
          return;
        }

        const positions = response.result || [];
        if (positions.length === 0) {
          process.stdout.write('No open positions\n');
          return;
        }

        const rows = positions.map((p) => ({
          instrument: p.instrument || '',
          size: p.size || '0',
          entryPrice: formatNumber(p.entry_price),
          markPrice: formatNumber(p.mark_price),
          unrealizedPnl: formatNumber(p.unrealized_pnl, 2),
          realizedPnl: formatNumber(p.realized_pnl, 2),
          leverage: formatNumber(p.leverage, 1),
          liqPrice: formatNumber(p.est_liquidation_price),
        }));
        output(rows, format);
      } catch (err) {
        handleError(err);
      }
    });
}
