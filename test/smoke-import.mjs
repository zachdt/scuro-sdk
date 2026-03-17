const sdk = await import("../dist/index.js");

if (typeof sdk.createScuroClient !== "function") {
  throw new Error("createScuroClient export missing");
}

if (typeof sdk.getProtocolManifest !== "function") {
  throw new Error("manifest export missing");
}

console.log("node smoke import passed");
