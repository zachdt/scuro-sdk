import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function assertExists(relativePath) {
  const fullPath = path.join(root, relativePath);
  await access(fullPath);
  return fullPath;
}

async function main() {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

  const requiredFiles = [
    "README.md",
    "dist/index.js",
    "dist/index.d.ts",
    "dist/manifest.js",
    "dist/manifest.d.ts",
    "dist/registry.js",
    "dist/registry.d.ts",
    "dist/contracts.js",
    "dist/contracts.d.ts",
    "dist/flows.js",
    "dist/flows.d.ts",
    "dist/coordinator.js",
    "dist/coordinator.d.ts",
    "dist/types.js",
    "dist/types.d.ts"
  ];

  for (const file of requiredFiles) {
    await assertExists(file);
  }

  for (const [subpath, target] of Object.entries(packageJson.exports)) {
    if (typeof target !== "object" || !target) {
      throw new Error(`Unsupported export shape for ${subpath}`);
    }

    if ("import" in target) {
      await assertExists(target.import.replace(/^\.\//, ""));
    }

    if ("types" in target) {
      await assertExists(target.types.replace(/^\.\//, ""));
    }
  }

  const indexStat = await stat(path.join(root, "dist/index.js"));
  if (indexStat.size === 0) {
    throw new Error("dist/index.js is empty");
  }

  console.log("release verification passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
