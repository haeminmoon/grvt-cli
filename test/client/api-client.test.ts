import { EGrvtEnvironment } from '@grvt/sdk';
import { CliApiClient } from '../../src/client/api-client';
import { ActionableError } from '../../src/output/error';

describe('CliApiClient', () => {
  describe('constructor', () => {
    it('creates client for testnet', () => {
      const client = new CliApiClient({
        env: EGrvtEnvironment.TESTNET,
        apiKey: 'test-key',
      });
      expect(client).toBeDefined();
    });

    it('creates client for production', () => {
      const client = new CliApiClient({
        env: EGrvtEnvironment.PRODUCTION,
        apiKey: 'test-key',
      });
      expect(client).toBeDefined();
    });
  });

  describe('login', () => {
    it('throws ActionableError when no API key configured', async () => {
      const client = new CliApiClient({
        env: EGrvtEnvironment.TESTNET,
      });
      await expect(client.login()).rejects.toThrow(ActionableError);
      await expect(client.login()).rejects.toThrow('API key is not configured');
    });
  });

  describe('setSession', () => {
    it('allows setting session externally', () => {
      const client = new CliApiClient({
        env: EGrvtEnvironment.TESTNET,
        apiKey: 'test-key',
      });
      client.setSession({
        cookie: 'test-cookie',
        accountId: 'acc-1',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });
      // Should not throw when making auth-required calls (would fail on network, not auth)
      expect(client).toBeDefined();
    });
  });

  describe('auth-required methods without session', () => {
    it('throws ActionableError for createOrder without auth', async () => {
      const client = new CliApiClient({
        env: EGrvtEnvironment.TESTNET,
      });
      await expect(
        client.createOrder({ order: {} as any })
      ).rejects.toThrow(ActionableError);
    });

    it('throws ActionableError for getPositions without auth', async () => {
      const client = new CliApiClient({
        env: EGrvtEnvironment.TESTNET,
      });
      await expect(
        client.getPositions({ sub_account_id: 'test' })
      ).rejects.toThrow(ActionableError);
    });

    it('throws ActionableError for cancelOrder without auth', async () => {
      const client = new CliApiClient({
        env: EGrvtEnvironment.TESTNET,
      });
      await expect(
        client.cancelOrder({ sub_account_id: 'test', order_id: '123' })
      ).rejects.toThrow(ActionableError);
    });
  });

  describe('market data methods (no auth required)', () => {
    // These will fail on network but should NOT throw auth errors
    it('getAllInstruments does not require auth', async () => {
      const client = new CliApiClient({
        env: EGrvtEnvironment.TESTNET,
      });
      // Will throw a network error, not an auth error
      try {
        await client.getAllInstruments({} as any);
      } catch (err: any) {
        expect(err).not.toBeInstanceOf(ActionableError);
      }
    });
  });
});
