#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_SECRETS = ["ABUSE_HMAC_SECRET", "ENCRYPTION_SECRET"];
const REQUIRED_RUNTIME_ROLES = [
  "roles/datastore.user",
  "roles/firebaseappcheck.tokenVerifier",
  "roles/firebaseauth.viewer",
];

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameStrings(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

export function validateGameServiceContract(contract) {
  if (!contract || contract.schemaVersion !== 1) {
    throw new Error("Unsupported game service contract schema");
  }
  if (contract.project !== "aresfirst-portal" || contract.region !== "us-central1") {
    throw new Error("Game service must remain in the reviewed Firebase project and region");
  }
  if (!/^[a-z][a-z0-9-]{1,62}$/u.test(contract.serviceId ?? "")) {
    throw new Error("Game service id is invalid");
  }
  if (!/^aresweb-game-runtime@aresfirst-portal\.iam\.gserviceaccount\.com$/u.test(
    contract.runtimeServiceAccount ?? "",
  )) {
    throw new Error("Game runtime identity is invalid");
  }
  if (!Array.isArray(contract.runtimeProjectRoles) || !sameStrings(
    contract.runtimeProjectRoles,
    REQUIRED_RUNTIME_ROLES,
  )) {
    throw new Error("Game runtime project roles exceed the reviewed allowlist");
  }
  if (
    !contract.artifactRegistry
    || !/^[a-z][a-z0-9-]+$/u.test(contract.artifactRegistry.repository ?? "")
    || !/^[a-z][a-z0-9-]+$/u.test(contract.artifactRegistry.image ?? "")
  ) {
    throw new Error("Game Artifact Registry target is invalid");
  }
  if (!sameStrings(contract.deployerArtifactRepositoryRoles ?? [], ["roles/artifactregistry.writer"])) {
    throw new Error("Game image repository deployer role is invalid");
  }
  if (!sameStrings(contract.deployerRuntimeIdentityRoles ?? [], ["roles/iam.serviceAccountUser"])) {
    throw new Error("Game runtime impersonation role is invalid");
  }

  const runtime = contract.runtime;
  if (
    !runtime
    || runtime.cpu !== "0.08"
    || runtime.memoryMiB !== 256
    || runtime.concurrency !== 1
    || runtime.minInstances !== 0
    || runtime.maxInstances !== 1
    || runtime.timeoutSeconds !== 10
    || runtime.executionEnvironment !== "gen1"
    || runtime.requestBasedBilling !== true
    || runtime.startupCpuBoost !== false
  ) {
    throw new Error("Game runtime must preserve the reviewed single-instance fractional-CPU ceiling");
  }
  if (!Array.isArray(contract.secrets) || !sameStrings(contract.secrets, REQUIRED_SECRETS)) {
    throw new Error(`Game secrets must be exactly [${REQUIRED_SECRETS.join(", ")}]`);
  }
  positiveInteger(contract.monthlyResourceUnits, "monthlyResourceUnits");
  if (contract.monthlyResourceUnits > 500_000) {
    throw new Error("Game monthly resource units cannot exceed the reviewed ceiling");
  }

  const cap = contract.spendCap;
  if (
    !cap
    || !/^[a-f0-9-]{36}$/u.test(cap.consoleBudgetId ?? "")
    || !/^\d{4}-\d{2}-\d{2}$/u.test(cap.configuredAt ?? "")
    || cap.billingService !== "Cloud Run"
    || cap.currency !== "USD"
    || cap.targetAmount !== 35
    || cap.period !== "calendar-month"
    || cap.enforcement !== "spend-cap"
    || cap.configuredOutsideDeployment !== true
    || cap.reportingLatencyCanCauseOverage !== true
  ) {
    throw new Error("Game spend-cap contract must retain the reviewed $35 Cloud Run boundary and latency warning");
  }
  return contract;
}

function annotation(template, name) {
  return template?.metadata?.annotations?.[name];
}

function normalizeCpu(value) {
  if (value === "80m" || value === "0.08") return "0.08";
  return value;
}

function normalizeMemoryMiB(value) {
  const match = /^(\d+)(?:Mi|MiB)$/u.exec(String(value ?? ""));
  return match ? Number.parseInt(match[1], 10) : Number.NaN;
}

export function validateLiveGameService(contract, service) {
  const errors = [];
  const template = service?.spec?.template;
  const container = template?.spec?.containers?.[0];
  const actual = {
    serviceId: service?.metadata?.name,
    region: service?.metadata?.labels?.["cloud.googleapis.com/location"],
    runtimeServiceAccount: template?.spec?.serviceAccountName,
    cpu: normalizeCpu(container?.resources?.limits?.cpu),
    memoryMiB: normalizeMemoryMiB(container?.resources?.limits?.memory),
    concurrency: template?.spec?.containerConcurrency,
    minInstances: Number.parseInt(annotation(template, "autoscaling.knative.dev/minScale") ?? "0", 10),
    maxInstances: Number.parseInt(annotation(template, "autoscaling.knative.dev/maxScale") ?? "", 10),
    timeoutSeconds: Number.parseInt(String(template?.spec?.timeoutSeconds ?? "").replace(/s$/u, ""), 10),
    executionEnvironment: annotation(template, "run.googleapis.com/execution-environment"),
    requestBasedBilling: annotation(template, "run.googleapis.com/cpu-throttling") !== "false",
    startupCpuBoost: annotation(template, "run.googleapis.com/startup-cpu-boost") === "true",
  };
  const expected = {
    serviceId: contract.serviceId,
    region: contract.region,
    runtimeServiceAccount: contract.runtimeServiceAccount,
    ...contract.runtime,
  };
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (actual[field] !== expectedValue) {
      errors.push(`${field}: expected ${expectedValue}, received ${actual[field]}`);
    }
  }

  const imagePrefix = `${contract.region}-docker.pkg.dev/${contract.project}/` +
    `${contract.artifactRegistry.repository}/${contract.artifactRegistry.image}@sha256:`;
  if (typeof container?.image !== "string" || !container.image.startsWith(imagePrefix)) {
    errors.push("image is not an immutable digest from the reviewed Artifact Registry repository");
  }
  const actualSecrets = (container?.env ?? [])
    .filter((entry) => entry?.valueFrom?.secretKeyRef)
    .map((entry) => entry.name);
  if (!sameStrings(actualSecrets, contract.secrets)) {
    errors.push(`secrets: expected [${sorted(contract.secrets)}], received [${sorted(actualSecrets)}]`);
  }
  if (!service?.status?.conditions?.some((condition) => condition.type === "Ready" && condition.status === "True")) {
    errors.push("service is not Ready");
  }
  if (errors.length > 0) {
    throw new Error(`Production game service drift detected:\n- ${errors.join("\n- ")}`);
  }
  return true;
}

