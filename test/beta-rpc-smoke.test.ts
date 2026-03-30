import { describe, expect, test } from "bun:test";

import { getBetaRpcSmokeTarget, runBetaRpcSmoke } from "../scripts/beta-rpc-smoke";

describe("beta rpc smoke", () => {
  test("resolve the hosted beta smoke target from the checked-in profile", () => {
    expect(getBetaRpcSmokeTarget()).toEqual({
      profileKey: "testnet-beta",
      rpcUrl: "https://d1eu0nzcw8l9ul.cloudfront.net",
      chainId: 31337
    });
  });

  test("report success when the hosted beta chain matches the pinned profile", async () => {
    const result = await runBetaRpcSmoke({
      getChainId: async () => 31337,
      getBlockNumber: async () => 123n
    });

    expect(result.chainId).toBe(31337);
    expect(result.blockNumber).toBe(123n);
    expect(result.target.profileKey).toBe("testnet-beta");
  });

  test("fail when the hosted beta chain does not match the pinned profile", async () => {
    await expect(
      runBetaRpcSmoke({
        getChainId: async () => 1,
        getBlockNumber: async () => 123n
      })
    ).rejects.toThrow("Expected 31337, got 1");
  });
});
