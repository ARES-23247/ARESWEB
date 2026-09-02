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

const firestore = vi.hoisted(() => {
  type Ref = { collectionName: string; id: string };
  const records = new Map<string, unknown>();
  const key = (ref: Ref) => `${ref.collectionName}/${ref.id}`;
  const snapshot = (ref: Ref) => ({
    get exists() {
      return records.has(key(ref));
    },
    data: () => records.get(key(ref)),
  });
  const collection = (collectionName: string) => ({
    doc: (id: string): Ref => ({ collectionName, id }),
  });
  const adminDb = {
    collection,
    batch: () => {
      const operations: Array<() => void> = [];
      return {
        create: (ref: Ref, value: unknown) => {
          operations.push(() => records.set(key(ref), value));
        },
        commit: async () => {
          operations.forEach((operation) => operation());
        },
      };
    },
    runTransaction: async (work: (transaction: any) => Promise<unknown>) => {
      const transaction = {
        get: async (ref: Ref) => snapshot(ref),
        create: (ref: Ref, value: unknown) => records.set(key(ref), value),
        set: (ref: Ref, value: unknown) => records.set(key(ref), value),
        update: (ref: Ref, value: Record<string, unknown>) => {
          records.set(key(ref), {
            ...(records.get(key(ref)) as Record<string, unknown>),
            ...value,
          });
        },
        delete: (ref: Ref) => records.delete(key(ref)),
      };
      return work(transaction);
    },
  };
  const appCheckVerify = vi.fn();
  return {
    adminDb,
    appCheckVerify,
    records,
    clear: () => records.clear(),
    get: (collectionName: string, id: string) =>
      records.get(`${collectionName}/${id}`) as
        Record<string, unknown> | undefined,
  };
});

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: firestore.adminDb,
  adminAppCheck: { verifyToken: firestore.appCheckVerify },
}));
vi.mock("express-rate-limit", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../../middleware/distributedQuota", () => ({
  distributedQuotas: () => (_req: unknown, _res: unknown, next: () => void) =>
    next(),
}));
vi.mock("../../middleware/auth", () => ({
  ensureTeamMember: (
    req: any,
    _res: unknown,
    next: (error?: unknown) => void,
  ) => {
    if (req.get("Authorization") === "Bearer team-member") {
      req.user = { uid: "team-member" };
      next();
      return;
    }
    next(Object.assign(new Error("Team sign-in required."), { status: 403 }));
  },
}));

import {
  getBuzzelloLegalMoves,
  type BuzzelloBoard,
} from "../../lib/buzzelloGame";
import { createApiApp } from "../../apiApp";
import router, {
  generateBuzzelloInviteCode,
  hashBuzzelloInviteCode,
} from "../buzzello";

interface MatchResponse {
  inviteCode?: string;
  playerToken: string;
  matched?: boolean;
  game: {
    gameId: string;
    status: "waiting" | "active" | "finished";
    youAre: "yellow" | "black";
    version: number;
    syncsRemaining: number;
    state: {
      board: BuzzelloBoard;
      currentPlayer: "yellow" | "black";
      moveNumber: number;
    };
  };
}

let server: Server;
let origin: string;
let protectedServer: Server;
let protectedOrigin: string;

async function post(
  path: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: "8kb" }));
  app.use(router);
  app.use((error: any, _req: unknown, res: any, _next: unknown) => {
    res.status(error.status ?? 500).json({
      error: error.message,
      code: error.code ?? `HTTP_${error.status ?? 500}`,
    });
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  protectedServer = createServer(
    createApiApp({ routes: [{ path: "/api/buzzello", router }] }),
  );
  await new Promise<void>((resolve) =>
    protectedServer.listen(0, "127.0.0.1", resolve),
  );
  protectedOrigin = `http://127.0.0.1:${(protectedServer.address() as AddressInfo).port}`;
});

beforeEach(() => {
  firestore.clear();
  firestore.appCheckVerify.mockReset();
  process.env.ENCRYPTION_SECRET =
    "test-encryption-secret-that-is-at-least-32-characters";
});

