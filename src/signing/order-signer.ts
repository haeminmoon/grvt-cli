import { Signer } from '@grvt/sdk/signing/signer';
import { getEIP712DomainData } from '@grvt/sdk/signing/domain';
import { Order as OrderType, GenerateNonce, GenerateExpiration, EGrvtEnvironment } from '@grvt/sdk';
import { ethers } from 'ethers';

// TimeInForce enum values (matching GRVT's ETimeInForceInt)
const TIME_IN_FORCE_MAP: Record<string, number> = {
  GOOD_TILL_TIME: 1,
  ALL_OR_NONE: 2,
  IMMEDIATE_OR_CANCEL: 3,
  FILL_OR_KILL: 4,
};

/**
 * Multiply a decimal string by 10^decimals and return as number.
 * E.g., toScaledInt("0.01", 9) => 10000000
 */
function toScaledInt(value: string, decimals: number): number {
  const parts = value.split('.');
  const intPart = parts[0] || '0';
  const decPart = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
  return Number(BigInt(intPart + decPart));
}

export interface InstrumentInfo {
  instrument: string;
  instrument_hash: string;
  base_decimals: number;
}

export interface SignOrderParams {
  subAccountId: string;
  isMarket: boolean;
  timeInForce: string;
  postOnly: boolean;
  reduceOnly: boolean;
  legs: {
    instrument: string;
    size: string;
    limitPrice: string;
    isBuyingAsset: boolean;
  }[];
  instruments: Record<string, InstrumentInfo>;
}

export interface SignedOrder {
  sub_account_id: string;
  is_market: boolean;
  time_in_force: string;
  post_only: boolean;
  reduce_only: boolean;
  legs: {
    instrument: string;
    size: string;
    limit_price: string;
    is_buying_asset: boolean;
  }[];
  signature: {
    signer: string;
    r: string;
    s: string;
    v: number;
    expiration: string;
    nonce: number;
  };
  metadata: {
    client_order_id: string;
  };
}

/**
 * Sign an order using EIP-712 typed data signing.
 * Uses @grvt/sdk's Signer and Order type definitions for consistency.
 */
export async function signOrder(
  params: SignOrderParams,
  apiSecret: string,
  env: EGrvtEnvironment,
): Promise<SignedOrder> {
  const domain = getEIP712DomainData(env);
  const nonce = GenerateNonce();
  const expiration = GenerateExpiration(28 * 24); // 28 days

  const timeInForceValue = TIME_IN_FORCE_MAP[params.timeInForce] || 1;
  const wallet = new ethers.Wallet(apiSecret);

  // Build signing legs with instrument data
  const signingLegs = params.legs.map((leg) => {
    const inst = params.instruments[leg.instrument];
    if (!inst) {
      throw new Error(`Instrument info not found for ${leg.instrument}. Fetch instrument data first.`);
    }

    return {
      assetID: inst.instrument_hash,
      contractSize: toScaledInt(leg.size, inst.base_decimals),
      limitPrice: leg.limitPrice && leg.limitPrice !== '0'
        ? toScaledInt(leg.limitPrice, 9)
        : 0,
      isBuyingContract: leg.isBuyingAsset,
    };
  });

  const typedData = {
    ...OrderType,
    domain,
    message: {
      subAccountID: params.subAccountId,
      isMarket: params.isMarket,
      timeInForce: timeInForceValue,
      postOnly: params.postOnly,
      reduceOnly: params.reduceOnly,
      legs: signingLegs,
      nonce,
      expiration,
    },
  };

  // Sign using SDK's Signer (uses @metamask/eth-sig-util V4)
  const signatureHex = Signer.sign(apiSecret, typedData);
  const { r, s, v } = Signer.decode(signatureHex);

  return {
    sub_account_id: params.subAccountId,
    is_market: params.isMarket,
    time_in_force: params.timeInForce,
    post_only: params.postOnly,
    reduce_only: params.reduceOnly,
    legs: params.legs.map((leg) => ({
      instrument: leg.instrument,
      size: leg.size,
      limit_price: String(parseInt(leg.limitPrice) || 0),
      is_buying_asset: leg.isBuyingAsset,
    })),
    signature: {
      signer: wallet.address.toLowerCase(),
      r,
      s,
      v,
      expiration,
      nonce,
    },
    metadata: {
      client_order_id: `${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
    },
  };
}
