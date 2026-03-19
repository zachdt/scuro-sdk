export const supplementalContracts = [
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
  }
};

export const supplementalDeploymentOutputLabels = {
  core: ["GameEngineRegistry"],
  controllers: ["SlotMachineController", "SuperBaccaratController", "CheminDeFerController"],
  engines: ["SlotMachineEngine", "SuperBaccaratEngine", "CheminDeFerEngine"]
};
