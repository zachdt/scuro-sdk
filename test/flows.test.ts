import { describe, expect, test } from "bun:test";

import { createFlowHelpers } from "../src/flows";
import { InvalidLifecycleStateError } from "../src/types";
import { createTestClientOptions, dummyAddresses } from "./support";

function createReadContractStub() {
  return async ({ functionName, args }: { functionName: string; args?: readonly unknown[] }) => {
    switch (functionName) {
      case "getSpin":
        return { presetId: 1n };
      case "getSpinResult":
        return { totalPayout: 25n };
      case "getSettlementOutcome":
        if (args?.[0] === 99n) {
          return { completed: false };
        }
        if (args?.[0] === 77n) {
          return { completed: false };
        }
        return { completed: true };
      case "spinSettled":
        return false;
      case "spinExpressionTokenId":
        return 3n;
      case "getPresetSummary":
        return {
          active: true,
          volatilityTier: 1,
          configHash: "0x" + "11".repeat(32),
          reelCount: 5,
          rowCount: 3,
          waysMode: 1,
          minStake: 1n,
          maxStake: 100n,
          maxPayoutMultiplierBps: 10_000n,
          maxFreeSpins: 10,
          maxRetriggers: 3,
          maxPickReveals: 5,
          maxRespins: 3,
          maxTotalEvents: 20
        };
      case "getRound":
        return {
          playerCards: [1, 2, 3],
          bankerCards: [4, 5, 6],
          playerCardCount: 2,
          bankerCardCount: 2,
          playerTotal: 3,
          bankerTotal: 4,
          natural: false,
          outcome: 1,
          randomWord: 123n,
          fulfilled: true,
          resolved: true,
          playRef: "0x" + "22".repeat(32),
          requestId: 8n
        };
      case "sessionSettled":
        return false;
      case "sessionExpressionTokenId":
        return 4n;
      case "tables":
        return {
          banker: dummyAddresses.Player1,
          bankerEscrow: 300n,
          joinDeadline: 1000n,
          totalPlayerTake: 150n,
          matchedBankerRisk: 154n,
          unmatchedBankerRefund: 146n,
          expressionTokenId: 5n,
          playRef: "0x" + "33".repeat(32),
          closed: true,
          settled: false
        };
      case "getTakers":
        return [dummyAddresses.Player2];
      case "getTakerAmount":
        return 150n;
      case "playerTakeCap":
        return 291n;
      case "matchedBankerRisk":
        return 154n;
      case "isResolved":
        return true;
      default:
        throw new Error(`unexpected readContract: ${functionName}`);
    }
  };
}

describe("flow helpers", () => {
  test("prepare slot settlement only when completed", async () => {
    const flows = createFlowHelpers(
      createTestClientOptions({
        publicClient: {
          readContract: createReadContractStub(),
          getBlock: async () => ({ timestamp: 0n })
        } as any
      })
    );

    const tx = await flows.slotMachine.prepareSettlement(1n);
    expect(tx.to).toBe(dummyAddresses.SlotMachineController);

    await expect(flows.slotMachine.prepareSettlement(99n)).rejects.toBeInstanceOf(InvalidLifecycleStateError);
  });

  test("prepare super baccarat settlement only when completed", async () => {
    const flows = createFlowHelpers(
      createTestClientOptions({
        publicClient: {
          readContract: createReadContractStub(),
          getBlock: async () => ({ timestamp: 0n })
        } as any
      })
    );

    const tx = await flows.superBaccarat.prepareSettlement(1n);
    expect(tx.to).toBe(dummyAddresses.SuperBaccaratController);

    await expect(flows.superBaccarat.prepareSettlement(77n)).rejects.toBeInstanceOf(InvalidLifecycleStateError);
  });

  test("inspect chemin de fer table composes controller and engine state", async () => {
    const flows = createFlowHelpers(
      createTestClientOptions({
        publicClient: {
          readContract: createReadContractStub(),
          getBlock: async () => ({ timestamp: 0n })
        } as any
      })
    );

    const snapshot = await flows.cheminDeFer.inspectTable(5n);
    expect(snapshot.table.closed).toBe(true);
    expect(snapshot.resolved).toBe(true);
    expect(snapshot.takers).toEqual([dummyAddresses.Player2]);
    expect(snapshot.takerAmounts[dummyAddresses.Player2]).toBe(150n);
  });
});
