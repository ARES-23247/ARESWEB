import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBiobuzzContract, verifyRevision } from "./biobuzz-cloud-run.mjs";
import { prepareGamePackages } from "./prepare-game-packages.mjs";
import {
  validateGameServiceContract,
  validateLiveGameService,
} from "./verify-game-cloud-run.mjs";
import { validateDeploymentContract } from "./verify-production-deployment.mjs";

export const DEPLOYMENT_FINGERPRINT_LABEL = "ares-fp";
export const FINGERPRINT_PATTERN = /^v1-[a-f0-9]{60}$/u;

export const FUNCTION_EXTRA_ENTRIES = {
  cleanupOldInquiries: [],
  cleanupWaggleGardens: ["functions/src/lib/waggleCommunityCleanup.ts"],
  communicationsApi: ["functions/src/apps/communications.ts"],
  coreApi: ["functions/src/apps/core.ts"],
  driveApi: ["functions/src/apps/drive.ts"],
  mediaApi: ["functions/src/apps/media.ts"],
  publicApi: ["functions/src/apps/public.ts"],
  refreshPublicSitemap: ["functions/src/routes/sitemap.ts"],
  refreshSimulationArtifacts: ["functions/src/routes/simulations.ts"],
  syncGoogleDriveChanges: [],
  taskDueDigest: [],
  web: [],
};

const toPosix = (value) => value.replaceAll("\\", "/");
const sorted = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

export function parseRelativeImports(
  source,
  fileLabel,
  { includeDynamic = true } = {},
) {
  const specifiers = [];
  const staticPattern =
    /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^;\n]*?\s+from\s+|\{[\s\S]*?\}\s+from\s+)?["']([^"']+)["']/gu;
  for (const match of source.matchAll(staticPattern)) {
    if (match[1].startsWith(".")) specifiers.push(match[1]);
  }
  const dynamicPattern = /\b(?:import|require)\s*\(\s*([^)]+?)\s*\)/gu;
  for (const match of source.matchAll(dynamicPattern)) {
    const raw = match[1].trim();
    const literal = /^["']([^"']+)["']$/u.exec(raw);
    if (!literal) {
      throw new Error(
        `Unsupported non-literal module specifier in ${fileLabel}: ${raw}`,
      );
    }
    if (includeDynamic && literal[1].startsWith(".")) {
      specifiers.push(literal[1]);
    }
  }
  return sorted(specifiers);
}

export function resolveFunctionsModule(root, fromFile, specifier) {
  const functionsSrcRoot = resolve(root, "functions/src");
  const base = resolve(dirname(resolve(root, fromFile)), specifier);
  for (const candidate of [`${base}.ts`, resolve(base, "index.ts"), base]) {
    const relToSrc = relative(functionsSrcRoot, candidate);
    if (relToSrc.startsWith("..") || relToSrc === "") continue;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return toPosix(relative(root, candidate));
    }
  }
  throw new Error(
    `Cannot resolve relative module "${specifier}" from ${fromFile}`,
  );
}

