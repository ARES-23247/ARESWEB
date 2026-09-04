import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_ATTEMPTS = 4;
const INITIAL_RETRY_DELAY_MS = 10_000;
const COMMAND_TIMEOUT_MS = 45_000;

const TRANSIENT_FAILURE_PATTERNS = [
  /operation aborted due to timeout/iu,
  /\b(?:ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENETUNREACH|ENOTFOUND)\b/iu,
  /\bTimeoutError\b/iu,
  /\bERR_PNPM_(?:AUDIT_BAD_RESPONSE|META_FETCH_FAIL)\b/iu,
  /\b(?:429|500|502|503|504)\b[^\n]*(?:registry|audit|response|request|service|server)/iu,
  /(?:registry|audit|response|request|service|server)[^\n]*\b(?:429|500|502|503|504)\b/iu,
  /(?:npm registry|advisory endpoint)[^\n]*(?:unavailable|timed?\s*out)/iu,
  /Audit process[^\n]*timed?\s*out/iu,
];

export function isTransientAuditFailure(output) {
  return TRANSIENT_FAILURE_PATTERNS.some((pattern) => pattern.test(output));
}

export function retryDelayMs(failedAttempt) {
  return INITIAL_RETRY_DELAY_MS * 2 ** (failedAttempt - 1);
}

export function runPnpmAudit() {
  const isWindows = process.platform === "win32";
  const executable = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
  const auditArguments = ["audit", "--prod", "--audit-level=high"];
  const args = isWindows
    ? ["/d", "/s", "/c", `pnpm.cmd ${auditArguments.join(" ")}`]
    : auditArguments;

  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      env: {
        ...process.env,
        // Let this wrapper own the retry policy. A short per-attempt timeout
        // avoids spending several minutes inside pnpm before each retry.
        npm_config_fetch_retries: "0",
        npm_config_fetch_timeout: "30000",
      },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: COMMAND_TIMEOUT_MS,
      windowsHide: true,
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on("error", (error) => {
      output += `\n${error.name}: ${error.message}`;
    });
    child.on("close", (exitCode, signal) => {
      if (signal) {
        output += `\nAudit process ended after signal ${signal}; the attempt may have timed out.`;
      }
      resolve({ exitCode: exitCode ?? 1, output });
    });
  });
}

export async function runProductionAudit({
  runAttempt = runPnpmAudit,
  sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
  logger = console,
  maxAttempts = MAX_ATTEMPTS,
} = {}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("Production dependency audit requires at least one attempt.");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    logger.log(`Production dependency audit attempt ${attempt}/${maxAttempts}`);
    const result = await runAttempt();
    if (result.exitCode === 0) return true;

    const transient = isTransientAuditFailure(result.output);
    if (!transient) {
      throw new Error(
        "Production dependency audit failed with a vulnerability finding or an unrecognized error; refusing to retry.",
      );
    }
    if (attempt === maxAttempts) {
      throw new Error(
        `Production dependency audit could not reach a healthy advisory service after ${maxAttempts} attempts.`,
      );
    }

    const delay = retryDelayMs(attempt);
    logger.warn(
      `Transient npm advisory service failure; retrying in ${delay / 1000} seconds.`,
    );
    await sleep(delay);
  }

  throw new Error("Production dependency audit ended without a result.");
}

const isMain = process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  runProductionAudit().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
