import { describe, expect, test } from "bun:test";

import { getAbi, getContractMetadata, getProtocolManifest, listContractNames } from "../src/manifest";

describe("manifest helpers", () => {
  test("load protocol manifest and contract metadata", () => {
    const manifest = getProtocolManifest();
    expect(manifest.contracts.length).toBeGreaterThan(5);
    expect(listContractNames()).toContain("ProtocolSettlement");

    const metadata = getContractMetadata("ProtocolSettlement");
    expect(metadata.reference_doc).toContain("protocol-settlement");

    const abi = getAbi("ProtocolSettlement");
    expect(Array.isArray(abi)).toBe(true);
    expect(abi.length).toBeGreaterThan(0);
  });
});

