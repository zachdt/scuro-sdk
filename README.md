# Scuro SDK

Server-side TypeScript SDK for the Scuro protocol.

This package is for backend applications and services that need to:

- load checked-in Scuro protocol metadata and ABIs
- normalize deployment outputs into typed addresses and ids
- prepare typed `viem` contract reads and transaction requests
- use higher-level gameplay, settlement, and staking helpers
- run coordinator-style poker and blackjack proof submission loops

The SDK supports standard Node.js and Bun server runtimes. It ships ESM output and is not intended for browser clients in this version.

## Status

This is an early v1 SDK with a working package surface, generated metadata pipeline, unit tests, hosted-beta integration coverage, and publishable build output.

Included today:

- root client via `createScuroClient(...)`
- subpath exports for `manifest`, `registry`, `contracts`, `flows`, `coordinator`, and `types`
- generated protocol manifest, enum labels, event signatures, proof-input metadata, and ABI constants
- typed tx builders for staking, governance, gameplay, settlement, engine-registry admin actions, proof submission, and supported factory deployments
- runtime helpers for NumberPicker, Slot Machine, Super Baccarat, Chemin de Fer, poker, and blackjack
- slot preset admin helpers and GameEngineRegistry read/write helpers
- poker and blackjack coordinator executors with injected proof providers
- hosted `testnet-beta` integration tests for canonical release-artifact checks, live reads, and additive signer-backed smoke coverage

Not included yet:

- bundled proof generation or witness tooling
- automatic fetching of hosted beta release manifests or actor records
- sibling local-deployment integration coverage against the Scuro protocol repo's deployment scripts

## Install

Use the prerelease channel while the SDK is aligned to the hosted beta network snapshot:

```bash
npm install @scuro/sdk@beta
```

Use the stable channel only after a version has been intentionally promoted:

```bash
npm install @scuro/sdk
```

## Runtime Expectations

