import { describe, expect, test } from "bun:test";
import type { Hex } from "viem";

import { createContractHelpers, encodeBlackjackDeployment, encodeNumberPickerDeployment, encodePokerDeployment } from "../src/contracts";
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
  });

  test("build approval and gameplay tx requests", () => {
    const contracts = createContractHelpers(createTestClientOptions());
    const approve = contracts.encode.approveSettlement(100n);
    const play = contracts.encode.numberPickerPlay({
      wager: 10n,
      selection: 25n,
      playRef: "0x" + "44".repeat(32)
    });

    expect(approve.to).toBe(dummyAddresses.ScuroToken);
    expect(approve.data).toStartWith("0x");
    expect(play.to).toBe(dummyAddresses.NumberPickerAdapter);
    expect(play.data).toStartWith("0x");
  });
});
