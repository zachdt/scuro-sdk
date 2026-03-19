import { describe, expect, test } from "bun:test";

import {
  decodeBaccaratOutcome,
  decodeBaccaratSide,
  decodeBlackjackActionMask,
  decodeBlackjackSessionPhase,
  decodeGameMode,
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
  });
});
