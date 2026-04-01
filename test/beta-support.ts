import { execFileSync } from "node:child_process";

import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  keccak256,
  toBytes,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

import { createScuroClient } from "../src/client";
import { TESTNET_BETA_PROFILE } from "../src/registry";

export const HOSTED_BETA_RELEASE_RECORD_URI =
  "s3://scuro-testnet-beta-artifacts-20260328225139708000000001/releases/latest.json";
export const DEFAULT_BETA_AWS_REGION = "us-east-1";
export const DEFAULT_BETA_RUNTIME_ENV_PARAMETER = "/scuro/beta/runtime-env";

export interface BetaReleaseRecord {
  awsRegion: string;
  bundleUri: string;
  publicRpcUrl: string;
  manifestKey: string;
  actorsKey: string;
}

export interface BetaManifest {
  chain: {
    chainId: number;
    rpcUrl: string;
  };
  contracts: Record<string, string>;
  actors: Record<string, Address>;
  deploymentStatus: string;
}

export interface BetaActorsFile {
  actors: Record<string, Address>;
  privateKeys: Record<string, string>;
}

export interface HostedBetaSignerSecrets {
  Admin: Hex;
  Player1: Hex;
  Player2: Hex;
}

type ScuroClient = ReturnType<typeof createScuroClient>;

interface HostedBetaWalletContext {
  address: Address;
  scuro: ScuroClient;
}

export interface HostedBetaReadContext {
  profile: typeof TESTNET_BETA_PROFILE;
  publicClient: PublicClient;
  scuro: ScuroClient;
  releaseRecord: BetaReleaseRecord;
  manifest: BetaManifest;
  actorsFile: BetaActorsFile;
}

export interface HostedBetaSignerContext extends HostedBetaReadContext {
  signers: {
    Admin: HostedBetaWalletContext;
    Player1: HostedBetaWalletContext;
    Player2: HostedBetaWalletContext;
  };
}

let hostedBetaReadContextPromise: Promise<HostedBetaReadContext> | undefined;
let hostedBetaSignerContextPromise: Promise<HostedBetaSignerContext> | undefined;

const AWS_READ_ATTEMPTS = 3;

function sleepMs(milliseconds: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function formatAwsError(args: string[], error: unknown) {
  if (!(error instanceof Error)) {
    return `aws ${args.join(" ")} failed with a non-Error value.`;
  }

  const details = [error.message];
  const stdout = "stdout" in error ? String(error.stdout ?? "").trim() : "";
  const stderr = "stderr" in error ? String(error.stderr ?? "").trim() : "";

  if (stderr) {
    details.push(`stderr:\n${stderr}`);
  }
  if (stdout) {
    details.push(`stdout:\n${stdout}`);
  }

  return `Command failed: aws ${args.join(" ")}\n${details.join("\n\n")}`;
}

function runAws(args: string[], { attempts = 1 }: { attempts?: number } = {}) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return execFileSync("aws", args, {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          AWS_PAGER: ""
        },
        stdio: ["ignore", "pipe", "pipe"]
      }).trim();
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        sleepMs(250 * attempt);
      }
    }
  }

  throw new Error(formatAwsError(args, lastError));
}

function readAwsJson<T>(args: string[], options?: { attempts?: number }) {
  return JSON.parse(runAws(args, options)) as T;
}

function parseRequiredHex(name: string, value: string | undefined): Hex {
  if (!value) {
    throw new Error(`Missing required runtime env entry ${name}.`);
  }
  if (!value.startsWith("0x")) {
    throw new Error(`Runtime env entry ${name} must be a 0x-prefixed hex string.`);
  }
  return value as Hex;
}

export function parseS3Uri(uri: string) {
  if (!uri.startsWith("s3://")) {
    throw new Error(`Unsupported S3 URI: ${uri}`);
  }

  const withoutPrefix = uri.slice("s3://".length);
  const slashIndex = withoutPrefix.indexOf("/");
  if (slashIndex === -1) {
    throw new Error(`Invalid S3 URI: ${uri}`);
  }

  return {
    bucket: withoutPrefix.slice(0, slashIndex),
    key: withoutPrefix.slice(slashIndex + 1)
  };
}

export function buildReleaseArtifactS3Uri(releaseRecord: BetaReleaseRecord, key: keyof Pick<BetaReleaseRecord, "manifestKey" | "actorsKey">) {
  const { bucket } = parseS3Uri(releaseRecord.bundleUri);
  return `s3://${bucket}/${releaseRecord[key]}`;
}

export function parseRuntimeEnvBlock(input: string) {
  const entries = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => (line.startsWith("export ") ? line.slice("export ".length).trim() : line));

  return Object.fromEntries(
    entries.map((line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        throw new Error(`Invalid runtime env line: ${line}`);
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (!key) {
        throw new Error(`Invalid runtime env line: ${line}`);
      }

      return [key, value];
    })
  );
}

export function parseHostedBetaSignerSecrets(input: string): HostedBetaSignerSecrets {
  const entries = parseRuntimeEnvBlock(input);

  return {
    Admin: parseRequiredHex("PRIVATE_KEY", entries.PRIVATE_KEY),
    Player1: parseRequiredHex("PLAYER1_PRIVATE_KEY", entries.PLAYER1_PRIVATE_KEY),
    Player2: parseRequiredHex("PLAYER2_PRIVATE_KEY", entries.PLAYER2_PRIVATE_KEY)
  };
}

