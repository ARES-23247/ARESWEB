import { describe, expect, it, vi } from "vitest";
import {
  isTransientAuditFailure,
  retryDelayMs,
  runProductionAudit,
} from "./run-production-audit.mjs";

describe("production dependency audit retry policy", () => {
  it.each([
    "[23] operation aborted due to timeout",
    "request failed with ECONNRESET",
    "ERR_PNPM_AUDIT_BAD_RESPONSE",
    "npm registry returned 503 Service Unavailable",
    "advisory endpoint timed out",
  ])("recognizes transient advisory service failures: %s", (output) => {
    expect(isTransientAuditFailure(output)).toBe(true);
  });

  it.each([
    "3 vulnerabilities found\nSeverity: high",
    "ERR_PNPM_NO_LOCKFILE",
    "Command not found: pnpm",
  ])("does not disguise audit findings or unknown failures: %s", (output) => {
    expect(isTransientAuditFailure(output)).toBe(false);
  });

  it("uses bounded exponential retry delays", () => {
    expect([1, 2, 3].map(retryDelayMs)).toEqual([10_000, 20_000, 40_000]);
  });

  it("retries a transient failure and returns only after a successful audit", async () => {
    const runAttempt = vi.fn()
      .mockResolvedValueOnce({ exitCode: 1, output: "ETIMEDOUT" })
      .mockResolvedValueOnce({ exitCode: 0, output: "No known vulnerabilities" });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const logger = { log: vi.fn(), warn: vi.fn() };

    await expect(runProductionAudit({ runAttempt, sleep, logger })).resolves.toBe(true);
    expect(runAttempt).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10_000);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("retrying"));
  });

  it("fails immediately for vulnerability findings or unknown errors", async () => {
    const runAttempt = vi.fn().mockResolvedValue({
      exitCode: 1,
      output: "1 high severity vulnerability found",
    });

    await expect(runProductionAudit({
      runAttempt,
      sleep: vi.fn(),
      logger: { log: vi.fn(), warn: vi.fn() },
    })).rejects.toThrow("refusing to retry");
    expect(runAttempt).toHaveBeenCalledTimes(1);
  });

  it("fails closed after the bounded transient retry count", async () => {
    const runAttempt = vi.fn().mockResolvedValue({ exitCode: 1, output: "EAI_AGAIN" });
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(runProductionAudit({
      runAttempt,
      sleep,
      logger: { log: vi.fn(), warn: vi.fn() },
      maxAttempts: 3,
    })).rejects.toThrow("after 3 attempts");
    expect(runAttempt).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("rejects an invalid retry budget", async () => {
    await expect(runProductionAudit({ maxAttempts: 0 })).rejects.toThrow(
      "at least one attempt",
    );
  });
});
