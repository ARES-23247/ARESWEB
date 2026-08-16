import { describe, expect, it, vi } from "vitest";
import {
  applyHealthOriginOverride,
  buildHealthCheckUrl,
  parseArgs,
  runHealthCheck,
  runHealthChecks,
  validateHealthResponse,
} from "./check-production-health.mjs";

function contractWith(checks) {
  return {
    health: {
      primaryOrigin: "https://aresfirst.org",
      hostingOrigin: "https://aresfirst-portal.web.app",
      attempts: 2,
      retryDelayMs: 1,
      timeoutMs: 100,
      checks,
    },
  };
}

function response(body, init = {}) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init,
  });
}

describe("production response validation", () => {
  it("checks status, type, body, JSON, and required security header values", () => {
    const check = {
      status: 200,
      contentType: "application/json",
      validJson: true,
      bodyIncludes: ["healthy"],
      headerIncludes: { "x-content-type-options": ["nosniff"] },
    };
    const healthy = response('{"status":"healthy"}', {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
    expect(validateHealthResponse(check, healthy, '{"status":"healthy"}')).toBe(
      true,
    );
  });

  it("combines response contract violations without logging the body", () => {
    const check = {
      status: 404,
      contentType: "application/json",
      validJson: true,
      bodyIncludes: ["missing-marker"],
      headerIncludes: { "x-content-type-options": ["nosniff"] },
    };
    const unhealthy = response("private response body");
    expect(() =>
      validateHealthResponse(check, unhealthy, "private response body"),
    ).toThrow(
      /HTTP 404[\s\S]*Content-Type[\s\S]*missing-marker[\s\S]*not valid JSON[\s\S]*nosniff/,
    );
  });
});

describe("production health runner", () => {
  const check = {
    name: "missing page",
    origin: "primary",
    path: "/missing-{{DEPLOYMENT_ID}}",
    status: 404,
    contentType: "text/html",
  };

  it("builds only configured origins with a bounded deployment identifier", () => {
    const contract = contractWith([check]);
    expect(buildHealthCheckUrl(contract, check, "abc-123")).toBe(
      "https://aresfirst.org/missing-abc-123",
    );
    expect(() =>
      buildHealthCheckUrl(contract, { ...check, origin: "unknown" }, "abc"),
    ).toThrow("unknown origin");
    expect(() => buildHealthCheckUrl(contract, check, "../escape")).toThrow(
      "Deployment id",
    );
  });

  it("retries propagation failures and succeeds without exposing response bodies", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response("not ready"))
      .mockResolvedValueOnce(response("not found", { status: 404 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const logger = { log: vi.fn() };
    await expect(
      runHealthCheck(contractWith([check]), check, {
        deploymentId: "release-1",
        fetchImpl,
        sleep,
        logger,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ name: "missing page", status: 404 }),
    );
    expect(sleep).toHaveBeenCalledWith(1);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("PASS missing page"),
    );
  });

  it("fails after the bounded retry count and can run all checks", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response("wrong"));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(
      runHealthCheck(contractWith([check]), check, {
        deploymentId: "release-1",
        fetchImpl,
        sleep,
        logger: { log: vi.fn() },
      }),
    ).rejects.toThrow("FAIL missing page");
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const okCheck = {
      name: "home",
      origin: "hosting",
      path: "/",
      status: 200,
      contentType: "text/html",
    };
    await expect(
      runHealthChecks(contractWith([okCheck]), {
        deploymentId: "release-2",
        fetchImpl: vi.fn().mockResolvedValue(response("ok")),
        sleep,
        logger: { log: vi.fn() },
      }),
    ).resolves.toEqual({ checks: 1 });
  });

  it("waits for every check and reports all independent failures", async () => {
    const checks = [
      { name: "first", origin: "primary", path: "/first", status: 201 },
      { name: "second", origin: "hosting", path: "/second", status: 202 },
    ];
    const fetchImpl = vi.fn().mockResolvedValue(response("wrong"));
    await expect(
      runHealthChecks(contractWith(checks), {
        deploymentId: "release-3",
        fetchImpl,
        sleep: vi.fn().mockResolvedValue(undefined),
        logger: { log: vi.fn() },
      }),
    ).rejects.toThrow(/FAIL first[\s\S]*FAIL second/);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("bounds concurrent probes so the health gate does not trigger edge protection", async () => {
    const checks = Array.from({ length: 5 }, (_, index) => ({
      name: `check ${index + 1}`,
      origin: "primary",
      path: `/check-${index + 1}`,
      status: 200,
      contentType: "text/html",
    }));
    let activeRequests = 0;
    let peakRequests = 0;
    const fetchImpl = vi.fn(async () => {
      activeRequests += 1;
      peakRequests = Math.max(peakRequests, activeRequests);
      await Promise.resolve();
      activeRequests -= 1;
      return response("ok");
    });

    await expect(
      runHealthChecks(contractWith(checks), {
        deploymentId: "release-4",
        fetchImpl,
        sleep: vi.fn().mockResolvedValue(undefined),
        logger: { log: vi.fn() },
      }),
    ).resolves.toEqual({ checks: 5 });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(peakRequests).toBe(2);
  });
});

describe("health checker arguments", () => {
  it("parses explicit safe identifiers and rejects ambiguous input", () => {
    expect(
      parseArgs(["--contract", "contract.json", "--deployment-id", "sha.123"]),
    ).toEqual({
      contractPath: "contract.json",
      deploymentId: "sha.123",
      primaryOrigin: undefined,
    });
    expect(() => parseArgs(["--deployment-id", "bad id"])).toThrow(
      "Deployment id",
    );
    expect(() => parseArgs(["--other"])).toThrow("Unknown argument");
  });

  it("allows a strict alternate HTTPS origin without accepting URL paths or credentials", () => {
    expect(
      parseArgs([
        "--deployment-id",
        "sha.123",
        "--primary-origin",
        "https://aresfirst-portal.web.app",
      ]),
    ).toEqual({
      contractPath: "infra/gcp/production-deployment.json",
      deploymentId: "sha.123",
      primaryOrigin: "https://aresfirst-portal.web.app",
    });
    expect(() =>
      parseArgs(["--primary-origin", "http://aresfirst.org"]),
    ).toThrow("valid HTTPS origin");
    expect(() =>
      parseArgs(["--primary-origin", "https://aresfirst.org/path"]),
    ).toThrow("valid HTTPS origin");
    expect(() =>
      parseArgs(["--primary-origin", "https://user:pass@aresfirst.org"]),
    ).toThrow("valid HTTPS origin");
    expect(() => parseArgs(["--primary-origin"])).toThrow(
      "requires an HTTPS origin",
    );
  });

  it("overrides only the primary health origin without mutating the contract", () => {
    const original = contractWith([]);
    const overridden = applyHealthOriginOverride(
      original,
      "https://aresfirst-portal.web.app",
    );
    expect(overridden.health.primaryOrigin).toBe(
      "https://aresfirst-portal.web.app",
    );
    expect(overridden.health.hostingOrigin).toBe(
      "https://aresfirst-portal.web.app",
    );
    expect(original.health.primaryOrigin).toBe("https://aresfirst.org");
  });
});
