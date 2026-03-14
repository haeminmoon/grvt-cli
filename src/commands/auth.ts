import { Command } from 'commander';
import { getEffectiveConfig, loadSession, saveSession, clearSession } from '../config/store';
import { CliApiClient } from '../client/api-client';
import { output, getOutputFormat } from '../output/formatter';
import { handleError } from '../output/error';

export function registerAuthCommands(program: Command): void {
  const authCmd = program
    .command('auth')
    .description('Authentication management');

  authCmd
    .command('login')
    .description('Login with API key and get session cookie')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action(async (options) => {
      try {
        const config = getEffectiveConfig();
        const client = new CliApiClient(config);
        const session = await client.login();
        saveSession(session);

        const format = getOutputFormat(options);
        output(
          {
            status: 'Logged in',
            env: config.env,
            accountId: session.accountId || '(unknown)',
            expiresAt: new Date(session.expiresAt * 1000).toISOString(),
          },
          format
        );
      } catch (err) {
        handleError(err);
      }
    });

  authCmd
    .command('status')
    .description('Check current authentication status')
    .option('-o, --output <format>', 'Output format (json, table)', 'table')
    .action((options) => {
      try {
        const config = getEffectiveConfig();
        const session = loadSession();
        const format = getOutputFormat(options);

        if (!session) {
          output(
            {
              status: 'Not authenticated',
              env: config.env,
              apiKeyConfigured: !!config.apiKey,
            },
            format
          );
          return;
        }

        const expiresIn = session.expiresAt - Math.floor(Date.now() / 1000);
        output(
          {
            status: 'Authenticated',
            env: config.env,
            accountId: session.accountId || '(unknown)',
            expiresIn: `${Math.floor(expiresIn / 60)} minutes`,
            expiresAt: new Date(session.expiresAt * 1000).toISOString(),
          },
          format
        );
      } catch (err) {
        handleError(err);
      }
    });

  authCmd
    .command('logout')
    .description('Clear saved session')
    .action(() => {
      clearSession();
      process.stdout.write('Session cleared.\n');
    });

}
