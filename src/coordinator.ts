import type { Address, Hex } from "viem";

import { createContractHelpers } from "./contracts";
import { InvalidLifecycleStateError } from "./internal/errors";
import { isPokerPlayerClockPhase } from "./internal/enums";
import type { CreateScuroClientOptions, ScuroContractHelpers, ScuroCoordinatorHelpers } from "./internal/types";

export interface PokerInitialDealProof {
  deckCommitment: Hex;
  handNonce: Hex;
  handCommitments: readonly [Hex, Hex];
  encryptionKeyCommitments: readonly [Hex, Hex];
  ciphertextRefs: readonly [Hex, Hex];
  proof: Hex;
}

export interface PokerDrawProof {
  player: Address;
  newCommitment: Hex;
  newEncryptionKeyCommitment: Hex;
  newCiphertextRef: Hex;
  proof: Hex;
}

export interface PokerShowdownProof {
  winnerAddr: Address;
  isTie: boolean;
  proof: Hex;
}

export interface PokerProofProvider {
  provideInitialDeal(snapshot: Awaited<ReturnType<ReturnType<typeof createContractHelpers>["inspect"]["pokerGame"]>>): Promise<PokerInitialDealProof>;
  provideDraw(snapshot: Awaited<ReturnType<ReturnType<typeof createContractHelpers>["inspect"]["pokerGame"]>> & { player: Address; playerIndex: 0 | 1 }): Promise<PokerDrawProof>;
  provideShowdown(snapshot: Awaited<ReturnType<ReturnType<typeof createContractHelpers>["inspect"]["pokerGame"]>>): Promise<PokerShowdownProof>;
}

export interface BlackjackInitialDealProof {
  deckCommitment: Hex;
  handNonce: Hex;
  playerStateCommitment: Hex;
  dealerStateCommitment: Hex;
  playerCiphertextRef: Hex;
  dealerCiphertextRef: Hex;
  dealerVisibleValue: bigint;
  handCount: number;
  activeHandIndex: number;
  payout: bigint;
  immediateResultCode: number;
  handValues: readonly [bigint, bigint, bigint, bigint];
  handStatuses: readonly [number, number, number, number];
  allowedActionMasks: readonly [number, number, number, number];
  softMask: bigint;
  proof: Hex;
}

export interface BlackjackActionProof {
  kind: "action";
  args: {
    newPlayerStateCommitment: Hex;
    dealerStateCommitment: Hex;
    playerCiphertextRef: Hex;
    dealerCiphertextRef: Hex;
    dealerVisibleValue: bigint;
    handCount: number;
    activeHandIndex: number;
    nextPhase: number;
    handValues: readonly [bigint, bigint, bigint, bigint];
    handStatuses: readonly [number, number, number, number];
    allowedActionMasks: readonly [number, number, number, number];
    softMask: bigint;
    proof: Hex;
  };
}

export interface BlackjackShowdownProof {
  kind: "showdown";
  args: {
    playerStateCommitment: Hex;
    dealerStateCommitment: Hex;
    payout: bigint;
    dealerFinalValue: bigint;
    handCount: number;
    activeHandIndex: number;
    handStatuses: readonly [number, number, number, number];
    proof: Hex;
  };
}

export interface BlackjackProofProvider {
  provideInitialDeal(snapshot: Awaited<ReturnType<ReturnType<typeof createContractHelpers>["inspect"]["blackjackSession"]>>): Promise<BlackjackInitialDealProof>;
  provideNext(snapshot: Awaited<ReturnType<ReturnType<typeof createContractHelpers>["inspect"]["blackjackSession"]>>): Promise<BlackjackActionProof | BlackjackShowdownProof>;
}

export interface CoordinatorStepResult {
  status: "submitted" | "idle";
  action: string;
  txHash?: Hex;
}

