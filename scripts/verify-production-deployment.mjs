import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_TRIGGERS = new Set(["https", "schedule"]);

function runGcloud(command, args, options) {
  if (process.platform !== "win32") return execFileSync(command, args, options);
  const scriptPath = execFileSync("where.exe", ["gcloud.ps1"], {
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .find(Boolean);
  if (!scriptPath) throw new Error("gcloud.ps1 is not available on PATH");
  return execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      ...args,
    ],
    options,
  );
}

function sortedStrings(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function sameStrings(left, right) {
  return (
    JSON.stringify(sortedStrings(left)) === JSON.stringify(sortedStrings(right))
  );
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

export function validateDeploymentContract(contract, roleSpec) {
  if (!contract || contract.schemaVersion !== 1)
    throw new Error("Unsupported deployment contract schema");
  for (const key of ["project", "region", "platform", "runtime"]) {
    if (typeof contract[key] !== "string" || contract[key].length === 0) {
      throw new Error(`Deployment contract ${key} is required`);
    }
  }
  if (!Array.isArray(contract.functions) || contract.functions.length === 0) {
    throw new Error("Deployment contract must list at least one Function");
  }

  const ids = new Set();
  const services = new Set();
  for (const spec of contract.functions) {
    if (
      typeof spec.id !== "string" ||
      !/^[A-Za-z][A-Za-z0-9]*$/.test(spec.id)
    ) {
      throw new Error("Every Function must have a valid id");
    }
    if (ids.has(spec.id)) throw new Error(`Duplicate Function id: ${spec.id}`);
    ids.add(spec.id);
    if (
      typeof spec.runServiceId !== "string" ||
      !/^[a-z][a-z0-9-]*$/.test(spec.runServiceId)
    ) {
      throw new Error(`${spec.id} has an invalid Cloud Run service id`);
    }
    if (services.has(spec.runServiceId))
      throw new Error(`Duplicate Cloud Run service: ${spec.runServiceId}`);
    services.add(spec.runServiceId);
    if (!ALLOWED_TRIGGERS.has(spec.trigger))
      throw new Error(`${spec.id} has an invalid trigger`);
    if (typeof spec.public !== "boolean")
      throw new Error(`${spec.id} public must be boolean`);
    if (spec.trigger !== "https" && spec.public)
      throw new Error(`${spec.id} cannot be public without an HTTPS trigger`);
    if (
      !Array.isArray(spec.secrets) ||
      spec.secrets.some(
        (key) => typeof key !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(key),
      )
    ) {
      throw new Error(`${spec.id} has an invalid secret allowlist`);
    }
    if (new Set(spec.secrets).size !== spec.secrets.length)
      throw new Error(`${spec.id} has duplicate secrets`);
    for (const field of [
      "timeoutSeconds",
      "availableMemoryMb",
      "maxInstances",
      "concurrency",
    ]) {
      requirePositiveInteger(spec[field], `${spec.id}.${field}`);
    }
  }

  if (
    !roleSpec ||
    roleSpec.stage !== "GA" ||
    !Array.isArray(roleSpec.includedPermissions)
  ) {
    throw new Error(
      "The deployment auxiliary role definition is missing or invalid",
    );
  }
  if (
    roleSpec.includedPermissions.length === 0 ||
    new Set(roleSpec.includedPermissions).size !==
      roleSpec.includedPermissions.length
  ) {
    throw new Error(
      "The deployment auxiliary role permissions must be non-empty and unique",
    );
  }
  if (
    roleSpec.includedPermissions.some(
      (permission) =>
        typeof permission !== "string" || permission.includes("*"),
    )
  ) {
    throw new Error(
      "The deployment auxiliary role cannot contain wildcard permissions",
    );
  }

  const health = contract.health;
  if (!health || !Array.isArray(health.checks) || health.checks.length === 0) {
    throw new Error("Deployment contract must define production health checks");
  }
  for (const originKey of ["primaryOrigin", "hostingOrigin"]) {
    let origin;
    try {
      origin = new URL(health[originKey]);
    } catch {
      throw new Error(`health.${originKey} must be a valid HTTPS origin`);
    }
    if (
      origin.protocol !== "https:" ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    ) {
      throw new Error(`health.${originKey} must be a valid HTTPS origin`);
    }
  }
  requirePositiveInteger(health.attempts, "health.attempts");
  requirePositiveInteger(health.retryDelayMs, "health.retryDelayMs");
  requirePositiveInteger(health.timeoutMs, "health.timeoutMs");
  const checkNames = new Set();
  for (const check of health.checks) {
    if (
      typeof check.name !== "string" ||
      check.name.length === 0 ||
      checkNames.has(check.name)
    ) {
      throw new Error("Health check names must be non-empty and unique");
    }
    checkNames.add(check.name);
    if (!new Set(["primary", "hosting"]).has(check.origin))
      throw new Error(`${check.name} has an invalid health origin`);
    if (typeof check.path !== "string" || !check.path.startsWith("/"))
      throw new Error(`${check.name} must use an origin-relative path`);
    if (
      !Number.isInteger(check.status) ||
      check.status < 100 ||
      check.status > 599
    )
      throw new Error(`${check.name} has an invalid HTTP status`);
    for (const value of check.bodyIncludes ?? []) {
      if (typeof value !== "string" || value.length === 0)
        throw new Error(`${check.name} has an invalid body marker`);
    }
    for (const [header, values] of Object.entries(check.headerIncludes ?? {})) {
      if (
        !/^[a-z0-9-]+$/.test(header) ||
        !Array.isArray(values) ||
        values.length === 0 ||
        values.some((value) => typeof value !== "string" || value.length === 0)
      ) {
        throw new Error(`${check.name} has an invalid required header`);
      }
    }
  }
  return contract;
}

export function validateFunctionInventory(contract, payload) {
  if (
    !payload ||
    payload.status !== "success" ||
    !Array.isArray(payload.result)
  ) {
    throw new Error(
      "Firebase Functions inventory was not a successful JSON result",
    );
  }
  const actualById = new Map();
  for (const fn of payload.result) {
    if (actualById.has(fn.id))
      throw new Error(`Deployed Function id is duplicated: ${fn.id}`);
    actualById.set(fn.id, fn);
  }

  const expectedIds = new Set(contract.functions.map((spec) => spec.id));
  const unexpected = [...actualById.keys()].filter(
    (id) => !expectedIds.has(id),
  );
  const missing = [...expectedIds].filter((id) => !actualById.has(id));
  const errors = [];
  if (unexpected.length > 0)
    errors.push(
      `unexpected Functions: ${sortedStrings(unexpected).join(", ")}`,
    );
  if (missing.length > 0)
    errors.push(`missing Functions: ${sortedStrings(missing).join(", ")}`);

  for (const spec of contract.functions) {
    const actual = actualById.get(spec.id);
    if (!actual) continue;
    const expectedValues = {
      project: contract.project,
      region: contract.region,
      platform: contract.platform,
      runtime: contract.runtime,
      runServiceId: spec.runServiceId,
      state: "ACTIVE",
      timeoutSeconds: spec.timeoutSeconds,
      availableMemoryMb: spec.availableMemoryMb,
      maxInstances: spec.maxInstances,
      concurrency: spec.concurrency,
    };
    for (const [field, expected] of Object.entries(expectedValues)) {
      if (actual[field] !== expected)
        errors.push(
          `${spec.id}.${field}: expected ${expected}, received ${actual[field]}`,
        );
    }
    const hasExpectedTrigger =
      spec.trigger === "https"
        ? actual.httpsTrigger != null
        : actual.scheduleTrigger != null;
    if (!hasExpectedTrigger)
      errors.push(`${spec.id}.trigger: expected ${spec.trigger}`);
    const actualSecrets = (actual.secretEnvironmentVariables ?? []).map(
      (secret) => secret.key,
    );
    if (!sameStrings(spec.secrets, actualSecrets)) {
      errors.push(
        `${spec.id}.secrets: expected [${sortedStrings(spec.secrets)}], received [${sortedStrings(actualSecrets)}]`,
      );
    }
  }

  if (errors.length > 0)
    throw new Error(
      `Production Function drift detected:\n- ${errors.join("\n- ")}`,
    );
  return { functions: contract.functions.length };
}

export function validateInvokerPolicy(spec, policy) {
  if (!policy || !Array.isArray(policy.bindings))
    throw new Error(`${spec.id} returned an invalid IAM policy`);
  const publicBindings = policy.bindings.filter(
    (binding) =>
      Array.isArray(binding.members) && binding.members.includes("allUsers"),
  );
  const hasRunInvoker = publicBindings.some(
    (binding) => binding.role === "roles/run.invoker",
  );
  if (spec.public && !hasRunInvoker)
    throw new Error(`${spec.id} is missing allUsers roles/run.invoker`);
  if (!spec.public && publicBindings.length > 0)
    throw new Error(`${spec.id} is private but grants allUsers an IAM role`);
  return true;
}

export function verifyLiveInvokerPolicies(
  contract,
  runCommand = runGcloud,
  gcloudCommand = "gcloud",
) {
  for (const spec of contract.functions) {
    const output = runCommand(
      gcloudCommand,
      [
        "run",
        "services",
        "get-iam-policy",
        spec.runServiceId,
        "--region",
        contract.region,
        "--project",
        contract.project,
        "--format=json",
      ],
      { encoding: "utf8" },
    );
    validateInvokerPolicy(spec, JSON.parse(output));
  }
  return { services: contract.functions.length };
}

export function parseArgs(argv) {
  const options = {
    contractPath: "infra/gcp/production-deployment.json",
    functionsJsonPath: null,
    verifyIam: false,
    validateContractOnly: false,
    printDeployTargets: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--contract") options.contractPath = argv[++index];
    else if (arg === "--functions-json")
      options.functionsJsonPath = argv[++index];
    else if (arg === "--verify-iam") options.verifyIam = true;
    else if (arg === "--validate-contract") options.validateContractOnly = true;
    else if (arg === "--print-deploy-targets")
      options.printDeployTargets = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.contractPath) throw new Error("--contract requires a path");
  if (
    !options.validateContractOnly &&
    !options.printDeployTargets &&
    !options.functionsJsonPath
  ) {
    throw new Error("--functions-json is required");
  }
  return options;
}

export function loadContract(contractPath) {
  const absoluteContractPath = resolve(contractPath);
  const contract = JSON.parse(readFileSync(absoluteContractPath, "utf8"));
  const rolePath = resolve(contract.deploymentRoleFile ?? "");
  if (!contract.deploymentRoleFile || !existsSync(rolePath))
    throw new Error("Deployment role file does not exist");
  const roleSpec = JSON.parse(readFileSync(rolePath, "utf8"));
  return validateDeploymentContract(contract, roleSpec);
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const contract = loadContract(options.contractPath);
  if (options.printDeployTargets) {
    console.log(
      contract.functions.map(({ id }) => `functions:${id}`).join(","),
    );
    return;
  }
  if (options.validateContractOnly) {
    console.log(
      `Deployment contract valid: ${contract.functions.length} Functions, ${contract.health.checks.length} health checks`,
    );
    return;
  }
  const inventorySource =
    options.functionsJsonPath === "-" ? 0 : resolve(options.functionsJsonPath);
  const inventory = JSON.parse(readFileSync(inventorySource, "utf8"));
  const inventoryResult = validateFunctionInventory(contract, inventory);
  console.log(
    `Function inventory valid: ${inventoryResult.functions} expected Functions`,
  );
  if (options.verifyIam) {
    const iamResult = verifyLiveInvokerPolicies(contract);
    console.log(
      `Cloud Run invoker policies valid: ${iamResult.services} services`,
    );
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
