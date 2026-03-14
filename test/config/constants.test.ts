import { EGrvtEnvironment } from '@grvt/sdk';
import { CHAIN_IDS, ENV_ALIASES, DEFAULT_ENV } from '../../src/config/constants';

describe('constants', () => {
  describe('CHAIN_IDS', () => {
    it('has correct chain ID for PRODUCTION', () => {
      expect(CHAIN_IDS[EGrvtEnvironment.PRODUCTION]).toBe(325);
    });

    it('has correct chain ID for TESTNET', () => {
      expect(CHAIN_IDS[EGrvtEnvironment.TESTNET]).toBe(326);
    });

    it('has matching chain ID for DEV and STAGING', () => {
      expect(CHAIN_IDS[EGrvtEnvironment.DEV]).toBe(327);
      expect(CHAIN_IDS[EGrvtEnvironment.STAGING]).toBe(327);
    });
  });

  describe('ENV_ALIASES', () => {
    it('maps "prod" to PRODUCTION', () => {
      expect(ENV_ALIASES['prod']).toBe(EGrvtEnvironment.PRODUCTION);
    });

    it('maps "mainnet" to PRODUCTION', () => {
      expect(ENV_ALIASES['mainnet']).toBe(EGrvtEnvironment.PRODUCTION);
    });

    it('maps "testnet" to TESTNET', () => {
      expect(ENV_ALIASES['testnet']).toBe(EGrvtEnvironment.TESTNET);
    });
  });

  describe('DEFAULT_ENV', () => {
    it('defaults to PRODUCTION', () => {
      expect(DEFAULT_ENV).toBe(EGrvtEnvironment.PRODUCTION);
    });
  });
});
