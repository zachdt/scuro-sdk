import type { Address, Hex } from "viem";

import { createContractHelpers } from "./contracts";
import { developerExpressionRegistryAbi } from "./generated/abis";
import { InvalidLifecycleStateError } from "./internal/errors";
import type { CreateScuroClientOptions, ScuroFlowHelpers } from "./internal/types";

export function createFlowHelpers(options: CreateScuroClientOptions): ScuroFlowHelpers {
  const contracts = createContractHelpers(options);

  return {
    staking: {
      prepareApproveAndStake(args: { approveAmount: bigint; stakeAmount: bigint; delegatee?: Address }) {
        const txs = [contracts.encode.approveStaking(args.approveAmount), contracts.encode.stake(args.stakeAmount)];
        if (args.delegatee) {
          txs.push(contracts.encode.delegateGovernance(args.delegatee));
        }
        return txs;
      }
    },
    governance: {
      async readConfig() {
        const [proposalThreshold, votingDelay, votingPeriod] = await Promise.all([
          contracts.read.governance.proposalThreshold(),
          contracts.read.governance.votingDelay(),
          contracts.read.governance.votingPeriod()
        ]);

        return {
          proposalThreshold,
          votingDelay,
          votingPeriod
        };
      }
    },
    expressions: {
      registry: contracts.instances.developerExpressionRegistry,
      async isCompatible(engineType: Hex, expressionTokenId: bigint) {
        return options.publicClient.readContract({
          address: contracts.deployment.contracts.DeveloperExpressionRegistry!,
          abi: developerExpressionRegistryAbi,
          functionName: "isExpressionCompatible",
          args: [engineType, expressionTokenId]
        });
      }
    },
    numberPicker: {
      preparePlay: contracts.encode.numberPickerPlay,
      prepareFinalize: contracts.encode.numberPickerFinalize,
      inspectRequest: async (requestId: bigint) => {
        const [outcome, settlementOutcome, expressionTokenId, settled] = await Promise.all([
          contracts.read.numberPicker.outcome(requestId),
          contracts.read.numberPicker.settlementOutcome(requestId),
          contracts.read.numberPicker.requestExpressionTokenId(requestId),
          contracts.read.numberPicker.requestSettled(requestId)
        ]);

        return {
          outcome,
          settlementOutcome,
          expressionTokenId,
          settled
        };
      }
    },
    slotMachine: {
      prepareSpin: contracts.encode.slotMachineSpin,
      prepareRegisterPreset: contracts.encode.slotMachineRegisterPreset,
      prepareSetPresetActive: contracts.encode.slotMachineSetPresetActive,
      prepareSettlement: async (spinId: bigint) => {
        const snapshot = await contracts.inspect.slotMachineSpin(spinId);
        if (snapshot.settled) {
          throw new InvalidLifecycleStateError("Slot spin is already settled.", { spinId: spinId.toString() });
        }
        if (!snapshot.settlementOutcome.completed) {
          throw new InvalidLifecycleStateError("Slot spin is not ready to settle.", { spinId: spinId.toString() });
        }
        return contracts.encode.slotMachineSettle(spinId);
      },
      inspectSpin: contracts.inspect.slotMachineSpin
    },
    superBaccarat: {
      preparePlay: contracts.encode.superBaccaratPlay,
      prepareSettlement: async (sessionId: bigint) => {
        const snapshot = await contracts.inspect.superBaccaratSession(sessionId);
        if (snapshot.sessionSettled) {
          throw new InvalidLifecycleStateError("Super baccarat session is already settled.", { sessionId: sessionId.toString() });
        }
        if (!snapshot.settlementOutcome.completed) {
          throw new InvalidLifecycleStateError("Super baccarat session is not ready to settle.", { sessionId: sessionId.toString() });
        }
        return contracts.encode.superBaccaratSettle(sessionId);
      },
      inspectSession: contracts.inspect.superBaccaratSession
    },
    cheminDeFer: {
      prepareOpenTable: contracts.encode.cheminDeFerOpenTable,
      prepareTake: contracts.encode.cheminDeFerTake,
      prepareCloseTable: contracts.encode.cheminDeFerCloseTable,
      prepareForceCloseTable: contracts.encode.cheminDeFerForceCloseTable,
      prepareCancelTable: contracts.encode.cheminDeFerCancelTable,
      prepareSettlement: async (tableId: bigint) => {
        const snapshot = await contracts.inspect.cheminDeFerTable(tableId);
        if (snapshot.table.settled) {
          throw new InvalidLifecycleStateError("Chemin de fer table is already settled.", { tableId: tableId.toString() });
        }
        if (!snapshot.table.closed) {
          throw new InvalidLifecycleStateError("Chemin de fer table is still open.", { tableId: tableId.toString() });
        }
        if (!snapshot.resolved) {
          throw new InvalidLifecycleStateError("Chemin de fer table is not ready to settle.", { tableId: tableId.toString() });
        }
        return contracts.encode.cheminDeFerSettle(tableId);
      },
      inspectTable: contracts.inspect.cheminDeFerTable
    },
    pvp: {
      prepareCreateSession: contracts.encode.createPvPSession,
      prepareSettlement: async (sessionId: bigint) => {
        const isGameOver = await contracts.read.pokerEngine.isGameOver(sessionId, "pvp");
        if (!isGameOver) {
          throw new InvalidLifecycleStateError("PvP session is not ready to settle.", { sessionId: sessionId.toString() });
        }
        return contracts.encode.settlePvPSession(sessionId);
      },
      inspectSession: async (sessionId: bigint) => {
        const [session, settled, poker] = await Promise.all([
          contracts.read.pvp.session(sessionId),
          contracts.read.pvp.sessionSettled(sessionId),
          contracts.inspect.pokerGame(sessionId, "pvp")
        ]);

        return {
          session,
          settled,
          ...poker
        };
      }
    },
    tournament: {
      prepareCreateTournament: contracts.encode.createTournament,
      prepareStartGame: contracts.encode.startTournamentGame,
      prepareSettlement: async (gameId: bigint) => {
        const isGameOver = await contracts.read.pokerEngine.isGameOver(gameId, "tournament");
        if (!isGameOver) {
          throw new InvalidLifecycleStateError("Tournament game is not ready to report.", { gameId: gameId.toString() });
        }
        return contracts.encode.reportTournamentOutcome(gameId);
      },
      inspectGame: async (gameId: bigint) => {
        const [tournamentId, poker] = await Promise.all([
          contracts.read.tournament.gameToTournament(gameId),
          contracts.inspect.pokerGame(gameId, "tournament")
        ]);

        return {
          tournamentId,
          ...poker
        };
      }
    },
    blackjack: {
      prepareStartHand: contracts.encode.startBlackjackHand,
      prepareAction: async (
        sessionId: bigint,
        action: "hit" | "stand" | "doubleDown" | "split"
      ) => {
        const snapshot = await contracts.inspect.blackjackSession(sessionId);
        if (action === "hit") {
          contracts.helpers.assertBlackjackPlayerAction(snapshot, "ALLOW_HIT");
          return contracts.encode.blackjackHit(sessionId);
        }
        if (action === "stand") {
          contracts.helpers.assertBlackjackPlayerAction(snapshot, "ALLOW_STAND");
          return contracts.encode.blackjackStand(sessionId);
        }
        if (action === "doubleDown") {
          contracts.helpers.assertBlackjackPlayerAction(snapshot, "ALLOW_DOUBLE");
          return contracts.encode.blackjackDoubleDown(sessionId);
        }
        contracts.helpers.assertBlackjackPlayerAction(snapshot, "ALLOW_SPLIT");
        return contracts.encode.blackjackSplit(sessionId);
      },
      prepareSettlement: async (sessionId: bigint) => {
        const snapshot = await contracts.inspect.blackjackSession(sessionId);
        if (!snapshot.settlementOutcome.completed) {
          throw new InvalidLifecycleStateError("Blackjack session is not ready to settle.", { sessionId: sessionId.toString() });
        }
        return contracts.encode.blackjackSettle(sessionId);
      },
      inspectSession: contracts.inspect.blackjackSession
    }
  };
}
