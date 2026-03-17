import {
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient
} from "viem";

import {
  blackjackControllerAbi,
  blackjackVerifierBundleAbi,
  developerExpressionRegistryAbi,
  developerRewardsAbi,
  gameCatalogAbi,
  gameDeploymentFactoryAbi,
  numberPickerAdapterAbi,
  numberPickerEngineAbi,
  pokerVerifierBundleAbi,
  protocolSettlementAbi,
  pvPControllerAbi,
  scuroGovernorAbi,
  scuroStakingTokenAbi,
  scuroTokenAbi,
  singleDeckBlackjackEngineAbi,
  singleDraw2To7EngineAbi,
  tournamentControllerAbi
} from "./generated/abis";
import { eventSignatures } from "./generated/protocol";
import type { CreateScuroClientOptions, PreparedTransactionRequest, ScuroContractHelpers } from "./internal/types";
import { InvalidLifecycleStateError, UnsupportedFactoryFamilyError } from "./internal/errors";
import { ensureWalletClient, nowSeconds } from "./internal/utils";
import {
  decodeBlackjackActionMask,
  decodeBlackjackSessionPhase,
  decodePokerHandPhase
} from "./internal/enums";
import {
  normalizeDeploymentLabels,
  requireDeploymentAddress,
  requireExpressionId,
  requireModuleId
} from "./registry";

const pokerDeploymentParams = parseAbiParameters(
  "address coordinator, uint256 smallBlind, uint256 bigBlind, uint256 blindEscalationInterval, uint256 actionWindow, bytes32 configHash, uint16 developerRewardBps"
);
const numberPickerDeploymentParams = parseAbiParameters(
  "address vrfCoordinator, bytes32 configHash, uint16 developerRewardBps"
);
const blackjackDeploymentParams = parseAbiParameters(
  "address coordinator, uint256 defaultActionWindow, bytes32 configHash, uint16 developerRewardBps"
);

const FACTORY_FAMILIES = {
  solo: {
    NumberPicker: 0,
    Blackjack: 1
  },
  match: {
    PokerSingleDraw2To7: 0
  }
} as const;

type ContractContext = {
  publicClient: PublicClient;
  walletClient: WalletClient | undefined;
  deployment: ReturnType<typeof normalizeDeploymentLabels>;
};

function buildTx(address: Address, abi: Abi, functionName: string, args: readonly unknown[] = []): PreparedTransactionRequest {
  return {
    to: address,
    data: encodeFunctionData({
      abi,
      functionName,
      args
    })
  };
}

async function writeContract(
  walletClient: WalletClient | undefined,
  address: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = []
) {
  return ensureWalletClient(walletClient).writeContract({
    address,
    abi,
    functionName,
    args,
    chain: walletClient?.chain,
    account: walletClient?.account ?? null
  });
}

function createInstances({ publicClient, walletClient, deployment }: ContractContext) {
  const descriptor = (address: Address, abi: Abi) => ({
    address,
    abi,
    publicClient,
    walletClient
  });

  return {
    scuroToken: () => descriptor(requireDeploymentAddress(deployment, "ScuroToken"), scuroTokenAbi as Abi),
    scuroStakingToken: () => descriptor(requireDeploymentAddress(deployment, "ScuroStakingToken"), scuroStakingTokenAbi as Abi),
    scuroGovernor: () => descriptor(requireDeploymentAddress(deployment, "ScuroGovernor"), scuroGovernorAbi as Abi),
    protocolSettlement: () => descriptor(requireDeploymentAddress(deployment, "ProtocolSettlement"), protocolSettlementAbi as Abi),
    gameCatalog: () => descriptor(requireDeploymentAddress(deployment, "GameCatalog"), gameCatalogAbi as Abi),
    gameDeploymentFactory: () => descriptor(requireDeploymentAddress(deployment, "GameDeploymentFactory"), gameDeploymentFactoryAbi as Abi),
    developerExpressionRegistry: () =>
      descriptor(requireDeploymentAddress(deployment, "DeveloperExpressionRegistry"), developerExpressionRegistryAbi as Abi),
    developerRewards: () => descriptor(requireDeploymentAddress(deployment, "DeveloperRewards"), developerRewardsAbi as Abi),
    numberPickerAdapter: () => descriptor(requireDeploymentAddress(deployment, "NumberPickerAdapter"), numberPickerAdapterAbi as Abi),
    numberPickerEngine: () => descriptor(requireDeploymentAddress(deployment, "NumberPickerEngine"), numberPickerEngineAbi as Abi),
    tournamentController: () => descriptor(requireDeploymentAddress(deployment, "TournamentController"), tournamentControllerAbi as Abi),
    tournamentPokerEngine: () => descriptor(requireDeploymentAddress(deployment, "TournamentPokerEngine"), singleDraw2To7EngineAbi as Abi),
    tournamentPokerVerifierBundle: () =>
      descriptor(requireDeploymentAddress(deployment, "TournamentPokerVerifierBundle"), pokerVerifierBundleAbi as Abi),
    pvpController: () => descriptor(requireDeploymentAddress(deployment, "PvPController"), pvPControllerAbi as Abi),
    pvpPokerEngine: () => descriptor(requireDeploymentAddress(deployment, "PvPPokerEngine"), singleDraw2To7EngineAbi as Abi),
    pvpPokerVerifierBundle: () =>
      descriptor(requireDeploymentAddress(deployment, "PvPPokerVerifierBundle"), pokerVerifierBundleAbi as Abi),
    blackjackController: () => descriptor(requireDeploymentAddress(deployment, "BlackjackController"), blackjackControllerAbi as Abi),
    blackjackEngine: () =>
      descriptor(requireDeploymentAddress(deployment, "SingleDeckBlackjackEngine"), singleDeckBlackjackEngineAbi as Abi),
    blackjackVerifierBundle: () =>
      descriptor(requireDeploymentAddress(deployment, "BlackjackVerifierBundle"), blackjackVerifierBundleAbi as Abi)
  };
}

