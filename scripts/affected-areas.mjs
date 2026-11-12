import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { matchesGlob, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sorted = (values) => [...new Set(values)].sort();
const matches = (file, patterns) =>
  patterns.some((pattern) => matchesGlob(file, pattern));

export function validateManifest(manifest) {
  if (
    manifest.schemaVersion !== 1 ||
    !["observe", "enforce"].includes(manifest.mode) ||
    !manifest.areas ||
    !Object.keys(manifest.areas).length
  )
    throw new Error("Invalid area manifest");
  for (const patterns of [
    manifest.shared,
    manifest.smoke,
    ...Object.values(manifest.areas).flatMap((area) => [area.paths, area.e2e]),
  ]) {
    if (
      !Array.isArray(patterns) ||
      !patterns.length ||
      patterns.some(
        (pattern) =>
          typeof pattern !== "string" ||
          pattern.startsWith("/") ||
          pattern.includes("..") ||
          pattern.includes("\\"),
      )
    )
      throw new Error("Invalid area patterns");
  }
  for (const area of Object.values(manifest.areas)) {
    if (
      !Array.isArray(area.dependsOn) ||
      area.dependsOn.some((name) => !Object.hasOwn(manifest.areas, name)) ||
      !Array.isArray(area.components)
    )
      throw new Error("Invalid area dependencies");
  }
  return manifest;
}

/** Conservative selector: unknown paths and shared changes always select the full suite. */
export function selectAreas(manifest, changed, inventory, reason) {
  validateManifest(manifest);
  const names = Object.keys(manifest.areas);
  const reasons = reason ? [reason] : [];
  const selected = new Set();
  for (const file of changed) {
    if (
      !file ||
      file.startsWith("/") ||
      file.includes("\\") ||
      file.split("/").includes("..")
    )
      throw new Error("Invalid changed path");
    const owners = names.filter((name) =>
      matches(file, manifest.areas[name].paths),
    );
    if (matches(file, manifest.shared)) reasons.push(`Shared: ${file}`);
    else if (!owners.length) reasons.push(`Unmapped: ${file}`);
    owners.forEach((name) => selected.add(name));
  }
  if (!changed.length) reasons.push("No changed files: full verification");
  let previous = -1;
  while (previous !== selected.size) {
    previous = selected.size;
    names
      .filter((name) =>
        manifest.areas[name].dependsOn.some((dependency) =>
          selected.has(dependency),
        ),
      )
      .forEach((name) => selected.add(name));
  }
  const full = reasons.length > 0;
  const areas = full ? names.sort() : [...selected].sort();
  const e2ePatterns = full
    ? ["e2e/*.spec.ts"]
    : [...manifest.smoke, ...areas.flatMap((name) => manifest.areas[name].e2e)];
  const e2e = inventory.filter((file) => matches(file, e2ePatterns)).sort();
  if (!e2e.length) throw new Error("No browser tests selected");
  const unit = inventory.filter(
    (file) =>
      /\.(test|spec)\.[cm]?[jt]sx?$/u.test(file) &&
      !file.startsWith("e2e/") &&
      !file.startsWith("tests/rules/") &&
      !file.includes(".emulator.") &&
      (full || areas.some((name) => matches(file, manifest.areas[name].paths))),
  );
  const potentialComponents = sorted(
    areas.flatMap((name) => manifest.areas[name].components),
  );
  return {
    schemaVersion: 1,
    mode: manifest.mode,
    full,
    reasons: sorted(reasons),
    areas,
    changed: sorted(changed),
    e2e,
    unit: sorted(unit),
    potentialComponents,
    needsGameContainer: full || potentialComponents.includes("game"),
    deploymentSelectionEnabled: manifest.mode === "enforce",
  };
}

export function readChanges(
  base,
  git = (args) => execFileSync("git", args, { encoding: "utf8" }),
) {
  const inventory = sorted(
    git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
      .split("\0")
      .filter(Boolean),
  );
  try {
    const resolved = git([
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${base}^{commit}`,
    ]).trim();
    if (!/^[a-f0-9]{40,64}$/u.test(resolved))
      throw new Error("Invalid base commit");
    const mergeBase = git(["merge-base", resolved, "HEAD"]).trim();
    if (!/^[a-f0-9]{40,64}$/u.test(mergeBase))
      throw new Error("Invalid merge base");
    const changed = sorted(
      [
        ...git([
          "diff",
          "--no-renames",
          "--name-only",
          "-z",
          mergeBase,
          "--",
        ]).split("\0"),
        ...git(["ls-files", "--others", "--exclude-standard", "-z"]).split(
          "\0",
        ),
      ].filter(Boolean),
    );
    return { inventory, changed, mergeBase };
  } catch {
    return {
      inventory,
      changed: [],
      reason: "Base unavailable: full verification",
    };
  }
}

export function buildCommands(plan, suite, root, playwrightArgs = []) {
  if (!["unit", "e2e"].includes(suite))
    throw new Error("Choose --suite unit or e2e");
  if (suite === "e2e") {
    if (!Array.isArray(plan.e2e) || !plan.e2e.length)
      throw new Error("No browser tests selected");
    return [
      {
        cwd: root,
        args: [
          resolve(root, "node_modules/@playwright/test/cli.js"),
          "test",
          ...(plan.full ? [] : plan.e2e),
          ...playwrightArgs,
        ],
      },
    ];
  }
  const frontend = plan.unit.filter((file) => !file.startsWith("functions/"));
  const backend = plan.unit
    .filter((file) => file.startsWith("functions/"))
    .map((file) => file.slice("functions/".length));
  if (!plan.full && !frontend.length && !backend.length)
    throw new Error("No area unit tests mapped; run the full test suite");
  const commands = [];
  if (plan.full || frontend.length)
    commands.push({
      cwd: root,
      args: [
        resolve(root, "node_modules/vitest/vitest.mjs"),
        "run",
        ...(plan.full ? [] : frontend),
      ],
    });
  if (plan.full || backend.length)
    commands.push(
      {
        cwd: resolve(root, "functions"),
        args: [resolve(root, "functions/node_modules/typescript/bin/tsc")],
      },
      {
        cwd: resolve(root, "functions"),
        args: [
          resolve(root, "functions/node_modules/vitest/vitest.mjs"),
          "run",
          ...(plan.full ? [] : backend),
        ],
      },
    );
  return commands;
}

export function main(
  argv = process.argv.slice(2),
  root = process.cwd(),
  { git, execute = execFileSync, log = console.log } = {},
) {
  let base = "origin/master",
    output,
    githubOutput,
    planPath,
    listE2ePath,
    suite,
    run = false;
  const playwrightArgs = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--run") run = true;
    else if (arg.startsWith("--playwright-arg=")) {
      const value = arg.slice("--playwright-arg=".length);
      if (!value) throw new Error("--playwright-arg requires a value");
      playwrightArgs.push(value);
    } else if (
      [
        "--base",
        "--output",
        "--github-output",
        "--plan",
        "--list-e2e",
        "--suite",
        "--playwright-arg",
      ].includes(arg)
    ) {
      const value = argv[++index];
      if (!value || (arg !== "--playwright-arg" && value.startsWith("--")))
        throw new Error(`${arg} requires a value`);
      if (arg === "--base") base = value;
      else if (arg === "--output") output = value;
      else if (arg === "--github-output") githubOutput = value;
      else if (arg === "--plan") planPath = value;
      else if (arg === "--list-e2e") listE2ePath = value;
      else if (arg === "--playwright-arg") playwrightArgs.push(value);
      else suite = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }

  let plan;
  if (planPath) {
    plan = JSON.parse(readFileSync(resolve(root, planPath), "utf8"));
    if (!Array.isArray(plan?.e2e) || !plan.e2e.length)
      throw new Error("Invalid area plan: e2e list is required");
  } else {
    const manifest = JSON.parse(
      readFileSync(resolve(root, "infra/verification-areas.json"), "utf8"),
    );
    const changes = readChanges(base, git);
    plan = {
      ...selectAreas(
        manifest,
        changes.changed,
        changes.inventory,
        changes.reason,
      ),
      mergeBase: changes.mergeBase ?? null,
    };
  }

  if (output) writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`);
  if (githubOutput) {
    appendFileSync(
      githubOutput,
      `full=${plan.full}\nneeds_game_container=${Boolean(plan.needsGameContainer)}\n`,
    );
  }
  if (!planPath) log(JSON.stringify(plan, null, 2));

  if (listE2ePath) {
    const listed = execute(
      process.execPath,
      [
        resolve(root, "node_modules/@playwright/test/cli.js"),
        "test",
        "--list",
        "--reporter=json",
        ...(plan.full ? [] : plan.e2e),
      ],
      { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
    writeFileSync(resolve(root, listE2ePath), listed);
  }

  if (run) {
    const commands = buildCommands(plan, suite, root, playwrightArgs);
    execute(
      process.execPath,
      [resolve(root, "scripts/prepare-game-packages.mjs")],
      { cwd: root, stdio: "inherit" },
    );
    for (const command of commands)
      execute(process.execPath, command.args, {
        cwd: command.cwd,
        stdio: "inherit",
      });
  }
  return plan;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
