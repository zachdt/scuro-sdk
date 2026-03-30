# Coordinator Operations

The SDK includes two coordinator executors:

- `createPokerCoordinator(...)`
- `createBlackjackCoordinator(...)`

These helpers are meant for backend services that watch chain state, obtain proofs from an external provider, and submit the next valid transaction.

## Design Boundary

The coordinators do:

- inspect current engine and controller state
- decide whether the next valid action is proof submission, timeout claiming, settlement, or no-op
- submit transactions through SDK write helpers
- expose `snapshot()`, `step()`, and `runUntilIdle()` for app-controlled scheduling

The coordinators do not:

- generate proofs internally
- create their own background workers or schedulers
- persist progress for you
- manage retries, deduplication, or distributed locking
- fund or rotate signers

If you need those operational behaviors, build them in the surrounding service layer.

## Runtime Requirements

Coordinator services should run in a server process with:

- a `publicClient` that can read the target chain reliably
- a `walletClient` that can sign and submit writes
- deployment data that includes the required controller, engine, and verifier addresses
- an external proof provider that can produce calldata fields matching the engine expectations

`walletClient` is not optional in practice for coordinator services. The coordinator path eventually calls `contracts.write.*`, and those writes require a signer.

## Proof Provider Responsibilities

Proof generation stays outside the SDK. Your service injects provider implementations that return the concrete calldata fields each engine expects.

The proof provider is responsible for:

- turning a chain snapshot into witness/proof inputs
- choosing the correct proof type for the current phase
- returning calldata in the shape required by the SDK helper
- surfacing recoverable vs terminal provider failures to the surrounding service

The SDK is responsible for:

- loading chain state
- deciding which proof submission or timeout path is currently valid
- encoding and submitting the corresponding transaction

## Poker Coordinator

Create a poker coordinator from the root client:

```ts
const poker = scuro.coordinator.poker({
  mode: "pvp",
  proofProvider: {
    async provideInitialDeal(snapshot) {
      return {
        deckCommitment,
        handNonce,
        handCommitments,
        encryptionKeyCommitments,
        ciphertextRefs,
        proof
      };
    },
    async provideDraw(snapshot) {
      return {
        player: snapshot.player,
        newCommitment,
        newEncryptionKeyCommitment,
        newCiphertextRef,
        proof
      };
    },
    async provideShowdown(snapshot) {
      return {
        winnerAddr,
        isTie,
        proof
      };
    }
  }
});
```

The poker coordinator currently handles:

- initial deal proof submission
- draw proof submission for unresolved declared draws
- showdown proof submission
- player timeout claiming during player-clock phases
- controller settlement for PvP sessions after game completion
- controller outcome reporting for tournament games after game completion

### Tournament mode and `resolvePlayers(gameId)`

Tournament mode needs one extra dependency because player addresses are not recovered from the tournament controller alone.

```ts
const tournament = scuro.coordinator.poker({
  mode: "tournament",
  resolvePlayers: async (gameId) => {
    const game = await tournamentStore.load(gameId);
    return [game.player1, game.player2];
  },
  proofProvider: {
    async provideInitialDeal(snapshot) {
      return buildInitialDealProof(snapshot);
    },
    async provideDraw(snapshot) {
      return buildDrawProof(snapshot);
    },
    async provideShowdown(snapshot) {
      return buildShowdownProof(snapshot);
    }
  }
});
```

`resolvePlayers(gameId)` should return the same player ordering expected by the proof provider and downstream settlement logic.

## Blackjack Coordinator

```ts
const blackjack = scuro.coordinator.blackjack({
  proofProvider: {
    async provideInitialDeal(snapshot) {
      return {
        deckCommitment,
        handNonce,
        playerStateCommitment,
        dealerStateCommitment,
        playerCiphertextRef,
        dealerCiphertextRef,
        dealerVisibleValue,
        handCount,
        activeHandIndex,
        payout,
        immediateResultCode,
        handValues,
        handStatuses,
        allowedActionMasks,
        softMask,
        proof
      };
    },
    async provideNext(snapshot) {
      if (shouldSubmitAction(snapshot)) {
        return {
          kind: "action",
          args: {
            newPlayerStateCommitment,
            dealerStateCommitment,
            playerCiphertextRef,
            dealerCiphertextRef,
            dealerVisibleValue,
            handCount,
            activeHandIndex,
            nextPhase,
            handValues,
            handStatuses,
            allowedActionMasks,
            softMask,
            proof
          }
        };
      }

      return {
        kind: "showdown",
        args: {
          playerStateCommitment,
          dealerStateCommitment,
          payout,
          dealerFinalValue,
          handCount,
          activeHandIndex,
          handStatuses,
          proof
        }
      };
    }
  }
});
```

The blackjack coordinator currently handles:

- initial deal proof submission
- action proof submission
- showdown proof submission
- player timeout claims
- controller settlement after the engine marks the session complete

## Operating Patterns

### `step()`

Use `step()` when your scheduler wants one decision at a time and you want to observe each result explicitly:

```ts
const result = await blackjack.step(sessionId);

if (result.status === "submitted") {
  console.log(result.action, result.txHash);
}
```

This is the better fit when you need:

- per-step logging
- fine-grained retry control
- external backoff or queue orchestration
- distributed locking around each game or session

### `runUntilIdle()`

Use `runUntilIdle()` when you want to process a game or session repeatedly until no immediate action remains:

```ts
const results = await poker.runUntilIdle(gameId, 10);
```

This is useful for:

- synchronous reconciliation loops
- catch-up jobs after service restarts
- one-shot drain passes over a known backlog item

Keep `maxSteps` bounded so a bad proof provider or unexpected state transition cannot trap a worker in an unbounded loop.

## Production Guidance

### Signing and funding

- Use a dedicated signer for coordinator traffic.
- Fund it for the target network and monitor balance proactively.
- Keep chain, deployment profile, and signer ownership aligned so writes cannot target the wrong environment accidentally.

### Idempotency and retries

- Treat `step()` as an operational action, not a pure function.
- Persist enough state to avoid duplicate submissions after crashes or queue redelivery.
- Retries should distinguish between provider failures, transient RPC failures, and on-chain rejections.
- Use transaction hashes and current chain snapshot state to reconcile ambiguous outcomes.

### Persistence

The SDK does not remember prior runs. In production, persist at least:

- the game or session identifier being processed
- the most recent coordinator action
- provider job identifiers if proofs are produced asynchronously
- submitted transaction hashes and reconciliation status

### Observability

Use `snapshot()` for debugging and structured logging before you submit:

```ts
const snapshot = await blackjack.snapshot(sessionId);
logger.info({ sessionId, phase: snapshot.phaseLabel }, "blackjack snapshot");
```

Good telemetry usually includes:

- chain and deployment profile
- game or session id
- current phase label
- chosen coordinator action
- proof-provider latency
- transaction hash and confirmation result

### Concurrency control

- Process each game or session under a lock or single-owner queue.
- Avoid running multiple coordinators against the same id without coordination.
- Make `resolvePlayers(gameId)` deterministic and stable for tournament jobs.

## Practical Guidance

- Keep proof generation outside the SDK and inject it through provider interfaces.
- Run coordinators in backend services, not browser clients.
- Prefer `step()` for continuously running workers and `runUntilIdle()` for bounded reconciliation passes.
- Use `snapshot()` before submission when debugging or building audit trails.
