import { describe, expect, test } from "bun:test";
import { decodeFunctionData, encodeAbiParameters, encodeEventTopics, type AbiEvent, type Hex } from "viem";

import {
  createContractHelpers,
  decodeScuroEventLog,
  encodeBlackjackDeployment,
  encodeCheminDeFerDeployment,
  encodeNumberPickerDeployment,
  encodePokerDeployment,
  encodeSlotMachineDeployment,
  encodeSuperBaccaratDeployment
} from "../src/contracts";
import {
  cheminDeFerControllerAbi,
  singleDeckBlackjackEngineAbi,
  slotMachineEngineAbi,
  superBaccaratControllerAbi
} from "../src/generated/abis";
import { createTestClientOptions, dummyAddresses } from "./support";

describe("contract helpers", () => {
  test("encode typed factory deployment params", () => {
    expect(
      encodeNumberPickerDeployment({
        vrfCoordinator: dummyAddresses.NumberPickerEngine,
        configHash: ("0x" + "11".repeat(32)) as Hex,
        developerRewardBps: 500
      })
    ).toStartWith("0x");

    expect(
      encodeBlackjackDeployment({
        coordinator: dummyAddresses.Admin,
        defaultActionWindow: 60n,
        configHash: ("0x" + "22".repeat(32)) as Hex,
        developerRewardBps: 500
      })
    ).toStartWith("0x");

    expect(
      encodeSuperBaccaratDeployment({
        vrfCoordinator: dummyAddresses.SuperBaccaratEngine,
        configHash: ("0x" + "24".repeat(32)) as Hex,
        developerRewardBps: 500
      })
    ).toStartWith("0x");

    expect(
      encodeSlotMachineDeployment({
        vrfCoordinator: dummyAddresses.SlotMachineEngine,
        configHash: ("0x" + "25".repeat(32)) as Hex,
        developerRewardBps: 500
      })
    ).toStartWith("0x");

    expect(
      encodePokerDeployment({
        coordinator: dummyAddresses.Admin,
        smallBlind: 10n,
        bigBlind: 20n,
        blindEscalationInterval: 180n,
        actionWindow: 60n,
        configHash: ("0x" + "33".repeat(32)) as Hex,
        developerRewardBps: 1000
      })
    ).toStartWith("0x");

    expect(
      encodeCheminDeFerDeployment({
        vrfCoordinator: dummyAddresses.CheminDeFerEngine,
        joinWindow: 60n,
        configHash: ("0x" + "34".repeat(32)) as Hex,
        developerRewardBps: 500
      })
    ).toStartWith("0x");
  });

  test("build approval, gameplay, and admin tx requests", () => {
    const contracts = createContractHelpers(createTestClientOptions());
    const approve = contracts.encode.approveSettlement(100n);
    const play = contracts.encode.numberPickerPlay({
      wager: 10n,
      selection: 25n,
      playRef: "0x" + "44".repeat(32)
    });
    const slotSpin = contracts.encode.slotMachineSpin({
      stake: 10n,
      presetId: 1n,
      playRef: "0x" + "45".repeat(32),
      expressionTokenId: 9n
    });
    const superBaccaratPlay = contracts.encode.superBaccaratPlay({
      wager: 20n,
      side: 1,
      playRef: "0x" + "46".repeat(32),
      expressionTokenId: 10n
    });
    const cheminOpen = contracts.encode.cheminDeFerOpenTable({
      bankerMaxBet: 30n,
      playRef: "0x" + "47".repeat(32),
      expressionTokenId: 11n
    });
    const registerEngine = contracts.encode.registerEngine(dummyAddresses.SlotMachineEngine, {
      engineType: ("0x" + "55".repeat(32)) as Hex,
      verifier: dummyAddresses.Admin,
      configHash: ("0x" + "56".repeat(32)) as Hex,
      developerRewardBps: 500,
      active: true,
      supportsTournament: false,
      supportsPvP: false,
      supportsSolo: true
    });

    expect(approve.to).toBe(dummyAddresses.ScuroToken);
    expect(approve.data).toStartWith("0x");
    expect(play.to).toBe(dummyAddresses.NumberPickerAdapter);
    expect(play.data).toStartWith("0x");
    expect(slotSpin.to).toBe(dummyAddresses.SlotMachineController);
    expect(superBaccaratPlay.to).toBe(dummyAddresses.SuperBaccaratController);
    expect(cheminOpen.to).toBe(dummyAddresses.CheminDeFerController);
    expect(registerEngine.to).toBe(dummyAddresses.GameEngineRegistry);
  });

  test("decode slot, baccarat, and chemin events", () => {
    const slotEvent = slotMachineEngineAbi.find(
      (item) => item.type === "event" && item.name === "PresetActiveSet"
    ) as AbiEvent;
    const slotTopics = encodeEventTopics({
      abi: slotMachineEngineAbi,
      eventName: "PresetActiveSet",
      args: { presetId: 1n }
    });
    if (!Array.isArray(slotTopics)) {
      throw new Error("slot topics did not encode");
    }
    const slotTopicsList = slotTopics as readonly Hex[];
    const slotLog = {
      topics: slotTopicsList,
      data: encodeAbiParameters(slotEvent.inputs.filter((input) => !input.indexed), [true])
    };
    expect((decodeScuroEventLog("SlotMachineEngine", slotLog) as any).eventName).toBe("PresetActiveSet");

    const baccaratEvent = superBaccaratControllerAbi.find(
      (item) => item.type === "event" && item.name === "SessionSettled"
    ) as AbiEvent;
    const baccaratTopics = encodeEventTopics({
      abi: superBaccaratControllerAbi,
      eventName: "SessionSettled",
      args: {
        sessionId: 7n,
        player: dummyAddresses.Player1,
        expressionTokenId: 2n
      }
    });
    if (!Array.isArray(baccaratTopics)) {
      throw new Error("baccarat topics did not encode");
    }
    const baccaratTopicsList = baccaratTopics as readonly Hex[];
    const baccaratLog = {
      topics: baccaratTopicsList,
      data: encodeAbiParameters(
        baccaratEvent.inputs.filter((input) => !input.indexed),
        [100n, 1]
      )
    };
    expect((decodeScuroEventLog("SuperBaccaratController", baccaratLog) as any).eventName).toBe("SessionSettled");

    const cheminEvent = cheminDeFerControllerAbi.find(
      (item) => item.type === "event" && item.name === "TableCanceled"
    ) as AbiEvent;
    const cheminTopics = encodeEventTopics({
      abi: cheminDeFerControllerAbi,
      eventName: "TableCanceled",
      args: {
        tableId: 5n,
        banker: dummyAddresses.Player1
      }
    });
    if (!Array.isArray(cheminTopics)) {
      throw new Error("chemin topics did not encode");
    }
    const cheminTopicsList = cheminTopics as readonly Hex[];
    const cheminLog = {
      topics: cheminTopicsList,
      data: encodeAbiParameters(cheminEvent.inputs.filter((input) => !input.indexed), [250n])
    };
    expect((decodeScuroEventLog("CheminDeFerController", cheminLog) as any).eventName).toBe("TableCanceled");
  });

  test("inspect blackjack session exposes v2 card and payout fields", async () => {
    const contracts = createContractHelpers(
      createTestClientOptions({
        publicClient: {
          readContract: async ({ functionName }: { functionName: string }) => {
            switch (functionName) {
              case "getSession":
                return {
                  phase: 2,
                  activeHandIndex: 0,
                  dealerRevealMask: 0b0001,
                  playerCards: [9, 22, 35, 48, 52, 52, 52, 52],
                  dealerCards: [12, 52, 52, 52],
                  hands: [
                    { wager: 10n, value: 21n, status: 1, allowedActionMask: 0, cardCount: 2, payoutKind: 4 },
                    { wager: 10n, value: 0n, status: 0, allowedActionMask: 0, cardCount: 0, payoutKind: 0 },
                    { wager: 0n, value: 0n, status: 0, allowedActionMask: 0, cardCount: 0, payoutKind: 0 },
                    { wager: 0n, value: 0n, status: 0, allowedActionMask: 0, cardCount: 0, payoutKind: 0 }
                  ]
                };
              case "getSettlementOutcome":
                return { completed: false, payout: 0n, totalBurned: 10n, player: dummyAddresses.Player1 };
              case "sessionSettled":
                return false;
              default:
                throw new Error(`unexpected readContract: ${functionName}`);
            }
          },
          getBlock: async () => ({ timestamp: 0n })
        } as any
      })
    );

    const snapshot = await contracts.inspect.blackjackSession(1n);
    expect(snapshot.phaseLabel).toBe("AwaitingPlayerAction");
    expect(snapshot.playerCards).toEqual([9, 22, 35, 48, 52, 52, 52, 52]);
    expect(snapshot.dealerCards).toEqual([12, 52, 52, 52]);
    expect(snapshot.dealerRevealMask).toBe(0b0001);
    expect(snapshot.hands[0].cardCount).toBe(2);
    expect(snapshot.hands[0].payoutKind).toBe(4);
  });

  test("encode blackjack v2 proof calldata with expanded card fields", () => {
    const contracts = createContractHelpers(createTestClientOptions());

    const initialDeal = contracts.encode.blackjackSubmitInitialDealProof(1n, {
      deckCommitment: ("0x" + "11".repeat(32)) as Hex,
      handNonce: ("0x" + "12".repeat(32)) as Hex,
      playerStateCommitment: ("0x" + "13".repeat(32)) as Hex,
      dealerStateCommitment: ("0x" + "14".repeat(32)) as Hex,
      playerCiphertextRef: ("0x" + "15".repeat(32)) as Hex,
      dealerCiphertextRef: ("0x" + "16".repeat(32)) as Hex,
      dealerVisibleValue: 10n,
      playerCards: [0, 1, 2, 3, 52, 52, 52, 52],
      dealerCards: [12, 52, 52, 52],
      handCount: 1,
      activeHandIndex: 0,
      payout: 15n,
      immediateResultCode: 0,
      handValues: [21n, 0n, 0n, 0n],
      handStatuses: [1, 0, 0, 0],
      allowedActionMasks: [0, 0, 0, 0],
      handCardCounts: [2, 0, 0, 0],
      handPayoutKinds: [4, 0, 0, 0],
      dealerRevealMask: 0b0001,
      softMask: 0n,
      proof: "0x1234"
    });
    const decodedInitial = decodeFunctionData({
      abi: singleDeckBlackjackEngineAbi,
      data: initialDeal.data
    });
    const initialArgs = decodedInitial.args as readonly unknown[];

    expect(decodedInitial.functionName).toBe("submitInitialDealProof");
    expect(initialArgs[8]).toEqual([0, 1, 2, 3, 52, 52, 52, 52]);
    expect(initialArgs[9]).toEqual([12, 52, 52, 52]);
    expect(initialArgs[16]).toEqual([0, 0, 0, 0]);
    expect(initialArgs[17]).toEqual([2, 0, 0, 0]);
    expect(initialArgs[18]).toEqual([4, 0, 0, 0]);
    expect(initialArgs[19]).toBe(1);

    const showdown = contracts.encode.blackjackSubmitShowdownProof(1n, {
      playerStateCommitment: ("0x" + "21".repeat(32)) as Hex,
      dealerStateCommitment: ("0x" + "22".repeat(32)) as Hex,
      payout: 20n,
      dealerFinalValue: 18n,
      playerCards: [0, 1, 2, 3, 4, 5, 52, 52],
      dealerCards: [11, 24, 52, 52],
      handCount: 2,
      activeHandIndex: 1,
      handStatuses: [1, 2, 0, 0],
      handValues: [21n, 18n, 0n, 0n],
      handCardCounts: [2, 3, 0, 0],
      handPayoutKinds: [4, 2, 0, 0],
      dealerRevealMask: 0b0011,
      proof: "0xabcd"
    });
    const decodedShowdown = decodeFunctionData({
      abi: singleDeckBlackjackEngineAbi,
      data: showdown.data
    });
    const showdownArgs = decodedShowdown.args as readonly unknown[];

    expect(decodedShowdown.functionName).toBe("submitShowdownProof");
    expect(showdownArgs[5]).toEqual([0, 1, 2, 3, 4, 5, 52, 52]);
    expect(showdownArgs[6]).toEqual([11, 24, 52, 52]);
    expect(showdownArgs[10]).toEqual([21n, 18n, 0n, 0n]);
    expect(showdownArgs[11]).toEqual([2, 3, 0, 0]);
    expect(showdownArgs[12]).toEqual([4, 2, 0, 0]);
    expect(showdownArgs[13]).toBe(3);
  });

  test("write blackjack v2 proof helpers forward expanded args", async () => {
    let capturedWrite: any;
    const contracts = createContractHelpers(
      createTestClientOptions({
        walletClient: {
          chain: null,
          account: dummyAddresses.Admin,
          writeContract: async (args: any) => {
            capturedWrite = args;
            return "0xabc123";
          }
        } as any
      })
    );

    await contracts.write.blackjackSubmitActionProof(2n, {
      newPlayerStateCommitment: ("0x" + "31".repeat(32)) as Hex,
      dealerStateCommitment: ("0x" + "32".repeat(32)) as Hex,
      playerCiphertextRef: ("0x" + "33".repeat(32)) as Hex,
      dealerCiphertextRef: ("0x" + "34".repeat(32)) as Hex,
      dealerVisibleValue: 9n,
      playerCards: [0, 1, 2, 3, 4, 52, 52, 52],
      dealerCards: [10, 52, 52, 52],
      handCount: 2,
      activeHandIndex: 1,
      nextPhase: 3,
      handValues: [11n, 20n, 0n, 0n],
      handStatuses: [1, 1, 0, 0],
      allowedActionMasks: [1, 2, 0, 0],
      handCardCounts: [2, 3, 0, 0],
      handPayoutKinds: [0, 3, 0, 0],
      dealerRevealMask: 0b0001,
      softMask: 0n,
      proof: "0xbeef"
    });

    const forwardedArgs = capturedWrite.args as unknown[];
    expect(forwardedArgs[6]).toEqual([0, 1, 2, 3, 4, 52, 52, 52]);
    expect(forwardedArgs[7]).toEqual([10, 52, 52, 52]);
    expect(forwardedArgs[14]).toEqual([2, 3, 0, 0]);
    expect(forwardedArgs[15]).toEqual([0, 3, 0, 0]);
    expect(forwardedArgs[16]).toBe(0b0001);
  });
});
