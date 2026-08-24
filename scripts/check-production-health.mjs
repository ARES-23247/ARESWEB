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

function validateOrigin(origin, optionName) {
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error(`${optionName} must be a valid HTTPS origin`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`${optionName} must be a valid HTTPS origin`);
  }
  return parsed.origin;
}

export function applyHealthOriginOverride(contract, primaryOrigin) {
  if (!primaryOrigin) return contract;
  return {
    ...contract,
    health: {
      ...contract.health,
      primaryOrigin: validateOrigin(primaryOrigin, "--primary-origin"),
    },
  };
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
  for (const forbidden of check.bodyExcludes ?? []) {
    if (body.includes(forbidden))
      failures.push(`response body contains forbidden marker: ${forbidden}`);
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
  const results = [];
  const maxConcurrentChecks = 2;
  for (
    let index = 0;
    index < contract.health.checks.length;
    index += maxConcurrentChecks
  ) {
    const checks = contract.health.checks.slice(
      index,
      index + maxConcurrentChecks,
    );
    results.push(
      ...(await Promise.allSettled(
        checks.map((check) => runHealthCheck(contract, check, options)),
      )),
    );
  }
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

const PUBLIC_MEDIA_PATH = /^\/api\/photos\/public\/media\/([A-Za-z0-9_-]{1,300})\/(original|medium|thumbnail)$/u;
const PRIVATE_MEDIA_FIELDS = [
  "storagePath",
  "thumbnailPath",
  "mediumPath",
  "googleMediaItemId",
  "googleProductUrl",
];

export async function validatePublicMediaSurface(origin, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const request = (url) => fetchImpl(url, {
    redirect: "error",
    signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
    headers: { "user-agent": "ARESWEB deployment media health check" },
  });
  const listResponse = await request(new URL("/api/photos/public?limit=1", `${origin}/`));
  if (!listResponse.ok) throw new Error(`public gallery returned HTTP ${listResponse.status}`);
  if (!(listResponse.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    throw new Error("public gallery did not return JSON");
  }
  const payload = await listResponse.json();
  const photo = Array.isArray(payload?.photos) ? payload.photos[0] : null;
  if (!photo || typeof photo !== "object") {
    throw new Error("public gallery did not provide a media record for verification");
  }
  if (PRIVATE_MEDIA_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(photo, field))) {
    throw new Error("public gallery DTO exposed a private media field");
  }
  const originalMatch = typeof photo.publicUrl === "string"
    ? photo.publicUrl.match(PUBLIC_MEDIA_PATH)
    : null;
  if (!originalMatch || originalMatch[2] !== "original") {
    throw new Error("public gallery DTO did not use an opaque same-origin original URL");
  }
  for (const [field, variant] of [["thumbnailUrl", "thumbnail"], ["mediumUrl", "medium"]]) {
    if (photo[field] == null) continue;
    const match = typeof photo[field] === "string" ? photo[field].match(PUBLIC_MEDIA_PATH) : null;
    if (!match || match[1] !== originalMatch[1] || match[2] !== variant) {
      throw new Error(`public gallery DTO contained an invalid ${field}`);
    }
  }
  const selectedPath = photo.thumbnailUrl || photo.mediumUrl || photo.publicUrl;
  const mediaUrl = new URL(selectedPath, `${origin}/`);
  if (mediaUrl.origin !== new URL(origin).origin) {
    throw new Error("public gallery media URL was not same-origin");
  }
  const mediaResponse = await request(mediaUrl);
  if (!mediaResponse.ok) throw new Error(`public media returned HTTP ${mediaResponse.status}`);
  const mediaType = (mediaResponse.headers.get("content-type") ?? "").toLowerCase();
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(mediaType)) {
    throw new Error("public media returned an unsupported Content-Type");
  }
  if (!(mediaResponse.headers.get("cache-control") ?? "").toLowerCase().includes("public")) {
    throw new Error("public media was missing public cache policy");
  }
  if ((mediaResponse.headers.get("x-content-type-options") ?? "").toLowerCase() !== "nosniff") {
    throw new Error("public media was missing nosniff");
  }
  const reader = mediaResponse.body?.getReader();
  const firstChunk = reader ? await reader.read() : { done: true, value: null };
  if (firstChunk.done || !firstChunk.value?.byteLength) {
    throw new Error("public media response body was empty");
  }
  await reader.cancel();
  return true;
}

export async function runPublicMediaHealth(contract, options) {
  const sleep = options.sleep
    ?? ((milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)));
  const logger = options.logger ?? console;
  let lastError;
  for (let attempt = 1; attempt <= contract.health.attempts; attempt += 1) {
    try {
      await validatePublicMediaSurface(contract.health.primaryOrigin, {
        fetchImpl: options.fetchImpl,
        timeoutMs: contract.health.timeoutMs,
      });
      logger.log("PASS public same-origin media delivery");
      return true;
    } catch (error) {
      lastError = error;
      if (attempt < contract.health.attempts) await sleep(contract.health.retryDelayMs);
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`FAIL public same-origin media delivery: ${detail}`);
}

export function parseArgs(argv) {
  const options = {
    contractPath: "infra/gcp/production-deployment.json",
    deploymentId: process.env.GITHUB_SHA ?? `manual-${Date.now()}`,
    primaryOrigin: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--contract") options.contractPath = argv[++index];
    else if (arg === "--deployment-id") options.deploymentId = argv[++index];
    else if (arg === "--primary-origin") {
      options.primaryOrigin = argv[++index];
      if (!options.primaryOrigin) {
        throw new Error("--primary-origin requires an HTTPS origin");
      }
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.contractPath) throw new Error("--contract requires a path");
  validateDeploymentId(options.deploymentId);
  if (options.primaryOrigin !== undefined) {
    options.primaryOrigin = validateOrigin(
      options.primaryOrigin,
      "--primary-origin",
    );
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const contract = applyHealthOriginOverride(
    loadContract(options.contractPath),
    options.primaryOrigin,
  );
  const result = await runHealthChecks(contract, {
    deploymentId: options.deploymentId,
  });
  await runPublicMediaHealth(contract, {});
  console.log(`Production health valid: ${result.checks + 1} checks`);
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
