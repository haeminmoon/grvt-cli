import { EGrvtEnvironment } from '@grvt/sdk';

export const CHAIN_IDS: Record<EGrvtEnvironment, number> = {
  [EGrvtEnvironment.DEV]: 327,
  [EGrvtEnvironment.STAGING]: 327,
  [EGrvtEnvironment.TESTNET]: 326,
  [EGrvtEnvironment.PRODUCTION]: 325,
};

export const ENV_ALIASES: Record<string, EGrvtEnvironment> = {
  prod: EGrvtEnvironment.PRODUCTION,
  production: EGrvtEnvironment.PRODUCTION,
  mainnet: EGrvtEnvironment.PRODUCTION,
  testnet: EGrvtEnvironment.TESTNET,
  staging: EGrvtEnvironment.STAGING,
  dev: EGrvtEnvironment.DEV,
};

export const DEFAULT_ENV = EGrvtEnvironment.PRODUCTION;


export const CONFIG_DIR_NAME = '.grvt-cli';
export const CONFIG_FILE_NAME = 'config.json';
export const SESSION_FILE_NAME = 'session.json';