export function decodeScuroEventLog(
  contract:
    | keyof typeof eventSignatures
    | "TournamentPokerEngine"
    | "PvPPokerEngine"
    | "TournamentPokerVerifierBundle"
    | "PvPPokerVerifierBundle",
  log: { data: Hex; topics: readonly Hex[] }
) {
  const abiMap = {
    TournamentPokerEngine: singleDraw2To7EngineAbi,
    PvPPokerEngine: singleDraw2To7EngineAbi,
    TournamentPokerVerifierBundle: pokerVerifierBundleAbi,
    PvPPokerVerifierBundle: pokerVerifierBundleAbi,
    ProtocolSettlement: protocolSettlementAbi,
    GameCatalog: gameCatalogAbi,
    GameDeploymentFactory: gameDeploymentFactoryAbi,
    GameEngineRegistry: [] as const,
    DeveloperExpressionRegistry: developerExpressionRegistryAbi,
    DeveloperRewards: developerRewardsAbi,
    ScuroToken: scuroTokenAbi,
    ScuroStakingToken: scuroStakingTokenAbi,
    ScuroGovernor: scuroGovernorAbi,
    NumberPickerAdapter: numberPickerAdapterAbi,
    NumberPickerEngine: numberPickerEngineAbi,
    TournamentController: tournamentControllerAbi,
    PvPController: pvPControllerAbi,
    BlackjackController: blackjackControllerAbi,
    SingleDeckBlackjackEngine: singleDeckBlackjackEngineAbi,
    PokerVerifierBundle: pokerVerifierBundleAbi,
    BlackjackVerifierBundle: blackjackVerifierBundleAbi
  } as Record<string, Abi>;

  return decodeEventLog({
    abi: abiMap[contract] ?? ([] as unknown as Abi),
    data: log.data,
    topics: log.topics as [Hex, ...Hex[]]
  });
}

export function encodeNumberPickerDeployment(params: {
  vrfCoordinator: Address;
  configHash: Hex;
  developerRewardBps: number;
}) {
  return encodeAbiParameters(numberPickerDeploymentParams, [
    params.vrfCoordinator,
    params.configHash,
    params.developerRewardBps
  ]);
}

export function encodeBlackjackDeployment(params: {
  coordinator: Address;
  defaultActionWindow: bigint;
  configHash: Hex;
  developerRewardBps: number;
}) {
  return encodeAbiParameters(blackjackDeploymentParams, [
    params.coordinator,
    params.defaultActionWindow,
    params.configHash,
    params.developerRewardBps
  ]);
}

export function encodePokerDeployment(params: {
  coordinator: Address;
  smallBlind: bigint;
  bigBlind: bigint;
  blindEscalationInterval: bigint;
  actionWindow: bigint;
  configHash: Hex;
  developerRewardBps: number;
}) {
  return encodeAbiParameters(pokerDeploymentParams, [
    params.coordinator,
    params.smallBlind,
    params.bigBlind,
    params.blindEscalationInterval,
    params.actionWindow,
    params.configHash,
    params.developerRewardBps
  ]);
}

