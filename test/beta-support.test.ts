import { describe, expect, test } from "bun:test";

import {
  buildReleaseArtifactS3Uri,
  parseHostedBetaSignerSecrets,
  parseRuntimeEnvBlock,
  parseS3Uri
} from "./beta-support";

describe("hosted beta test support", () => {
  test("parse runtime env blocks with comments and export prefixes", () => {
    expect(
      parseRuntimeEnvBlock(`
        # comment
        export PRIVATE_KEY=0xabc
        PLAYER1_PRIVATE_KEY=0xdef

        PLAYER2_PRIVATE_KEY=0x123
      `)
    ).toEqual({
      PRIVATE_KEY: "0xabc",
      PLAYER1_PRIVATE_KEY: "0xdef",
      PLAYER2_PRIVATE_KEY: "0x123"
    });
  });

  test("extract required signer secrets from the beta runtime env block", () => {
    expect(
      parseHostedBetaSignerSecrets(`
        PRIVATE_KEY=0x111
        PLAYER1_PRIVATE_KEY=0x222
        PLAYER2_PRIVATE_KEY=0x333
      `)
    ).toEqual({
      Admin: "0x111",
      Player1: "0x222",
      Player2: "0x333"
    });
  });

  test("build release artifact uris from the latest release record", () => {
    const releaseRecord = {
      awsRegion: "us-east-1",
      bundleUri: "s3://bucket-name/releases/sha/bundle.tar.gz",
      publicRpcUrl: "https://rpc.example.com",
      manifestKey: "releases/sha/manifest.json",
      actorsKey: "releases/sha/actors.json"
    };

    expect(parseS3Uri(releaseRecord.bundleUri)).toEqual({
      bucket: "bucket-name",
      key: "releases/sha/bundle.tar.gz"
    });
    expect(buildReleaseArtifactS3Uri(releaseRecord, "manifestKey")).toBe(
      "s3://bucket-name/releases/sha/manifest.json"
    );
    expect(buildReleaseArtifactS3Uri(releaseRecord, "actorsKey")).toBe(
      "s3://bucket-name/releases/sha/actors.json"
    );
  });
});
