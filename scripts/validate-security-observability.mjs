import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const expectedEvents = [
  "app_check_rejected",
  "access_denied",
  "rate_limited",
  "server_error",
  "ai_generation",
];
const forbiddenFilterTerms = ["email", "phone", "uid", "userid", "requestbody", "prompt"];

export function validateSecurityObservability(document) {
  const failures = [];
  const names = new Set();

  if (document.schemaVersion !== 1 || document.project !== "aresfirst-portal") {
    failures.push("The observability contract must target the production project with schema version 1.");
  }
  if (!Array.isArray(document.logMetrics) || !Array.isArray(document.alertPolicies)) {
    failures.push("The observability contract requires logMetrics and alertPolicies arrays.");
  } else {
    for (const metric of document.logMetrics) {
      if (!/^aresweb_[a-z0-9_]+$/.test(metric.name ?? "") || names.has(metric.name)) {
        failures.push(`Invalid or duplicate log metric name: ${String(metric.name)}`);
      }
      names.add(metric.name);
      if (typeof metric.filter !== "string" || !metric.filter.includes('resource.type="cloud_run_revision"')) {
        failures.push(`Log metric ${String(metric.name)} is missing its bounded Cloud Run filter.`);
      }
      const normalized = String(metric.filter).toLowerCase();
      for (const term of forbiddenFilterTerms) {
        if (normalized.includes(term)) failures.push(`Log metric ${metric.name} filters on sensitive term ${term}.`);
      }
    }
    for (const expected of expectedEvents) {
      if (![...names].some((name) => name.includes(expected))) {
        failures.push(`Missing expected security metric: ${expected}`);
      }
    }
    for (const policy of document.alertPolicies) {
      const metricName = String(policy.metric ?? "").replace("logging.googleapis.com/user/", "");
      if (!names.has(metricName)) failures.push(`Alert ${String(policy.name)} references an unknown metric.`);
      if (!Number.isSafeInteger(policy.threshold) || policy.threshold < 1) {
        failures.push(`Alert ${String(policy.name)} has an invalid threshold.`);
      }
      if (!Number.isSafeInteger(policy.windowSeconds) || policy.windowSeconds < 60) {
        failures.push(`Alert ${String(policy.name)} has an invalid window.`);
      }
    }
  }
  if (document.budget?.scope !== "project:aresfirst-portal" || document.budget?.hardCap !== false) {
    failures.push("The budget guidance must be project-scoped and must not claim to be a hard cap.");
  }

  if (failures.length > 0) throw new Error(failures.join("\n"));
  return {metricCount: names.size};
}

async function main() {
  const contractPath = resolve("infra/gcp/security-observability.json");
  const document = JSON.parse(await readFile(contractPath, "utf8"));
  const {metricCount} = validateSecurityObservability(document);
  console.log(`Security observability contract is valid (${metricCount} redacted log metrics).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
