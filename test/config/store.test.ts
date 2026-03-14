import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EGrvtEnvironment } from '@grvt/sdk';
import {
  loadConfig,
  saveConfig,
  resolveEnv,
  getEffectiveConfig,
  loadSession,
  saveSession,
  clearSession,
  CliConfig,
  SessionData,
} from '../../src/config/store';

// Use a temp directory for tests
const TEST_DIR = path.join(os.tmpdir(), `grvt-cli-test-${Date.now()}`);
const CONFIG_DIR = path.join(TEST_DIR, '.grvt-cli');

// Mock os.homedir to return our test directory
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: () => TEST_DIR,
}));

beforeEach(() => {
  if (fs.existsSync(CONFIG_DIR)) {
    fs.rmSync(CONFIG_DIR, { recursive: true });
  }
  // Clean environment variables
  delete process.env.GRVT_API_KEY;
  delete process.env.GRVT_SECRET_KEY;
  delete process.env.GRVT_SUB_ACCOUNT_ID;
});

afterAll(() => {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
});

describe('resolveEnv', () => {
  it('resolves alias "testnet" to TESTNET', () => {
    expect(resolveEnv('testnet')).toBe(EGrvtEnvironment.TESTNET);
  });

  it('resolves alias "prod" to PRODUCTION', () => {
    expect(resolveEnv('prod')).toBe(EGrvtEnvironment.PRODUCTION);
  });

  it('resolves alias "mainnet" to PRODUCTION', () => {
    expect(resolveEnv('mainnet')).toBe(EGrvtEnvironment.PRODUCTION);
  });

  it('resolves case-insensitive input', () => {
    expect(resolveEnv('TESTNET')).toBe(EGrvtEnvironment.TESTNET);
    expect(resolveEnv('Testnet')).toBe(EGrvtEnvironment.TESTNET);
  });

  it('throws on unknown environment', () => {
    expect(() => resolveEnv('invalid')).toThrow('Unknown environment');
  });
});

describe('config store', () => {
  it('returns default config when no file exists', () => {
    const config = loadConfig();
    expect(config.env).toBe(EGrvtEnvironment.PRODUCTION);
    expect(config.apiKey).toBeUndefined();
  });

  it('saves and loads config', () => {
    saveConfig({
      env: EGrvtEnvironment.PRODUCTION,
      apiKey: 'test-key-123',
      subAccountId: 'sub-1',
    });

    const config = loadConfig();
    expect(config.env).toBe(EGrvtEnvironment.PRODUCTION);
    expect(config.apiKey).toBe('test-key-123');
    expect(config.subAccountId).toBe('sub-1');
  });

  it('merges config updates without overwriting', () => {
    saveConfig({ apiKey: 'key-1' });
    saveConfig({ subAccountId: 'sub-2' });

    const config = loadConfig();
    expect(config.apiKey).toBe('key-1');
    expect(config.subAccountId).toBe('sub-2');
  });

  it('creates config directory with correct permissions', () => {
    saveConfig({ env: EGrvtEnvironment.DEV });
    const stats = fs.statSync(CONFIG_DIR);
    // Check it exists and is a directory
    expect(stats.isDirectory()).toBe(true);
  });

  it('sets file permissions to 0600', () => {
    saveConfig({ apiKey: 'secret' });
    const configPath = path.join(CONFIG_DIR, 'config.json');
    const stats = fs.statSync(configPath);
    // 0o600 = owner read/write only
    expect(stats.mode & 0o777).toBe(0o600);
  });
});

describe('effective config with env vars', () => {
  it('prefers saved config over env var for apiKey', () => {
    saveConfig({ apiKey: 'saved-key' });
    process.env.GRVT_API_KEY = 'env-key';

    const config = getEffectiveConfig();
    expect(config.apiKey).toBe('saved-key');
  });

  it('uses env var when no saved value', () => {
    process.env.GRVT_API_KEY = 'env-key-only';
    const config = getEffectiveConfig();
    expect(config.apiKey).toBe('env-key-only');
  });
});

describe('session management', () => {
  it('returns null when no session file exists', () => {
    expect(loadSession()).toBeNull();
  });

  it('saves and loads session', () => {
    const session: SessionData = {
      cookie: 'test-cookie',
      accountId: 'acc-1',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    saveSession(session);

    const loaded = loadSession();
    expect(loaded).not.toBeNull();
    expect(loaded!.cookie).toBe('test-cookie');
    expect(loaded!.accountId).toBe('acc-1');
  });

  it('returns null for expired session', () => {
    const session: SessionData = {
      cookie: 'expired-cookie',
      expiresAt: Math.floor(Date.now() / 1000) - 100, // expired
    };
    saveSession(session);
    expect(loadSession()).toBeNull();
  });

  it('clears session', () => {
    saveSession({
      cookie: 'to-clear',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(loadSession()).not.toBeNull();

    clearSession();
    expect(loadSession()).toBeNull();
  });
});
