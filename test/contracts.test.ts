import { describe, expect, test } from "bun:test";
import { encodeAbiParameters, encodeEventTopics, type AbiEvent, type Hex } from "viem";

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
});
