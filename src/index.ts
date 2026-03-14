// Suppress noisy SDK console.info logs (e.g. "Cookie should be refreshed")
const _origInfo = console.info;
console.info = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.startsWith('Cookie') || msg.startsWith('cookie')) return;
  _origInfo(...args);
};

import { Command } from 'commander';
import { registerConfigCommands } from './commands/config';
import { registerAuthCommands } from './commands/auth';
import { registerMarketCommands } from './commands/market';
import { registerOrderCommands } from './commands/order';
import { registerPositionCommands } from './commands/position';
import { registerAccountCommands } from './commands/account';
import { registerFundingCommands } from './commands/funding';
import { handleError } from './output/error';

const program = new Command();

program
  .name('grvt-cli')
  .description('CLI toolkit for GRVT derivatives exchange')
  .version('0.1.1');

// Register all command groups
registerConfigCommands(program);
registerAuthCommands(program);
registerMarketCommands(program);
registerOrderCommands(program);
registerPositionCommands(program);
registerAccountCommands(program);
registerFundingCommands(program);

// Global error handling
program.exitOverride();

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err: unknown) {
    // Commander throws on --help and --version, ignore those
    const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
    if (code === 'commander.helpDisplayed' || code === 'commander.version') {
      process.exit(0);
    }
    if (code === 'commander.missingMandatoryOptionValue' ||
        code === 'commander.missingArgument') {
      // Commander already printed the error
      process.exit(1);
    }
    handleError(err);
  }
}

main();
