import { describe, expect, test } from "bun:test";

import {
  BLACKJACK_CARD_EMPTY,
  decodeBaccaratOutcome,
  decodeBaccaratSide,
  decodeBlackjackActionMask,
  decodeBlackjackDealerRevealMask,
  decodeBlackjackHandPayoutKind,
  decodeBlackjackSessionPhase,
  decodeCardProxy,
  decodeGameMode,
  groupBlackjackPlayerCards,
  decodePokerHandPhase
} from "../src/types";

describe("enum helpers", () => {
  test("decode documented protocol enums", () => {
    expect(decodeGameMode(2)).toBe("Tournament");
    expect(decodeBaccaratSide(1)).toBe("Banker");
    expect(decodeBaccaratOutcome(2)).toBe("Tie");
    expect(decodeBlackjackSessionPhase(3)).toBe("AwaitingCoordinator");
    expect(decodePokerHandPhase(4)).toBe("DrawProofPending");
    expect(decodeBlackjackActionMask(5)).toEqual(["ALLOW_HIT", "ALLOW_DOUBLE"]);
    expect(decodeBlackjackHandPayoutKind(2)).toBe("HAND_PAYOUT_PUSH");
    expect(decodeBlackjackHandPayoutKind(4)).toBe("HAND_PAYOUT_BLACKJACK_3_TO_2");
    expect(decodeBlackjackHandPayoutKind(5)).toBe("HAND_PAYOUT_SUITED_BLACKJACK_2_TO_1");
  });

  test("decode blackjack card proxies, reveal masks, and grouped hands", () => {
    expect(decodeCardProxy(0)).toEqual({
      raw: 0,
      isEmpty: false,
      rank: 0,
      suit: 0
    });
    expect(decodeCardProxy(27)).toEqual({
      raw: 27,
      isEmpty: false,
      rank: 1,
      suit: 2
    });
    expect(decodeCardProxy(BLACKJACK_CARD_EMPTY)).toEqual({
      raw: 52,
      isEmpty: true,
      rank: null,
      suit: null
    });

    expect(decodeBlackjackDealerRevealMask(0b0101)).toEqual({
      rawMask: 0b0101,
      slots: [true, false, true, false]
    });

    expect(groupBlackjackPlayerCards([0, 12, 13, 14, 15, 52, 52, 52], [2, 3, 0, 0])).toEqual([
      [0, 12],
      [13, 14, 15],
      [],
      []
    ]);
  });
});
