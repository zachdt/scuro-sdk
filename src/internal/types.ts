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
export type BuiltinProfileKey = "anvil-local" | "testnet-beta";

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
  | "BaccaratTypes.BaccaratSide"
  | "BaccaratTypes.BaccaratOutcome"
  | "SingleDeckBlackjackEngine.SessionPhase"
  | "SingleDeckBlackjackEngine.Action"
  | "SingleDeckBlackjackEngine.ActionMask"
  | "SingleDeckBlackjackEngine.HandPayoutKind"
  | "SingleDraw2To7Engine.MatchState"
  | "SingleDraw2To7Engine.HandPhase";

export type GameModeLabel = "Solo" | "PvP" | "Tournament";
export type ModuleStatusLabel = "LIVE" | "RETIRED" | "DISABLED";
export type BaccaratSideLabel = "Player" | "Banker" | "Tie";
export type BaccaratOutcomeLabel = "PlayerWin" | "BankerWin" | "Tie";
export type BlackjackSessionPhaseLabel =
  | "Inactive"
  | "AwaitingInitialDeal"
  | "AwaitingPlayerAction"
  | "AwaitingCoordinator"
  | "Completed";
export type BlackjackActionLabel = "ACTION_HIT" | "ACTION_STAND" | "ACTION_DOUBLE" | "ACTION_SPLIT";
export type BlackjackActionMaskLabel = "ALLOW_HIT" | "ALLOW_STAND" | "ALLOW_DOUBLE" | "ALLOW_SPLIT";
export type BlackjackHandPayoutKindLabel =
  | "HAND_PAYOUT_NONE"
  | "HAND_PAYOUT_LOSS"
  | "HAND_PAYOUT_PUSH"
  | "HAND_PAYOUT_EVEN_MONEY"
  | "HAND_PAYOUT_BLACKJACK_3_TO_2"
  | "HAND_PAYOUT_SUITED_BLACKJACK_2_TO_1";
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
export type BlackjackCardRank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type BlackjackCardSuit = 0 | 1 | 2 | 3;
export type BlackjackDealerRevealSlots = readonly [boolean, boolean, boolean, boolean];
export type BlackjackGroupedPlayerCards = readonly [
  readonly number[],
  readonly number[],
  readonly number[],
  readonly number[]
];

export interface DecodedBlackjackCardProxy {
  raw: number;
  isEmpty: boolean;
  rank: BlackjackCardRank | null;
  suit: BlackjackCardSuit | null;
}

export interface DecodedBlackjackDealerRevealMask {
  rawMask: number;
  slots: BlackjackDealerRevealSlots;
}

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

export interface SlotMachinePresetConfigInput {
  volatilityTier: number;
  configHash: Hex;
  reelCount: number;
  rowCount: number;
  waysMode: number;
  minStake: bigint;
  maxStake: bigint;
  maxPayoutMultiplierBps: bigint;
  symbolIds: readonly number[];
  wildSymbolId: number;
  scatterSymbolId: number;
  bonusSymbolId: number;
  jackpotSymbolId: number;
  reelWeightOffsets: readonly number[];
  reelSymbolIds: readonly number[];
  reelSymbolWeights: readonly number[];
  paytableSymbolIds: readonly number[];
  paytableMatchCounts: readonly number[];
  paytableMultiplierBps: readonly number[];
  freeSpinTriggerCount: number;
  freeSpinAwardCounts: readonly number[];
  maxFreeSpins: number;
  maxRetriggers: number;
  freeSpinMultiplierBps: number;
  pickTriggerCount: number;
  maxPickReveals: number;
  pickAwardMultiplierBps: readonly number[];
  holdTriggerCount: number;
  holdBoardSize: number;
  initialRespins: number;
  maxRespins: number;
  holdValueMultiplierBps: readonly number[];
  jackpotTierIds: readonly number[];
  jackpotAwardMultiplierBps: readonly number[];
  jackpotTierWeights: readonly number[];
  maxTotalEvents: number;
}

export interface SlotMachinePresetSummary {
  active: boolean;
  volatilityTier: number;
  configHash: Hex;
  reelCount: number;
  rowCount: number;
  waysMode: number;
  minStake: bigint;
  maxStake: bigint;
  maxPayoutMultiplierBps: bigint;
  maxFreeSpins: number;
  maxRetriggers: number;
  maxPickReveals: number;
  maxRespins: number;
  maxTotalEvents: number;
}

export interface SlotMachineSpinInspection {
  spin: any;
  spinResult: any;
  settlementOutcome: any;
  settled: boolean;
  expressionTokenId: bigint;
  presetSummary: SlotMachinePresetSummary;
}

export interface SuperBaccaratRoundInspection {
  playerCards: readonly [number, number, number];
  bankerCards: readonly [number, number, number];
  playerCardCount: number;
  bankerCardCount: number;
  playerTotal: number;
  bankerTotal: number;
  natural: boolean;
  outcome: number;
  outcomeLabel: BaccaratOutcomeLabel;
  randomWord: bigint;
  fulfilled: boolean;
}

export interface SuperBaccaratSessionInspection {
  round: SuperBaccaratRoundInspection;
  settlementOutcome: any;
  sessionSettled: boolean;
  expressionTokenId: bigint;
}

export interface CheminDeFerTableInspection {
  table: any;
  takers: Address[];
  takerAmounts: Record<Address, bigint>;
  round: any;
  resolved: boolean;
  playerTakeCap: bigint;
  matchedBankerRisk: bigint;
}

export interface GameEngineMetadataInput {
  engineType: Hex;
  verifier: Address;
  configHash: Hex;
  developerRewardBps: number;
  active: boolean;
  supportsTournament: boolean;
  supportsPvP: boolean;
  supportsSolo: boolean;
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
