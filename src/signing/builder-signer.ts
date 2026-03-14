import { ethers } from 'ethers';
import { EGrvtEnvironment } from '@grvt/sdk';
import { CHAIN_IDS } from '../config/constants';

/**
 * Get server time in nanoseconds from the market data endpoint.
 */
async function getServerTimeNs(env: EGrvtEnvironment): Promise<bigint> {
  const domainMap: Record<EGrvtEnvironment, string> = {
    [EGrvtEnvironment.PRODUCTION]: 'https://market-data.grvt.io',
    [EGrvtEnvironment.TESTNET]: 'https://market-data.testnet.grvt.io',
    [EGrvtEnvironment.STAGING]: 'https://market-data.staging.gravitymarkets.io',
    [EGrvtEnvironment.DEV]: 'https://market-data.dev.gravitymarkets.io',
  };
  const resp = await fetch(`${domainMap[env]}/time`, { signal: AbortSignal.timeout(10_000) });
  if (!resp.ok) throw new Error(`GET /time failed: ${resp.status}`);
  const data = (await resp.json()) as { server_time: number };
  return BigInt(data.server_time) * 1_000_000n;
}

/** Encode an integer as a 0x-prefixed 32-byte hex string. */
function hex32(n: bigint): string {
  return '0x' + n.toString(16).padStart(64, '0');
}

export interface AuthorizeBuilderParams {
  mainAccountId: string;       // User's main account funding address
  builderAccountId: string;    // Builder's funding address
  maxFuturesFeeRate: string;   // e.g., "0.001"
  maxSpotFeeRate: string;      // e.g., "0.0001"
}

export interface SignedAuthorizeBuilder {
  main_account_id: string;
  builder_account_id: string;
  max_futures_fee_rate: string;
  max_spot_fee_rate: string;
  signature: {
    signer: string;
    r: string;
    s: string;
    v: number;
    expiration: string;
    nonce: number;
    chain_id: string;
  };
}

/**
 * Sign an AuthorizeBuilder EIP-712 payload (authorize-only, no API key creation).
 * Signed by the USER's main account private key.
 * Reference: https://github.com/gravity-technologies/builder-examples
 */
export async function signAuthorizeBuilder(
  params: AuthorizeBuilderParams,
  userPrivateKey: string,
  env: EGrvtEnvironment,
): Promise<SignedAuthorizeBuilder> {
  const chainId = CHAIN_IDS[env];
  const wallet = new ethers.Wallet(userPrivateKey);

  const mfUint32 = Math.floor(parseFloat(params.maxFuturesFeeRate) * 10_000);
  const msUint32 = Math.floor(parseFloat(params.maxSpotFeeRate) * 10_000);

  const nonce = crypto.getRandomValues(new Uint32Array(1))[0];
  const expirationNs = (await getServerTimeNs(env)) + BigInt(7 * 24 * 3600) * 1_000_000_000n;

  const domain: ethers.TypedDataDomain = {
    name: 'GRVT Exchange',
    version: '0',
    chainId,
  };

  const types = {
    AuthorizeBuilder: [
      { name: 'mainAccountID', type: 'address' },
      { name: 'builderAccountID', type: 'address' },
      { name: 'maxFutureFeeRate', type: 'uint32' },
      { name: 'maxSpotFeeRate', type: 'uint32' },
      { name: 'nonce', type: 'uint32' },
      { name: 'expiration', type: 'int64' },
    ],
  };

  const message = {
    mainAccountID: params.mainAccountId,
    builderAccountID: params.builderAccountId,
    maxFutureFeeRate: mfUint32,
    maxSpotFeeRate: msUint32,
    nonce,
    expiration: expirationNs,
  };

  const rawSig = await wallet.signTypedData(domain, types, message);
  const sig = ethers.Signature.from(rawSig);

  return {
    main_account_id: params.mainAccountId.toLowerCase(),
    builder_account_id: params.builderAccountId.toLowerCase(),
    max_futures_fee_rate: params.maxFuturesFeeRate,
    max_spot_fee_rate: params.maxSpotFeeRate,
    signature: {
      signer: wallet.address.toLowerCase(),
      r: hex32(BigInt(sig.r)),
      s: hex32(BigInt(sig.s)),
      v: sig.v,
      expiration: expirationNs.toString(),
      nonce,
      chain_id: String(chainId),
    },
  };
}
