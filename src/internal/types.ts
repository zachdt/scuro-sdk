import type { Abi, Address, Hex, PublicClient, WalletClient } from "viem";

import type {
  ContractDeploymentLabel,
  ContractName,
  DeploymentOutputLabel
} from "../generated/protocol";
import { deploymentOutputLabelGroups } from "../generated/protocol";

export type ActorLabel = (typeof deploymentOutputLabelGroups.actors)[number];
export type ModuleIdLabel = (typeof deploymentOutputLabelGroups.module_ids)[number];
export type ExpressionLabel = (typeof deploymentOutputLabelGroups.expressions)[number];
export type BuiltinProfileKey = "anvil-local";

export interface DeploymentProfile {
  key: string;
  name: string;
  chainId: number;
  rpcUrl?: string;
  labels: Partial<Record<DeploymentOutputLabel, string>>;
  privateKeys?: Partial<Record<ActorLabel | "Admin", Hex>>;
}

export interface NormalizedDeployment {
  raw: Partial<Record<DeploymentOutputLabel, string>>;
  contracts: Partial<Record<ContractDeploymentLabel, Address>>;
  actors: Partial<Record<ActorLabel | "Admin", Address>>;
  moduleIds: Partial<Record<ModuleIdLabel, bigint>>;
  expressions: Partial<Record<ExpressionLabel, bigint>>;
}

export interface CreateScuroClientOptions {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  deployment: Partial<Record<DeploymentOutputLabel, string>> | DeploymentProfile | NormalizedDeployment;
  chainId?: number;
}

export type EnumName =
  | "GameCatalog.GameMode"
  | "GameCatalog.ModuleStatus"
  | "SingleDeckBlackjackEngine.SessionPhase"
  | "SingleDeckBlackjackEngine.Action"
  | "SingleDeckBlackjackEngine.ActionMask"
  | "SingleDraw2To7Engine.MatchState"
  | "SingleDraw2To7Engine.HandPhase";

export type GameModeLabel = "Solo" | "PvP" | "Tournament";
export type ModuleStatusLabel = "LIVE" | "RETIRED" | "DISABLED";
export type BlackjackSessionPhaseLabel =
  | "Inactive"
  | "AwaitingInitialDeal"
  | "AwaitingPlayerAction"
  | "AwaitingCoordinator"
  | "Completed";
export type BlackjackActionLabel = "ACTION_HIT" | "ACTION_STAND" | "ACTION_DOUBLE" | "ACTION_SPLIT";
export type BlackjackActionMaskLabel = "ALLOW_HIT" | "ALLOW_STAND" | "ALLOW_DOUBLE" | "ALLOW_SPLIT";
export type PokerMatchStateLabel = "Inactive" | "Active" | "Completed";
export type PokerHandPhaseLabel =
  | "None"
  | "AwaitingInitialDeal"
  | "PreDrawBetting"
  | "DrawDeclaration"
  | "DrawProofPending"
  | "PostDrawBetting"
  | "ShowdownProofPending"
  | "HandComplete";

export interface PreparedTransactionRequest {
  to: Address;
  data: Hex;
  value?: bigint;
}

export interface ContractEventMetadata {
  name: string;
  signature: string;
  anonymous: boolean;
}

export interface ContractMetadata {
  name: ContractName;
  category: string;
  source: string;
  artifact: string;
  reference_doc: string;
  abi_path: string;
  functions: readonly string[];
  events: readonly string[];
}

export interface ContractDescriptor {
  address: Address;
  abi: Abi;
  publicClient: PublicClient;
  walletClient: WalletClient | undefined;
}

export interface ScuroContractHelpers {
  publicClient: PublicClient;
  walletClient: WalletClient | undefined;
  deployment: NormalizedDeployment;
  instances: any;
  read: any;
  encode: any;
  write: any;
  inspect: any;
  helpers: any;
}

export interface ScuroFlowHelpers {
  [key: string]: any;
}

export interface ScuroCoordinatorHelpers {
  [key: string]: any;
}

export interface ScuroClient {
  deployment: NormalizedDeployment;
  contracts: ScuroContractHelpers;
  flows: ScuroFlowHelpers;
  coordinator: ScuroCoordinatorHelpers;
  events: {
    decode: (...args: any[]) => any;
  };
  registry: Record<string, any>;
  manifest: Record<string, any>;
}
