import type { Abi } from "viem";

import { abis, contractNames, eventSignatures, protocolManifest } from "./generated/protocol";
import type { ContractMetadata } from "./internal/types";

const contractMetadataByName = new Map(
  protocolManifest.contracts.map((metadata) => [metadata.name, metadata satisfies ContractMetadata])
);

export function getProtocolManifest() {
  return protocolManifest;
}

export function getContractMetadata(name: keyof typeof abis): ContractMetadata {
  const metadata = contractMetadataByName.get(name);
  if (!metadata) {
    throw new Error(`Unknown contract metadata: ${name}`);
  }
  return metadata;
}

export function getAbi(name: keyof typeof abis): Abi {
  return abis[name] as Abi;
}

export function listContractNames() {
  return contractNames;
}

export function getEventMetadata(name: keyof typeof eventSignatures) {
  return eventSignatures[name];
}

