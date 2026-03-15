import * as readline from 'readline';
import { Command } from 'commander';
import { loadConfig, saveConfig, resolveEnv, getEffectiveConfig } from '../config/store';
import { CliApiClient } from '../client/api-client';
import { output, getOutputFormat } from '../output/formatter';
import { ActionableError, handleError } from '../output/error';

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

/**
 * Prompt for sensitive input with echo suppressed.
 * Characters are replaced with '*' as the user types.
 */
function askSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf-8');

    let input = '';
    const onData = (char: string) => {
      const c = char.toString();
      if (c === '\n' || c === '\r') {
        stdin.removeListener('data', onData);
        if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
        process.stdout.write('\n');
        resolve(input);
      } else if (c === '\u007F' || c === '\b') {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (c === '\u0003') {
        // Ctrl+C
        process.stdout.write('\n');
        process.exit(0);
      } else {
        input += c;
        process.stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

export function registerConfigCommands(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Manage CLI configuration');

  configCmd
    .command('init')
    .description('Interactive setup wizard')
    .action(async () => {
      let activeRl: readline.Interface | null = null;
      try {
        process.stdout.write('\nGRVT CLI Setup\n\n');

        const env = resolveEnv('prod');

        activeRl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const apiKey = (await ask(activeRl, 'API Key: ')).trim();
        if (!apiKey) {
          throw new Error('API key is required.');
        }
        activeRl.close();
        activeRl = null;

        const apiSecret = (await askSecret('API Secret (private key): ')).trim();
        if (!apiSecret) {
          throw new Error('API secret is required.');
        }

        activeRl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const subAccountId = (await ask(activeRl, 'Sub-account ID: ')).trim();
        if (!subAccountId) {
          throw new Error('Sub-account ID is required.');
        }

        saveConfig({
          ...(env ? { env } : {}),
          apiKey,
          apiSecret,
          subAccountId,
        });

        process.stdout.write('\nConfiguration saved.\n');

        // Attempt auto-login
        process.stdout.write('Logging in...\n');
        const config = getEffectiveConfig();
        const client = new CliApiClient(config);
        try {
          const { saveSession } = await import('../config/store');
          const session = await client.login();
          saveSession(session);
          process.stdout.write(`Login successful. Session expires at ${new Date(session.expiresAt * 1000).toISOString()}\n`);
        } catch {
          process.stdout.write('Login failed. Check your API key and try: grvt-cli auth login\n');
        }
      } catch (err) {
        handleError(err);
      } finally {
        activeRl?.close();
      }
    });

  configCmd
    .command('set')
    .description('Set configuration values')
    .option('--env <environment>', 'Environment (testnet, prod, dev, staging)')
    .option('--api-key <key>', 'GRVT API key')
    .option('--api-secret <secret>', 'GRVT API secret (private key)')
    .option('--sub-account-id <id>', 'Default sub-account ID')
    .action((options) => {
      try {
        const updates: Record<string, unknown> = {};
        if (options.env) {
          updates.env = resolveEnv(options.env);
        }
        if (options.apiKey) updates.apiKey = options.apiKey;
        if (options.apiSecret) updates.apiSecret = options.apiSecret;
        if (options.subAccountId) updates.subAccountId = options.subAccountId;

        if (Object.keys(updates).length === 0) {
          throw new ActionableError(
            'No configuration values provided.',
            'grvt-cli config set --env <environment>'
          );
        }

        saveConfig(updates);
        process.stdout.write('Configuration updated.\n');
      } catch (err) {
        handleError(err);
      }
    });

  configCmd
    .command('get')
    .description('Get a configuration value')
    .argument('<key>', 'Configuration key (env, apiKey, subAccountId)')
    .action((key) => {
      try {
        const config = getEffectiveConfig();
        const value = (config as unknown as Record<string, unknown>)[key];
        if (value === undefined) {
          throw new Error(`Unknown config key: ${key}`);
        }
        // Mask secrets
        if (key === 'apiKey' || key === 'apiSecret') {
          const str = String(value);
          process.stdout.write(str.slice(0, 6) + '...' + str.slice(-4) + '\n');
        } else {
          process.stdout.write(String(value) + '\n');
        }
      } catch (err) {
        handleError(err);
      }
    });

  configCmd
    .command('list')
    .description('List all configuration values')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action((options) => {
      const config = getEffectiveConfig();
      const format = getOutputFormat(options);
      const display: Record<string, string> = {
        env: config.env,
        apiKey: config.apiKey ? config.apiKey.slice(0, 6) + '...' + config.apiKey.slice(-4) : '(not set)',
        apiSecret: config.apiSecret ? '****' + config.apiSecret.slice(-4) : '(not set)',
        subAccountId: config.subAccountId || '(not set)',
      };
      output(display, format);
    });
}
