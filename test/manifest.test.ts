import { describe, expect, test } from "bun:test";

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
  });
});
