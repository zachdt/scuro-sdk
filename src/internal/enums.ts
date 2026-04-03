import { enumLabels } from "../generated/protocol";
import type {
  BaccaratOutcomeLabel,
  BaccaratSideLabel,
  BlackjackActionLabel,
  BlackjackActionMaskLabel,
  BlackjackHandPayoutKindLabel,
  BlackjackSessionPhaseLabel,
  EnumName,
  GameModeLabel,
  ModuleStatusLabel,
  PokerHandPhaseLabel,
  PokerMatchStateLabel
} from "./types";
import { UnknownEnumValueError } from "./errors";

function lookupEnumLabel(enumName: EnumName, value: number | bigint): string {
  const key = typeof value === "bigint" ? value.toString() : String(value);
  const label = enumLabels[enumName][key as keyof (typeof enumLabels)[typeof enumName]];
  if (!label) {
    throw new UnknownEnumValueError(enumName, value);
  }
  return label;
}

export function decodeGameMode(value: number | bigint): GameModeLabel {
  return lookupEnumLabel("GameCatalog.GameMode", value) as GameModeLabel;
}

export function decodeModuleStatus(value: number | bigint): ModuleStatusLabel {
  return lookupEnumLabel("GameCatalog.ModuleStatus", value) as ModuleStatusLabel;
}

export function decodeBaccaratSide(value: number | bigint): BaccaratSideLabel {
  return lookupEnumLabel("BaccaratTypes.BaccaratSide", value) as BaccaratSideLabel;
}

export function decodeBaccaratOutcome(value: number | bigint): BaccaratOutcomeLabel {
  return lookupEnumLabel("BaccaratTypes.BaccaratOutcome", value) as BaccaratOutcomeLabel;
}

export function decodeBlackjackSessionPhase(value: number | bigint): BlackjackSessionPhaseLabel {
  return lookupEnumLabel("BlackjackEngine.SessionPhase", value) as BlackjackSessionPhaseLabel;
}

export function decodeBlackjackAction(value: number | bigint): BlackjackActionLabel {
  return lookupEnumLabel("BlackjackEngine.Action", value) as BlackjackActionLabel;
}

export function decodeBlackjackHandPayoutKind(value: number | bigint): BlackjackHandPayoutKindLabel {
  return lookupEnumLabel("BlackjackEngine.HandPayoutKind", value) as BlackjackHandPayoutKindLabel;
}

export function decodePokerMatchState(value: number | bigint): PokerMatchStateLabel {
  return lookupEnumLabel("SingleDraw2To7Engine.MatchState", value) as PokerMatchStateLabel;
}

export function decodePokerHandPhase(value: number | bigint): PokerHandPhaseLabel {
  return lookupEnumLabel("SingleDraw2To7Engine.HandPhase", value) as PokerHandPhaseLabel;
}

export function decodeBlackjackActionMask(mask: number | bigint): BlackjackActionMaskLabel[] {
  const numericMask = typeof mask === "bigint" ? Number(mask) : mask;
  return Object.entries(enumLabels["BlackjackEngine.ActionMask"])
    .filter(([flag]) => (numericMask & Number(flag)) !== 0)
    .map(([, label]) => label as BlackjackActionMaskLabel);
}

export function isPokerPlayerClockPhase(phase: PokerHandPhaseLabel) {
  return phase === "PreDrawBetting" || phase === "DrawDeclaration" || phase === "PostDrawBetting";
}
