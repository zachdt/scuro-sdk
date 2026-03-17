import { getAddress, type Address, type Hex, type WalletClient } from "viem";

import { MissingDeploymentLabelError, MissingWalletClientError } from "./errors";

export function asAddress(value: string): Address {
  return getAddress(value);
}

export function asBigInt(value: string | number | bigint): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

export function requireValue<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new MissingDeploymentLabelError(label);
  }
  return value;
}

export function optionalAddress(value: string | undefined): Address | undefined {
  return value ? asAddress(value) : undefined;
}

export function optionalBigInt(value: string | undefined): bigint | undefined {
  return value === undefined ? undefined : asBigInt(value);
}

export function ensureWalletClient(walletClient: WalletClient | undefined): WalletClient {
  if (!walletClient) {
    throw new MissingWalletClientError();
  }
  return walletClient;
}

export function nowSeconds(value?: number | bigint): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(Math.floor(value));
  }

  return BigInt(Math.floor(Date.now() / 1000));
}

export function toHex32(value: string): Hex {
  return value as Hex;
}

