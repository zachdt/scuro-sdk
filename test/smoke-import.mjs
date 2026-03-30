const sdk = await import("../dist/index.js");

if (typeof sdk.createScuroClient !== "function") {
  throw new Error("createScuroClient export missing");
}

if (typeof sdk.getProtocolManifest !== "function") {
  throw new Error("manifest export missing");
}

const hostedBeta = sdk.getDeploymentProfile("testnet-beta");
if (!hostedBeta || hostedBeta.rpcUrl !== "https://d1eu0nzcw8l9ul.cloudfront.net") {
  throw new Error("testnet-beta profile missing");
}

const client = sdk.createScuroClient({
  publicClient: {
    readContract: async () => {
      throw new Error("readContract not stubbed");
    },
    getBlock: async () => ({ timestamp: 0n })
  },
  walletClient: {
    chain: null,
    account: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    writeContract: async () => "0xabc123"
  },
  deployment: {
    GameEngineRegistry: "0x1000000000000000000000000000000000000007",
    SlotMachineController: "0x1000000000000000000000000000000000000013",
    SlotMachineEngine: "0x1000000000000000000000000000000000000014",
    SuperBaccaratController: "0x1000000000000000000000000000000000000015",
    SuperBaccaratEngine: "0x1000000000000000000000000000000000000016",
    CheminDeFerController: "0x1000000000000000000000000000000000000017",
    CheminDeFerEngine: "0x1000000000000000000000000000000000000018"
  }
});

if (typeof client.flows.slotMachine?.prepareSpin !== "function") {
  throw new Error("slotMachine flow missing");
}

if (typeof client.flows.superBaccarat?.preparePlay !== "function") {
  throw new Error("superBaccarat flow missing");
}

if (typeof client.flows.cheminDeFer?.prepareOpenTable !== "function") {
  throw new Error("cheminDeFer flow missing");
}

console.log("node smoke import passed");
