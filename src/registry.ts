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

// Synced against the April 1, 2026 Iterate Beta Runtime manifest/actors artifact.
export const TESTNET_BETA_PROFILE: DeploymentProfile = {
  key: "testnet-beta",
  name: "Hosted Testnet Beta",
  chainId: 31337,
  rpcUrl: "https://d1eu0nzcw8l9ul.cloudfront.net",
  labels: {
    ScuroToken: "0x70804a7A45bB7A5f25b9486f484489D531DB48B2",
    ScuroStakingToken: "0x1EeCbC9772A0De56653FaE657D8A279792F083d7",
    TimelockController: "0xdaA61f5dAf9223a866E2341eF277e173f570591A",
    ScuroGovernor: "0xaCe2544542E610Fa90265F666C503F465c100Dda",
    GameCatalog: "0x9e4F5782c1aa64a81D8cFE38Ce8Af4DccE7043CF",
    GameDeploymentFactory: "0x87596323899DcbecBe0E942Ca5e7b215d4626c71",
    DeveloperExpressionRegistry: "0x4349F999eB9179Bd24EeA1Aa9B7b482B44766B1F",
    DeveloperRewards: "0x136538C8983323429Bdab3d6C6cD914f272e0233",
    ProtocolSettlement: "0x93DE6Cc0D7f4A4A773F11850397E0DfD4713c6e6",
    NumberPickerEngine: "0x8715B9B821d157080a4d4bB80AcA13f1c207b176",
    NumberPickerAdapter: "0x5c070b258dFF03B5C0d1ecEDf75edbc6cf4A4730",
    NumberPickerModuleId: "1",
    TournamentController: "0x5B31485e631B8bb417ed7E0dA76700eED65112ff",
    TournamentPokerEngine: "0x2a4792F5E5d79F1215a8355217A5123015FF0b29",
    TournamentPokerVerifierBundle: "0x0fA08f1dd7C10F104057ecb7af8b446b551cc5f5",
    TournamentPokerModuleId: "2",
    PvPController: "0x50925Db2eEAa415ff242C063D4276617B261C76A",
    PvPPokerEngine: "0x703D5a5134afCEb802c348716BCCC96E68d2D5D9",
    PvPPokerVerifierBundle: "0xE7D223C8e2918592AB270B9423A96cF8349E02bf",
    PvPPokerModuleId: "3",
    BlackjackVerifierBundle: "0x9cd8dF334535483e9D9760FE00c32b9aB868f72d",
    SingleDeckBlackjackEngine: "0x0F61a9ad43824aD8fe53DdA65e5EdE1eF9be5C2F",
    BlackjackController: "0xd7427b2617DB84240b3eC79760361076A92ed829",
    BlackjackModuleId: "4",
    Admin: "0x6d25B305a3a152758AEfe8b99A389174C1fb9065",
    Player1: "0x4567f033D344454bBdA7A1EFE5E6b9B4cfF14cf7",
    Player2: "0xA16cb12623345ba0C736A3E6816F857680Bcc235",
    SoloDeveloper: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    PokerDeveloper: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    NumberPickerExpressionTokenId: "1",
    PokerExpressionTokenId: "3",
    BlackjackExpressionTokenId: "2"
  }
};

registry.set(ANVIL_LOCAL_PROFILE.key, ANVIL_LOCAL_PROFILE);
registry.set(TESTNET_BETA_PROFILE.key, TESTNET_BETA_PROFILE);

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
