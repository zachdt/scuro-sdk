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
bun run test:int:beta:read
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
  - optionally runs a beta RPC smoke check if `ENABLE_BETA_RPC_SMOKE=true`
  - optionally runs the hosted-beta integration suite if `ENABLE_BETA_LIVE_INTEGRATION=true`
- `.github/workflows/publish.yml`
  - publishes on GitHub Release publication
  - sends GitHub prereleases to npm `beta`
  - sends stable GitHub releases to npm `latest`
  - uses npm trusted publishing via GitHub OIDC
  - runs the hosted-beta integration suite before beta publishes
  - can also be run manually with `workflow_dispatch`, but requires an explicit npm dist-tag

### Required GitHub configuration

For npm trusted publishing:

1. Create the package on npm if needed.
2. Add this repository and `.github/workflows/publish.yml` as a trusted publisher in npm package settings.
3. Publish from a GitHub-hosted runner.

GitHub repository settings needed for the publish workflow itself:

- Required repository secrets: none
- Required repository variables for beta release gating: `SCURO_BETA_AWS_ROLE_ARN`
- Required environment secrets: none
- Required environment variables: none
- Optional repository variable: `ENABLE_BETA_RPC_SMOKE=true` to run the hosted beta smoke step before publish
- Optional repository variable: `ENABLE_BETA_LIVE_INTEGRATION=true` to run the hosted-beta integration suite on normal CI
- Optional repository variable for hosted-beta CI/publish: `SCURO_BETA_AWS_REGION` defaulting to `us-east-1`
- Optional repository variable for hosted-beta CI/publish: `SCURO_BETA_RUNTIME_ENV_PARAMETER` defaulting to `/scuro/beta/runtime-env`

The publish workflow uses GitHub OIDC, so you do not need to store an `NPM_TOKEN` in GitHub for normal releases.

### Optional beta testnet configuration

If you want the workflows to ping the hosted beta RPC before release:

- add the repository variable `ENABLE_BETA_RPC_SMOKE` with value `true`

The beta smoke job is intentionally read-only and is not required for package publication.
`bun run smoke:beta` now targets the checked-in `testnet-beta` deployment profile directly, so GitHub no longer needs separate RPC URL or chain ID settings for that check.
If the hosted beta endpoint changes, update the checked-in `testnet-beta` profile instead of reconfiguring workflow variables.

### Hosted beta integration configuration

Use the hosted-beta integration suite when you want more than a plain RPC ping:

```bash
bun run test:int:beta:read
bun run test:int:beta:signer
bun run test:int:beta
```

The read-only lane validates the checked-in `testnet-beta` profile against the canonical S3 release artifacts and exercises stable live reads.
The signer lane additionally loads `PRIVATE_KEY`, `PLAYER1_PRIVATE_KEY`, and `PLAYER2_PRIVATE_KEY` from the beta runtime SSM parameter and performs additive live write smoke coverage.

Defaults:

- `SCURO_BETA_AWS_REGION=us-east-1`
- `SCURO_BETA_RUNTIME_ENV_PARAMETER=/scuro/beta/runtime-env`

## Testing strategy

Current test coverage focuses on:

- manifest loading
- registry normalization
- enum decoding
- deployment-param encoding
- tx builder shape
- coordinator state machine behavior
- Node import smoke coverage against built output
- hosted-beta release artifact validation, live reads, and additive signer-backed smoke coverage

Still missing:

- live local-chain integration coverage against the sibling Scuro deployment scripts
- proof-provider integration with real witness/proof generation
