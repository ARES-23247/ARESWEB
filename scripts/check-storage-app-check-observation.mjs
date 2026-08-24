import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const METRIC_TYPE =
  "firebaseappcheck.googleapis.com/resources/verification_count";
const RESOURCE_TYPE = "firebaseappcheck.googleapis.com/Resource";
const STORAGE_SERVICE = "firebasestorage.googleapis.com";
const DEFAULT_MINIMUM_HOURS = 72;
const METRIC_DELAY_MS = 3 * 60 * 1_000;

function parseTimestamp(value, optionName) {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new Error(`${optionName} must be an ISO-8601 timestamp`);
  }
  return new Date(milliseconds);
}

function parseMinimumHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 744) {
    throw new Error("--minimum-hours must be greater than 0 and no more than 744");
  }
  return hours;
}

export function parseObservationArgs(argv, now = new Date()) {
  const options = {
    end: new Date(now.getTime() - METRIC_DELAY_MS),
    minimumHours: DEFAULT_MINIMUM_HOURS,
    requireReady: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--require-ready") {
      options.requireReady = true;
      continue;
    }
    if (!["--project", "--start", "--end", "--minimum-hours"].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value`);
    }
    index += 1;
    if (argument === "--project") options.project = value;
    if (argument === "--start") options.start = parseTimestamp(value, argument);
    if (argument === "--end") options.end = parseTimestamp(value, argument);
    if (argument === "--minimum-hours") {
      options.minimumHours = parseMinimumHours(value);
    }
  }
  if (!options.project || !/^[a-z][a-z0-9-]{4,62}$/u.test(options.project)) {
    throw new Error("--project must be an explicit Firebase project ID");
  }
  if (!options.start) throw new Error("--start is required");
  if (options.start >= options.end) {
    throw new Error("--start must be earlier than the observation end");
  }
  return options;
}

export function buildMonitoringUrl(options, pageToken) {
  const url = new URL(
    `https://monitoring.googleapis.com/v3/projects/${options.project}/timeSeries`,
  );
  url.searchParams.set(
    "filter",
    `metric.type="${METRIC_TYPE}" AND ` +
      `resource.type="${RESOURCE_TYPE}" AND ` +
      `resource.labels.service_id="${STORAGE_SERVICE}"`,
  );
  url.searchParams.set("interval.startTime", options.start.toISOString());
  url.searchParams.set("interval.endTime", options.end.toISOString());
  url.searchParams.set("view", "FULL");
  url.searchParams.set("pageSize", "1000");
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  return url;
}

function increment(record, key, amount) {
  record[key] = (record[key] ?? 0) + amount;
}

export function summarizeVerificationSeries(timeSeries) {
  const summary = { total: 0, bySecurity: {}, byResult: {} };
  for (const series of timeSeries) {
    const count = (series.points ?? []).reduce(
      (total, point) => total + Number(point.value?.int64Value ?? 0),
      0,
    );
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error("Cloud Monitoring returned an invalid verification count");
    }
    if (count === 0) continue;
    const security = series.metric?.labels?.security ?? "UNSPECIFIED";
    const result = series.metric?.labels?.result ?? "UNSPECIFIED";
    summary.total += count;
    increment(summary.bySecurity, security, count);
    increment(summary.byResult, result, count);
  }
  return summary;
}

export function assessStorageObservation(options, summary) {
  const durationHours = (options.end - options.start) / (60 * 60 * 1_000);
  const windowComplete = durationHours >= options.minimumHours;
  if (summary.total > 0) {
    return {
      status: "REVIEW_REQUIRED",
      windowComplete,
      durationHours,
      readyForManualEnforcementReview: false,
      reason:
        "Cloud Monitoring observed direct Storage App Check verifications; classify every request before enforcement.",
    };
  }
  if (!windowComplete) {
    return {
      status: "OBSERVING",
      windowComplete: false,
      durationHours,
      readyForManualEnforcementReview: false,
      reason: `No direct Storage verifications were observed, but the ${options.minimumHours}-hour window is incomplete.`,
    };
  }
  return {
    status: "READY_FOR_MANUAL_ENFORCEMENT_REVIEW",
    windowComplete: true,
    durationHours,
    readyForManualEnforcementReview: true,
    reason:
      "The observation window is complete with no direct Storage verifications; finish the documented media and inventory checks before enforcement.",
  };
}

export function readGcloudAccessToken(
  spawnImpl = spawnSync,
  platform = process.platform,
  commandShell = process.env.ComSpec,
) {
  const windows = platform === "win32";
  const command = windows ? (commandShell ?? "cmd.exe") : "gcloud";
  const args = windows
    ? ["/d", "/s", "/c", "gcloud.cmd auth print-access-token"]
    : ["auth", "print-access-token"];
  const result = spawnImpl(command, args, { encoding: "utf8", windowsHide: true });
  const token = result.status === 0 ? result.stdout?.trim() : "";
  if (result.error || !token || /\s/u.test(token) || token.length > 8_192) {
    throw new Error(
      "Unable to obtain a Google Cloud access token; authenticate gcloud with a monitoring-viewer account.",
    );
  }
  return token;
}

export async function queryStorageAppCheckMetrics(options, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const accessToken =
    dependencies.accessToken ?? readGcloudAccessToken(dependencies.spawnImpl);
  const timeSeries = [];
  let pageToken;
  do {
    const response = await fetchImpl(buildMonitoringUrl(options, pageToken), {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(`Cloud Monitoring request failed with HTTP ${response.status}`);
    }
    const payload = await response.json();
    timeSeries.push(...(payload.timeSeries ?? []));
    pageToken = payload.nextPageToken;
  } while (pageToken);
  return summarizeVerificationSeries(timeSeries);
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseObservationArgs(argv, dependencies.now ?? new Date());
  const summary = await queryStorageAppCheckMetrics(options, dependencies);
  const assessment = assessStorageObservation(options, summary);
  const report = {
    mode: "read-only",
    project: options.project,
    service: STORAGE_SERVICE,
    interval: {
      start: options.start.toISOString(),
      end: options.end.toISOString(),
      minimumHours: options.minimumHours,
      samplingDelayMinutes: METRIC_DELAY_MS / 60_000,
    },
    counts: summary,
    assessment,
  };
  (dependencies.logger ?? console).log(JSON.stringify(report, null, 2));
  if (options.requireReady && !assessment.readyForManualEnforcementReview) {
    throw new Error(`Storage App Check observation is not ready: ${assessment.status}`);
  }
  return report;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
