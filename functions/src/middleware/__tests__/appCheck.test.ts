import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextFunction, Response } from "express";

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("../../lib/firebase-admin", () => ({
  default: {
    appCheck: () => ({ verifyToken: mocks.verifyToken }),
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: mocks.info,
    warn: mocks.warn,
  },
}));

import {
  AppCheckObservedRequest,
  enforceAppCheck,
  getAppCheckRouteGroup,
  observeAppCheck,
  shouldObserveAppCheck,
} from "../appCheck";

function createRequest(
  method: string,
  path: string,
  token?: string
): AppCheckObservedRequest {
  return {
    method,
    path,
    get: vi.fn((name: string) => name === "X-Firebase-AppCheck" ? token : undefined),
  } as unknown as AppCheckObservedRequest;
}

describe("App Check monitoring middleware", () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENFORCE_APP_CHECK = "true";
    next = vi.fn() as unknown as NextFunction;
  });

  it("normalizes paths to a non-identifying route group", () => {
    expect(getAppCheckRouteGroup("/api/inquiries/private-id")).toBe("/api/inquiries");
    expect(getAppCheckRouteGroup("/api")).toBe("/api");
  });

  it("observes API mutations but not reads or unrelated paths", () => {
    expect(shouldObserveAppCheck(createRequest("POST", "/api/inquiries"))).toBe(true);
    expect(shouldObserveAppCheck(createRequest("GET", "/api/inquiries"))).toBe(false);
    expect(shouldObserveAppCheck(createRequest("POST", "/health"))).toBe(false);
  });

  it("exempts integrations that authenticate without Firebase App Check", () => {
    expect(shouldObserveAppCheck(createRequest("POST", "/api/profiles/sync"))).toBe(false);
    expect(shouldObserveAppCheck(createRequest("POST", "/api/webhooks/zulip"))).toBe(false);
  });

  it("skips verification and logging for exempt requests", async () => {
    const req = createRequest("POST", "/api/webhooks/zulip");

    await observeAppCheck(req, {} as Response, next);

    expect(mocks.verifyToken).not.toHaveBeenCalled();
    expect(mocks.info).not.toHaveBeenCalled();
    expect(mocks.warn).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it("records missing tokens without rejecting the request", async () => {
    const req = createRequest("PATCH", "/api/robots/robot-id", "   ");

    await observeAppCheck(req, {} as Response, next);

    expect(req.appCheckObservation).toEqual({ status: "missing" });
    expect(mocks.warn).toHaveBeenCalledWith("app-check", "App Check observation", {
      status: "missing",
      method: "PATCH",
      routeGroup: "/api/robots",
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it("records valid tokens from the production web app", async () => {
    mocks.verifyToken.mockResolvedValue({
      appId: "1:205869391101:web:ca1bb24da790e4904ff294",
    });
    const req = createRequest("POST", "/api/inquiries", "valid-token");

    await observeAppCheck(req, {} as Response, next);

    expect(mocks.verifyToken).toHaveBeenCalledWith("valid-token");
    expect(req.appCheckObservation).toEqual({
      status: "valid",
      appId: "1:205869391101:web:ca1bb24da790e4904ff294",
    });
    expect(mocks.info).toHaveBeenCalledWith("app-check", "App Check observation", {
      status: "valid",
      method: "POST",
      routeGroup: "/api/inquiries",
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it("records tokens issued to an unexpected app as invalid", async () => {
    mocks.verifyToken.mockResolvedValue({ appId: "unexpected-app" });
    const req = createRequest("DELETE", "/api/simulations/private-id", "other-token");

    await observeAppCheck(req, {} as Response, next);

    expect(req.appCheckObservation).toEqual({
      status: "invalid",
      appId: "unexpected-app",
      reason: "unexpected_app",
    });
    expect(mocks.warn).toHaveBeenCalledWith("app-check", "App Check observation", {
      status: "invalid",
      reason: "unexpected_app",
      method: "DELETE",
      routeGroup: "/api/simulations",
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it("records failed token verification as invalid without leaking details", async () => {
    mocks.verifyToken.mockRejectedValue(new Error("sensitive verifier detail"));
    const req = createRequest("POST", "/api/store/checkout", "invalid-token");

    await observeAppCheck(req, {} as Response, next);

    expect(req.appCheckObservation).toEqual({
      status: "invalid",
      reason: "verification_failed",
    });
    expect(mocks.warn).toHaveBeenCalledWith("app-check", "App Check observation", {
      status: "invalid",
      reason: "verification_failed",
      method: "POST",
      routeGroup: "/api/store",
    });
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain("sensitive verifier detail");
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects observed mutations when the token is missing", () => {
    const req = createRequest("POST", "/api/store/checkout");
    req.appCheckObservation = { status: "missing" };

    enforceAppCheck(req, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 401,
      code: "APP_CHECK_REQUIRED",
    }));
  });

  it("rejects observed mutations when token verification failed", () => {
    const req = createRequest("PATCH", "/api/robots/robot-id", "invalid-token");
    req.appCheckObservation = { status: "invalid", reason: "verification_failed" };

    enforceAppCheck(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 401,
      code: "APP_CHECK_REQUIRED",
    }));
  });

  it("allows valid and explicitly exempt mutation requests", () => {
    const valid = createRequest("DELETE", "/api/simulations/private-id", "valid-token");
    valid.appCheckObservation = { status: "valid", appId: "expected-app" };
    enforceAppCheck(valid, {} as Response, next);

    const exempt = createRequest("POST", "/api/webhooks/zulip");
    enforceAppCheck(exempt, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenNthCalledWith(1);
    expect(next).toHaveBeenNthCalledWith(2);
  });

  it("allows an explicit observation-only emergency override", () => {
    process.env.ENFORCE_APP_CHECK = "false";
    const req = createRequest("POST", "/api/store/checkout");
    req.appCheckObservation = { status: "missing" };

    enforceAppCheck(req, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("fails closed by default in production", () => {
    delete process.env.ENFORCE_APP_CHECK;
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const req = createRequest("POST", "/api/store/checkout");
    req.appCheckObservation = { status: "missing" };

    enforceAppCheck(req, {} as Response, next);

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 401,
      code: "APP_CHECK_REQUIRED",
    }));
  });
});
