export const supplementalContracts = [
  {
    name: "GameEngineRegistry",
    category: "core",
    source: "src/GameEngineRegistry.sol",
    reference_doc: "docs/reference/game-engine-registry.md",
    artifact: "out/GameEngineRegistry.sol/GameEngineRegistry.json"
  },
  {
    name: "SlotMachineController",
    category: "controller",
    source: "src/controllers/SlotMachineController.sol",
    reference_doc: "docs/reference/slot-machine-controller.md",
    artifact: "out/SlotMachineController.sol/SlotMachineController.json"
  },
  {
    name: "SuperBaccaratController",
    category: "controller",
    source: "src/controllers/SuperBaccaratController.sol",
    reference_doc: "docs/game-module-user-flows.md",
    artifact: "out/SuperBaccaratController.sol/SuperBaccaratController.json"
  },
  {
    name: "CheminDeFerController",
    category: "controller",
    source: "src/controllers/CheminDeFerController.sol",
    reference_doc: "docs/game-module-user-flows.md",
    artifact: "out/CheminDeFerController.sol/CheminDeFerController.json"
  },
  {
    name: "SlotMachineEngine",
    category: "engine",
    source: "src/engines/SlotMachineEngine.sol",
    reference_doc: "docs/reference/slot-machine-engine.md",
    artifact: "out/SlotMachineEngine.sol/SlotMachineEngine.json"
  },
  {
    name: "SuperBaccaratEngine",
    category: "engine",
    source: "src/engines/SuperBaccaratEngine.sol",
    reference_doc: "docs/game-module-user-flows.md",
    artifact: "out/SuperBaccaratEngine.sol/SuperBaccaratEngine.json"
  },
  {
    name: "CheminDeFerEngine",
    category: "engine",
    source: "src/engines/CheminDeFerEngine.sol",
    reference_doc: "docs/game-module-user-flows.md",
    artifact: "out/CheminDeFerEngine.sol/CheminDeFerEngine.json"
  },
  {
    name: "ICheminDeFerEngine",
    category: "interface",
    source: "src/interfaces/ICheminDeFerEngine.sol",
    reference_doc: "docs/reference/gameplay-interfaces.md",
    artifact: "out/ICheminDeFerEngine.sol/ICheminDeFerEngine.json"
  },
  {
    name: "BlackjackEngine",
    category: "engine",
    source: "src/engines/BlackjackEngine.sol",
    reference_doc: "docs/reference/blackjack-engine.md",
    artifact: "out/BlackjackEngine.sol/BlackjackEngine.json"
  }
];

export const supplementalEnumLabels = {
  "BaccaratTypes.BaccaratSide": {
    "0": "Player",
    "1": "Banker",
    "2": "Tie"
  },
  "BaccaratTypes.BaccaratOutcome": {
    "0": "PlayerWin",
    "1": "BankerWin",
    "2": "Tie"
  },
  "BlackjackEngine.SessionPhase": {
    "0": "Inactive",
    "1": "AwaitingInitialDeal",
    "2": "AwaitingPrePlayDecision",
    "3": "AwaitingPeekResolution",
    "4": "AwaitingPostPeekDecision",
    "5": "AwaitingPlayerAction",
    "6": "AwaitingCoordinatorAction",
    "7": "Completed"
  },
  "BlackjackEngine.HandPayoutKind": {
    "0": "HAND_PAYOUT_NONE",
    "1": "HAND_PAYOUT_LOSS",
    "2": "HAND_PAYOUT_PUSH",
    "3": "HAND_PAYOUT_EVEN_MONEY",
    "4": "HAND_PAYOUT_BLACKJACK_3_TO_2",
    "5": "HAND_PAYOUT_SURRENDER"
  },
  "BlackjackEngine.Action": {
    "1": "ACTION_HIT",
    "2": "ACTION_STAND",
    "3": "ACTION_DOUBLE",
    "4": "ACTION_SPLIT"
  },
  "BlackjackEngine.ActionMask": {
    "1": "ALLOW_HIT",
    "2": "ALLOW_STAND",
    "4": "ALLOW_DOUBLE",
    "8": "ALLOW_SPLIT"
  }
};

export const supplementalDeploymentOutputLabels = {
  core: ["GameEngineRegistry"],
  controllers: ["SlotMachineController", "SuperBaccaratController", "CheminDeFerController"],
  engines: ["SlotMachineEngine", "SuperBaccaratEngine", "CheminDeFerEngine", "BlackjackEngine"]
};
