# Releasing

This package uses a two-lane release model:

- GitHub Release is the canonical publish path.
- GitHub prereleases publish to npm with the `beta` dist-tag.
- Stable GitHub releases publish to npm with the `latest` dist-tag.

The built-in `testnet-beta` deployment profile is a checked-in snapshot of the hosted beta network. Beta SDK releases should only change that snapshot intentionally when a new deployment handoff is ready to ship.

## Versioning rules

- First public beta release: `0.1.0-beta.1`
- Later beta releases: increment the prerelease number, for example `0.1.0-beta.2`
- First stable promotion: `0.1.0`
- Post-stable fixes: continue with normal semver, for example `0.1.1`

If the npm registry already has a conflicting prerelease version, bump to the next valid prerelease version before cutting the release.

## Maintainer preflight

1. Confirm npm access for `@scuro/sdk` and verify npm trusted publishing is configured for this repository and `.github/workflows/publish.yml`.
2. Update `package.json` to the version you intend to release.
3. Run the local checks:

   ```bash
   bun install
   bun run release:check
   ```

4. Run the hosted beta integration suite before beta publishes:

   ```bash
   bun run test:int:beta
   ```

   The suite uses the AWS CLI plus:

   - `SCURO_BETA_AWS_REGION` defaulting to `us-east-1`
   - `SCURO_BETA_RUNTIME_ENV_PARAMETER` defaulting to `/scuro/beta/runtime-env`

5. Optionally run the fast hosted beta RPC smoke test against the checked-in `testnet-beta` profile:

   ```bash
   bun run smoke:beta
   ```

6. Build and inspect the publish tarball:

   ```bash
   bun run release:pack
   ```

7. Review the tarball in `.artifacts/releases/` and confirm the checked-in `testnet-beta` profile matches the deployment snapshot you want to ship.

## GitHub settings required to release

For the GitHub Actions release path:

- Required repository secrets: none
- Required repository variable for beta release gating: `SCURO_BETA_AWS_ROLE_ARN`
- Required environment secrets: none
- Required environment variables: none
- Optional repository variable: `ENABLE_BETA_RPC_SMOKE=true` if you want the hosted beta smoke step to run before publish
- Optional repository variable: `SCURO_BETA_AWS_REGION` defaulting to `us-east-1`
- Optional repository variable: `SCURO_BETA_RUNTIME_ENV_PARAMETER` defaulting to `/scuro/beta/runtime-env`
- Optional repository variable: `ENABLE_BETA_LIVE_INTEGRATION=true` if you also want the hosted-beta integration suite on normal CI

The publish workflow uses npm trusted publishing via GitHub OIDC, so the normal GitHub Release flow does not need an `NPM_TOKEN`.
The external prerequisite is on npm: this repository and `.github/workflows/publish.yml` must be registered as a trusted publisher for `@scuro/sdk`.
For beta publishes, the workflow now also assumes `SCURO_BETA_AWS_ROLE_ARN` through GitHub OIDC so it can read the canonical release artifacts from S3 and load runtime signer keys from SSM.
If the AWS credential step fails with `Could not load credentials from any providers`, treat that as an AWS/OIDC setup problem rather than an npm publish problem:
- `SCURO_BETA_AWS_ROLE_ARN` is missing, empty, or scoped to a GitHub environment this job does not use
- the IAM role trust policy does not allow this repository/workflow to assume the role via GitHub OIDC
- the workflow is missing `id-token: write`

## Canonical publish flow

1. Commit and push the release version bump to `main`.
2. Create a GitHub Release from that commit.
3. Choose the release type intentionally:
   - Mark it as a prerelease to publish to npm `beta`.
   - Publish a normal release to publish to npm `latest`.
4. Let GitHub Actions run `.github/workflows/publish.yml`.
5. Confirm the workflow logs show the expected package version and npm dist-tag before the publish step runs.
6. For beta publishes, confirm the hosted-beta integration suite passes before the publish step executes.
7. Verify the package on npm:
   - beta install path: `npm install @scuro/sdk@beta`
   - stable install path: `npm install @scuro/sdk`
8. Announce the release with the exact version, npm tag, and whether the `testnet-beta` snapshot changed.

## Manual GitHub Actions fallback

If you need to publish without creating a GitHub Release first, use the `Publish` workflow's `workflow_dispatch` trigger.

1. Open the `Publish` workflow in GitHub Actions.
2. Run the workflow manually.
3. Select the intended npm dist-tag explicitly:
   - `beta` for prerelease distribution
   - `latest` for stable distribution
4. Review the printed publish metadata in the workflow logs before the publish step executes.
5. The workflow will create a matching Git tag and GitHub Release after the npm publish completes:
   - tag name: `v<package-version>`
   - release type: prerelease when npm tag is `beta`, normal release when npm tag is `latest`

`workflow_dispatch` requires an explicit tag so a manual run cannot silently publish to `latest`.
If the npm version is already published, the workflow will skip the duplicate publish and still create the matching GitHub Release if it does not exist yet.

## Local emergency fallback

If trusted publishing is unavailable and an urgent release is still required:

1. Run the full maintainer preflight locally.
2. Publish with an explicit npm tag from a maintainer machine:

   ```bash
   npm publish --access public --tag beta
   ```

   or

   ```bash
   npm publish --access public --tag latest
   ```

3. Verify the published version and dist-tag on npm immediately after the push.

Prefer the GitHub Release path whenever possible so the published package is tied to a recorded release and CI verification trail.
