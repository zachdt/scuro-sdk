import { describe, expect, test } from "bun:test";

import {
  ANVIL_LOCAL_PROFILE,
  TESTNET_BETA_PROFILE,
  defineDeploymentProfile,
  getDeploymentProfile,
  normalizeDeploymentLabels
} from "../src/registry";
import { createScuroClient } from "../src/client";

describe("registry helpers", () => {
  test("normalize deployment labels into typed buckets", () => {
    const normalized = normalizeDeploymentLabels({
      ...ANVIL_LOCAL_PROFILE.labels,
      ScuroToken: "0x1000000000000000000000000000000000000001",
      GameCatalog: "0x1000000000000000000000000000000000000005",
      GameEngineRegistry: "0x1000000000000000000000000000000000000007",
      SlotMachineController: "0x1000000000000000000000000000000000000013",
      SuperBaccaratEngine: "0x1000000000000000000000000000000000000016",
      NumberPickerModuleId: "42",
      PokerExpressionTokenId: "7"
    });

    expect(normalized.contracts.ScuroToken).toBe("0x1000000000000000000000000000000000000001");
    expect(normalized.contracts.GameEngineRegistry).toBe("0x1000000000000000000000000000000000000007");
    expect(normalized.contracts.SlotMachineController).toBe("0x1000000000000000000000000000000000000013");
    expect(normalized.contracts.SuperBaccaratEngine).toBe("0x1000000000000000000000000000000000000016");
    expect(normalized.actors.Player1).toBe(ANVIL_LOCAL_PROFILE.labels.Player1 as `0x${string}`);
    expect(normalized.moduleIds.NumberPickerModuleId).toBe(42n);
    expect(normalized.expressions.PokerExpressionTokenId).toBe(7n);
  });

  test("define and fetch custom profiles", () => {
    defineDeploymentProfile({
      key: "custom-test",
      name: "Custom Test",
      chainId: 999,
      labels: {
        Admin: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
      }
    });

    expect(getDeploymentProfile("custom-test")?.chainId).toBe(999);
  });

  test("ship a built-in hosted beta profile", () => {
    const profile = getDeploymentProfile("testnet-beta");

    expect(profile).toBeDefined();
    expect(profile).toBe(TESTNET_BETA_PROFILE);
    expect(profile?.chainId).toBe(31337);
    expect(profile?.rpcUrl).toBe("https://d1eu0nzcw8l9ul.cloudfront.net");
    expect(profile?.privateKeys).toBeUndefined();

    const normalized = normalizeDeploymentLabels(profile!);
    expect(normalized.contracts.ScuroToken).toBe("0x70804a7A45bB7A5f25b9486f484489D531DB48B2");
    expect(normalized.contracts.GameCatalog).toBe("0x9e4F5782c1aa64a81D8cFE38Ce8Af4DccE7043CF");
    expect(normalized.contracts.BlackjackController).toBe("0xd7427b2617DB84240b3eC79760361076A92ed829");
    expect(normalized.actors.Admin).toBe("0x6d25B305a3a152758AEfe8b99A389174C1fb9065");
    expect(normalized.actors.Player1).toBe("0x4567f033D344454bBdA7A1EFE5E6b9B4cfF14cf7");
    expect(normalized.moduleIds.TournamentPokerModuleId).toBe(2n);
    expect(normalized.expressions.BlackjackExpressionTokenId).toBe(2n);
  });

  test("createScuroClient accepts the built-in hosted beta profile", () => {
    const deployment = getDeploymentProfile("testnet-beta");
    if (!deployment) {
      throw new Error("missing testnet-beta profile");
    }

    const client = createScuroClient({
      publicClient: {
        readContract: async () => {
          throw new Error("readContract not stubbed");
        },
        getBlock: async () => ({ timestamp: 0n })
      } as any,
      deployment
    });

    expect(client.deployment.contracts.ProtocolSettlement).toBe("0x93DE6Cc0D7f4A4A773F11850397E0DfD4713c6e6");
    expect(typeof client.contracts.instances.gameCatalog).toBe("function");
    expect(client.contracts.instances.gameCatalog().address).toBe("0x9e4F5782c1aa64a81D8cFE38Ce8Af4DccE7043CF");
  });
});