export function createContractHelpers(options: CreateScuroClientOptions): ScuroContractHelpers {
  const deployment = normalizeDeploymentLabels(options.deployment);
  const context: ContractContext = {
    publicClient: options.publicClient,
    walletClient: options.walletClient,
    deployment
  };
  const instances = createInstances(context);

  const read = {
    governance: {
      proposalThreshold: () =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "ScuroGovernor"),
          abi: scuroGovernorAbi as Abi,
          functionName: "proposalThreshold"
        }),
      quorum: (blockNumber: bigint) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "ScuroGovernor"),
          abi: scuroGovernorAbi as Abi,
          functionName: "quorum",
          args: [blockNumber]
        }),
      state: (proposalId: bigint) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "ScuroGovernor"),
          abi: scuroGovernorAbi as Abi,
          functionName: "state",
          args: [proposalId]
        }),
      votingDelay: () =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "ScuroGovernor"),
          abi: scuroGovernorAbi as Abi,
          functionName: "votingDelay"
        }),
      votingPeriod: () =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "ScuroGovernor"),
          abi: scuroGovernorAbi as Abi,
          functionName: "votingPeriod"
        })
    },
    catalog: {
      getModule: (moduleId: bigint) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "GameCatalog"),
          abi: gameCatalogAbi as Abi,
          functionName: "getModule",
          args: [moduleId]
        }),
      getModuleByController: (controller: Address) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "GameCatalog"),
          abi: gameCatalogAbi as Abi,
          functionName: "getModuleByController",
          args: [controller]
        }),
      getModuleByEngine: (engine: Address) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "GameCatalog"),
          abi: gameCatalogAbi as Abi,
          functionName: "getModuleByEngine",
          args: [engine]
        }),
      isLaunchableController: (controller: Address) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "GameCatalog"),
          abi: gameCatalogAbi as Abi,
          functionName: "isLaunchableController",
          args: [controller]
        }),
      isSettlableController: (controller: Address) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "GameCatalog"),
          abi: gameCatalogAbi as Abi,
          functionName: "isSettlableController",
          args: [controller]
        }),
      isAuthorizedControllerForEngine: (controller: Address, engine: Address) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "GameCatalog"),
          abi: gameCatalogAbi as Abi,
          functionName: "isAuthorizedControllerForEngine",
          args: [controller, engine]
        })
    },
    numberPicker: {
      outcome: (requestId: bigint) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "NumberPickerEngine"),
          abi: numberPickerEngineAbi as Abi,
          functionName: "getOutcome",
          args: [requestId]
        }),
      settlementOutcome: (requestId: bigint) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "NumberPickerEngine"),
          abi: numberPickerEngineAbi as Abi,
          functionName: "getSettlementOutcome",
          args: [requestId]
        }),
      requestExpressionTokenId: (requestId: bigint) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "NumberPickerAdapter"),
          abi: numberPickerAdapterAbi as Abi,
          functionName: "requestExpressionTokenId",
          args: [requestId]
        }),
      requestSettled: (requestId: bigint) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "NumberPickerAdapter"),
          abi: numberPickerAdapterAbi as Abi,
          functionName: "requestSettled",
          args: [requestId]
        })
    },
    pvp: {
      session: (sessionId: bigint) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "PvPController"),
          abi: pvPControllerAbi as Abi,
          functionName: "sessions",
          args: [sessionId]
        }),
      sessionSettled: (sessionId: bigint) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "PvPController"),
          abi: pvPControllerAbi as Abi,
          functionName: "sessionSettled",
          args: [sessionId]
        })
    },
    tournament: {
      tournament: (tournamentId: bigint) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "TournamentController"),
          abi: tournamentControllerAbi as Abi,
          functionName: "tournaments",
          args: [tournamentId]
        }),
      gameToTournament: (gameId: bigint) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "TournamentController"),
          abi: tournamentControllerAbi as Abi,
          functionName: "gameToTournament",
          args: [gameId]
        })
    },
    pokerEngine: {
      game: (gameId: bigint, mode: "pvp" | "tournament" = "pvp") =>
        options.publicClient.readContract({
          address:
            mode === "pvp"
              ? requireDeploymentAddress(deployment, "PvPPokerEngine")
              : requireDeploymentAddress(deployment, "TournamentPokerEngine"),
          abi: singleDraw2To7EngineAbi as Abi,
          functionName: "games",
          args: [gameId]
        }),
      handState: (gameId: bigint, mode: "pvp" | "tournament" = "pvp") =>
        options.publicClient.readContract({
          address:
            mode === "pvp"
              ? requireDeploymentAddress(deployment, "PvPPokerEngine")
              : requireDeploymentAddress(deployment, "TournamentPokerEngine"),
          abi: singleDraw2To7EngineAbi as Abi,
          functionName: "getHandState",
          args: [gameId]
        }),
      currentPhase: async (gameId: bigint, mode: "pvp" | "tournament" = "pvp") =>
        decodePokerHandPhase(
          (await options.publicClient.readContract({
            address:
              mode === "pvp"
                ? requireDeploymentAddress(deployment, "PvPPokerEngine")
                : requireDeploymentAddress(deployment, "TournamentPokerEngine"),
            abi: singleDraw2To7EngineAbi as Abi,
            functionName: "getCurrentPhase",
            args: [gameId]
          })) as any
        ),
      proofDeadline: (gameId: bigint, mode: "pvp" | "tournament" = "pvp") =>
        options.publicClient.readContract({
          address:
            mode === "pvp"
              ? requireDeploymentAddress(deployment, "PvPPokerEngine")
              : requireDeploymentAddress(deployment, "TournamentPokerEngine"),
          abi: singleDraw2To7EngineAbi as Abi,
          functionName: "getProofDeadline",
          args: [gameId]
        }),
      isGameOver: (gameId: bigint, mode: "pvp" | "tournament" = "pvp") =>
        options.publicClient.readContract({
          address:
            mode === "pvp"
              ? requireDeploymentAddress(deployment, "PvPPokerEngine")
              : requireDeploymentAddress(deployment, "TournamentPokerEngine"),
          abi: singleDraw2To7EngineAbi as Abi,
          functionName: "isGameOver",
          args: [gameId]
        }),
      outcomes: (gameId: bigint, mode: "pvp" | "tournament" = "pvp") =>
        options.publicClient.readContract({
          address:
            mode === "pvp"
              ? requireDeploymentAddress(deployment, "PvPPokerEngine")
              : requireDeploymentAddress(deployment, "TournamentPokerEngine"),
          abi: singleDraw2To7EngineAbi as Abi,
          functionName: "getOutcomes",
          args: [gameId]
        })
    },
    blackjack: {
      session: (sessionId: bigint) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "SingleDeckBlackjackEngine"),
          abi: singleDeckBlackjackEngineAbi as Abi,
          functionName: "getSession",
          args: [sessionId]
        }),
      settlementOutcome: (sessionId: bigint) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "SingleDeckBlackjackEngine"),
          abi: singleDeckBlackjackEngineAbi as Abi,
          functionName: "getSettlementOutcome",
          args: [sessionId]
        }),
      requiredAdditionalBurn: (sessionId: bigint, action: number) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "SingleDeckBlackjackEngine"),
          abi: singleDeckBlackjackEngineAbi as Abi,
          functionName: "requiredAdditionalBurn",
          args: [sessionId, action]
        }),
      sessionSettled: (sessionId: bigint) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "BlackjackController"),
          abi: blackjackControllerAbi as Abi,
          functionName: "sessionSettled",
          args: [sessionId]
        }),
      sessionExpressionTokenId: (sessionId: bigint) =>
        options.publicClient.readContract({
          address: requireDeploymentAddress(deployment, "BlackjackController"),
          abi: blackjackControllerAbi as Abi,
          functionName: "sessionExpressionTokenId",
          args: [sessionId]
        })
    }
  };

  const encode = {
    approveSettlement: (amount: bigint) =>
      buildTx(requireDeploymentAddress(deployment, "ScuroToken"), scuroTokenAbi as Abi, "approve", [
        requireDeploymentAddress(deployment, "ProtocolSettlement"),
        amount
      ]),
    approveStaking: (amount: bigint) =>
      buildTx(requireDeploymentAddress(deployment, "ScuroToken"), scuroTokenAbi as Abi, "approve", [
        requireDeploymentAddress(deployment, "ScuroStakingToken"),
        amount
      ]),
    stake: (amount: bigint) =>
      buildTx(requireDeploymentAddress(deployment, "ScuroStakingToken"), scuroStakingTokenAbi as Abi, "stake", [amount]),
    unstake: (amount: bigint) =>
      buildTx(requireDeploymentAddress(deployment, "ScuroStakingToken"), scuroStakingTokenAbi as Abi, "unstake", [amount]),
    delegateGovernance: (delegatee: Address) =>
      buildTx(requireDeploymentAddress(deployment, "ScuroStakingToken"), scuroStakingTokenAbi as Abi, "delegate", [
        delegatee
      ]),
    numberPickerPlay: (args: {
      wager: bigint;
      selection: bigint;
      playRef: Hex;
      expressionTokenId?: bigint;
    }) =>
      buildTx(requireDeploymentAddress(deployment, "NumberPickerAdapter"), numberPickerAdapterAbi as Abi, "play", [
        args.wager,
        args.selection,
        args.playRef,
        args.expressionTokenId ?? requireExpressionId(deployment, "NumberPickerExpressionTokenId")
      ]),
    numberPickerFinalize: (requestId: bigint) =>
      buildTx(requireDeploymentAddress(deployment, "NumberPickerAdapter"), numberPickerAdapterAbi as Abi, "finalize", [
        requestId
      ]),
    createTournament: (args: {
      entryFee: bigint;
      rewardPool: bigint;
      startingStack: bigint;
      expressionTokenId?: bigint;
    }) =>
      buildTx(requireDeploymentAddress(deployment, "TournamentController"), tournamentControllerAbi as Abi, "createTournament", [
        args.entryFee,
        args.rewardPool,
        args.startingStack,
        args.expressionTokenId ?? requireExpressionId(deployment, "PokerExpressionTokenId")
      ]),
    setTournamentActive: (tournamentId: bigint, active: boolean) =>
      buildTx(requireDeploymentAddress(deployment, "TournamentController"), tournamentControllerAbi as Abi, "setTournamentActive", [
        tournamentId,
        active
      ]),
    startTournamentGame: (tournamentId: bigint, p1: Address, p2: Address) =>
      buildTx(requireDeploymentAddress(deployment, "TournamentController"), tournamentControllerAbi as Abi, "startGameForPlayers", [
        tournamentId,
        p1,
        p2
      ]),
    reportTournamentOutcome: (gameId: bigint) =>
      buildTx(requireDeploymentAddress(deployment, "TournamentController"), tournamentControllerAbi as Abi, "reportOutcome", [
        gameId
      ]),
    createPvPSession: (args: {
      player1: Address;
      player2: Address;
      stake: bigint;
      rewardPool: bigint;
      startingStack: bigint;
      expressionTokenId?: bigint;
    }) =>
      buildTx(requireDeploymentAddress(deployment, "PvPController"), pvPControllerAbi as Abi, "createSession", [
        args.player1,
        args.player2,
        args.stake,
        args.rewardPool,
        args.startingStack,
        args.expressionTokenId ?? requireExpressionId(deployment, "PokerExpressionTokenId")
      ]),
    settlePvPSession: (sessionId: bigint) =>
      buildTx(requireDeploymentAddress(deployment, "PvPController"), pvPControllerAbi as Abi, "settleSession", [sessionId]),
    startBlackjackHand: (args: {
      wager: bigint;
      playRef: Hex;
      playerKeyCommitment: Hex;
      expressionTokenId?: bigint;
    }) =>
      buildTx(requireDeploymentAddress(deployment, "BlackjackController"), blackjackControllerAbi as Abi, "startHand", [
        args.wager,
        args.playRef,
        args.playerKeyCommitment,
        args.expressionTokenId ?? requireExpressionId(deployment, "BlackjackExpressionTokenId")
      ]),
    blackjackHit: (sessionId: bigint) =>
      buildTx(requireDeploymentAddress(deployment, "BlackjackController"), blackjackControllerAbi as Abi, "hit", [sessionId]),
    blackjackStand: (sessionId: bigint) =>
      buildTx(requireDeploymentAddress(deployment, "BlackjackController"), blackjackControllerAbi as Abi, "stand", [sessionId]),
    blackjackDoubleDown: (sessionId: bigint) =>
      buildTx(requireDeploymentAddress(deployment, "BlackjackController"), blackjackControllerAbi as Abi, "doubleDown", [
        sessionId
      ]),
    blackjackSplit: (sessionId: bigint) =>
      buildTx(requireDeploymentAddress(deployment, "BlackjackController"), blackjackControllerAbi as Abi, "split", [sessionId]),
    blackjackClaimTimeout: (sessionId: bigint) =>
      buildTx(requireDeploymentAddress(deployment, "BlackjackController"), blackjackControllerAbi as Abi, "claimPlayerTimeout", [
        sessionId
      ]),
    blackjackSettle: (sessionId: bigint) =>
      buildTx(requireDeploymentAddress(deployment, "BlackjackController"), blackjackControllerAbi as Abi, "settle", [sessionId]),
    burnPlayerWager: (player: Address, amount: bigint, controller: Address) =>
      buildTx(requireDeploymentAddress(deployment, "ProtocolSettlement"), protocolSettlementAbi as Abi, "burnPlayerWager", [
        player,
        amount,
        controller
      ]),
    mintPlayerReward: (player: Address, amount: bigint, controller: Address) =>
      buildTx(requireDeploymentAddress(deployment, "ProtocolSettlement"), protocolSettlementAbi as Abi, "mintPlayerReward", [
        player,
        amount,
        controller
      ]),
    accrueDeveloperForExpression: (expressionTokenId: bigint, developerRewardBase: bigint, controller: Address, moduleId?: bigint) =>
      buildTx(
        requireDeploymentAddress(deployment, "ProtocolSettlement"),
        protocolSettlementAbi as Abi,
        "accrueDeveloperForExpression",
        [expressionTokenId, developerRewardBase, controller, moduleId ?? requireModuleId(deployment, "NumberPickerModuleId")]
      ),
    pokerSubmitInitialDealProof: (
      gameId: bigint,
      args: {
        deckCommitment: Hex;
        handNonce: Hex;
        handCommitments: readonly [Hex, Hex];
        encryptionKeyCommitments: readonly [Hex, Hex];
        ciphertextRefs: readonly [Hex, Hex];
        proof: Hex;
      },
      mode: "pvp" | "tournament" = "pvp"
    ) =>
      buildTx(
        mode === "pvp"
          ? requireDeploymentAddress(deployment, "PvPPokerEngine")
          : requireDeploymentAddress(deployment, "TournamentPokerEngine"),
        singleDraw2To7EngineAbi as Abi,
        "submitInitialDealProof",
        [
          gameId,
          args.deckCommitment,
          args.handNonce,
          args.handCommitments,
          args.encryptionKeyCommitments,
          args.ciphertextRefs,
          args.proof
        ]
      ),
    pokerSubmitDrawProof: (
      gameId: bigint,
      args: {
        player: Address;
        newCommitment: Hex;
        newEncryptionKeyCommitment: Hex;
        newCiphertextRef: Hex;
        proof: Hex;
      },
      mode: "pvp" | "tournament" = "pvp"
    ) =>
      buildTx(
        mode === "pvp"
          ? requireDeploymentAddress(deployment, "PvPPokerEngine")
          : requireDeploymentAddress(deployment, "TournamentPokerEngine"),
        singleDraw2To7EngineAbi as Abi,
        "submitDrawProof",
        [gameId, args.player, args.newCommitment, args.newEncryptionKeyCommitment, args.newCiphertextRef, args.proof]
      ),
    pokerSubmitShowdownProof: (
      gameId: bigint,
      args: { winnerAddr: Address; isTie: boolean; proof: Hex },
      mode: "pvp" | "tournament" = "pvp"
    ) =>
      buildTx(
        mode === "pvp"
          ? requireDeploymentAddress(deployment, "PvPPokerEngine")
          : requireDeploymentAddress(deployment, "TournamentPokerEngine"),
        singleDraw2To7EngineAbi as Abi,
        "submitShowdownProof",
        [gameId, args.winnerAddr, args.isTie, args.proof]
      ),
    pokerClaimTimeout: (gameId: bigint, mode: "pvp" | "tournament" = "pvp") =>
      buildTx(
        mode === "pvp"
          ? requireDeploymentAddress(deployment, "PvPPokerEngine")
          : requireDeploymentAddress(deployment, "TournamentPokerEngine"),
        singleDraw2To7EngineAbi as Abi,
        "claimTimeout",
        [gameId]
      ),
    pokerHandleTimeout: (gameId: bigint, player: Address, mode: "pvp" | "tournament" = "pvp") =>
      buildTx(
        mode === "pvp"
          ? requireDeploymentAddress(deployment, "PvPPokerEngine")
          : requireDeploymentAddress(deployment, "TournamentPokerEngine"),
        singleDraw2To7EngineAbi as Abi,
        "handleTimeout",
        [gameId, player]
      ),
    blackjackSubmitInitialDealProof: (
      sessionId: bigint,
      args: {
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
    ) =>
      buildTx(requireDeploymentAddress(deployment, "SingleDeckBlackjackEngine"), singleDeckBlackjackEngineAbi as Abi, "submitInitialDealProof", [
        sessionId,
        args.deckCommitment,
        args.handNonce,
        args.playerStateCommitment,
        args.dealerStateCommitment,
        args.playerCiphertextRef,
        args.dealerCiphertextRef,
        args.dealerVisibleValue,
        args.handCount,
        args.activeHandIndex,
        args.payout,
        args.immediateResultCode,
        args.handValues,
        args.handStatuses,
        args.allowedActionMasks,
        args.softMask,
        args.proof
      ]),
    blackjackSubmitActionProof: (
      sessionId: bigint,
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
      }
    ) =>
      buildTx(requireDeploymentAddress(deployment, "SingleDeckBlackjackEngine"), singleDeckBlackjackEngineAbi as Abi, "submitActionProof", [
        sessionId,
        args.newPlayerStateCommitment,
        args.dealerStateCommitment,
        args.playerCiphertextRef,
        args.dealerCiphertextRef,
        args.dealerVisibleValue,
        args.handCount,
        args.activeHandIndex,
        args.nextPhase,
        args.handValues,
        args.handStatuses,
        args.allowedActionMasks,
        args.softMask,
        args.proof
      ]),
    blackjackSubmitShowdownProof: (
      sessionId: bigint,
      args: {
        playerStateCommitment: Hex;
        dealerStateCommitment: Hex;
        payout: bigint;
        dealerFinalValue: bigint;
        handCount: number;
        activeHandIndex: number;
        handStatuses: readonly [number, number, number, number];
        proof: Hex;
      }
    ) =>
      buildTx(requireDeploymentAddress(deployment, "SingleDeckBlackjackEngine"), singleDeckBlackjackEngineAbi as Abi, "submitShowdownProof", [
        sessionId,
        args.playerStateCommitment,
        args.dealerStateCommitment,
        args.payout,
        args.dealerFinalValue,
        args.handCount,
        args.activeHandIndex,
        args.handStatuses,
        args.proof
      ]),
    deployNumberPickerModule: (params: Parameters<typeof encodeNumberPickerDeployment>[0]) =>
      buildTx(requireDeploymentAddress(deployment, "GameDeploymentFactory"), gameDeploymentFactoryAbi as Abi, "deploySoloModule", [
        FACTORY_FAMILIES.solo.NumberPicker,
        encodeNumberPickerDeployment(params)
      ]),
    deployBlackjackModule: (params: Parameters<typeof encodeBlackjackDeployment>[0]) =>
      buildTx(requireDeploymentAddress(deployment, "GameDeploymentFactory"), gameDeploymentFactoryAbi as Abi, "deploySoloModule", [
        FACTORY_FAMILIES.solo.Blackjack,
        encodeBlackjackDeployment(params)
      ]),
    deployPokerPvPModule: (params: Parameters<typeof encodePokerDeployment>[0]) =>
      buildTx(requireDeploymentAddress(deployment, "GameDeploymentFactory"), gameDeploymentFactoryAbi as Abi, "deployPvPModule", [
        FACTORY_FAMILIES.match.PokerSingleDraw2To7,
        encodePokerDeployment(params)
      ]),
    deployPokerTournamentModule: (params: Parameters<typeof encodePokerDeployment>[0]) =>
      buildTx(requireDeploymentAddress(deployment, "GameDeploymentFactory"), gameDeploymentFactoryAbi as Abi, "deployTournamentModule", [
        FACTORY_FAMILIES.match.PokerSingleDraw2To7,
        encodePokerDeployment(params)
      ]),
    deploySoloModuleRaw: (family: number, deploymentParams: Hex) => {
      if (family > FACTORY_FAMILIES.solo.Blackjack) {
        throw new UnsupportedFactoryFamilyError(String(family));
      }
      return buildTx(requireDeploymentAddress(deployment, "GameDeploymentFactory"), gameDeploymentFactoryAbi as Abi, "deploySoloModule", [
        family,
        deploymentParams
      ]);
    },
    deployPvPModuleRaw: (family: number, deploymentParams: Hex) => {
      if (family !== FACTORY_FAMILIES.match.PokerSingleDraw2To7) {
        throw new UnsupportedFactoryFamilyError(String(family));
      }
      return buildTx(requireDeploymentAddress(deployment, "GameDeploymentFactory"), gameDeploymentFactoryAbi as Abi, "deployPvPModule", [
        family,
        deploymentParams
      ]);
    },
    deployTournamentModuleRaw: (family: number, deploymentParams: Hex) => {
      if (family !== FACTORY_FAMILIES.match.PokerSingleDraw2To7) {
        throw new UnsupportedFactoryFamilyError(String(family));
      }
      return buildTx(requireDeploymentAddress(deployment, "GameDeploymentFactory"), gameDeploymentFactoryAbi as Abi, "deployTournamentModule", [
        family,
        deploymentParams
      ]);
    }
  };

  const write = {
    approveSettlement: (amount: bigint) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "ScuroToken"), scuroTokenAbi as Abi, "approve", [
        requireDeploymentAddress(deployment, "ProtocolSettlement"),
        amount
      ]),
    approveStaking: (amount: bigint) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "ScuroToken"), scuroTokenAbi as Abi, "approve", [
        requireDeploymentAddress(deployment, "ScuroStakingToken"),
        amount
      ]),
    stake: (amount: bigint) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "ScuroStakingToken"), scuroStakingTokenAbi as Abi, "stake", [amount]),
    unstake: (amount: bigint) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "ScuroStakingToken"), scuroStakingTokenAbi as Abi, "unstake", [amount]),
    delegateGovernance: (delegatee: Address) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "ScuroStakingToken"), scuroStakingTokenAbi as Abi, "delegate", [delegatee]),
    numberPickerPlay: (args: Parameters<typeof encode.numberPickerPlay>[0]) =>
      writeContract(options.walletClient, encode.numberPickerPlay(args).to, numberPickerAdapterAbi as Abi, "play", [
        args.wager,
        args.selection,
        args.playRef,
        args.expressionTokenId ?? requireExpressionId(deployment, "NumberPickerExpressionTokenId")
      ]),
    numberPickerFinalize: (requestId: bigint) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "NumberPickerAdapter"), numberPickerAdapterAbi as Abi, "finalize", [requestId]),
    createTournament: (args: Parameters<typeof encode.createTournament>[0]) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "TournamentController"), tournamentControllerAbi as Abi, "createTournament", [
        args.entryFee,
        args.rewardPool,
        args.startingStack,
        args.expressionTokenId ?? requireExpressionId(deployment, "PokerExpressionTokenId")
      ]),
    setTournamentActive: (tournamentId: bigint, active: boolean) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "TournamentController"), tournamentControllerAbi as Abi, "setTournamentActive", [
        tournamentId,
        active
      ]),
    startTournamentGame: (tournamentId: bigint, p1: Address, p2: Address) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "TournamentController"), tournamentControllerAbi as Abi, "startGameForPlayers", [
        tournamentId,
        p1,
        p2
      ]),
    reportTournamentOutcome: (gameId: bigint) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "TournamentController"), tournamentControllerAbi as Abi, "reportOutcome", [gameId]),
    createPvPSession: (args: Parameters<typeof encode.createPvPSession>[0]) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "PvPController"), pvPControllerAbi as Abi, "createSession", [
        args.player1,
        args.player2,
        args.stake,
        args.rewardPool,
        args.startingStack,
        args.expressionTokenId ?? requireExpressionId(deployment, "PokerExpressionTokenId")
      ]),
    settlePvPSession: (sessionId: bigint) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "PvPController"), pvPControllerAbi as Abi, "settleSession", [sessionId]),
    startBlackjackHand: (args: Parameters<typeof encode.startBlackjackHand>[0]) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "BlackjackController"), blackjackControllerAbi as Abi, "startHand", [
        args.wager,
        args.playRef,
        args.playerKeyCommitment,
        args.expressionTokenId ?? requireExpressionId(deployment, "BlackjackExpressionTokenId")
      ]),
    blackjackHit: (sessionId: bigint) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "BlackjackController"), blackjackControllerAbi as Abi, "hit", [sessionId]),
    blackjackStand: (sessionId: bigint) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "BlackjackController"), blackjackControllerAbi as Abi, "stand", [sessionId]),
    blackjackDoubleDown: (sessionId: bigint) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "BlackjackController"), blackjackControllerAbi as Abi, "doubleDown", [sessionId]),
    blackjackSplit: (sessionId: bigint) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "BlackjackController"), blackjackControllerAbi as Abi, "split", [sessionId]),
    blackjackClaimTimeout: (sessionId: bigint) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "BlackjackController"), blackjackControllerAbi as Abi, "claimPlayerTimeout", [sessionId]),
    blackjackSettle: (sessionId: bigint) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "BlackjackController"), blackjackControllerAbi as Abi, "settle", [sessionId]),
    pokerSubmitInitialDealProof: (gameId: bigint, args: Parameters<typeof encode.pokerSubmitInitialDealProof>[1], mode?: "pvp" | "tournament") =>
      writeContract(
        options.walletClient,
        mode === "tournament"
          ? requireDeploymentAddress(deployment, "TournamentPokerEngine")
          : requireDeploymentAddress(deployment, "PvPPokerEngine"),
        singleDraw2To7EngineAbi as Abi,
        "submitInitialDealProof",
        [
          gameId,
          args.deckCommitment,
          args.handNonce,
          args.handCommitments,
          args.encryptionKeyCommitments,
          args.ciphertextRefs,
          args.proof
        ]
      ),
    pokerSubmitDrawProof: (gameId: bigint, args: Parameters<typeof encode.pokerSubmitDrawProof>[1], mode?: "pvp" | "tournament") =>
      writeContract(
        options.walletClient,
        mode === "tournament"
          ? requireDeploymentAddress(deployment, "TournamentPokerEngine")
          : requireDeploymentAddress(deployment, "PvPPokerEngine"),
        singleDraw2To7EngineAbi as Abi,
        "submitDrawProof",
        [gameId, args.player, args.newCommitment, args.newEncryptionKeyCommitment, args.newCiphertextRef, args.proof]
      ),
    pokerSubmitShowdownProof: (gameId: bigint, args: Parameters<typeof encode.pokerSubmitShowdownProof>[1], mode?: "pvp" | "tournament") =>
      writeContract(
        options.walletClient,
        mode === "tournament"
          ? requireDeploymentAddress(deployment, "TournamentPokerEngine")
          : requireDeploymentAddress(deployment, "PvPPokerEngine"),
        singleDraw2To7EngineAbi as Abi,
        "submitShowdownProof",
        [gameId, args.winnerAddr, args.isTie, args.proof]
      ),
    pokerClaimTimeout: (gameId: bigint, mode?: "pvp" | "tournament") =>
      writeContract(
        options.walletClient,
        mode === "tournament"
          ? requireDeploymentAddress(deployment, "TournamentPokerEngine")
          : requireDeploymentAddress(deployment, "PvPPokerEngine"),
        singleDraw2To7EngineAbi as Abi,
        "claimTimeout",
        [gameId]
      ),
    blackjackSubmitInitialDealProof: (sessionId: bigint, args: Parameters<typeof encode.blackjackSubmitInitialDealProof>[1]) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "SingleDeckBlackjackEngine"), singleDeckBlackjackEngineAbi as Abi, "submitInitialDealProof", [
        sessionId,
        args.deckCommitment,
        args.handNonce,
        args.playerStateCommitment,
        args.dealerStateCommitment,
        args.playerCiphertextRef,
        args.dealerCiphertextRef,
        args.dealerVisibleValue,
        args.handCount,
        args.activeHandIndex,
        args.payout,
        args.immediateResultCode,
        args.handValues,
        args.handStatuses,
        args.allowedActionMasks,
        args.softMask,
        args.proof
      ]),
    blackjackSubmitActionProof: (sessionId: bigint, args: Parameters<typeof encode.blackjackSubmitActionProof>[1]) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "SingleDeckBlackjackEngine"), singleDeckBlackjackEngineAbi as Abi, "submitActionProof", [
        sessionId,
        args.newPlayerStateCommitment,
        args.dealerStateCommitment,
        args.playerCiphertextRef,
        args.dealerCiphertextRef,
        args.dealerVisibleValue,
        args.handCount,
        args.activeHandIndex,
        args.nextPhase,
        args.handValues,
        args.handStatuses,
        args.allowedActionMasks,
        args.softMask,
        args.proof
      ]),
    blackjackSubmitShowdownProof: (sessionId: bigint, args: Parameters<typeof encode.blackjackSubmitShowdownProof>[1]) =>
      writeContract(options.walletClient, requireDeploymentAddress(deployment, "SingleDeckBlackjackEngine"), singleDeckBlackjackEngineAbi as Abi, "submitShowdownProof", [
        sessionId,
        args.playerStateCommitment,
        args.dealerStateCommitment,
        args.payout,
        args.dealerFinalValue,
        args.handCount,
        args.activeHandIndex,
        args.handStatuses,
        args.proof
      ])
  };

  async function inspectBlackjackSession(sessionId: bigint) {
    const [session, settlementOutcome, sessionSettled] = await Promise.all([
      read.blackjack.session(sessionId) as Promise<any>,
      read.blackjack.settlementOutcome(sessionId) as Promise<any>,
      read.blackjack.sessionSettled(sessionId) as Promise<any>
    ]);
    const phaseLabel = decodeBlackjackSessionPhase(session.phase);
    const allowedActions = session.hands.map((hand: any) => decodeBlackjackActionMask(hand.allowedActionMask));

    return {
      session,
      settlementOutcome,
      sessionSettled,
      phaseLabel,
      allowedActions
    };
  }

  async function inspectPokerGame(gameId: bigint, mode: "pvp" | "tournament" = "pvp") {
    const [game, handState, phaseLabel, proofDeadline, isGameOver] = await Promise.all([
      read.pokerEngine.game(gameId, mode) as Promise<any>,
      read.pokerEngine.handState(gameId, mode) as Promise<any>,
      read.pokerEngine.currentPhase(gameId, mode),
      read.pokerEngine.proofDeadline(gameId, mode),
      read.pokerEngine.isGameOver(gameId, mode)
    ]);

    return {
      game,
      handState,
      phaseLabel,
      proofDeadline,
      isGameOver
    };
  }

  function assertBlackjackPlayerAction(snapshot: Awaited<ReturnType<typeof inspectBlackjackSession>>, expectedActionMask: "ALLOW_HIT" | "ALLOW_STAND" | "ALLOW_DOUBLE" | "ALLOW_SPLIT") {
    if (snapshot.phaseLabel !== "AwaitingPlayerAction") {
      throw new InvalidLifecycleStateError(`Blackjack session is not awaiting a player action. Current phase: ${snapshot.phaseLabel}`);
    }

    const activeHand = snapshot.allowedActions[Number(snapshot.session.activeHandIndex)] ?? [];
    if (!activeHand.includes(expectedActionMask)) {
      throw new InvalidLifecycleStateError(`Blackjack action ${expectedActionMask} is not allowed for the active hand.`, {
        allowedActions: activeHand
      });
    }
  }

  return {
    publicClient: options.publicClient,
    walletClient: options.walletClient,
    deployment,
    instances,
    read,
    encode,
    write,
    inspect: {
      blackjackSession: inspectBlackjackSession,
      pokerGame: inspectPokerGame
    },
    helpers: {
      nowSeconds,
      assertBlackjackPlayerAction
    }
  };
}