function readNormalizedText(root, relPath, fileCache) {
  if (fileCache?.has(relPath)) return fileCache.get(relPath);
  const fullPath = resolve(root, relPath);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing backend module: ${relPath}`);
  }
  const normalized = readFileSync(fullPath, "utf8").replaceAll("\r\n", "\n");
  fileCache?.set(relPath, normalized);
  return normalized;
}

export function collectFunctionModuleClosure(
  root,
  entryFiles,
  { includeDynamicInEntries = true, fileCache } = {},
) {
  const entrySet = new Set(entryFiles);
  const visited = new Set();
  const queue = [...entryFiles];
  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    const source = readNormalizedText(root, current, fileCache);
    visited.add(current);
    const includeDynamic = includeDynamicInEntries || !entrySet.has(current);
    for (const specifier of parseRelativeImports(source, current, {
      includeDynamic,
    })) {
      const next = resolveFunctionsModule(root, current, specifier);
      if (!visited.has(next)) queue.push(next);
    }
  }
  return sorted(visited);
}

export function hashComponentInputs(root, metadata, files, fileCache) {
  const hash = createHash("sha256");
  hash.update(`meta:${JSON.stringify(metadata)}\0`);
  for (const relPath of sorted(files)) {
    const normalized = readNormalizedText(root, relPath, fileCache);
    hash.update(`file:${relPath}:${normalized.length}\0${normalized}\0`);
  }
  return `v1-${hash.digest("hex").slice(0, 60)}`;
}

function loadValidatedContracts(root) {
  const readJson = (relPath) =>
    JSON.parse(readFileSync(resolve(root, relPath), "utf8"));
  const rawDeploy = readJson("infra/gcp/production-deployment.json");
  const roleSpec = readJson(rawDeploy.deploymentRoleFile);
  const deploymentContract = validateDeploymentContract(rawDeploy, roleSpec);
  const gameContract = validateGameServiceContract(
    readJson("infra/gcp/game-service.json"),
  );
  const biobuzzContract = validateBiobuzzContract(
    readJson("infra/gcp/biobuzz-service.json"),
  );
  return { deploymentContract, gameContract, biobuzzContract };
}

const CANONICAL_GAME_RULE_FILES = [
  "packages/game-common/src/hexGrid.ts",
  "packages/buzzello/src/rules.ts",
  "packages/buzzle/src/rules.ts",
  "packages/waggle-way/src/core/level.ts",
  "packages/waggle-way/src/core/weather.ts",
  "packages/waggle-way/src/core/engine.ts",
  "packages/waggle-way/src/core/replay.ts",
  "packages/waggle-way/src/core/community.ts",
];

const CANONICAL_BIOBUZZ_RULE_FILES = [
  "packages/biobuzz/src/core/types.ts",
  "packages/biobuzz/src/core/timing.ts",
  "packages/biobuzz/src/core/field.ts",
  "packages/biobuzz/src/core/hive.ts",
  "packages/biobuzz/src/core/shooting.ts",
  "packages/biobuzz/src/core/robot.ts",
  "packages/biobuzz/src/core/scoring.ts",
  "packages/biobuzz/src/core/auto.ts",
  "packages/biobuzz/src/core/bots.ts",
  "packages/biobuzz/src/core/engine.ts",
  "packages/biobuzz/src/core/protocol.ts",
];

export function computeDeploymentFingerprints(
  root = process.cwd(),
  { prepare = false } = {},
) {
  if (
    prepare ||
    !existsSync(resolve(root, "functions/src/generated/games/buzzle.ts"))
  ) {
    prepareGamePackages(root);
  }
  const { deploymentContract, gameContract, biobuzzContract } =
    loadValidatedContracts(root);
  const rootPkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const firebaseCfg = JSON.parse(
    readFileSync(resolve(root, "firebase.json"), "utf8"),
  );

  const declaredIds = sorted(deploymentContract.functions.map((fn) => fn.id));
  const mappedIds = sorted(Object.keys(FUNCTION_EXTRA_ENTRIES));
  if (JSON.stringify(declaredIds) !== JSON.stringify(mappedIds)) {
    throw new Error(
      `FUNCTION_EXTRA_ENTRIES (${mappedIds.join(", ")}) must match declared Functions (${declaredIds.join(", ")})`,
    );
  }

  const indexSource = readFileSync(
    resolve(root, "functions/src/index.ts"),
    "utf8",
  );
  const allDynamicInIndex = parseRelativeImports(
    indexSource,
    "functions/src/index.ts",
    { includeDynamic: true },
  );
  const staticOnlyInIndex = new Set(
    parseRelativeImports(indexSource, "functions/src/index.ts", {
      includeDynamic: false,
    }),
  );
  const resolvedLazyInIndex = sorted(
    allDynamicInIndex
      .filter((spec) => !staticOnlyInIndex.has(spec))
      .map((spec) =>
        resolveFunctionsModule(root, "functions/src/index.ts", spec),
      ),
  );
  const mappedLazyTargets = sorted(Object.values(FUNCTION_EXTRA_ENTRIES).flat());
  if (JSON.stringify(resolvedLazyInIndex) !== JSON.stringify(mappedLazyTargets)) {
    throw new Error(
      `Unmapped lazy import in functions/src/index.ts: expected [${mappedLazyTargets.join(", ")}], found [${resolvedLazyInIndex.join(", ")}]`,
    );
  }

  const fileCache = new Map();
  const gameFiles = [
    "functions/Dockerfile.game",
    "functions/Dockerfile.game.dockerignore",
    "functions/package.json",
    "functions/package-lock.json",
    "functions/tsconfig.json",
    "scripts/prepare-game-packages.mjs",
    "packages/buzzle/data/buzzle-words.txt",
    ...CANONICAL_GAME_RULE_FILES,
    ...collectFunctionModuleClosure(
      root,
      [
        "functions/src/gameServer.ts",
        "functions/src/lib/waggleVerification.worker.ts",
      ],
      {
        fileCache,
      },
    ).filter((file) => !file.startsWith("functions/src/generated/games/")),
  ];
  const game = hashComponentInputs(
    root,
    { engines: rootPkg.engines, contract: gameContract },
    gameFiles,
    fileCache,
  );

  const biobuzzFiles = [
    "functions/Dockerfile.biobuzz",
    "functions/Dockerfile.biobuzz.dockerignore",
    "functions/package.json",
    "functions/package-lock.json",
    "functions/tsconfig.json",
    "scripts/prepare-game-packages.mjs",
    "scripts/benchmark-biobuzz.mjs",
    ...CANONICAL_BIOBUZZ_RULE_FILES,
    ...collectFunctionModuleClosure(root, ["functions/src/biobuzzServer.ts"], {
      fileCache,
    }).filter((file) => !file.startsWith("functions/src/generated/games/")),
  ];
  const biobuzz = hashComponentInputs(
    root,
    { engines: rootPkg.engines, contract: biobuzzContract },
    biobuzzFiles,
    fileCache,
  );

  const indexBaseFiles = collectFunctionModuleClosure(
    root,
    ["functions/src/index.ts"],
    { includeDynamicInEntries: false, fileCache },
  );
  const sharedFunctionFiles = [
    "functions/package.json",
    "functions/package-lock.json",
    "functions/tsconfig.json",
    "scripts/prepare-game-packages.mjs",
    ...indexBaseFiles,
  ];
  const functions = {};
  for (const spec of deploymentContract.functions) {
    const rawExtraClosure = collectFunctionModuleClosure(
      root,
      FUNCTION_EXTRA_ENTRIES[spec.id],
      { fileCache },
    );
    const usesGeneratedGames = rawExtraClosure.some((file) =>
      file.startsWith("functions/src/generated/games/"),
    );
    const extraClosure = rawExtraClosure.filter(
      (file) => !file.startsWith("functions/src/generated/games/"),
    );
    functions[spec.id] = hashComponentInputs(
      root,
      {
        engines: rootPkg.engines,
        firebaseFunctions: firebaseCfg.functions,
        project: deploymentContract.project,
        region: deploymentContract.region,
        platform: deploymentContract.platform,
        runtime: deploymentContract.runtime,
        spec,
      },
      [
        ...sharedFunctionFiles,
        ...extraClosure,
        ...(usesGeneratedGames ? CANONICAL_GAME_RULE_FILES : []),
      ],
      fileCache,
    );
  }

  return {
    schemaVersion: 1,
    labelKey: DEPLOYMENT_FINGERPRINT_LABEL,
    game,
    biobuzz,
    functions,
  };
}

export function validateFingerprintManifest(manifest) {
  if (
    !manifest ||
    manifest.schemaVersion !== 1 ||
    manifest.labelKey !== DEPLOYMENT_FINGERPRINT_LABEL ||
    !FINGERPRINT_PATTERN.test(manifest.game ?? "") ||
    !FINGERPRINT_PATTERN.test(manifest.biobuzz ?? "") ||
    !manifest.functions ||
    typeof manifest.functions !== "object"
  ) {
    throw new Error("Invalid deployment fingerprint manifest");
  }
  for (const [id, value] of Object.entries(manifest.functions)) {
    if (!id || !FINGERPRINT_PATTERN.test(String(value ?? ""))) {
      throw new Error(`Invalid Function deployment fingerprint for ${id}`);
    }
  }
  return manifest;
}

export function decideGameDeployment(manifest, gameContract, servicePayload) {
  validateFingerprintManifest(manifest);
  validateGameServiceContract(gameContract);
  if (!servicePayload) {
    return {
      action: "deploy",
      reason: "missing live game service",
      fingerprint: manifest.game,
    };
  }
  try {
    validateLiveGameService(gameContract, servicePayload);
  } catch (error) {
    return {
      action: "deploy",
      reason: error instanceof Error ? error.message : String(error),
      fingerprint: manifest.game,
    };
  }
  const actualLabel =
    servicePayload?.metadata?.labels?.[DEPLOYMENT_FINGERPRINT_LABEL];
  if (actualLabel !== manifest.game) {
    return {
      action: "deploy",
      reason: `fingerprint changed (${actualLabel ?? "missing"} -> ${manifest.game})`,
      fingerprint: manifest.game,
    };
  }
  return {
    action: "skip",
    reason: "live Ready game service matches fingerprint and contract",
    fingerprint: manifest.game,
  };
}

export function decideBiobuzzDeployment(
  manifest,
  biobuzzContract,
  servicePayload,
) {
  validateFingerprintManifest(manifest);
  validateBiobuzzContract(biobuzzContract);
  if (!biobuzzContract.productionEnabled) {
    return {
      action: "disabled",
      reason: "BIOBUZZ production rollout is disabled",
      fingerprint: manifest.biobuzz,
    };
  }
  if (!servicePayload) {
    return {
      action: "deploy",
      reason: "missing live BIOBUZZ service",
      fingerprint: manifest.biobuzz,
    };
  }
  try {
    verifyRevision(biobuzzContract, servicePayload);
  } catch (error) {
    return {
      action: "deploy",
      reason: error instanceof Error ? error.message : String(error),
      fingerprint: manifest.biobuzz,
    };
  }
  const actualLabel =
    servicePayload?.metadata?.labels?.[DEPLOYMENT_FINGERPRINT_LABEL];
  if (actualLabel !== manifest.biobuzz) {
    return {
      action: "deploy",
      reason: `fingerprint changed (${actualLabel ?? "missing"} -> ${manifest.biobuzz})`,
      fingerprint: manifest.biobuzz,
    };
  }
  return {
    action: "skip",
    reason: "live Ready BIOBUZZ service matches fingerprint and contract",
    fingerprint: manifest.biobuzz,
  };
}

function functionMatchesContractAndFingerprint(
  deploymentContract,
  spec,
  actual,
  expectedFingerprint,
) {
  if (!actual) return false;
  const expectedValues = {
    project: deploymentContract.project,
    region: deploymentContract.region,
    platform: deploymentContract.platform,
    runtime: deploymentContract.runtime,
    runServiceId: spec.runServiceId,
    serviceAccount: spec.serviceAccount,
    state: "ACTIVE",
    timeoutSeconds: spec.timeoutSeconds,
    availableMemoryMb: spec.availableMemoryMb,
    maxInstances: spec.maxInstances,
    concurrency: spec.concurrency,
  };
  for (const [field, expected] of Object.entries(expectedValues)) {
    if (actual[field] !== expected) return false;
  }
  const hasTrigger =
    spec.trigger === "https"
      ? actual.httpsTrigger != null
      : actual.scheduleTrigger != null;
  if (!hasTrigger) return false;
  const actualSecrets = sorted(
    (actual.secretEnvironmentVariables ?? []).map((secret) => secret.key),
  );
  if (JSON.stringify(actualSecrets) !== JSON.stringify(sorted(spec.secrets))) {
    return false;
  }
  return actual.labels?.[DEPLOYMENT_FINGERPRINT_LABEL] === expectedFingerprint;
}

export function selectChangedFunctions(
  manifest,
  deploymentContract,
  functionsListPayload,
) {
  validateFingerprintManifest(manifest);
  const allIds = deploymentContract.functions.map((spec) => spec.id);
  if (
    !functionsListPayload ||
    functionsListPayload.status !== "success" ||
    !Array.isArray(functionsListPayload.result)
  ) {
    return {
      changedIds: allIds,
      unchangedIds: [],
      targets: allIds.map((id) => `functions:${id}`).join(","),
    };
  }
  const actualById = new Map();
  for (const fn of functionsListPayload.result) {
    if (fn?.id) actualById.set(fn.id, fn);
  }
  const changedIds = [];
  const unchangedIds = [];
  for (const spec of deploymentContract.functions) {
    const expectedFp = manifest.functions[spec.id];
    if (!expectedFp) {
      throw new Error(`Manifest is missing Function fingerprint for ${spec.id}`);
    }
    if (
      functionMatchesContractAndFingerprint(
        deploymentContract,
        spec,
        actualById.get(spec.id),
        expectedFp,
      )
    ) {
      unchangedIds.push(spec.id);
    } else {
      changedIds.push(spec.id);
    }
  }
  return {
    changedIds,
    unchangedIds,
    targets: changedIds.map((id) => `functions:${id}`).join(","),
  };
}

function readOptionalJson(sourcePath, readStdin) {
  const raw = (
    sourcePath === "-"
      ? readStdin
        ? readStdin()
        : readFileSync(0, "utf8")
      : readFileSync(resolve(sourcePath), "utf8")
  ).trim();
  return raw ? JSON.parse(raw) : null;
}

export function main(
  argv = process.argv.slice(2),
  root = process.cwd(),
  { log = console.log, readStdin } = {},
) {
  let writeManifestPath = null;
  let manifestPath = null;
  let printTarget = null;
  let shouldDeployGame = false;
  let shouldDeployBiobuzz = false;
  let selectFunctions = false;
  let serviceJsonPath = null;
  let functionsJsonPath = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--should-deploy-game") shouldDeployGame = true;
    else if (arg === "--should-deploy-biobuzz") shouldDeployBiobuzz = true;
    else if (arg === "--select-functions") selectFunctions = true;
    else if (
      [
        "--write-manifest",
        "--manifest",
        "--print-fingerprint",
        "--service-json",
        "--functions-json",
      ].includes(arg)
    ) {
      const value = argv[++index];
      if (!value || (value.startsWith("--") && value !== "-")) {
        throw new Error(`${arg} requires a value`);
      }
      if (arg === "--write-manifest") writeManifestPath = value;
      else if (arg === "--manifest") manifestPath = value;
      else if (arg === "--print-fingerprint") printTarget = value;
      else if (arg === "--service-json") serviceJsonPath = value;
      else functionsJsonPath = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  const actions = [
    Boolean(writeManifestPath),
    Boolean(printTarget),
    shouldDeployGame,
    shouldDeployBiobuzz,
    selectFunctions,
  ].filter(Boolean).length;
  if (actions !== 1) {
    throw new Error("Choose exactly one deployment-fingerprints action");
  }

  if (writeManifestPath) {
    const computed = computeDeploymentFingerprints(root);
    const outFile = resolve(root, writeManifestPath);
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, `${JSON.stringify(computed, null, 2)}\n`);
    log(
      `Wrote deployment fingerprints (${Object.keys(computed.functions).length} Functions, game, biobuzz) to ${writeManifestPath}`,
    );
    return computed;
  }

  const manifest = manifestPath
    ? validateFingerprintManifest(
        JSON.parse(readFileSync(resolve(root, manifestPath), "utf8")),
      )
    : computeDeploymentFingerprints(root);

  if (printTarget) {
    const value =
      printTarget === "game"
        ? manifest.game
        : printTarget === "biobuzz"
          ? manifest.biobuzz
          : printTarget.startsWith("function:")
            ? manifest.functions[printTarget.slice("function:".length)]
            : null;
    if (!value) throw new Error(`Unknown fingerprint target: ${printTarget}`);
    log(value);
    return value;
  }

  const { deploymentContract, gameContract, biobuzzContract } =
    loadValidatedContracts(root);

  if (shouldDeployGame) {
    if (!serviceJsonPath) throw new Error("--service-json is required");
    const decision = decideGameDeployment(
      manifest,
      gameContract,
      readOptionalJson(serviceJsonPath, readStdin),
    );
    log(decision.action);
    return decision;
  }

  if (shouldDeployBiobuzz) {
    if (!serviceJsonPath) throw new Error("--service-json is required");
    const decision = decideBiobuzzDeployment(
      manifest,
      biobuzzContract,
      readOptionalJson(serviceJsonPath, readStdin),
    );
    log(decision.action);
    return decision;
  }

  if (!functionsJsonPath) throw new Error("--functions-json is required");
  const selection = selectChangedFunctions(
    manifest,
    deploymentContract,
    readOptionalJson(functionsJsonPath, readStdin),
  );
  log(selection.targets);
  return selection;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
