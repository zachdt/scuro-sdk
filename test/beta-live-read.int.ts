import { describe, expect, test } from "bun:test";

import { developerExpressionRegistryAbi } from "../src/generated/abis";
import { getHostedBetaReadContext } from "./beta-support";

describe("hosted beta read-only integration", () => {
  test("matches the canonical beta release artifacts", async () => {
    const context = await getHostedBetaReadContext();

    expect(context.profile.rpcUrl).toBe(context.releaseRecord.publicRpcUrl);
    expect(context.profile.chainId).toBe(context.manifest.chain.chainId);
    expect(context.manifest.deploymentStatus).toBe("completed");
    expect(context.actorsFile.privateKeys).toEqual({
      Admin: "PRIVATE_KEY",
      Player1: "PLAYER1_PRIVATE_KEY",
      Player2: "PLAYER2_PRIVATE_KEY"
    });

    for (const [label, value] of Object.entries(context.profile.labels)) {
      expect(context.manifest.contracts[label]).toBe(value);
    }

    for (const [actor, address] of Object.entries(context.actorsFile.actors)) {
      expect(context.manifest.actors[actor]).toBe(address);
    }
  });

  test("resolves live core reads against the hosted beta rpc", async () => {
    const context = await getHostedBetaReadContext();
    const { deployment } = context.scuro;
    const chainId = await context.publicClient.getChainId();
    const blockNumber = await context.publicClient.getBlockNumber();
    const governance = await context.scuro.flows.governance.readConfig();

    expect(chainId).toBe(context.profile.chainId);
    expect(blockNumber).toBeGreaterThan(0n);
    expect(typeof governance.proposalThreshold).toBe("bigint");
    expect(typeof governance.votingDelay).toBe("bigint");
    expect(typeof governance.votingPeriod).toBe("bigint");

    expect(
      await context.scuro.contracts.read.catalog.isLaunchableController(
        deployment.contracts.NumberPickerAdapter!
      )
    ).toBe(true);
    expect(
      await context.scuro.contracts.read.catalog.isAuthorizedControllerForEngine(
        deployment.contracts.NumberPickerAdapter!,
        deployment.contracts.NumberPickerEngine!
      )
    ).toBe(true);
    expect(
      await context.scuro.contracts.read.catalog.isLaunchableController(
        deployment.contracts.TournamentController!
      )
    ).toBe(true);
    expect(
      await context.scuro.contracts.read.catalog.isAuthorizedControllerForEngine(
        deployment.contracts.TournamentController!,
        deployment.contracts.TournamentPokerEngine!
      )
    ).toBe(true);
    expect(
      await context.scuro.contracts.read.catalog.isLaunchableController(
        deployment.contracts.PvPController!
      )
    ).toBe(true);
    expect(
      await context.scuro.contracts.read.catalog.isAuthorizedControllerForEngine(
        deployment.contracts.PvPController!,
        deployment.contracts.PvPPokerEngine!
      )
    ).toBe(true);
    expect(
      await context.scuro.contracts.read.catalog.isLaunchableController(
        deployment.contracts.BlackjackController!
      )
    ).toBe(true);
    expect(
      await context.scuro.contracts.read.catalog.isAuthorizedControllerForEngine(
        deployment.contracts.BlackjackController!,
        deployment.contracts.SingleDeckBlackjackEngine!
      )
    ).toBe(true);

    expect(
      await context.publicClient.readContract({
        address: deployment.contracts.DeveloperExpressionRegistry!,
        abi: developerExpressionRegistryAbi,
        functionName: "ownerOf",
        args: [deployment.expressions.NumberPickerExpressionTokenId!]
      })
    ).toBe(context.actorsFile.actors.SoloDeveloper!);
    expect(
      await context.publicClient.readContract({
        address: deployment.contracts.DeveloperExpressionRegistry!,
        abi: developerExpressionRegistryAbi,
        functionName: "ownerOf",
        args: [deployment.expressions.PokerExpressionTokenId!]
      })
    ).toBe(context.actorsFile.actors.PokerDeveloper!);
    expect(
      await context.publicClient.readContract({
        address: deployment.contracts.DeveloperExpressionRegistry!,
        abi: developerExpressionRegistryAbi,
        functionName: "ownerOf",
        args: [deployment.expressions.BlackjackExpressionTokenId!]
      })
    ).toBe(context.actorsFile.actors.SoloDeveloper!);
  });

  test("documents the missing engine registry address in the current beta snapshot", async () => {
    const context = await getHostedBetaReadContext();

    expect(context.profile.labels.GameEngineRegistry).toBeUndefined();
    expect(context.manifest.contracts.GameEngineRegistry).toBeUndefined();
  });
});
