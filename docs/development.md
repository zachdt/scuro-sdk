# Development

This SDK depends on the sibling Scuro protocol repo for metadata generation during development.

By default the generator looks for:

```text
../scuro
```

You can override that with `SCURO_PROTOCOL_ROOT`.

## Local workflow

Install dependencies:

```bash
bun install
```

Regenerate checked-in protocol metadata:

```bash
bun run generate-protocol
```

Run the verification steps:

```bash
bun test
bun run typecheck
bun run build
bun run smoke:node
bun run release:check
```

## What the generator does

[`scripts/generate-protocol.mjs`](../scripts/generate-protocol.mjs) reads the Scuro docs bundle and emits:

- `src/generated/protocol.ts`
- `src/generated/abis.ts`
- `src/generated/index.ts`

The generated module includes:

- the protocol manifest
- enum label maps
- event signature metadata
- proof-input field order metadata
- ABI constants keyed by contract name
- derived deployment label unions

The generator is meant to be deterministic and checked in.

## Build outputs

`bun run build` produces ESM bundles plus declaration files in `dist/`.

Current public build targets:

- `dist/index.js`
- `dist/manifest.js`
- `dist/registry.js`
- `dist/contracts.js`
- `dist/flows.js`
- `dist/coordinator.js`
- `dist/types.js`

## Release workflow

Before publishing, run:

```bash
bun run release:check
```

That command verifies:

- tests pass
- TypeScript typecheck passes
- the ESM build and declaration emit succeed
- the expected exported files exist in `dist/`

After that, create a tarball locally with:

```bash
bun run release:pack
```

The full maintainer release guide is in [`docs/releasing.md`](./releasing.md).

## GitHub Actions

This repo includes:

- `.github/workflows/ci.yml`
  - runs package verification on pull requests and pushes to `main`
  - optionally runs a beta RPC smoke check if `BETA_TESTNET_RPC_URL` is configured
- `.github/workflows/publish.yml`
  - publishes on GitHub Release publication
  - sends GitHub prereleases to npm `beta`
  - sends stable GitHub releases to npm `latest`
  - uses npm trusted publishing via GitHub OIDC
  - can also be run manually with `workflow_dispatch`, but requires an explicit npm dist-tag

### Required GitHub configuration

For npm trusted publishing:

1. Create the package on npm if needed.
2. Add this repository and `.github/workflows/publish.yml` as a trusted publisher in npm package settings.
3. Publish from a GitHub-hosted runner.

### Optional beta testnet configuration

If you want the workflows to ping the live beta RPC before release:

- add the repository secret `BETA_TESTNET_RPC_URL`
- optionally add the repository variable `BETA_TESTNET_EXPECTED_CHAIN_ID`

The beta smoke job is intentionally read-only and is not required for package publication.
The SDK now also ships a checked-in `testnet-beta` deployment profile pinned to the March 30, 2026 private AWS beta release handoff. The smoke check is still useful as a liveness check against that public RPC, but it does not fetch or mutate deployment metadata at runtime.

## Testing strategy

Current test coverage focuses on:

- manifest loading
- registry normalization
- enum decoding
- deployment-param encoding
- tx builder shape
- coordinator state machine behavior
- Node import smoke coverage against built output

Still missing:

- live local-chain integration coverage against the sibling Scuro deployment scripts
- proof-provider integration with real witness/proof generation
