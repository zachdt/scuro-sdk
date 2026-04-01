import { describe, expect, test } from "bun:test";
import type { AbiFunction } from "viem";

import { getAbi, getContractMetadata, getProtocolManifest, listContractNames } from "../src/manifest";
import { deploymentOutputLabelGroups, enumLabels } from "../src/generated/protocol";

describe("manifest helpers", () => {
  test("load protocol manifest and contract metadata", () => {
    const manifest = getProtocolManifest();
    expect(manifest.contracts.length).toBeGreaterThan(5);
    expect(listContractNames()).toContain("ProtocolSettlement");
    expect(listContractNames()).toContain("SlotMachineController");
    expect(listContractNames()).toContain("SuperBaccaratEngine");
    expect(listContractNames()).toContain("CheminDeFerController");

    const metadata = getContractMetadata("ProtocolSettlement");
    expect(metadata.reference_doc).toContain("protocol-settlement");

    const baccaratMetadata = getContractMetadata("SuperBaccaratController");
    expect(baccaratMetadata.reference_doc).toContain("game-module-user-flows");

    const abi = getAbi("ProtocolSettlement");
    expect(Array.isArray(abi)).toBe(true);
    expect(abi.length).toBeGreaterThan(0);
  });

  test("merge supplemental labels and enum metadata", () => {
    expect(deploymentOutputLabelGroups.core).toContain("GameEngineRegistry");
    expect(deploymentOutputLabelGroups.controllers).toContain("SlotMachineController");
    expect(deploymentOutputLabelGroups.controllers).toContain("SuperBaccaratController");
    expect(deploymentOutputLabelGroups.controllers).toContain("CheminDeFerController");
    expect(deploymentOutputLabelGroups.engines).toContain("SlotMachineEngine");
    expect(deploymentOutputLabelGroups.engines).toContain("SuperBaccaratEngine");
    expect(deploymentOutputLabelGroups.engines).toContain("CheminDeFerEngine");
    expect(enumLabels["BaccaratTypes.BaccaratSide"]["1"]).toBe("Banker");
    expect(enumLabels["BaccaratTypes.BaccaratOutcome"]["0"]).toBe("PlayerWin");
    expect(enumLabels["SingleDeckBlackjackEngine.HandPayoutKind"]["5"]).toBe("HAND_PAYOUT_SUITED_BLACKJACK_2_TO_1");
  });

  test("ship blackjack v2 manifest and abi metadata", () => {
    const manifest = getProtocolManifest();
    expect(manifest.local_defaults.blackjack.config_hash_label).toBe("single-deck-blackjack-zk-v2");

    const abi = getAbi("SingleDeckBlackjackEngine");
    const functionNames = abi
      .filter((item): item is AbiFunction => item.type === "function")
      .map((item) => item.name);

    expect(functionNames).toContain("CARD_EMPTY");
    expect(functionNames).toContain("HAND_PAYOUT_SUITED_BLACKJACK_2_TO_1");
    expect(functionNames).toContain("submitActionProof");
    expect(functionNames).toContain("submitShowdownProof");
  });
});
