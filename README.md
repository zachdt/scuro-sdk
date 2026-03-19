# Scuro SDK

Bun-first TypeScript SDK for the Scuro protocol.

This package is aimed at Node/Bun integrators who need to:

- load Scuro protocol metadata and ABIs
- normalize deployment outputs into typed addresses and ids
- build typed `viem` contract reads and transaction requests
- use higher-level gameplay and staking helpers
- run coordinator-style poker and blackjack proof workflows

The SDK currently targets Bun first and standard Node server runtimes second. Browser support is out of scope for this version.

## Status

This is an early v1 scaffold with a working package surface, generated metadata pipeline, unit tests, and build output.

What is included:

- root client via `createScuroClient(...)`
- subpath-ready modules for `manifest`, `registry`, `contracts`, `flows`, `coordinator`, and `types`
- generated protocol manifest, enum labels, event signatures, proof-input metadata, and ABI constants
- typed tx builders for staking, governance, gameplay, settlement, engine-registry admin actions, proof submission, and supported factory deployments
- runtime helpers for NumberPicker, Slot Machine, Super Baccarat, Chemin de Fer, poker, and blackjack
- slot preset admin helpers and GameEngineRegistry read/write helpers
- poker and blackjack coordinator executors with injected proof providers

What is not included yet:

- bundled proof generation or witness tooling
- real non-local deployment profiles
- full live integration tests against a running local Scuro deployment

## Package layout

The package exports these entrypoints:

- `@scuro/sdk`
- `@scuro/sdk/manifest`
- `@scuro/sdk/registry`
- `@scuro/sdk/contracts`
- `@scuro/sdk/flows`
- `@scuro/sdk/coordinator`
- `@scuro/sdk/types`

The root entrypoint re-exports the main client constructor and the support modules.

## Quick start

```ts
import { createPublicClient, createWalletClient, http } from "viem";
import { foundry } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createScuroClient, getDeploymentProfile } from "@scuro/sdk";

const deployment = getDeploymentProfile("anvil-local");
if (!deployment) {
  throw new Error("missing anvil-local profile");
}

const publicClient = createPublicClient({
  chain: foundry,
  transport: http(deployment.rpcUrl)
});

const walletClient = createWalletClient({
  chain: foundry,
  transport: http(deployment.rpcUrl),
  account: privateKeyToAccount(deployment.privateKeys!.Admin!)
});

const scuro = createScuroClient({
  publicClient,
  walletClient,
  deployment
});

const manifest = scuro.manifest.getProtocolManifest();
const approveTx = scuro.contracts.encode.approveSettlement(1000n);
```

## Core concepts

### `manifest`

Use manifest helpers when you need checked-in protocol metadata, not chain state.

```ts
import { getAbi, getContractMetadata, getProtocolManifest } from "@scuro/sdk/manifest";

const manifest = getProtocolManifest();
const settlementMeta = getContractMetadata("ProtocolSettlement");
const settlementAbi = getAbi("ProtocolSettlement");
```

### `registry`

Use registry helpers to normalize local deploy-script output or your own chain-specific deployment records.

```ts
import { normalizeDeploymentLabels } from "@scuro/sdk/registry";

const deployment = normalizeDeploymentLabels({
  ScuroToken: "0x1000000000000000000000000000000000000001",
  GameCatalog: "0x1000000000000000000000000000000000000005",
  NumberPickerModuleId: "1",
  NumberPickerExpressionTokenId: "1"
});
```

### `contracts`

Use contract helpers when you want typed transaction preparation, direct reads, and low-level control over write submission.

```ts
const tx = scuro.contracts.encode.startBlackjackHand({
  wager: 10n,
  playRef: "0x" + "11".repeat(32),
  playerKeyCommitment: "0x" + "22".repeat(32)
});

const session = await scuro.contracts.read.blackjack.session(1n);
```

### `flows`

Use flow helpers when you want documented workflow steps with some state guards already applied.

```ts
const stakingTxs = scuro.flows.staking.prepareApproveAndStake({
  approveAmount: 1000n,
  stakeAmount: 1000n,
  delegatee: deployment.labels.Admin
});

const blackjackActionTx = await scuro.flows.blackjack.prepareAction(7n, "doubleDown");
const slotTx = scuro.flows.slotMachine.prepareSpin({
  stake: 10n,
  presetId: 1n,
  playRef: "0x" + "33".repeat(32),
  expressionTokenId: 7n
});
```

### `coordinator`

Use coordinator helpers for operational proof submission loops.

Proof generation stays outside the SDK. You inject proof providers that return the concrete calldata fields each engine expects.

```ts
const blackjackCoordinator = scuro.coordinator.blackjack({
  proofProvider: {
    async provideInitialDeal(snapshot) {
      return buildInitialDealProof(snapshot);
    },
    async provideNext(snapshot) {
      return buildNextBlackjackProof(snapshot);
    }
  }
});

await blackjackCoordinator.runUntilIdle(3n);
```

More detail is in [docs/coordinators.md](./docs/coordinators.md).

## Supported helpers in this version

### Gameplay and protocol helpers

- staking approvals, stake, unstake, and delegation
- governance reads for threshold, delay, period, quorum, and state
- catalog reads for module metadata and launchability checks
- GameEngineRegistry reads and admin writes
- NumberPicker play/finalize helpers
- Slot Machine spin/settle helpers and slot preset admin helpers
- Super Baccarat play/settle helpers
- Chemin de Fer table lifecycle helpers
- PvP poker session create/settle helpers
- tournament poker create/start/report helpers
- blackjack start/action/timeout/settle helpers
- settlement tx builders
- event decoding through protocol ABIs

### Factory deployment helpers

Typed deployment-param encoders are included for:

- NumberPicker
- Blackjack
- Super Baccarat
- Slot Machine
- Poker Single Draw 2-7
- Chemin de Fer Baccarat

Unsupported or underdocumented families should use the raw factory escape hatches. For the new solo and chemin modules, gameplay helpers require explicit `expressionTokenId` values rather than relying on built-in local profile defaults.

## Generated metadata

The SDK does not read the sibling Scuro repo at runtime.

Instead, `bun run generate-protocol` uses the checked-in upstream generated metadata as a base, then supplements missing module surfaces from sibling protocol artifacts:

- `../scuro/docs/generated/protocol-manifest.json`
- `../scuro/docs/generated/enum-labels.json`
- `../scuro/docs/generated/event-signatures.json`
- `../scuro/docs/generated/proof-inputs.json`
- `../scuro/docs/generated/contracts/*.abi.json`
- `../scuro/out/SlotMachine*.json`
- `../scuro/out/SuperBaccarat*.json`
- `../scuro/out/CheminDeFer*.json`
- `../scuro/out/ICheminDeFerEngine.sol/ICheminDeFerEngine.json`

The generated output is written into [`src/generated`](./src/generated).

## Development

Install dependencies:

```bash
bun install
```

Regenerate protocol metadata:

```bash
bun run generate-protocol
```

Run checks:

```bash
bun test
bun run typecheck
bun run build
bun run smoke:node
bun run release:check
```

More detail is in [docs/development.md](./docs/development.md).

## Release preparation

The package is set up to publish from built `dist/` output only.

Useful commands:

```bash
bun run release:check
npm pack
```

`bun run release:check` runs tests, typechecking, a fresh build, and a local release verification pass that confirms the exported files exist.

## Notes and caveats

- The built-in registry only includes a seeded local Anvil profile right now.
- The coordinator layer is designed for server-side orchestration, not browser automation.
- Public helper types are intentionally lightweight in this revision to keep declaration output stable while the API is still settling.