function getBetaAwsRegion() {
  return process.env.SCURO_BETA_AWS_REGION || DEFAULT_BETA_AWS_REGION;
}

function getBetaRuntimeEnvParameter() {
  return process.env.SCURO_BETA_RUNTIME_ENV_PARAMETER || DEFAULT_BETA_RUNTIME_ENV_PARAMETER;
}

function loadHostedBetaReleaseRecord() {
  return readAwsJson<BetaReleaseRecord>(
    [
      "--region",
      getBetaAwsRegion(),
      "s3",
      "cp",
      "--only-show-errors",
      HOSTED_BETA_RELEASE_RECORD_URI,
      "-"
    ],
    { attempts: AWS_READ_ATTEMPTS }
  );
}

function loadHostedBetaReleaseArtifacts(releaseRecord: BetaReleaseRecord) {
  const awsRegion = releaseRecord.awsRegion || getBetaAwsRegion();
  const manifest = readAwsJson<BetaManifest>(
    [
      "--region",
      awsRegion,
      "s3",
      "cp",
      "--only-show-errors",
      buildReleaseArtifactS3Uri(releaseRecord, "manifestKey"),
      "-"
    ],
    { attempts: AWS_READ_ATTEMPTS }
  );
  const actorsFile = readAwsJson<BetaActorsFile>(
    [
      "--region",
      awsRegion,
      "s3",
      "cp",
      "--only-show-errors",
      buildReleaseArtifactS3Uri(releaseRecord, "actorsKey"),
      "-"
    ],
    { attempts: AWS_READ_ATTEMPTS }
  );

  return {
    manifest,
    actorsFile
  };
}

function loadHostedBetaSignerSecrets() {
  const runtimeEnv = runAws([
    "ssm",
    "get-parameter",
    "--region",
    getBetaAwsRegion(),
    "--with-decryption",
    "--name",
    getBetaRuntimeEnvParameter(),
    "--query",
    "Parameter.Value",
    "--output",
    "text"
  ], { attempts: AWS_READ_ATTEMPTS });

  return parseHostedBetaSignerSecrets(runtimeEnv);
}

function createHostedBetaWalletContext(
  publicClient: PublicClient,
  actorKey: Hex
): HostedBetaWalletContext {
  const account = privateKeyToAccount(actorKey);
  const walletClient = createWalletClient({
    account,
    chain: foundry,
    transport: http(TESTNET_BETA_PROFILE.rpcUrl)
  });

  return {
    address: account.address,
    scuro: createScuroClient({
      publicClient,
      walletClient,
      deployment: TESTNET_BETA_PROFILE
    })
  };
}

export function getHostedBetaReadContext() {
  hostedBetaReadContextPromise ??= Promise.resolve()
    .then(() => {
      if (!TESTNET_BETA_PROFILE.rpcUrl) {
        throw new Error("testnet-beta profile is missing an rpcUrl");
      }

      const publicClient = createPublicClient({
        chain: foundry,
        transport: http(TESTNET_BETA_PROFILE.rpcUrl)
      });
      const scuro = createScuroClient({
        publicClient,
        deployment: TESTNET_BETA_PROFILE
      });
      const releaseRecord = loadHostedBetaReleaseRecord();
      const { manifest, actorsFile } = loadHostedBetaReleaseArtifacts(releaseRecord);

      return {
        profile: TESTNET_BETA_PROFILE,
        publicClient,
        scuro,
        releaseRecord,
        manifest,
        actorsFile
      };
    })
    .catch((error) => {
      hostedBetaReadContextPromise = undefined;
      throw error;
    });

  return hostedBetaReadContextPromise;
}

export function getHostedBetaSignerContext() {
  hostedBetaSignerContextPromise ??= getHostedBetaReadContext()
    .then((readContext) => {
      const secrets = loadHostedBetaSignerSecrets();

      return {
        ...readContext,
        signers: {
          Admin: createHostedBetaWalletContext(readContext.publicClient, secrets.Admin),
          Player1: createHostedBetaWalletContext(readContext.publicClient, secrets.Player1),
          Player2: createHostedBetaWalletContext(readContext.publicClient, secrets.Player2)
        }
      };
    })
    .catch((error) => {
      hostedBetaSignerContextPromise = undefined;
      throw error;
    });

  return hostedBetaSignerContextPromise;
}

export async function waitForSuccessfulReceipt(publicClient: PublicClient, hash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction ${hash} failed with status ${receipt.status}.`);
  }
  return receipt;
}

export function findEventArgs(
  receipt: TransactionReceipt,
  abi: Abi,
  eventName: string
) {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics,
        eventName
      });

      return decoded.args as unknown as Record<string, unknown>;
    } catch {
      continue;
    }
  }

  throw new Error(`Event ${eventName} was not found in transaction ${receipt.transactionHash}.`);
}

export function uniquePlayRef(label: string) {
  return keccak256(toBytes(`${label}:${Date.now().toString()}:${Math.random().toString(16).slice(2)}`));
}