export function validateGameInvokerPolicy(policy) {
  const publicRoles = (policy?.bindings ?? [])
    .filter((binding) => binding?.members?.includes("allUsers"))
    .map((binding) => binding.role);
  if (!publicRoles.includes("roles/run.invoker")) {
    throw new Error("Game service is missing allUsers roles/run.invoker");
  }
  if (publicRoles.some((role) => role !== "roles/run.invoker")) {
    throw new Error("Game service grants allUsers an unexpected IAM role");
  }
  return true;
}

export function imageUri(contract, tag) {
  if (!/^[a-f0-9]{40}$/u.test(tag)) throw new Error("Image tag must be a full Git commit SHA");
  return `${contract.region}-docker.pkg.dev/${contract.project}/` +
    `${contract.artifactRegistry.repository}/${contract.artifactRegistry.image}:${tag}`;
}

export function validateRepositoryWiring(contract, root = process.cwd()) {
  const read = (path) => readFileSync(resolve(root, path), "utf8");
  const firebase = JSON.parse(read("firebase.json"));
  const rewrite = firebase.hosting?.rewrites?.find(
    (candidate) => candidate.source === "/api/buzzello{,/**}",
  );
  if (
    rewrite?.run?.serviceId !== contract.serviceId
    || rewrite.run.region !== contract.region
    || rewrite.run.pinTag !== true
    || rewrite.function !== undefined
  ) {
    throw new Error("Firebase Hosting must route BUZZELLO only to the pinned game Cloud Run service");
  }

  const dockerfile = read("functions/Dockerfile.game");
  for (const pattern of [
    /FROM node:24\.18\.0-bookworm-slim/u,
    /npm ci/u,
    /npm prune --omit=dev/u,
    /ENV NODE_ENV=production/u,
    /ENFORCE_APP_CHECK=true/u,
    /USER node/u,
    /CMD \["node", "lib\/gameServer\.js"\]/u,
  ]) {
    if (!pattern.test(dockerfile)) throw new Error(`Game Dockerfile is missing ${pattern}`);
  }

  const routeSource = read("functions/src/routes/buzzello.ts");
  const sourceUnitLiteral = String(contract.monthlyResourceUnits).replace(/\B(?=(\d{3})+(?!\d))/gu, "_");
  if (
    !routeSource.includes(`GAME_MONTHLY_RESOURCE_UNITS = ${sourceUnitLiteral}`)
    || !routeSource.includes('calendarWindow: "month"')
    || !routeSource.includes('scope: "games-monthly-resource-project"')
  ) {
    throw new Error("BUZZELLO routes do not match the monthly resource-unit contract");
  }

  const workflow = read(".github/workflows/ci.yml");
  const requiredWorkflowText = [
    `gcloud run deploy ${contract.serviceId}`,
    `--service-account ${contract.runtimeServiceAccount}`,
    `--cpu ${contract.runtime.cpu}`,
    `--memory ${contract.runtime.memoryMiB}Mi`,
    `--concurrency ${contract.runtime.concurrency}`,
    `--min-instances ${contract.runtime.minInstances}`,
    `--max-instances ${contract.runtime.maxInstances}`,
    `--timeout ${contract.runtime.timeoutSeconds}s`,
    `--execution-environment ${contract.runtime.executionEnvironment}`,
    "--cpu-throttling",
    "--no-cpu-boost",
  ];
  for (const marker of requiredWorkflowText) {
    if (!workflow.includes(marker)) throw new Error(`Production workflow is missing ${marker}`);
  }
  return true;
}