afterAll(async () => {
  await Promise.all(
    [server, protectedServer].map(
      (activeServer) =>
        new Promise<void>((resolve, reject) => {
          activeServer.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

describe("BUZZELLO online routes", () => {
  it("creates and joins a private friend match without exposing stored capabilities", async () => {
    const createdResponse = await post("/games");
    expect(createdResponse.status).toBe(201);
    expect(createdResponse.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
    const created = (await createdResponse.json()) as MatchResponse;
    expect(created.inviteCode).toMatch(/^[2-9A-HJ-NP-Z]{8}$/u);
    expect(created.playerToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(created.game).toMatchObject({ status: "waiting", youAre: "yellow" });
    expect(JSON.stringify(created)).not.toMatch(/tokenHash|uid|chat|profile/iu);

    const stored = firestore.get("game_matches", created.game.gameId)!;
    expect(
      (stored.participants as Array<{ tokenHash: string }>)[0].tokenHash,
    ).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(stored)).not.toContain(created.playerToken);
    expect(firestore.get("game_invites", created.inviteCode!)).toBeUndefined();

    const joinedResponse = await post("/join", { code: created.inviteCode });
    expect(joinedResponse.status).toBe(200);
    const joined = (await joinedResponse.json()) as MatchResponse;
    expect(joined.game).toMatchObject({
      gameId: created.game.gameId,
      status: "active",
      youAre: "black",
    });
    expect(joined.playerToken).not.toBe(created.playerToken);

    const moveIndex = getBuzzelloLegalMoves(
      created.game.state.board,
      "yellow",
    )[0].index;
    const movedResponse = await post(
      `/games/${created.game.gameId}/moves`,
      { index: moveIndex, expectedVersion: 1 },
      { "X-Game-Player": created.playerToken },
    );
    expect(movedResponse.status).toBe(200);
    await expect(movedResponse.json()).resolves.toMatchObject({
      game: { version: 2, state: { currentPlayer: "black" } },
    });

    const blackSync = await post(
      `/games/${created.game.gameId}/sync`,
      {},
      { "X-Game-Player": joined.playerToken },
    );
    await expect(blackSync.json()).resolves.toMatchObject({
      game: { youAre: "black", syncsRemaining: 479 },
    });
  });

  it("blind-matches guests and keeps the authenticated team queue separate", async () => {
    const guestWaiting = (await (
      await post("/matchmaking")
    ).json()) as MatchResponse;
    const guestMatchedResponse = await post("/matchmaking");
    const guestMatched = (await guestMatchedResponse.json()) as MatchResponse;
    expect(guestMatchedResponse.status).toBe(200);
    expect(guestMatched).toMatchObject({
      matched: true,
      game: {
        gameId: guestWaiting.game.gameId,
        youAre: "black",
        status: "active",
      },
    });

    const denied = await post("/matchmaking/team");
    expect(denied.status).toBe(403);
    const teamHeaders = { Authorization: "Bearer team-member" };
    const teamWaiting = (await (
      await post("/matchmaking/team", {}, teamHeaders)
    ).json()) as MatchResponse;
    const teamMatched = (await (
      await post("/matchmaking/team", {}, teamHeaders)
    ).json()) as MatchResponse;
    expect(teamMatched).toMatchObject({
      matched: true,
      game: { gameId: teamWaiting.game.gameId, youAre: "black" },
    });
    expect(teamWaiting.game.gameId).not.toBe(guestWaiting.game.gameId);
  });

  it("rejects invalid sessions, stale moves, illegal moves, and exhausted sync budgets", async () => {
    const created = (await (await post("/games")).json()) as MatchResponse;
    const invalidSession = await post(`/games/${created.game.gameId}/sync`);
    expect(invalidSession.status).toBe(401);

    const unknownSession = await post(
      `/games/${created.game.gameId}/sync`,
      {},
      { "X-Game-Player": "z".repeat(43) },
    );
    expect(unknownSession.status).toBe(404);

    const joined = (await (
      await post("/join", { code: created.inviteCode })
    ).json()) as MatchResponse;
    const stale = await post(
      `/games/${created.game.gameId}/moves`,
      { index: 0, expectedVersion: 2 },
      { "X-Game-Player": created.playerToken },
    );
    expect(stale.status).toBe(409);
    const illegal = await post(
      `/games/${created.game.gameId}/moves`,
      { index: 0, expectedVersion: 1 },
      { "X-Game-Player": created.playerToken },
    );
    expect(illegal.status).toBe(400);
    const wrongTurn = await post(
      `/games/${created.game.gameId}/moves`,
      {
        index: getBuzzelloLegalMoves(created.game.state.board, "yellow")[0]
          .index,
        expectedVersion: 1,
      },
      { "X-Game-Player": joined.playerToken },
    );
    expect(wrongTurn.status).toBe(409);

    const game = firestore.get("game_matches", created.game.gameId)!;
    const participants = game.participants as Array<Record<string, unknown>>;
    participants[0] = { ...participants[0], syncsRemaining: 0 };
    const exhausted = await post(
      `/games/${created.game.gameId}/sync`,
      {},
      { "X-Game-Player": created.playerToken },
    );
    expect(exhausted.status).toBe(429);
  });

  it("rejects expired, malformed, and missing records with bounded responses", async () => {
    const invalidJoin = await post("/join", { code: "ABC23456" });
    expect(invalidJoin.status).toBe(404);
    const invalidBody = await post("/games", { unexpected: true });
    expect(invalidBody.status).toBe(400);
    const missing = await post(
      "/games/00000000-0000-4000-8000-000000000000/sync",
      {},
      { "X-Game-Player": "a".repeat(43) },
    );
    expect(missing.status).toBe(404);

    const created = (await (await post("/games")).json()) as MatchResponse;
    const game = firestore.get("game_matches", created.game.gameId)!;
    game.createdAt = new Date(Date.now() - 60_000);
    game.expiresAt = new Date(Date.now() - 1);
    const expired = await post(
      `/games/${created.game.gameId}/sync`,
      {},
      { "X-Game-Player": created.playerToken },
    );
    expect(expired.status).toBe(410);

    game.expiresAt = new Date(Date.now() + 60_000);
    const state = game.state as Record<string, unknown>;
    state.history = [{ player: "yellow", index: 99, flippedCount: 1 }];
    state.moveNumber = 1;
    const corrupted = await post(
      `/games/${created.game.gameId}/sync`,
      {},
      { "X-Game-Player": created.playerToken },
    );
    expect(corrupted.status).toBe(500);
  });

  it("uses non-ambiguous invite codes and fails closed without its HMAC key", () => {
    expect(generateBuzzelloInviteCode()).toMatch(/^[2-9A-HJ-NP-Z]{8}$/u);
    expect(hashBuzzelloInviteCode("ABC23456")).toMatch(/^[a-f0-9]{64}$/u);
    delete process.env.ENCRYPTION_SECRET;
    expect(() => hashBuzzelloInviteCode("ABC23456")).toThrow(
      /temporarily unavailable/i,
    );
  });

  it("requires verified App Check before a public guest match can allocate records", async () => {
    const originalEnforcement = process.env.ENFORCE_APP_CHECK;
    const originalEmulator = process.env.FUNCTIONS_EMULATOR;
    process.env.ENFORCE_APP_CHECK = "true";
    delete process.env.FUNCTIONS_EMULATOR;
    try {
      const denied = await fetch(`${protectedOrigin}/api/buzzello/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      expect(denied.status).toBe(401);
      expect(firestore.records.size).toBe(0);

      firestore.appCheckVerify.mockResolvedValueOnce({
        appId: "1:205869391101:web:ca1bb24da790e4904ff294",
      });
      const allowed = await fetch(`${protectedOrigin}/api/buzzello/games`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Firebase-AppCheck": "verified-app-check-token",
        },
        body: "{}",
      });
      expect(allowed.status).toBe(201);
      expect(firestore.records.size).toBe(2);
    } finally {
      if (originalEnforcement === undefined) delete process.env.ENFORCE_APP_CHECK;
      else process.env.ENFORCE_APP_CHECK = originalEnforcement;
      if (originalEmulator === undefined) delete process.env.FUNCTIONS_EMULATOR;
      else process.env.FUNCTIONS_EMULATOR = originalEmulator;
    }
  });
});
