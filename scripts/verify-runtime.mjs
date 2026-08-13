import { spawnSync } from "node:child_process";

const REQUIRED_NODE = { major: 22, minor: 13 };
const REQUIRED_PNPM = "11.21.0";
const MINIMUM_JAVA_MAJOR = 21;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function runVersion(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.error || result.status !== 0) return null;
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
}

const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
if (nodeMajor !== REQUIRED_NODE.major || nodeMinor < REQUIRED_NODE.minor) {
  fail(`Unsupported Node.js ${process.versions.node}; use Node 22.13 or newer in the Node 22 line.`);
}

const pnpmVersion = runVersion("pnpm", ["--version"]);
if (pnpmVersion !== REQUIRED_PNPM) {
  fail(`Unsupported pnpm ${pnpmVersion ?? "(not found)"}; use pnpm ${REQUIRED_PNPM}.`);
}

const javaVersionOutput = runVersion("java", ["-version"]);
const javaMatch = javaVersionOutput?.match(/version\s+"(\d+)(?:\.|")/u);
const javaMajor = javaMatch ? Number(javaMatch[1]) : null;
if (javaMajor === null || javaMajor < MINIMUM_JAVA_MAJOR) {
  fail(`Unsupported Java ${javaMajor ?? "(not found)"}; use Java ${MINIMUM_JAVA_MAJOR} or newer.`);
}

if (process.exitCode !== 1) {
  process.stdout.write(
    `Runtime contract satisfied: Node ${process.versions.node}, pnpm ${pnpmVersion}, Java ${javaMajor}.\n`,
  );
}