- Server-side runtime only: Node.js 18.14+ or Bun 1.3+
- Package format: ESM
- Primary transport/client dependency: [`viem`](https://viem.sh/)
- Browser support: out of scope for this release

## Quick Start

### Read-only client

Use a read-only client when you only need metadata, chain reads, or tx preparation.

```ts
import { createPublicClient, http } from "viem";
import { foundry } from "viem/chains";
import { createScuroClient, getDeploymentProfile } from "@scuro/sdk";

const profile = getDeploymentProfile("anvil-local");
if (!profile?.rpcUrl) {
  throw new Error("missing anvil-local profile");
}

const publicClient = createPublicClient({
  chain: foundry,
  transport: http(profile.rpcUrl)
});

const scuro = createScuroClient({
  publicClient,
  deployment: profile
});

const manifest = scuro.manifest.getProtocolManifest();
const governorDelay = await scuro.flows.governance.readConfig();
const approveTx = scuro.contracts.encode.approveSettlement(1000n);
```

### Signer-enabled client

Add `walletClient` when you want the SDK to submit writes for you. Read and encode helpers still work without it.

```ts
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { createScuroClient, getDeploymentProfile } from "@scuro/sdk";

const profile = getDeploymentProfile("anvil-local");
if (!profile?.rpcUrl || !profile.privateKeys?.Admin) {
  throw new Error("missing anvil-local signer config");
}

const transport = http(profile.rpcUrl);
const account = privateKeyToAccount(profile.privateKeys.Admin);

const publicClient = createPublicClient({
  chain: foundry,
  transport
});

const walletClient = createWalletClient({
  chain: foundry,
  transport,
  account
});

const scuro = createScuroClient({
  publicClient,
  walletClient,
  deployment: profile
});

const txHash = await scuro.contracts.write.approveSettlement(1000n);
```

Built-in deployment profiles currently include:

- `anvil-local` for local Foundry/Anvil development
- `testnet-beta` for the hosted private beta pinned to the March 30, 2026 release handoff

Beta package releases should only move the checked-in `testnet-beta` snapshot intentionally when a new hosted deployment is promoted.

## Entrypoints

### `@scuro/sdk`

The root entrypoint exports the main client constructor plus the support modules.

### `@scuro/sdk/manifest`

Use manifest helpers when you need checked-in protocol metadata instead of chain state.

```ts
import { getAbi, getContractMetadata, getProtocolManifest } from "@scuro/sdk/manifest";

const manifest = getProtocolManifest();
const settlementMeta = getContractMetadata("ProtocolSettlement");
const settlementAbi = getAbi("ProtocolSettlement");
```

### `@scuro/sdk/registry`

Use registry helpers for built-in deployment profiles or to register and normalize your own deployment records.

```ts
import {
  defineDeploymentProfile,
  getDeploymentProfile,
  normalizeDeploymentLabels
} from "@scuro/sdk/registry";

const hostedBeta = getDeploymentProfile("testnet-beta");

defineDeploymentProfile({
  key: "staging",
  name: "Staging",
  chainId: 31337,
  rpcUrl: "https://staging-rpc.example.com",
  labels: {
    ScuroToken: "0x1000000000000000000000000000000000000001",
    GameCatalog: "0x1000000000000000000000000000000000000005",
    NumberPickerModuleId: "1",
    NumberPickerExpressionTokenId: "1"
  }
});

const deployment = normalizeDeploymentLabels({
  ScuroToken: "0x1000000000000000000000000000000000000001",
  GameCatalog: "0x1000000000000000000000000000000000000005",
  NumberPickerModuleId: "1",
  NumberPickerExpressionTokenId: "1"
});
```

### `@scuro/sdk/contracts`

Use contract helpers when you want typed transaction preparation, direct reads, and explicit write submission.

```ts
const tx = scuro.contracts.encode.startBlackjackHand({
  wager: 10n,
  playRef: "0x" + "11".repeat(32),
  playerKeyCommitment: "0x" + "22".repeat(32)
});

const session = await scuro.contracts.read.blackjack.session(1n);
```

### `@scuro/sdk/flows`

Use flow helpers when you want workflow-oriented helpers with useful state guards already applied.

```ts
const stakingTxs = scuro.flows.staking.prepareApproveAndStake({
  approveAmount: 1000n,
  stakeAmount: 1000n,
  delegatee: scuro.deployment.actors.Admin
});

const blackjackActionTx = await scuro.flows.blackjack.prepareAction(7n, "doubleDown");
const blackjackSession = await scuro.flows.blackjack.inspectSession(7n);
const slotTx = scuro.flows.slotMachine.prepareSpin({
  stake: 10n,
  presetId: 1n,
  playRef: "0x" + "33".repeat(32),
  expressionTokenId: 7n
});
```

Blackjack v2 session inspection now includes flattened `playerCards`, masked `dealerCards`, `dealerRevealMask`, and per-hand `cardCount` / `payoutKind`. Render blackjack bonuses from `payoutKind` and settled `payout` instead of recomputing them client-side.

### `@scuro/sdk/coordinator`

Use coordinator helpers for operational proof submission loops in backend services.

Proof generation stays outside the SDK. You inject proof providers that return the calldata each engine expects.

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

## Deeper Guides

- Integration guide: [docs/integration.md](./docs/integration.md)
- Coordinator operations: [docs/coordinators.md](./docs/coordinators.md)
- Contributor development workflow: [docs/development.md](./docs/development.md)
- Maintainer release workflow: [docs/releasing.md](./docs/releasing.md)

## Notes and Caveats

- The built-in registry currently ships `anvil-local` and the pinned `testnet-beta` hosted profile.
- `walletClient` is optional on `createScuroClient(...)`, but write helpers require a signer and will fail without one.
- The coordinator layer is designed for server-side orchestration, not browser automation.
- Public helper types are intentionally lightweight in this revision to keep declaration output stable while the API is still settling.
