import { beforeEach, describe, expect, it, vi } from "vitest";

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
  const adminDb = {
    collection: (collectionName: string) => ({
      doc: (id: string): Ref => ({ collectionName, id }),
    }),
    batch: () => {
      const operations: Array<() => void> = [];
      return {
        create: (ref: Ref, value: unknown) =>
          operations.push(() => records.set(key(ref), value)),
        commit: async () => operations.forEach((operation) => operation()),
      };
    },
    runTransaction: async (work: (transaction: any) => Promise<unknown>) => {
      const transaction = {
        get: async (ref: Ref) => snapshot(ref),
        create: (ref: Ref, value: unknown) => records.set(key(ref), value),
        set: (ref: Ref, value: unknown) => records.set(key(ref), value),
        update: (ref: Ref, value: Record<string, unknown>) =>
          records.set(key(ref), {
            ...(records.get(key(ref)) as Record<string, unknown>),
            ...value,
          }),
        delete: (ref: Ref) => records.delete(key(ref)),
      };
      return work(transaction);
    },
  };
  return { adminDb, clear: () => records.clear(), records };
});

vi.mock("../firebase-admin", () => ({ adminDb: firestore.adminDb }));

import {
  GameMatchService,
  hashGameInviteCode,
  requireGamePlayerToken,
  type GameDefinition,
} from "../gameMatches";

interface WordState {
  scores: number[];
  racks: string[][];
  finished: boolean;
}

interface WordAction {
  points: number;
}

const simultaneousWordDefinition: GameDefinition<
  WordState,
  WordAction,
  Record<string, unknown>,
  `player-${number}`
> = {
  gameType: "hex-words",
  minPlayers: 2,
  maxPlayers: 4,
  defaultMatchSize: 3,
  maxActions: 100,
  actionPolicy: "simultaneous",
  createInitialState: (playerCount) => ({
    scores: Array.from({ length: playerCount }, () => 0),
    racks: Array.from({ length: playerCount }, (_, index) => [
      `private-${index}`,
    ]),
    finished: false,
  }),
  parseState: (value, playerCount) => {
    const state = value as Partial<WordState>;
    if (
      !Array.isArray(state.scores) ||
      state.scores.length !== playerCount ||
      !state.scores.every(Number.isSafeInteger) ||
      !Array.isArray(state.racks) ||
      state.racks.length !== playerCount ||
      typeof state.finished !== "boolean"
    ) {
      throw new Error("Invalid word game state.");
    }
    return state as WordState;
  },
  activePlayerIndex: () => null,
  applyAction: (state, playerIndex, action) => ({
    ...state,
    scores: state.scores.map((score, index) =>
      index === playerIndex ? score + action.points : score,
    ),
  }),
  isFinished: (state) => state.finished,
  playerLabel: (playerIndex) => `player-${playerIndex}`,
  toPlayerView: (state, playerIndex) => ({
    scores: state.scores,
    rack: state.racks[playerIndex],
  }),
};

beforeEach(() => {
  firestore.clear();
  process.env.ENCRYPTION_SECRET =
    "generic-game-test-secret-that-is-long-enough";
});

describe("generic game match service", () => {
  it("supports multi-player friend rooms and player-specific hidden views", async () => {
    const service = new GameMatchService(simultaneousWordDefinition);
    const creator = await service.createFriendGame(3);
    const second = await service.joinFriendGame(creator.inviteCode);
    const third = await service.joinFriendGame(creator.inviteCode);

    expect(creator.game).toMatchObject({
      status: "waiting",
      desiredPlayers: 3,
      playerCount: 1,
      state: { rack: ["private-0"] },
    });
    expect(second.game).toMatchObject({
      status: "waiting",
      playerCount: 2,
      state: { rack: ["private-1"] },
    });
    expect(third.game).toMatchObject({
      status: "active",
      playerCount: 3,
      state: { rack: ["private-2"] },
    });
    expect(JSON.stringify(second.game.state)).not.toContain("private-0");
    expect(second.playerToken).not.toBe(creator.playerToken);
  });

  it("fills bounded matchmaking buckets to the configured player count", async () => {
    const service = new GameMatchService(simultaneousWordDefinition);
    const first = await service.matchmake("guest", 3);
    const second = await service.matchmake("guest", 3);
    const third = await service.matchmake("guest", 3);

    expect(first).toMatchObject({ matched: false, game: { playerCount: 1 } });
    expect(second).toMatchObject({ matched: false, game: { playerCount: 2 } });
    expect(third).toMatchObject({
      matched: true,
      game: { gameId: first.game.gameId, playerCount: 3, status: "active" },
    });
  });

  it("versions simultaneous actions per player instead of rejecting global concurrency", async () => {
    const service = new GameMatchService(simultaneousWordDefinition);
    const first = await service.matchmake("team", 2);
    const second = await service.matchmake("team", 2);

    const firstAction = await service.action(
      first.game.gameId,
      first.playerToken,
      { expectedActionSequence: 0 },
      { points: 4 },
    );
    const secondAction = await service.action(
      second.game.gameId,
      second.playerToken,
      { expectedActionSequence: 0 },
      { points: 7 },
    );

    expect(firstAction).toMatchObject({
      version: 2,
      actionSequence: 1,
      state: { scores: [4, 0] },
    });
    expect(secondAction).toMatchObject({
      version: 3,
      actionSequence: 1,
      state: { scores: [4, 7] },
    });
    await expect(
      service.action(
        first.game.gameId,
        first.playerToken,
        { expectedActionSequence: 0 },
        { points: 1 },
      ),
    ).rejects.toMatchObject({ code: "GAME_STALE_ACTION" });
  });

  it("validates adapter bounds, player counts, capabilities, and secrets", async () => {
    expect(
      () =>
        new GameMatchService({
          ...simultaneousWordDefinition,
          gameType: "Invalid Type",
        }),
    ).toThrow(/definition bounds/i);

    const service = new GameMatchService(simultaneousWordDefinition);
    await expect(service.createFriendGame(8)).rejects.toMatchObject({
      code: "GAME_PLAYER_COUNT",
    });

    expect(() =>
      requireGamePlayerToken({ get: () => undefined } as any),
    ).toThrow(/session is not available/i);
    expect(
      requireGamePlayerToken({ get: () => "a".repeat(43) } as any),
    ).toBe("a".repeat(43));

    expect(hashGameInviteCode("hex-words", "ABC23456")).toMatch(
      /^[a-f0-9]{64}$/u,
    );
    delete process.env.ENCRYPTION_SECRET;
    expect(() => hashGameInviteCode("hex-words", "ABC23456")).toThrow(
      /temporarily unavailable/i,
    );
  });
});
