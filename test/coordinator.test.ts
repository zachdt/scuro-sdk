import { describe, expect, mock, test } from "bun:test";
import type { Hex } from "viem";

import { createBlackjackCoordinator, createPokerCoordinator } from "../src/coordinator";

describe("coordinator state machines", () => {
  test("poker coordinator submits initial deal proof when a hand is awaiting deal", async () => {
    const provideInitialDeal = mock(async () => ({
      deckCommitment: ("0x" + "11".repeat(32)) as Hex,
      handNonce: ("0x" + "22".repeat(32)) as Hex,
      handCommitments: [("0x" + "33".repeat(32)) as Hex, ("0x" + "44".repeat(32)) as Hex] as const,
      encryptionKeyCommitments: [("0x" + "55".repeat(32)) as Hex, ("0x" + "66".repeat(32)) as Hex] as const,
      ciphertextRefs: [("0x" + "77".repeat(32)) as Hex, ("0x" + "88".repeat(32)) as Hex] as const,
      proof: "0x1234" as Hex
    }));
    const pokerSubmit = mock(async () => "0xaaa");

    const coordinator = createPokerCoordinator({
      mode: "pvp",
      proofProvider: {
        provideInitialDeal,
        provideDraw: async () => {
          throw new Error("unexpected");
        },
        provideShowdown: async () => {
          throw new Error("unexpected");
        }
      },
      contracts: {
        publicClient: {
          getBlock: async () => ({ timestamp: 0n })
        },
        inspect: {
          pokerGame: async () => ({
            game: {},
            handState: { drawDeclared: [false, false], drawResolved: [false, false] },
            phaseLabel: "AwaitingInitialDeal",
            proofDeadline: 10n,
            isGameOver: false
          })
        },
        read: {
          pvp: {
            session: async () => ({ player1: "0x1", player2: "0x2" }),
            sessionSettled: async () => false
          }
        },
        write: {
          pokerSubmitInitialDealProof: pokerSubmit
        }
      } as any
    });

    const result = await coordinator.step(1n);
    expect(result).toEqual({
      status: "submitted",
      action: "submit-initial-deal-proof",
      txHash: "0xaaa"
    });
    expect(provideInitialDeal).toHaveBeenCalled();
    expect(pokerSubmit).toHaveBeenCalled();
  });

  test("blackjack coordinator settles completed sessions", async () => {
    const settle = mock(async () => "0xbbb");
    const coordinator = createBlackjackCoordinator({
      proofProvider: {
        provideInitialDeal: async () => {
          throw new Error("unexpected");
        },
        provideNext: async () => {
          throw new Error("unexpected");
        }
      },
      contracts: {
        publicClient: {
          getBlock: async () => ({ timestamp: 0n })
        },
        inspect: {
          blackjackSession: async () => ({
            session: { deadlineAt: 5n },
            settlementOutcome: { completed: true },
            sessionSettled: false,
            phaseLabel: "Completed",
            allowedActions: []
          })
        },
        write: {
          blackjackSettle: settle,
          blackjackSubmitInitialDealProof: async () => "0x0",
          blackjackSubmitActionProof: async () => "0x0",
          blackjackSubmitShowdownProof: async () => "0x0",
          blackjackClaimTimeout: async () => "0x0"
        }
      } as any
    });

    const result = await coordinator.step(9n);
    expect(result).toEqual({
      status: "submitted",
      action: "settle-blackjack-session",
      txHash: "0xbbb"
    });
    expect(settle).toHaveBeenCalledWith(9n);
  });
});
