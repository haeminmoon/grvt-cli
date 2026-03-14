import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EGrvtEnvironment } from '@grvt/sdk';
import {
  CONFIG_DIR_NAME,
  CONFIG_FILE_NAME,
  SESSION_FILE_NAME,
  DEFAULT_ENV,
  ENV_ALIASES,
} from './constants';

export interface CliConfig {
  env: EGrvtEnvironment;
  apiKey?: string;
  apiSecret?: string;
  subAccountId?: string;
}

export interface SessionData {
  cookie: string;
  accountId?: string;
  expiresAt: number;
}

function getConfigDir(): string {
  return path.join(os.homedir(), CONFIG_DIR_NAME);
}

function getConfigPath(): string {
  return path.join(getConfigDir(), CONFIG_FILE_NAME);
}

function getSessionPath(): string {
  return path.join(getConfigDir(), SESSION_FILE_NAME);
}

function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { mode: 0o700, recursive: true });
  }
}

export function resolveEnv(input: string): EGrvtEnvironment {
  const lower = input.toLowerCase();
  if (lower in ENV_ALIASES) {
    return ENV_ALIASES[lower];
  }
  const upper = input.toUpperCase();
  if (Object.values(EGrvtEnvironment).includes(upper as EGrvtEnvironment)) {
    return upper as EGrvtEnvironment;
  }
  throw new Error(
    `Unknown environment: "${input}". Valid values: ${Object.keys(ENV_ALIASES).join(', ')}`
  );
}

export function loadConfig(): CliConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { env: DEFAULT_ENV };
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const data = JSON.parse(raw);
    return {
      env: data.env || DEFAULT_ENV,
      apiKey: data.apiKey,
      apiSecret: data.apiSecret,
      subAccountId: data.subAccountId,
    };
  } catch {
    return { env: DEFAULT_ENV };
  }
}

export function saveConfig(config: Partial<CliConfig>): void {
  ensureConfigDir();
  const existing = loadConfig();
  const merged = { ...existing, ...config };
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), {
    mode: 0o600,
  });
}

export function loadSession(): SessionData | null {
  const sessionPath = getSessionPath();
  if (!fs.existsSync(sessionPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(sessionPath, 'utf-8');
    const data = JSON.parse(raw);
    if (data.expiresAt && Date.now() < data.expiresAt * 1000) {
      return data as SessionData;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSession(session: SessionData): void {
  ensureConfigDir();
  const sessionPath = getSessionPath();
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), {
    mode: 0o600,
  });
}

export function clearSession(): void {
  const sessionPath = getSessionPath();
  if (fs.existsSync(sessionPath)) {
    fs.unlinkSync(sessionPath);
  }
}

export function getEffectiveConfig(): CliConfig {
  const config = loadConfig();
  return {
    ...config,
    apiKey: config.apiKey || process.env.GRVT_API_KEY,
    apiSecret: config.apiSecret || process.env.GRVT_SECRET_KEY,
    subAccountId: config.subAccountId || process.env.GRVT_SUB_ACCOUNT_ID,
  };
}
