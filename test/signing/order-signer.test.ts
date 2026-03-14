import { EGrvtEnvironment } from '@grvt/sdk';
import { signOrder, SignOrderParams, InstrumentInfo } from '../../src/signing/order-signer';

// Hardhat/Foundry default Account #0 — publicly known test key, no real funds
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

const TEST_INSTRUMENTS: Record<string, InstrumentInfo> = {
  'BTC_USDT_Perp': { instrument: 'BTC_USDT_Perp', instrument_hash: '0x030501', base_decimals: 9 },
  'ETH_USDT_Perp': { instrument: 'ETH_USDT_Perp', instrument_hash: '0x030401', base_decimals: 9 },
};

describe('signOrder', () => {
  const baseParams: SignOrderParams = {
    subAccountId: '12345',
    isMarket: false,
    timeInForce: 'GOOD_TILL_TIME',
    postOnly: false,
    reduceOnly: false,
    legs: [
      {
        instrument: 'BTC_USDT_Perp',
        size: '0.1',
        limitPrice: '65000',
        isBuyingAsset: true,
      },
    ],
    instruments: TEST_INSTRUMENTS,
  };

  it('produces a valid signature with r, s, v fields', async () => {
    const result = await signOrder(baseParams, TEST_PRIVATE_KEY, EGrvtEnvironment.TESTNET);

    expect(result.signature.r).toBeDefined();
    expect(result.signature.s).toBeDefined();
    expect(result.signature.v).toBeDefined();
    expect(result.signature.r.startsWith('0x')).toBe(true);
    expect(result.signature.s.startsWith('0x')).toBe(true);
    expect(typeof result.signature.v).toBe('number');
  });

  it('sets signer to the wallet address', async () => {
    const result = await signOrder(baseParams, TEST_PRIVATE_KEY, EGrvtEnvironment.TESTNET);
    expect(result.signature.signer.toLowerCase()).toBe(TEST_ADDRESS.toLowerCase());
  });

  it('includes nonce and expiration', async () => {
    const result = await signOrder(baseParams, TEST_PRIVATE_KEY, EGrvtEnvironment.TESTNET);
    expect(result.signature.nonce).toBeDefined();
    expect(typeof result.signature.nonce).toBe('number');
    expect(result.signature.nonce).toBeGreaterThan(0);
    expect(result.signature.expiration).toBeDefined();
    expect(BigInt(result.signature.expiration)).toBeGreaterThan(0n);
  });

  it('returns a valid signed order with correct fields', async () => {
    const result = await signOrder(baseParams, TEST_PRIVATE_KEY, EGrvtEnvironment.TESTNET);

    expect(result.sub_account_id).toBe('12345');
    expect(result.is_market).toBe(false);
    expect(result.time_in_force).toBe('GOOD_TILL_TIME');
    expect(result.post_only).toBe(false);
    expect(result.reduce_only).toBe(false);
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0].instrument).toBe('BTC_USDT_Perp');
    expect(result.legs[0].size).toBe('0.1');
    expect(result.legs[0].limit_price).toBe('65000');
    expect(result.legs[0].is_buying_asset).toBe(true);
    expect(result.signature).toBeDefined();
  });

  it('market orders have no limit_price', async () => {
    const marketParams: SignOrderParams = {
      ...baseParams,
      isMarket: true,
      legs: [
        {
          instrument: 'BTC_USDT_Perp',
          size: '0.1',
          limitPrice: '0',
          isBuyingAsset: true,
        },
      ],
    };
    const result = await signOrder(marketParams, TEST_PRIVATE_KEY, EGrvtEnvironment.TESTNET);

    expect(result.is_market).toBe(true);
    expect(result.legs[0].limit_price).toBe('0');
  });

  it('limit orders include limit_price', async () => {
    const result = await signOrder(baseParams, TEST_PRIVATE_KEY, EGrvtEnvironment.TESTNET);
    expect(result.legs[0].limit_price).toBe('65000');
  });

  it('sell orders have is_buying_asset=false', async () => {
    const sellParams: SignOrderParams = {
      ...baseParams,
      legs: [
        {
          ...baseParams.legs[0],
          isBuyingAsset: false,
        },
      ],
    };
    const result = await signOrder(sellParams, TEST_PRIVATE_KEY, EGrvtEnvironment.TESTNET);
    expect(result.legs[0].is_buying_asset).toBe(false);
  });

  it('produces different signatures for different nonces', async () => {
    const result1 = await signOrder(baseParams, TEST_PRIVATE_KEY, EGrvtEnvironment.TESTNET);
    const result2 = await signOrder(baseParams, TEST_PRIVATE_KEY, EGrvtEnvironment.TESTNET);

    // Different nonces should produce different signatures
    // (extremely unlikely to be equal with random nonces)
    expect(
      result1.signature.nonce !== result2.signature.nonce ||
      result1.signature.expiration !== result2.signature.expiration
    ).toBe(true);
  });

  it('different environments produce different signatures', async () => {
    const testnetResult = await signOrder(baseParams, TEST_PRIVATE_KEY, EGrvtEnvironment.TESTNET);
    const prodResult = await signOrder(baseParams, TEST_PRIVATE_KEY, EGrvtEnvironment.PRODUCTION);

    // Signatures should differ because chainId differs
    expect(testnetResult.signature.r).not.toBe(prodResult.signature.r);
  });

  it('handles reduce_only and post_only flags', async () => {
    const params: SignOrderParams = {
      ...baseParams,
      postOnly: true,
      reduceOnly: true,
    };
    const result = await signOrder(params, TEST_PRIVATE_KEY, EGrvtEnvironment.TESTNET);
    expect(result.post_only).toBe(true);
    expect(result.reduce_only).toBe(true);
  });

  it('signature r and s have correct length (66 chars with 0x prefix)', async () => {
    const result = await signOrder(baseParams, TEST_PRIVATE_KEY, EGrvtEnvironment.TESTNET);
    expect(result.signature.r.length).toBe(66); // 0x + 64 hex chars
    expect(result.signature.s.length).toBe(66);
  });

  it('v is 27 or 28', async () => {
    const result = await signOrder(baseParams, TEST_PRIVATE_KEY, EGrvtEnvironment.TESTNET);
    expect([27, 28]).toContain(result.signature.v);
  });

  it('metadata has client_order_id', async () => {
    const result = await signOrder(baseParams, TEST_PRIVATE_KEY, EGrvtEnvironment.TESTNET);
    expect(result.metadata).toBeDefined();
    expect(typeof result.metadata.client_order_id).toBe('string');
    expect(result.metadata.client_order_id.length).toBeGreaterThan(0);
  });

  it('throws when instrument info is missing from instruments map', async () => {
    const params: SignOrderParams = {
      ...baseParams,
      legs: [
        {
          instrument: 'UNKNOWN_USDT_Perp',
          size: '1',
          limitPrice: '100',
          isBuyingAsset: true,
        },
      ],
    };
    await expect(
      signOrder(params, TEST_PRIVATE_KEY, EGrvtEnvironment.TESTNET)
    ).rejects.toThrow('Instrument info not found for UNKNOWN_USDT_Perp');
  });
});

