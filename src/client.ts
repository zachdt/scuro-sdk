import { createContractHelpers, decodeScuroEventLog } from "./contracts";
import { createCoordinatorHelpers } from "./coordinator";
import { createFlowHelpers } from "./flows";
import { getAbi, getContractMetadata, getEventMetadata, getProtocolManifest, listContractNames } from "./manifest";
import {
  ANVIL_LOCAL_PROFILE,
  TESTNET_BETA_PROFILE,
  defineDeploymentProfile,
  getDeploymentProfile,
  listDeploymentProfiles,
  mergeProfileWithLabels,
  normalizeDeploymentLabels
} from "./registry";
import type { CreateScuroClientOptions, ScuroClient } from "./internal/types";

export function createScuroClient(options: CreateScuroClientOptions): ScuroClient {
  const normalizedDeployment = normalizeDeploymentLabels(options.deployment);
  const contractOptions = {
    ...options,
    deployment: normalizedDeployment
  };

  return {
    deployment: normalizedDeployment,
    contracts: createContractHelpers(contractOptions),
    flows: createFlowHelpers(contractOptions),
    coordinator: createCoordinatorHelpers(contractOptions),
    events: {
      decode: decodeScuroEventLog
    },
    registry: {
      anvil: ANVIL_LOCAL_PROFILE,
      testnetBeta: TESTNET_BETA_PROFILE,
      defineDeploymentProfile,
      getDeploymentProfile,
      listDeploymentProfiles,
      mergeProfileWithLabels,
      normalizeDeploymentLabels
    },
    manifest: {
      getProtocolManifest,
      getContractMetadata,
      getAbi,
      listContractNames,
      getEventMetadata
    }
  };
}
