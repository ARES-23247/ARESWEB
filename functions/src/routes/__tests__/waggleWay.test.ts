import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { WaggleStore } from "../../lib/__tests__/helpers/waggleStore";
const state = vi.hoisted(() => ({
  db: null as unknown as WaggleStore,
  proofCalls: 0,
  authCalls: 0,
}));
vi.mock("../../lib/firebase-admin", async () => {
  const { WaggleStore } =
    await import("../../lib/__tests__/helpers/waggleStore");
  state.db = new WaggleStore();
  return {
    adminDb: state.db.firestore,
    adminAuth: {
      verifyIdToken: async (token: string) => {
        state.authCalls++;
        if (token === "invalid") throw new Error("Invalid token");
        return { uid: token, email_verified: true };
      },
    },
    adminAppCheck: {
      verifyToken: async (token: string) => {
        if (token !== "valid-app") throw new Error("Invalid app");
        return { appId: "1:205869391101:web:ca1bb24da790e4904ff294" };
      },
    },
  };
});
vi.mock("../../lib/linkAuthorizedUser", () => ({
  linkAuthorizedUserByEmail: async () => false,
}));
vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
import { createApiApp } from "../../apiApp";
import { globalErrorHandler } from "../../middleware/errorHandler";
import { createWaggleWayRouter } from "../waggleWay";
import { createWaggleCommunityMutations } from "../../lib/waggleCommunityMutations";
import { evaluateWaggleProof } from "../../lib/waggleProof";
import { createBlankLevel } from "../../generated/games/waggle-way/level";
import {
  applyCommand,
  createRun,
  stepRun,
} from "../../generated/games/waggle-way/engine";
import { captureReplay } from "../../generated/games/waggle-way/replay";