export function readJson(path) {
  const input = path === "-" ? readFileSync(0, "utf8") : readFileSync(resolve(path), "utf8");
  return JSON.parse(input);
}

export function parseArgs(argv) {
  const options = {
    contractPath: "infra/gcp/game-service.json",
    validateContract: false,
    serviceJsonPath: null,
    iamJsonPath: null,
    imageTag: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--contract") options.contractPath = argv[++index];
    else if (arg === "--validate-contract") options.validateContract = true;
    else if (arg === "--service-json") options.serviceJsonPath = argv[++index];
    else if (arg === "--iam-json") options.iamJsonPath = argv[++index];
    else if (arg === "--print-image-uri") options.imageTag = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  const actions = [options.validateContract, options.serviceJsonPath, options.iamJsonPath, options.imageTag]
    .filter(Boolean).length;
  if (actions !== 1) throw new Error("Choose exactly one game service verification action");
  return options;
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const read = dependencies.readJsonFn ?? readJson;
  const log = dependencies.log ?? console.log;
  const options = parseArgs(argv);
  const contract = validateGameServiceContract(read(options.contractPath));
  if (options.validateContract) {
    validateRepositoryWiring(contract);
    log("Game Cloud Run contract is valid ($35 spend cap prerequisite; 500000 monthly units).");
  } else if (options.serviceJsonPath) {
    validateLiveGameService(contract, read(options.serviceJsonPath));
    log("Production game Cloud Run service matches the reviewed cost boundary.");
  } else if (options.iamJsonPath) {
    validateGameInvokerPolicy(read(options.iamJsonPath));
    log("Production game Cloud Run invoker policy is valid.");
  } else if (options.imageTag) {
    log(imageUri(contract, options.imageTag));
  }
}

export function reportMainError(error, target = console) {
  target.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(reportMainError);
}
