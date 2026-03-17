# Coordinator Usage

The SDK includes two coordinator executors:

- `createPokerCoordinator(...)`
- `createBlackjackCoordinator(...)`

These are operational helpers for services that watch chain state, request proofs from external providers, and submit the next valid transaction.

## Design boundary

The coordinators do:

- poll and inspect current engine/controller state
- derive the next valid proof or timeout action
- submit transactions through the SDK write helpers
- expose `step()` and `runUntilIdle()` for app-controlled scheduling

The coordinators do not:

- generate proofs internally
- run background jobs by themselves
- manage retries, persistence, or distributed locks for you

## Poker coordinator

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
- controller settlement/reporting after game completion

Tournament mode additionally needs `resolvePlayers(gameId)` because player addresses are not recovered from the tournament controller alone.

## Blackjack coordinator

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

## Operating pattern

The intended usage is explicit app-controlled scheduling:

```ts
const result = await blackjack.step(sessionId);

if (result.status === "submitted") {
  console.log(result.action, result.txHash);
}
```

Or batched stepping until no immediate work remains:

```ts
const results = await poker.runUntilIdle(gameId, 10);
```

## Practical guidance

- Keep proof generation outside the SDK and inject it through provider interfaces.
- Persist your own per-game/session job state if you need retry safety.
- Use `snapshot()` for observability and debugging before submitting proofs.
- Run these helpers in server processes, not browser clients.

