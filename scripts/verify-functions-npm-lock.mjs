import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..");
const functionsDirectory = join(workspaceRoot, "functions");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "aresweb-functions-lock-"));
const nodeDirectory = dirname(process.execPath);
const npmCli = [
  join(nodeDirectory, "node_modules", "npm", "bin", "npm-cli.js"),
  join(nodeDirectory, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
].find(existsSync);

if (!npmCli) throw new Error("Unable to locate the npm CLI bundled with Node.js.");

try {
  copyFileSync(join(functionsDirectory, "package.json"), join(temporaryDirectory, "package.json"));
  copyFileSync(
    join(functionsDirectory, "package-lock.json"),
    join(temporaryDirectory, "package-lock.json"),
  );

  const result = spawnSync(
    process.execPath,
    [npmCli, "ci", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"],
    {
      cwd: temporaryDirectory,
      stdio: "inherit",
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