export function createPokerCoordinator(args: {
  contracts: ScuroContractHelpers;
  mode: "pvp" | "tournament";
  proofProvider: PokerProofProvider;
  resolvePlayers?: (gameId: bigint) => Promise<readonly [Address, Address]>;
}) {
  const settled = new Set<string>();

  async function getPlayers(gameId: bigint): Promise<readonly [Address, Address]> {
    if (args.mode === "pvp") {
      const session = (await args.contracts.read.pvp.session(gameId)) as any;
      return [session.player1, session.player2];
    }

    if (!args.resolvePlayers) {
      throw new InvalidLifecycleStateError("Tournament poker coordination requires resolvePlayers(gameId).");
    }

    return args.resolvePlayers(gameId);
  }

  async function snapshot(gameId: bigint) {
    return args.contracts.inspect.pokerGame(gameId, args.mode);
  }

  async function step(gameId: bigint): Promise<CoordinatorStepResult> {
    const current = await snapshot(gameId);
    const now = await args.contracts.publicClient.getBlock().then((block) => block.timestamp);

    if (current.isGameOver) {
      if (args.mode === "pvp") {
        const alreadySettled = await args.contracts.read.pvp.sessionSettled(gameId);
        if (alreadySettled) {
          return { status: "idle", action: "already-settled" };
        }
        const txHash = await args.contracts.write.settlePvPSession(gameId);
        return { status: "submitted", action: "settle-pvp-session", txHash };
      }

      if (settled.has(gameId.toString())) {
        return { status: "idle", action: "already-reported" };
      }

      const txHash = await args.contracts.write.reportTournamentOutcome(gameId);
      settled.add(gameId.toString());
      return { status: "submitted", action: "report-tournament-outcome", txHash };
    }

    if (current.phaseLabel === "AwaitingInitialDeal") {
      const proof = await args.proofProvider.provideInitialDeal(current);
      const txHash = await args.contracts.write.pokerSubmitInitialDealProof(gameId, proof, args.mode);
      return { status: "submitted", action: "submit-initial-deal-proof", txHash };
    }

    if (current.phaseLabel === "DrawProofPending") {
      const players = await getPlayers(gameId);
      const handState = current.handState as any;
      const unresolvedIndex = handState.drawDeclared.findIndex(
        (declared: boolean, index: number) => declared && !handState.drawResolved[index]
      );
      if (unresolvedIndex === -1) {
        return { status: "idle", action: "no-draw-proof-needed" };
      }
      const playerIndex = unresolvedIndex as 0 | 1;
      const proof = await args.proofProvider.provideDraw({
        ...current,
        player: players[playerIndex],
        playerIndex
      });
      const txHash = await args.contracts.write.pokerSubmitDrawProof(gameId, proof, args.mode);
      return { status: "submitted", action: "submit-draw-proof", txHash };
    }

    if (current.phaseLabel === "ShowdownProofPending") {
      const proof = await args.proofProvider.provideShowdown(current);
      const txHash = await args.contracts.write.pokerSubmitShowdownProof(gameId, proof, args.mode);
      return { status: "submitted", action: "submit-showdown-proof", txHash };
    }

    if (isPokerPlayerClockPhase(current.phaseLabel) && (current.proofDeadline as bigint) <= now) {
      const txHash = await args.contracts.write.pokerClaimTimeout(gameId, args.mode);
      return { status: "submitted", action: "claim-poker-timeout", txHash };
    }

    return { status: "idle", action: "waiting-for-player-or-proof" };
  }

  async function runUntilIdle(gameId: bigint, maxSteps = 10) {
    const results: CoordinatorStepResult[] = [];
    for (let index = 0; index < maxSteps; index += 1) {
      const result = await step(gameId);
      results.push(result);
      if (result.status === "idle") {
        break;
      }
    }
    return results;
  }

  return {
    snapshot,
    step,
    runUntilIdle
  };
}

export function createBlackjackCoordinator(args: {
  contracts: ScuroContractHelpers;
  proofProvider: BlackjackProofProvider;
}) {
  async function snapshot(sessionId: bigint) {
    return args.contracts.inspect.blackjackSession(sessionId);
  }

  async function step(sessionId: bigint): Promise<CoordinatorStepResult> {
    const current = await snapshot(sessionId);
    const now = await args.contracts.publicClient.getBlock().then((block) => block.timestamp);

    if ((current.settlementOutcome as any).completed && !current.sessionSettled) {
      const txHash = await args.contracts.write.blackjackSettle(sessionId);
      return { status: "submitted", action: "settle-blackjack-session", txHash };
    }

    if (current.phaseLabel === "AwaitingInitialDeal") {
      const proof = await args.proofProvider.provideInitialDeal(current);
      const txHash = await args.contracts.write.blackjackSubmitInitialDealProof(sessionId, proof);
      return { status: "submitted", action: "submit-blackjack-initial-deal-proof", txHash };
    }

    if (current.phaseLabel === "AwaitingCoordinator") {
      const nextProof = await args.proofProvider.provideNext(current);
      if (nextProof.kind === "action") {
        const txHash = await args.contracts.write.blackjackSubmitActionProof(sessionId, nextProof.args);
        return { status: "submitted", action: "submit-blackjack-action-proof", txHash };
      }

      const txHash = await args.contracts.write.blackjackSubmitShowdownProof(sessionId, nextProof.args);
      return { status: "submitted", action: "submit-blackjack-showdown-proof", txHash };
    }

    if (current.phaseLabel === "AwaitingPlayerAction" && (current.session as any).deadlineAt <= now) {
      const txHash = await args.contracts.write.blackjackClaimTimeout(sessionId);
      return { status: "submitted", action: "claim-blackjack-timeout", txHash };
    }

    return { status: "idle", action: "waiting-for-player-or-proof" };
  }

  async function runUntilIdle(sessionId: bigint, maxSteps = 10) {
    const results: CoordinatorStepResult[] = [];
    for (let index = 0; index < maxSteps; index += 1) {
      const result = await step(sessionId);
      results.push(result);
      if (result.status === "idle") {
        break;
      }
    }
    return results;
  }

  return {
    snapshot,
    step,
    runUntilIdle
  };
}

export function createCoordinatorHelpers(options: CreateScuroClientOptions): ScuroCoordinatorHelpers {
  const contracts = createContractHelpers(options);
  return {
    poker: (args: Omit<Parameters<typeof createPokerCoordinator>[0], "contracts">) =>
      createPokerCoordinator({ ...args, contracts }),
    blackjack: (args: Omit<Parameters<typeof createBlackjackCoordinator>[0], "contracts">) =>
      createBlackjackCoordinator({ ...args, contracts })
  };
}
