# Integration Guide

This guide is for backend applications and services integrating Scuro through the SDK.

It covers:

- choosing a deployment source
- creating read-only and signer-enabled clients
- using the main helper layers intentionally
- preparing and submitting transactions safely
- wiring a minimal end-to-end backend flow

## Integration Model

The SDK is organized around a few distinct layers:

- `manifest`: checked-in protocol metadata and ABIs
- `registry`: deployment profiles and deployment normalization
- `contracts`: low-level reads, writes, event decoding, and tx encoders
- `flows`: workflow-oriented helpers with common guards
- `coordinator`: service-side proof submission loops for poker and blackjack
- `events`: ABI-backed event decoding from the root client

In practice:

- use `manifest` when you need protocol metadata without touching chain state
- use `registry` when you need to load or normalize deployment data
- use `contracts` when you want exact read/write control
- use `flows` when you want a more guided application workflow
- use `coordinator` only for backend services that own proof submission responsibilities

## Choose a Deployment Source

The SDK ships two built-in profiles:

- `anvil-local`: local Foundry/Anvil development
- `testnet-beta`: checked-in hosted beta snapshot pinned to the April 1, 2026 iterate-runtime artifact

Use a built-in profile when your service should target one of those environments directly:

```ts
import { getDeploymentProfile } from "@scuro/sdk/registry";

const profile = getDeploymentProfile("testnet-beta");
if (!profile?.rpcUrl) {
  throw new Error("missing testnet-beta profile");
}
```

Use a custom profile when your deployment records live outside the SDK:

```ts
import { defineDeploymentProfile } from "@scuro/sdk/registry";

const staging = defineDeploymentProfile({
  key: "staging",
  name: "Staging",
  chainId: 31337,
  rpcUrl: "https://staging-rpc.example.com",
  labels: {
    ScuroToken: "0x1000000000000000000000000000000000000001",
    ScuroGovernor: "0x1000000000000000000000000000000000000002",
    GameCatalog: "0x1000000000000000000000000000000000000003",
    ProtocolSettlement: "0x1000000000000000000000000000000000000004",
    NumberPickerModuleId: "1",
    NumberPickerExpressionTokenId: "1",
    Admin: "0x1000000000000000000000000000000000000005"
  }
});
```

Use `normalizeDeploymentLabels(...)` when you already have raw deployment labels and want the typed `contracts`, `actors`, `moduleIds`, and `expressions` shape used throughout the SDK:

```ts
import { normalizeDeploymentLabels } from "@scuro/sdk/registry";

const deployment = normalizeDeploymentLabels({
  ScuroToken: "0x1000000000000000000000000000000000000001",
  GameCatalog: "0x1000000000000000000000000000000000000002",
  ProtocolSettlement: "0x1000000000000000000000000000000000000003",
  NumberPickerModuleId: "1",
  NumberPickerExpressionTokenId: "1",
  Admin: "0x1000000000000000000000000000000000000004"
});
```

Use `mergeProfileWithLabels(...)` when you want to start from a built-in or existing profile and override a smaller set of labels:

```ts
import { getDeploymentProfile, mergeProfileWithLabels } from "@scuro/sdk/registry";

const base = getDeploymentProfile("testnet-beta");
if (!base) {
  throw new Error("missing testnet-beta profile");
}

const patched = mergeProfileWithLabels(base, {
  ProtocolSettlement: "0x1000000000000000000000000000000000000010"
});
```

## Create a Client

### Read-only client

`walletClient` is optional on `createScuroClient(...)`. If you only need chain reads, metadata access, inspection helpers, or transaction preparation, a public client is enough.

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

const governance = await scuro.flows.governance.readConfig();
const metadata = scuro.manifest.getContractMetadata("ProtocolSettlement");
```

### Signer-enabled client

Provide a `walletClient` when you want SDK writes such as `contracts.write.*` or coordinator submissions to execute on-chain.

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

await scuro.contracts.write.approveSettlement(1000n);
```

If `walletClient` is omitted, read and encode helpers continue to work, but write helpers will throw when called.

## Use the Helper Layers Intentionally

### Manifest and registry

Use these layers at service startup when you need checked-in metadata or deployment bootstrapping:

