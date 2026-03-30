import { describe, expect, test } from "bun:test";
import { parseEther } from "viem";

import {
  blackjackControllerAbi,
  numberPickerEngineAbi,
  tournamentControllerAbi
} from "../src/generated/abis";
import {
  findEventArgs,
  getHostedBetaSignerContext,
  uniquePlayRef,
  waitForSuccessfulReceipt
} from "./beta-support";

describe("hosted beta signer integration", () => {
  test("exercise additive live write flows against hosted beta", async () => {
    const context = await getHostedBetaSignerContext();
    const { publicClient } = context;
    const { deployment } = context.scuro;

    const numberPickerApprovalHash = await context.signers.Player1.scuro.contracts.write.approveSettlement(
      parseEther("50")
    );
    await waitForSuccessfulReceipt(publicClient, numberPickerApprovalHash);

    const numberPickerPlayHash = await context.signers.Player1.scuro.contracts.write.numberPickerPlay({
      wager: parseEther("25"),
      selection: 49n,
      playRef: uniquePlayRef("sdk-beta-number-picker")
    });
    const numberPickerPlayReceipt = await waitForSuccessfulReceipt(publicClient, numberPickerPlayHash);
    const numberPickerPlay = findEventArgs(
      numberPickerPlayReceipt,
      numberPickerEngineAbi,
      "PlayRequested"
    );
    const requestId = numberPickerPlay.requestId as bigint;
    const requestSnapshot = await context.signers.Player1.scuro.flows.numberPicker.inspectRequest(requestId);
    const requestOutcome = requestSnapshot.outcome as any;
    const requestSettlement = requestSnapshot.settlementOutcome as any;

    expect(requestSnapshot.settled).toBe(true);
    expect(requestSnapshot.expressionTokenId).toBe(deployment.expressions.NumberPickerExpressionTokenId);
    expect(requestOutcome.player ?? requestOutcome[0]).toBe(context.signers.Player1.address);
    expect(requestSettlement.player ?? requestSettlement[0]).toBe(context.signers.Player1.address);
    expect(requestSettlement.completed ?? requestSettlement[3]).toBe(true);

    const tournamentApprovalAmount = parseEther("2");
    await waitForSuccessfulReceipt(
      publicClient,
      await context.signers.Player1.scuro.contracts.write.approveSettlement(tournamentApprovalAmount)
    );
    await waitForSuccessfulReceipt(
      publicClient,
      await context.signers.Player2.scuro.contracts.write.approveSettlement(tournamentApprovalAmount)
    );

    const createTournamentHash = await context.signers.Admin.scuro.contracts.write.createTournament({
      entryFee: parseEther("1"),
      rewardPool: parseEther("2"),
      startingStack: 1000n
    });
    const createTournamentReceipt = await waitForSuccessfulReceipt(publicClient, createTournamentHash);
    const tournamentCreated = findEventArgs(
      createTournamentReceipt,
      tournamentControllerAbi,
      "TournamentCreated"
    );
    const tournamentId = tournamentCreated.tournamentId as bigint;

    const startGameHash = await context.signers.Admin.scuro.contracts.write.startTournamentGame(
      tournamentId,
      context.signers.Player1.address,
      context.signers.Player2.address
    );
    const startGameReceipt = await waitForSuccessfulReceipt(publicClient, startGameHash);
    const startedGame = findEventArgs(startGameReceipt, tournamentControllerAbi, "GameStarted");
    const gameId = startedGame.gameId as bigint;
    const gameSnapshot = await context.signers.Admin.scuro.flows.tournament.inspectGame(gameId);

    expect(gameSnapshot.tournamentId).toBe(tournamentId);
    expect(gameSnapshot.phaseLabel).toBe("AwaitingInitialDeal");
    expect(gameSnapshot.isGameOver).toBe(false);

    await waitForSuccessfulReceipt(
      publicClient,
      await context.signers.Player1.scuro.contracts.write.approveSettlement(100n)
    );

    const startHandHash = await context.signers.Player1.scuro.contracts.write.startBlackjackHand({
      wager: 100n,
      playRef: uniquePlayRef("sdk-beta-blackjack"),
      playerKeyCommitment: uniquePlayRef("sdk-beta-blackjack-key")
    });
    const startHandReceipt = await waitForSuccessfulReceipt(publicClient, startHandHash);
    const startedHand = findEventArgs(startHandReceipt, blackjackControllerAbi, "HandStarted");
    const sessionId = startedHand.sessionId as bigint;
    const blackjackSnapshot = await context.signers.Player1.scuro.flows.blackjack.inspectSession(sessionId);
    const sessionExpressionTokenId =
      await context.signers.Player1.scuro.contracts.read.blackjack.sessionExpressionTokenId(sessionId);

    expect(blackjackSnapshot.phaseLabel).toBe("AwaitingInitialDeal");
    expect(blackjackSnapshot.sessionSettled).toBe(false);
    expect(blackjackSnapshot.session.player).toBe(context.signers.Player1.address);
    expect(sessionExpressionTokenId).toBe(deployment.expressions.BlackjackExpressionTokenId);
  }, 30_000);
});
