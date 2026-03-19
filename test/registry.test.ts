import { describe, expect, test } from "bun:test";

import {
  ANVIL_LOCAL_PROFILE,
  defineDeploymentProfile,
  getDeploymentProfile,
  normalizeDeploymentLabels
} from "../src/registry";

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
});
