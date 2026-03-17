import type { CreateScuroClientOptions } from "../src/internal/types";

const dummyAddresses = {
  ScuroToken: "0x1000000000000000000000000000000000000001",
  ScuroStakingToken: "0x1000000000000000000000000000000000000002",
  TimelockController: "0x1000000000000000000000000000000000000003",
  ScuroGovernor: "0x1000000000000000000000000000000000000004",
  GameCatalog: "0x1000000000000000000000000000000000000005",
  GameDeploymentFactory: "0x1000000000000000000000000000000000000006",
  DeveloperExpressionRegistry: "0x1000000000000000000000000000000000000007",
  DeveloperRewards: "0x1000000000000000000000000000000000000008",
  ProtocolSettlement: "0x1000000000000000000000000000000000000009",
  NumberPickerAdapter: "0x1000000000000000000000000000000000000010",
  NumberPickerEngine: "0x1000000000000000000000000000000000000011",
  TournamentController: "0x1000000000000000000000000000000000000012",
  TournamentPokerEngine: "0x1000000000000000000000000000000000000013",
  TournamentPokerVerifierBundle: "0x1000000000000000000000000000000000000014",
  PvPController: "0x1000000000000000000000000000000000000015",
  PvPPokerEngine: "0x1000000000000000000000000000000000000016",
  PvPPokerVerifierBundle: "0x1000000000000000000000000000000000000017",
  BlackjackController: "0x1000000000000000000000000000000000000018",
  SingleDeckBlackjackEngine: "0x1000000000000000000000000000000000000019",
  BlackjackVerifierBundle: "0x1000000000000000000000000000000000000020",
  Admin: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  Player1: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  Player2: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  SoloDeveloper: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  PokerDeveloper: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  NumberPickerModuleId: "1",
  TournamentPokerModuleId: "2",
  PvPPokerModuleId: "3",
  BlackjackModuleId: "4",
  NumberPickerExpressionTokenId: "1",
  BlackjackExpressionTokenId: "2",
  PokerExpressionTokenId: "3"
} as const;

export function createTestClientOptions(overrides: Partial<CreateScuroClientOptions> = {}): CreateScuroClientOptions {
  return {
    publicClient: {
      readContract: async () => {
        throw new Error("readContract not stubbed");
      },
      getBlock: async () => ({ timestamp: 0n })
    } as any,
    walletClient: {
      chain: null,
      account: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      writeContract: async () => "0xabc123"
    } as any,
    deployment: dummyAddresses,
    ...overrides
  };
}

export { dummyAddresses };

