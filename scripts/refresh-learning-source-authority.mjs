import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEARNING_ROOT = path.join(ROOT, "content", "learning");
const CATALOG_PATH = path.join(LEARNING_ROOT, "catalog.json");
const AUTHORITIES_PATH = path.join(LEARNING_ROOT, "source-authorities.json");
const CURRICULUM_PLAN_PATH = path.join(LEARNING_ROOT, "robotics-curriculum-plan.json");
const REPOSITORY = "ARES-Robotics";
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;
const SOURCE_PATH_MIGRATIONS = new Map([
  [
    "ARESLib-Kotlin/core/src/main/kotlin/com/areslib/hardware/TopologyModels.kt",
    "ARESLib-Kotlin/telemetry-schema/src/main/kotlin/com/areslib/telemetry/schema/HardwareTopology.kt",
  ],
  [
    "ARESLib-Kotlin/core/src/main/kotlin/com/areslib/pathing/PathSafetyEvaluator.kt",
    "ARESLib-Kotlin/core/src/main/kotlin/com/areslib/pathing/AutoBuilder.kt",
  ],
  [
    "ARES-FRC/src/main/kotlin/com/areslib/frc/ARESRobot.kt",
    "ARES-FRC/src/main/kotlin/org/aresfirst/marvin/ARESRobot.kt",
  ],
  [
    "ARES-FRC/src/main/kotlin/com/areslib/frc/FrcMechanismCommissioningController.kt",
    "ARES-FRC/src/main/kotlin/org/aresfirst/marvin/FrcMechanismCommissioningController.kt",
  ],
  [
    "ARES-FRC/src/test/kotlin/com/areslib/frc/ARESRobotTimedBehaviorRegressionTest.kt",
    "ARES-FRC/src/test/kotlin/org/aresfirst/marvin/ARESRobotTimedBehaviorRegressionTest.kt",
  ],
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function parseVersionProperties(source) {
  const versions = {};
  for (const rawLine of source.replace(/\r\n?/gu, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    assert(separator > 0, `Invalid release version line: ${line}`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    assert(/^[A-Za-z][A-Za-z0-9]*$/u.test(key) && value,
      `Invalid release version property: ${line}`);
    assert(!Object.hasOwn(versions, key), `Duplicate release version property: ${key}`);
    versions[key] = value;
  }
  for (const key of ["aresVersion", "studioVersion", "ftcStarterVersion", "frcStarterVersion"]) {
    assert(VERSION_PATTERN.test(versions[key] ?? ""), `Missing release version property: ${key}`);
  }
  return versions;
}

function replaceField(source, field, value) {
  const pattern = new RegExp(`("${field}"\\s*:\\s*")[^"]+(")`, "u");
  assert(pattern.test(source), `Missing ${field} field.`);
  return source.replace(pattern, `$1${value}$2`);
}

export function replaceCurrentVersionText(source, previous, next) {
  const replacements = [
    [`ARES-FTC ${previous.aresVersion}`, `ARES-FTC ${next.aresVersion}`],
    [`ARES FTC ${previous.aresVersion}`, `ARES FTC ${next.aresVersion}`],
    [`ARESLib ${previous.aresVersion}`, `ARESLib ${next.aresVersion}`],
    [`ARES ${previous.aresVersion}`, `ARES ${next.aresVersion}`],
    [`FTC Starter ${previous.ftcStarterVersion}`, `FTC Starter ${next.ftcStarterVersion}`],
    [`FRC Starter ${previous.frcStarterVersion}`, `FRC Starter ${next.frcStarterVersion}`],
    [`Studio ${previous.studioVersion}`, `Studio ${next.studioVersion}`],
  ];
  return replacements.reduce((value, [from, to]) => value.replaceAll(from, to), source);
}

export function migrateCurrentSourcePaths(source) {
  let updated = source;
  for (const [previousPath, currentPath] of SOURCE_PATH_MIGRATIONS) {
    updated = updated.replaceAll(previousPath, currentPath);
  }
  return updated
    .replaceAll("Canonical hardware topology models", "Canonical hardware topology wire schema")
    .replaceAll("Hardware topology models", "Hardware topology wire schema")
    .replaceAll("ARES path safety evaluator", "ARES autonomous path task builder");
}

export function refreshCatalogText(source, snapshot, blobHashes) {
  const catalog = JSON.parse(source);
  const previous = catalog.generatedFrom;
  let updated = source;
  updated = replaceField(updated, "sourceRevision", snapshot.revision);
  updated = replaceField(updated, "sourceCommit", snapshot.commit);
  for (const field of ["aresVersion", "studioVersion", "ftcStarterVersion", "frcStarterVersion"]) {
    updated = replaceField(updated, field, snapshot.versions[field]);
  }
  updated = replaceCurrentVersionText(updated, previous, snapshot.versions);
  updated = updated.replace(
    /https:\/\/github\.com\/ARES-23247\/ARES-Robotics\/blob\/[a-f0-9]{40}\//gu,
    `https://github.com/ARES-23247/ARES-Robotics/blob/${snapshot.commit}/`,
  );
  updated = updated.replace(/("revision"\s*:\s*")[^"]+("\s*)/gu, `$1${snapshot.revision}$2`);
  updated = updated.replace(
    /("path"\s*:\s*"([^"]+)"\s*,\s*"blobHash"\s*:\s*")[a-f0-9]{40}(")/gu,
    (match, prefix, repositoryPath, suffix) => {
      const hash = blobHashes.get(repositoryPath);
      assert(hash, `No Git blob was resolved for ${repositoryPath}.`);
      return `${prefix}${hash}${suffix}`;
    },
  );
  return updated;
}

function git(monorepo, ...args) {
  return execFileSync("git", ["-C", monorepo, ...args], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

async function learningMarkdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await learningMarkdownFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(absolute);
  }
  return files;
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const monorepo = argumentValue("--monorepo");
  assert(monorepo, "Pass --monorepo with the local ARES Robotics monorepo path.");
  const requestedCommit = argumentValue("--commit") ?? "origin/main";
  const commit = git(monorepo, "rev-parse", requestedCommit);
  assert(COMMIT_PATTERN.test(commit), `Could not resolve an immutable commit from ${requestedCommit}.`);
  const versions = parseVersionProperties(git(monorepo, "show", `${commit}:release/ares-versions.properties`));
  const revision = `ares-${versions.aresVersion}-studio-${versions.studioVersion}`;
  const snapshot = { commit, revision, versions };

  const originalCatalogSource = await readFile(CATALOG_PATH, "utf8");
  const catalogSource = migrateCurrentSourcePaths(originalCatalogSource);
  const catalog = JSON.parse(catalogSource);
  const sourcePaths = new Set(catalog.documents.flatMap((document) =>
    document.sourceReferences.map((reference) => reference.path)));
  const blobHashes = new Map();
  for (const repositoryPath of sourcePaths) {
    let hash;
    try {
      hash = git(monorepo, "rev-parse", `${commit}:${repositoryPath}`);
    } catch {
      throw new Error(`Current source path is missing at ${commit.slice(0, 8)}: ${repositoryPath}`);
    }
    assert(COMMIT_PATTERN.test(hash), `Invalid Git blob for ${repositoryPath}.`);
    blobHashes.set(repositoryPath, hash);
  }
  const updatedCatalog = refreshCatalogText(catalogSource, snapshot, blobHashes);

  const authoritiesSource = await readFile(AUTHORITIES_PATH, "utf8");
  const authorities = JSON.parse(authoritiesSource);
  authorities.repositories[REPOSITORY].current = { revision, commit };
  authorities.repositories[REPOSITORY].approved = [{ revision, commit }];

  const planSource = await readFile(CURRICULUM_PLAN_PATH, "utf8");
  let updatedPlan = migrateCurrentSourcePaths(planSource);
  updatedPlan = replaceField(updatedPlan, "commit", commit);
  updatedPlan = replaceField(updatedPlan, "aresVersion", versions.aresVersion);
  updatedPlan = replaceField(updatedPlan, "studioVersion", versions.studioVersion);

  const markdownUpdates = [];
  const previous = catalog.generatedFrom;
  for (const markdownPath of await learningMarkdownFiles(LEARNING_ROOT)) {
    const source = await readFile(markdownPath, "utf8");
    const updated = replaceCurrentVersionText(source, previous, versions);
    if (updated !== source) markdownUpdates.push([markdownPath, updated]);
  }

  const changed = Number(updatedCatalog !== originalCatalogSource)
    + Number(`${JSON.stringify(authorities, null, 2)}\n` !== authoritiesSource)
    + Number(updatedPlan !== planSource)
    + markdownUpdates.length;
  if (!process.argv.includes("--write")) {
    console.log(`Dry run: ${sourcePaths.size} source paths resolve at ${commit.slice(0, 8)}; ${changed} files would change.`);
    return;
  }
  await writeFile(CATALOG_PATH, updatedCatalog, "utf8");
  await writeFile(AUTHORITIES_PATH, `${JSON.stringify(authorities, null, 2)}\n`, "utf8");
  await writeFile(CURRICULUM_PLAN_PATH, updatedPlan, "utf8");
  for (const [markdownPath, updated] of markdownUpdates) await writeFile(markdownPath, updated, "utf8");
  console.log(`Updated ${sourcePaths.size} source paths to ${revision} at ${commit.slice(0, 8)} across ${changed} files.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
