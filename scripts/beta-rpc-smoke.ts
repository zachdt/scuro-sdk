import { createPublicClient, http, type PublicClient } from "viem";

import { TESTNET_BETA_PROFILE } from "../src/registry";

export interface BetaRpcSmokeTarget {
  profileKey: "testnet-beta";
  rpcUrl: string;
  chainId: number;
}

export interface BetaRpcSmokeResult {
  target: BetaRpcSmokeTarget;
  chainId: number;
  blockNumber: bigint;
}

type SmokePublicClient = Pick<PublicClient, "getBlockNumber" | "getChainId">;

export function getBetaRpcSmokeTarget(): BetaRpcSmokeTarget {
  if (!TESTNET_BETA_PROFILE.rpcUrl) {
    throw new Error("testnet-beta profile is missing an rpcUrl");
  }

  return {
    profileKey: "testnet-beta",
    rpcUrl: TESTNET_BETA_PROFILE.rpcUrl,
    chainId: TESTNET_BETA_PROFILE.chainId
  };
}

export async function runBetaRpcSmoke(
  client: SmokePublicClient,
  target: BetaRpcSmokeTarget = getBetaRpcSmokeTarget()
): Promise<BetaRpcSmokeResult> {
  const [chainId, blockNumber] = await Promise.all([client.getChainId(), client.getBlockNumber()]);

  if (chainId !== target.chainId) {
    throw new Error(
      `Beta testnet chainId mismatch for ${target.profileKey}. Expected ${target.chainId}, got ${chainId}.`
    );
  }

  return {
    target,
    chainId,
    blockNumber
  };
}

async function main() {
  const target = getBetaRpcSmokeTarget();
  const client = createPublicClient({
    transport: http(target.rpcUrl)
  });
  const result = await runBetaRpcSmoke(client, target);

  console.log(
    `beta rpc smoke passed: profile=${result.target.profileKey} chainId=${result.chainId} latestBlock=${result.blockNumber.toString()} rpc=${result.target.rpcUrl}`
  );
}

if (import.meta.main) {
  await main();
}