```ts
const manifest = scuro.manifest.getProtocolManifest();
const abi = scuro.manifest.getAbi("GameCatalog");
const profiles = scuro.registry.listDeploymentProfiles();
```

### Contracts

Use `contracts.read` and `contracts.encode` when you want explicit control over data fetching and tx submission:

```ts
const state = await scuro.contracts.read.governance.state(1n);

const tx = scuro.contracts.encode.approveSettlement(1000n);
// submit through your own wallet pipeline or relay service
```

Use `contracts.write` when the service itself owns signing and submission:

```ts
const txHash = await scuro.contracts.write.approveSettlement(1000n);
```

Use `events.decode(...)` when you already know which contract ABI family to decode against:

```ts
const decoded = scuro.events.decode("ProtocolSettlement", {
  data: log.data,
  topics: log.topics
});
```

### Flows

Use `flows` when you want protocol-aware helpers that already apply common state checks:

```ts
const spinTx = scuro.flows.slotMachine.prepareSpin({
  stake: 10n,
  presetId: 1n,
  playRef: "0x" + "11".repeat(32),
  expressionTokenId: 7n
});

const settleTx = await scuro.flows.blackjack.prepareSettlement(12n);
```

These helpers are especially useful for application services that want a cleaner workflow API without hiding contract boundaries completely.

## Transaction Lifecycle

The SDK supports two common write patterns.

### Pattern 1: prepare first, submit elsewhere

Use this when another service, signer, relayer, or queue owns transaction dispatch:

```ts
const tx = scuro.contracts.encode.approveSettlement(1000n);

await queuePreparedTransaction({
  to: tx.to,
  data: tx.data,
  value: tx.value
});
```

### Pattern 2: inspect, prepare, then submit from the same service

Use this when the application wants to gate writes on current state:

```ts
const session = await scuro.flows.blackjack.inspectSession(12n);

const activeHand = session.hands[session.session.activeHandIndex];
console.log({
  playerCards: session.playerCards,
  dealerCards: session.dealerCards,
  dealerRevealMask: session.dealerRevealMask,
  payoutKind: activeHand?.payoutKind
});

if (!session.settlementOutcome.completed) {
  throw new Error("session is not ready to settle");
}

const txHash = await scuro.contracts.write.blackjackSettle(12n);
```

The `flows` layer is usually the better fit for guarded operations because it already performs common readiness checks and returns a prepared request only when the action is valid.
For blackjack v2 UIs, treat `hands[i].payoutKind` as the source of truth for blackjack bonus classes and use `dealerRevealMask` to decide which dealer slots are visible.

## End-to-End Backend Example

This example shows a typical server integration:

- load a deployment profile
- construct a signer-enabled client
- read metadata and current chain state
- prepare a workflow action
- submit a write through the SDK

```ts
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { createScuroClient, getDeploymentProfile } from "@scuro/sdk";

export async function settleBlackjackSession(sessionId: bigint) {
  const profile = getDeploymentProfile("anvil-local");
  if (!profile?.rpcUrl || !profile.privateKeys?.Admin) {
    throw new Error("missing local deployment config");
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

  const manifest = scuro.manifest.getProtocolManifest();
  const inspection = await scuro.flows.blackjack.inspectSession(sessionId);

  if (!inspection.settlementOutcome.completed) {
    return {
      status: "waiting",
      contractCount: manifest.contracts.length
    };
  }

  const settleTx = await scuro.flows.blackjack.prepareSettlement(sessionId);
  const txHash = await walletClient.sendTransaction({
    account,
    to: settleTx.to,
    data: settleTx.data,
    value: settleTx.value
  });

  return {
    status: "submitted",
    txHash
  };
}
```

This pattern keeps the application in control of inspection, queuing, signing, and observability while still using the SDK for typed protocol behavior.

## When to Use the Coordinator Layer

If your service is responsible for poker or blackjack proof submission, move to the coordinator guide next:

- [docs/coordinators.md](./coordinators.md)

Use the coordinator layer only when your service owns:

- chain polling
- proof-provider integration
- write submission and signer funding
- retry, persistence, and monitoring behavior
