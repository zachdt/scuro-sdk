import type { Address, Hex } from "viem";

import { deploymentOutputLabelGroups, type DeploymentOutputLabel } from "./generated/protocol";
import type {
  ActorLabel,
  BuiltinProfileKey,
  DeploymentProfile,
  ExpressionLabel,
  ModuleIdLabel,
  NormalizedDeployment
} from "./internal/types";
import { asAddress, optionalBigInt, requireValue } from "./internal/utils";

const registry = new Map<string, DeploymentProfile>();

export const ANVIL_LOCAL_PROFILE: DeploymentProfile = {
  key: "anvil-local",
  name: "Local Anvil",
  chainId: 31337,
  rpcUrl: "http://127.0.0.1:8545",
  labels: {
    Admin: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    Player1: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    Player2: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    SoloDeveloper: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    PokerDeveloper: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    NumberPickerExpressionTokenId: "1",
    BlackjackExpressionTokenId: "2",
    PokerExpressionTokenId: "3"
  },
  privateKeys: {
    Admin: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex,
    Player1: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex,
    Player2: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex
  }
};

registry.set(ANVIL_LOCAL_PROFILE.key, ANVIL_LOCAL_PROFILE);

export function defineDeploymentProfile(profile: DeploymentProfile): DeploymentProfile {
  registry.set(profile.key, profile);
  return profile;
}

export function getDeploymentProfile(key: BuiltinProfileKey | string): DeploymentProfile | undefined {
  return registry.get(key);
}

export function listDeploymentProfiles() {
  return Array.from(registry.values());
}

export function normalizeDeploymentLabels(
  input:
    | Partial<Record<DeploymentOutputLabel, string>>
    | DeploymentProfile
    | NormalizedDeployment
): NormalizedDeployment {
  if ("contracts" in input && "actors" in input && "moduleIds" in input && "expressions" in input) {
    return input;
  }

  const raw = "labels" in input ? input.labels : input;

  const contracts = Object.fromEntries(
    [...deploymentOutputLabelGroups.core, ...deploymentOutputLabelGroups.controllers, ...deploymentOutputLabelGroups.engines, ...deploymentOutputLabelGroups.verifiers]
      .flatMap((label) => {
        const value = raw[label];
        return value ? [[label, asAddress(value)]] : [];
      })
  ) as NormalizedDeployment["contracts"];

  const actors = Object.fromEntries(
    (["Admin", ...deploymentOutputLabelGroups.actors] as const).flatMap((label) => {
      const value = raw[label];
      return value ? [[label, asAddress(value)]] : [];
    })
  ) as Partial<Record<ActorLabel | "Admin", Address>>;

  const moduleIds = Object.fromEntries(
    deploymentOutputLabelGroups.module_ids.flatMap((label) => {
      const value = optionalBigInt(raw[label]);
      return value === undefined ? [] : [[label, value]];
    })
  ) as Partial<Record<ModuleIdLabel, bigint>>;

  const expressions = Object.fromEntries(
    deploymentOutputLabelGroups.expressions.flatMap((label) => {
      const value = optionalBigInt(raw[label]);
      return value === undefined ? [] : [[label, value]];
    })
  ) as Partial<Record<ExpressionLabel, bigint>>;

  return {
    raw,
    contracts,
    actors,
    moduleIds,
    expressions
  };
}

export function mergeProfileWithLabels(
  profile: DeploymentProfile,
  labels: Partial<Record<DeploymentOutputLabel, string>>
) {
  return defineDeploymentProfile({
    ...profile,
    labels: {
      ...profile.labels,
      ...labels
    }
  });
}

export function requireDeploymentAddress(
  deployment: NormalizedDeployment,
  label: keyof NormalizedDeployment["contracts"] | ActorLabel | "Admin"
) {
  if (label in deployment.contracts) {
    return requireValue(deployment.contracts[label as keyof NormalizedDeployment["contracts"]], String(label));
  }

  return requireValue(deployment.actors[label as ActorLabel | "Admin"], String(label));
}

export function requireModuleId(deployment: NormalizedDeployment, label: ModuleIdLabel) {
  return requireValue(deployment.moduleIds[label], label);
}

export function requireExpressionId(deployment: NormalizedDeployment, label: ExpressionLabel) {
  return requireValue(deployment.expressions[label], label);
}

