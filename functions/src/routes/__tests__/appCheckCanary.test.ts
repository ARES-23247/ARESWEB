import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const verifyToken = vi.hoisted(() => vi.fn());

vi.mock("../../lib/firebase-admin", () => ({
  adminAppCheck: { verifyToken },
}));
vi.mock("../../lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { createApiApp } from "../../apiApp";
import appCheckCanaryRouter from "../appCheckCanary";

const EXPECTED_APP_ID = "1:205869391101:web:ca1bb24da790e4904ff294";

async function requestCanary(token?: string) {
  const app = createApiApp({
    routes: [{ path: "/api/app-check", router: appCheckCanaryRouter }],
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  try {
    return await fetch(`http://127.0.0.1:${port}/api/app-check/canary`, {
      method: "POST",
      headers: token ? { "X-Firebase-AppCheck": token } : undefined,
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe("App Check canary complete middleware chain", () => {
  beforeEach(() => {
    process.env.ENFORCE_APP_CHECK = "true";
    verifyToken.mockReset();
  });

  afterEach(() => {
    delete process.env.ENFORCE_APP_CHECK;
  });

  it("rejects a missing token before reaching the canary handler", async () => {
    const response = await requestCanary();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "APP_CHECK_REQUIRED",
    });
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("rejects invalid and wrong-application tokens", async () => {
    verifyToken.mockRejectedValueOnce(new Error("invalid token"));
    expect((await requestCanary("invalid-token")).status).toBe(401);

    verifyToken.mockResolvedValueOnce({ appId: "unexpected-app" });
    expect((await requestCanary("wrong-app-token")).status).toBe(401);
  });

  it("returns 204 only after the real middleware chain verifies the expected app", async () => {
    verifyToken.mockResolvedValueOnce({ appId: EXPECTED_APP_ID });

    const response = await requestCanary("valid-app-check-token");

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(verifyToken).toHaveBeenCalledWith("valid-app-check-token");
  });
});
