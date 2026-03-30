import { createPublicClient, http } from "viem";

const rpcUrl = process.env.BETA_TESTNET_RPC_URL;
const expectedChainId = process.env.BETA_TESTNET_EXPECTED_CHAIN_ID
  ? BigInt(process.env.BETA_TESTNET_EXPECTED_CHAIN_ID)
  : undefined;

if (!rpcUrl) {
  console.log("Skipping beta RPC smoke because BETA_TESTNET_RPC_URL is not set.");
  process.exit(0);
}

const client = createPublicClient({
  transport: http(rpcUrl)
});

const [chainId, blockNumber] = await Promise.all([client.getChainId(), client.getBlockNumber()]);

if (expectedChainId !== undefined && BigInt(chainId) !== expectedChainId) {
  throw new Error(
    `Beta testnet chainId mismatch. Expected ${expectedChainId.toString()}, got ${chainId.toString()}.`
  );
}

console.log(`beta rpc smoke passed: chainId=${chainId} latestBlock=${blockNumber.toString()}`);
