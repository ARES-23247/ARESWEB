import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContract } from "./verify-production-deployment.mjs";

function validateDeploymentId(deploymentId) {
  if (
    typeof deploymentId !== "string" ||
    !/^[A-Za-z0-9._-]{1,128}$/.test(deploymentId)
  ) {
    throw new Error(
      "Deployment id must contain only letters, digits, dots, underscores, and hyphens",
    );
  }
  return deploymentId;
}

export function validateHealthResponse(check, response, body) {
  const failures = [];
  if (response.status !== check.status)
    failures.push(`expected HTTP ${check.status}, received ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (
    check.contentType &&
    !contentType.toLowerCase().startsWith(check.contentType.toLowerCase())
  ) {
    failures.push(
      `expected Content-Type ${check.contentType}, received ${contentType || "<missing>"}`,
    );
  }
  for (const required of check.bodyIncludes ?? []) {
    if (!body.includes(required))
      failures.push(`response body is missing required marker: ${required}`);
  }
  if (check.validJson) {
    try {
      JSON.parse(body);
    } catch {
      failures.push("response body is not valid JSON");
    }
  }
  for (const [name, requiredValues] of Object.entries(
    check.headerIncludes ?? {},
  )) {
    const value = response.headers.get(name) ?? "";
    for (const required of requiredValues) {
      if (!value.toLowerCase().includes(required.toLowerCase())) {
        failures.push(`${name} is missing required value: ${required}`);
      }
    }
  }
  if (failures.length > 0) throw new Error(failures.join("; "));
  return true;
}

export function buildHealthCheckUrl(contract, check, deploymentId) {
  const origins = {
    primary: contract.health.primaryOrigin,
    hosting: contract.health.hostingOrigin,
  };
  const origin = origins[check.origin];
  if (!origin)
    throw new Error(`${check.name} has an unknown origin: ${check.origin}`);
  const path = check.path.replaceAll(
    "{{DEPLOYMENT_ID}}",
    validateDeploymentId(deploymentId),
  );
  return new URL(path, `${origin}/`).toString();
}

export async function runHealthCheck(contract, check, options) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep =
    options.sleep ??
    ((milliseconds) =>
      new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)));
  const logger = options.logger ?? console;
  const url = buildHealthCheckUrl(contract, check, options.deploymentId);
  let lastError;

  for (let attempt = 1; attempt <= contract.health.attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        redirect: "error",
        signal: AbortSignal.timeout(contract.health.timeoutMs),
        headers: { "user-agent": "ARESWEB deployment health check" },
      });
      const body = await response.text();
      validateHealthResponse(check, response, body);
      logger.log(`PASS ${check.name}: ${response.status} ${url}`);
      return { name: check.name, status: response.status, url };
    } catch (error) {
      lastError = error;
      if (attempt < contract.health.attempts)
        await sleep(contract.health.retryDelayMs);
    }
  }
  const detail =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`FAIL ${check.name}: ${url}: ${detail}`);
}

export async function runHealthChecks(contract, options) {
  validateDeploymentId(options.deploymentId);
  const results = await Promise.allSettled(
    contract.health.checks.map((check) =>
      runHealthCheck(contract, check, options),
    ),
  );
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    throw new Error(
      failures
        .map((failure) =>
          failure.reason instanceof Error
            ? failure.reason.message
            : String(failure.reason),
        )
        .join("\n"),
    );
  }
  return { checks: results.length };
}

export function parseArgs(argv) {
  const options = {
    contractPath: "infra/gcp/production-deployment.json",
    deploymentId: process.env.GITHUB_SHA ?? `manual-${Date.now()}`,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--contract") options.contractPath = argv[++index];
    else if (arg === "--deployment-id") options.deploymentId = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.contractPath) throw new Error("--contract requires a path");
  validateDeploymentId(options.deploymentId);
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const contract = loadContract(options.contractPath);
  const result = await runHealthChecks(contract, {
    deploymentId: options.deploymentId,
  });
  console.log(`Production health valid: ${result.checks} checks`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
