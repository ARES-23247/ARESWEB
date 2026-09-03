import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => {
  type Ref = { collectionName: string; id: string };
  const records = new Map<string, unknown>();
  const key = (ref: Ref) => `${ref.collectionName}/${ref.id}`;
  const snapshot = (ref: Ref) => ({ get exists() { return records.has(key(ref)); }, data: () => records.get(key(ref)) });
  const adminDb = {
    collection: (collectionName: string) => ({ doc: (id: string): Ref => ({ collectionName, id }) }),
    batch: () => {
      const operations: Array<() => void> = [];
      return {
        create: (ref: Ref, value: unknown) => operations.push(() => records.set(key(ref), value)),
        commit: async () => operations.forEach((operation) => operation()),
      };
    },
    runTransaction: async (work: (transaction: any) => Promise<unknown>) => work({
      get: async (ref: Ref) => snapshot(ref),
      create: (ref: Ref, value: unknown) => records.set(key(ref), value),
      set: (ref: Ref, value: unknown) => records.set(key(ref), value),
      update: (ref: Ref, value: Record<string, unknown>) => records.set(key(ref), {
        ...(records.get(key(ref)) as Record<string, unknown>), ...value,
      }),
      delete: (ref: Ref) => records.delete(key(ref)),
    }),
  };
  return {
    adminDb,
    clear: () => records.clear(),
    get: (collection: string, id: string) => records.get(`${collection}/${id}`) as Record<string, unknown> | undefined,
  };
});
const quotaConfigurations = vi.hoisted(() => [] as unknown[][]);

vi.mock("../../lib/firebase-admin", () => ({ adminDb: firestore.adminDb }));
vi.mock("express-rate-limit", () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../../middleware/distributedQuota", () => ({
  distributedQuotas: (options: unknown[]) => {
    quotaConfigurations.push(options);
    return (_req: unknown, _res: unknown, next: () => void) => next();
  },
}));
vi.mock("../../middleware/auth", () => ({
  ensureTeamMember: (req: any, _res: unknown, next: (error?: unknown) => void) => {
    if (req.get("Authorization") === "Bearer team-member") { next(); return; }
    next(Object.assign(new Error("Team sign-in required."), { status: 403 }));
  },
}));

import router from "../buzzle";

interface MatchResponse {
  inviteCode?: string;
  playerToken: string;
  matched?: boolean;
  game: {
    gameId: string;
    status: "waiting" | "active" | "finished";
    playerIndex: number;
    version: number;
    state: {
      board: unknown[];
      rack: Array<{ id: string }>;
      players: Array<{ score: number; rackCount: number }>;
      currentPlayer: number;
    };
  };
}