let server: Server;
let origin: string;
const id = "00000000-0000-4000-8000-000000000001";
const level = createBlankLevel();
let run = applyCommand(level, createRun(level), { type: "start" });
while (run.phase !== "finished" && run.tick < 1800) run = stepRun(level, run);
const submission = {
  expectedVersion: 0,
  metadata: {
    nickname: "Clover",
    difficulty: "gentle",
    estimatedLength: "short",
  },
  proof: { level, replays: [captureReplay(level, run)] },
};
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  user?: string,
  headers: Record<string, string> = {},
) {
  return fetch(`${origin}/api/waggle-way${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      "X-Firebase-AppCheck": "valid-app",
      ...(user ? { Authorization: `Bearer ${user}` } : {}),
      ...headers,
    },
    ...(body === undefined
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}
beforeAll(async () => {
  const mutations = createWaggleCommunityMutations(
    state.db.firestore,
    async (payload) => {
      state.proofCalls++;
      return evaluateWaggleProof(payload);
    },
  );
  // Exercise default service construction as well as the injected canonical verifier.
  createWaggleWayRouter();
  const app = createApiApp({
    routes: [],
    preBodyRoutes: [
      { path: "/api/waggle-way", router: createWaggleWayRouter(mutations) },
    ],
    globalRequestLimit: { max: 5000, windowMs: 15 * 60 * 1000 },
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => {
  state.db.data.clear();
  state.db.failRead = "";
  state.db.failWrite = "";
  state.proofCalls = 0;
  state.authCalls = 0;
  for (const [uid, role, isDeleted] of [
    ["member", "member", false],
    ["coach", "coach", false],
    ["mentor", "mentor", false],
    ["archived", "member", true],
    ["unknown", "owner", false],
  ])
    state.db.data.set(`authorized_users/${uid}`, { role, isDeleted });
  vi.stubEnv("ENFORCE_APP_CHECK", "true");
  vi.stubEnv(
    "ENCRYPTION_SECRET",
    "local-test-quota-secret-at-least-32-characters",
  );
  vi.stubEnv(
    "ABUSE_HMAC_SECRET",
    "local-test-abuse-secret-at-least-32-characters",
  );
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("Waggle Way complete HTTP middleware chain", () => {
  it("limits repeated authentication before parsing even when mounted separately", async () => {
    const app = express();
    app.use("/api/waggle-way", createWaggleWayRouter());
    app.use(globalErrorHandler);
    const isolated = createServer(app);
    await new Promise<void>((resolve) => isolated.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${(isolated.address() as AddressInfo).port}/api/waggle-way/mine`;
    try {
      for (let attempt = 0; attempt < 300; attempt++) {
        const response = await fetch(url, { headers: { Authorization: "Bearer invalid" } });
        expect(response.status).toBe(401);
        await response.text();
      }
      expect(state.authCalls).toBe(300);
      const blocked = await fetch(url, { headers: { Authorization: "Bearer invalid" } });
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("retry-after")).toBeTruthy();
      expect(state.authCalls).toBe(300);
      expect(state.proofCalls).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) => isolated.close((error) => error ? reject(error) : resolve()));
    }
  });
  it("publishes only an approved revision, manages owner drafts, and resolves a guest report", async () => {
    expect(await (await request("/gardens")).json()).toEqual({
      gardens: [],
      nextCursor: null,
    });
    const submitted = await request(`/mine/${id}`, "PUT", submission, "member");
    expect(submitted.status).toBe(200);
    expect((await submitted.json()).status).toBe("pending");
    expect((await request(`/gardens/${id}`)).status).toBe(404);
    expect(
      await (await request("/mine", "GET", undefined, "member")).json(),
    ).toHaveLength(1);
    expect(
      (await request(`/mine/${id}`, "GET", undefined, "member")).status,
    ).toBe(200);
    expect(
      (await (await request("/review", "GET", undefined, "coach")).json())
        .gardens,
    ).toHaveLength(1);
    const review = await (
      await request(`/review/${id}`, "GET", undefined, "coach")
    ).json();
    const approval = await request(
      `/review/${id}`,
      "POST",
      {
        expectedVersion: 1,
        reviewDigest: review.reviewDigest,
        decision: "approve",
      },
      "coach",
    );
    expect(approval.status).toBe(200);
    const detail = await request(`/gardens/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.headers.get("Cache-Control")).toBe("private, no-store");
    expect(JSON.stringify(await detail.json())).not.toMatch(
      /ownerUid|reviewDigest|candidate|private-creator/u,
    );
    expect(
      (await request(`/gardens/${id}/report`, "POST", { reason: "text" }))
        .status,
    ).toBe(204);
    const reported = await (
      await request("/reports", "GET", undefined, "coach")
    ).json();
    expect(reported.reports).toHaveLength(1);
    const reportId = reported.reports[0].id;
    expect(
      (
        await request(
          `/reports/${reportId}/resolve`,
          "POST",
          { extra: true },
          "coach",
        )
      ).status,
    ).toBe(400);
    expect(
      (await request(`/reports/${reportId}/resolve`, "POST", {}, "coach"))
        .status,
    ).toBe(204);
    expect(
      (
        await request(
          `/gardens/${id}/remove`,
          "POST",
          { expectedVersion: 2, reason: "text" },
          "coach",
        )
      ).status,
    ).toBe(200);
    expect((await request(`/gardens/${id}`)).status).toBe(404);
    expect(
      (await request(`/mine/${id}`, "DELETE", { expectedVersion: 3 }, "member"))
        .status,
    ).toBe(200);
    expect(
      await (await request("/mine", "GET", undefined, "member")).json(),
    ).toEqual([]);
  });
  it("rejects unauthorized oversized proofs before parsing or spending quotas", async () => {
    const oversized = "{" + "x".repeat(800 * 1024);
    for (const [user, status] of [
      [undefined, 401],
      ["invalid", 401],
      ["missing", 403],
      ["archived", 403],
      ["unknown", 403],
    ] as const)
      expect(
        (await request(`/mine/${id}`, "PUT", oversized, user)).status,
      ).toBe(status);
    expect(state.proofCalls).toBe(0);
    expect(
      [...state.db.data.keys()].some((key) =>
        key.startsWith("internal_api_quotas/"),
      ),
    ).toBe(false);
    expect(
      (await request(`/mine/${id}`, "PUT", oversized, "member")).status,
    ).toBe(413);
    expect(state.proofCalls).toBe(0);
    expect(
      (await request(`/review/${id}`, "POST", oversized, "mentor")).status,
    ).toBe(403);
    expect((await request("/reports", "GET", undefined, "member")).status).toBe(
      403,
    );
  });
  it("checks App Check before any body and applies guest report quotas", async () => {
    expect(
      (
        await request(`/mine/${id}`, "PUT", "{", "member", {
          "X-Firebase-AppCheck": "",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(`/gardens/${id}/report`, "POST", "{", undefined, {
          "X-Firebase-AppCheck": "invalid-app",
        })
      ).status,
    ).toBe(401);
    expect(
      [...state.db.data.keys()].some((key) =>
        key.startsWith("internal_api_quotas/"),
      ),
    ).toBe(false);
    for (let n = 0; n < 10; n++)
      expect(
        (await request(`/gardens/${id}/report`, "POST", { reason: "text" }))
          .status,
      ).toBe(404);
    const blocked = await request(
      `/gardens/${id}/report`,
      "POST",
      "{" + "x".repeat(9000),
    );
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
  it("enforces the proof quota before malformed bodies and rejects unsupported encodings", async () => {
    expect(
      (
        await request(`/mine/${id}`, "PUT", "{", "member", {
          "Content-Type": "text/plain",
        })
      ).status,
    ).toBe(415);
    expect(
      (
        await request(`/mine/${id}`, "PUT", "{", "member", {
          "Content-Type": "application/json; charset=latin1",
        })
      ).status,
    ).toBe(415);
    expect(
      (
        await request(`/mine/${id}`, "PUT", "{", "member", {
          "Content-Encoding": "gzip",
        })
      ).status,
    ).toBe(415);
    expect((await request(`/mine/${id}`, "PUT", "{", "member")).status).toBe(
      400,
    );
    expect((await request(`/mine/${id}`, "PUT", {}, "member")).status).toBe(
      400,
    );
    expect((await request(`/mine/${id}`, "PUT", "{", "member")).status).toBe(
      400,
    );
    expect(
      (await request(`/mine/${id}`, "PUT", "x".repeat(800 * 1024), "member"))
        .status,
    ).toBe(429);
    expect(state.proofCalls).toBe(0);
    expect((await request(`/mine/${id}`, "DELETE", "{", "member")).status).toBe(
      400,
    );
    expect(
      (await request(`/mine/${id}`, "DELETE", "x".repeat(9000), "member"))
        .status,
    ).toBe(413);
    expect(
      (await request("/unknown", "POST", "x".repeat(2 * 1024 * 1024))).status,
    ).toBe(404);
  });
  it("returns explicit conflict and generic upstream errors, never false empty success", async () => {
    expect(
      (await request(`/mine/${id}`, "PUT", submission, "member")).status,
    ).toBe(200);
    expect(
      (await request(`/mine/${id}`, "PUT", submission, "member")).status,
    ).toBe(409);
    state.db.failRead = "waggle_levels";
    const failed = await request("/gardens");
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({
      error: "Internal server error.",
      code: "INTERNAL_ERROR",
    });
    state.db.failRead = "";
    vi.stubEnv("ABUSE_HMAC_SECRET", "");
    expect((await request("/gardens")).status).toBe(503);
  });
});