let server: Server;
let origin: string;
async function post(path: string, body: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return fetch(`${origin}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
}

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: "8kb" }));
  app.use(router);
  app.use((error: any, _req: unknown, res: any, _next: unknown) => res.status(error.status ?? 500).json({ error: error.message, code: error.code }));
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => {
  firestore.clear();
  process.env.ENCRYPTION_SECRET = "test-encryption-secret-that-is-at-least-32-characters";
});
afterAll(async () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

function putTileInRack(state: any, tileId: string, rackIndex: number) {
  const replacement = state.players[0].rack[rackIndex];
  const bagIndex = state.bag.findIndex((tile: { id: string }) => tile.id === tileId);
  if (bagIndex >= 0) {
    state.players[0].rack[rackIndex] = state.bag[bagIndex];
    state.bag[bagIndex] = replacement;
    return;
  }
  for (const player of state.players) {
    const found = player.rack.findIndex((tile: { id: string }) => tile.id === tileId);
    if (found >= 0) {
      state.players[0].rack[rackIndex] = player.rack[found];
      player.rack[found] = replacement;
      return;
    }
  }
}

describe("BUZZLE online routes", () => {
  it("exposes a mutation-free deployment health check", async () => {
    const response = await fetch(`${origin}/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({ healthy: true, service: "game-api", game: "buzzle" });
  });

  it("shares the single monthly resource ceiling across every endpoint", () => {
    const budgets = quotaConfigurations.map((configuration) => configuration[0] as Record<string, unknown>);
    expect(budgets).toHaveLength(6);
    expect(budgets.every(({ scope }) => scope === "games-monthly-resource-project")).toBe(true);
    expect(budgets.map(({ cost }) => cost)).toEqual([8, 8, 8, 8, 8, 5]);
  });

  it("creates and joins a private match without exposing the opponent rack or capability hashes", async () => {
    const createdResponse = await post("/games");
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json() as MatchResponse;
    expect(created.inviteCode).toMatch(/^[2-9A-HJ-NP-Z]{8}$/u);
    expect(created.game.state.rack).toHaveLength(7);
    expect(created.game.state.players).toEqual([{ score: 0, rackCount: 7 }, { score: 0, rackCount: 7 }]);
    expect(JSON.stringify(created)).not.toMatch(/tokenHash|bag"|chat|profile/u);

    const stored = firestore.get("game_matches", created.game.gameId)!;
    expect(JSON.stringify(stored)).not.toContain(created.playerToken);
    const joined = await (await post("/join", { code: created.inviteCode })).json() as MatchResponse;
    expect(joined.game).toMatchObject({ status: "active", playerIndex: 1 });
    expect(joined.game.state.rack).not.toEqual(created.game.state.rack);
  });

  it("validates words server-side and returns compact unchanged syncs", async () => {
    const created = await (await post("/games")).json() as MatchResponse;
    const joined = await (await post("/join", { code: created.inviteCode })).json() as MatchResponse;
    const stored = firestore.get("game_matches", created.game.gameId)!;
    putTileInRack(stored.state, "A-1", 0);
    putTileInRack(stored.state, "T-1", 1);
    const center = 108;
    const played = await post(`/games/${created.game.gameId}/actions`, {
      expectedVersion: 1,
      action: { type: "play", placements: [{ index: center, tileId: "A-1" }, { index: 125, tileId: "T-1" }] },
    }, { "X-Game-Player": created.playerToken });
    expect(played.status).toBe(200);
    await expect(played.json()).resolves.toMatchObject({ game: { version: 2, state: { currentPlayer: 1 } } });

    const compact = await post(`/games/${created.game.gameId}/sync`, {
      knownVersion: 2, knownStatus: "active", knownPlayerCount: 2,
    }, { "X-Game-Player": joined.playerToken });
    const payload = await compact.json();
    expect(payload).toMatchObject({ unchanged: true, syncsRemaining: 479 });
    expect(payload).not.toHaveProperty("game");

    const changed = await post(`/games/${created.game.gameId}/sync`, {
      knownVersion: 1, knownStatus: "active", knownPlayerCount: 2,
    }, { "X-Game-Player": joined.playerToken });
    await expect(changed.json()).resolves.toMatchObject({ game: { version: 2, syncsRemaining: 478 } });
  });

  it("separates guest and authenticated team queues and rejects invalid actions", async () => {
    const guest = await (await post("/matchmaking")).json() as MatchResponse;
    const matched = await (await post("/matchmaking")).json() as MatchResponse;
    expect(matched).toMatchObject({ matched: true, game: { gameId: guest.game.gameId } });
    expect((await post("/matchmaking/team")).status).toBe(403);
    const teamHeaders = { Authorization: "Bearer team-member" };
    const team = await (await post("/matchmaking/team", {}, teamHeaders)).json() as MatchResponse;
    expect(team.game.gameId).not.toBe(guest.game.gameId);

    const invalid = await post(`/games/${guest.game.gameId}/actions`, {
      expectedVersion: 1, action: { type: "play", placements: [{ index: 999, tileId: "A-1" }] },
    }, { "X-Game-Player": guest.playerToken });
    expect(invalid.status).toBe(400);
    expect((await post(`/games/${guest.game.gameId}/sync`)).status).toBe(401);
  });
});
