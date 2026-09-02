import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/api", () => ({ authenticatedFetch: vi.fn() }));

import { authenticatedFetch } from "@/lib/api";
import { createBuzzleGame } from "@/lib/buzzle";
import {
  createOnlineBuzzleGame,
  findOnlineBuzzleMatch,
  findTeamBuzzleMatch,
  getOnlineBuzzlePollDelay,
  joinOnlineBuzzleGame,
  parseOnlineBuzzleGame,
  placementsToOnlineAction,
  playOnlineBuzzleAction,
  syncOnlineBuzzleGame,
} from "@/lib/buzzleOnline";

function onlinePayload() {
  const state = createBuzzleGame(2, () => 0);
  return {
    gameId: "12345678-1234-1234-1234-123456789abc",
    gameType: "buzzle",
    status: "active",
    youAre: "player-1",
    playerIndex: 0,
    playerCount: 2,
    desiredPlayers: 2,
    version: 2,
    actionSequence: 0,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    syncsRemaining: 480,
    state: {
      board: state.board,
      rack: state.players[0].rack,
      players: state.players.map(({ score, rack }) => ({ score, rackCount: rack.length })),
      currentPlayer: 0,
      turn: 1,
      consecutivePasses: 0,
      bagCount: state.bag.length,
      finished: false,
      winner: null,
    },
  };
}

describe("BUZZLE online DTO", () => {
  beforeEach(() => vi.mocked(authenticatedFetch).mockReset());
  it("parses a bounded player-specific view", () => {
    const game = parseOnlineBuzzleGame(onlinePayload());
    expect(game.rack).toHaveLength(7);
    expect(game.board).toHaveLength(127);
    expect(game.players).toEqual([{ score: 0, rackCount: 7 }, { score: 0, rackCount: 7 }]);
  });

  it("polls only while waiting for a remote state change", () => {
    const ownTurn = parseOnlineBuzzleGame(onlinePayload());
    expect(getOnlineBuzzlePollDelay(ownTurn, 0)).toBeNull();
    const opponentTurn = { ...ownTurn, currentPlayer: 1 };
    expect(getOnlineBuzzlePollDelay(opponentTurn, 0)).toBe(4_000);
    expect(getOnlineBuzzlePollDelay(opponentTurn, 99)).toBe(12_000);
  });

  it("rejects a response that exposes an invalid rack tile", () => {
    const payload = onlinePayload();
    payload.state.rack[0] = { ...payload.state.rack[0], points: 99 };
    expect(() => parseOnlineBuzzleGame(payload)).toThrow(/invalid match/u);
  });

  it("creates, joins, and matchmakes through bounded API endpoints", async () => {
    const payload = onlinePayload();
    const session = { success: true, playerToken: "a".repeat(43), game: payload };
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...session, inviteCode: "ABC23456" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(session)))
      .mockResolvedValueOnce(new Response(JSON.stringify(session)))
      .mockResolvedValueOnce(new Response(JSON.stringify(session)));
    await expect(createOnlineBuzzleGame()).resolves.toMatchObject({ inviteCode: "ABC23456", game: { gameId: payload.gameId } });
    await expect(joinOnlineBuzzleGame("abc23456")).resolves.toMatchObject({ playerToken: "a".repeat(43) });
    await expect(findOnlineBuzzleMatch()).resolves.toMatchObject({ game: { gameId: payload.gameId } });
    await expect(findTeamBuzzleMatch()).resolves.toMatchObject({ game: { gameId: payload.gameId } });
    expect(vi.mocked(authenticatedFetch).mock.calls.map(([path]) => path)).toEqual([
      "/api/buzzle/games", "/api/buzzle/join", "/api/buzzle/matchmaking", "/api/buzzle/matchmaking/team",
    ]);
  });

  it("syncs compact or changed state and submits server-authoritative actions", async () => {
    const game = parseOnlineBuzzleGame(onlinePayload());
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ unchanged: true, syncsRemaining: 479, expiresAt: game.expiresAt })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ game: onlinePayload() })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ game: onlinePayload() })));
    await expect(syncOnlineBuzzleGame(game, "a".repeat(43))).resolves.toEqual({
      unchanged: true, syncsRemaining: 479, expiresAt: game.expiresAt,
    });
    await expect(syncOnlineBuzzleGame(game, "a".repeat(43))).resolves.toMatchObject({ unchanged: false, game: { gameId: game.gameId } });
    await expect(playOnlineBuzzleAction(game, "a".repeat(43), { type: "pass" })).resolves.toMatchObject({ gameId: game.gameId });
  });

  it("maps local placements and surfaces bounded API errors", async () => {
    const local = createBuzzleGame(2, () => 0);
    expect(placementsToOnlineAction([{ index: 63, tile: local.players[0].rack[0] }])).toMatchObject({
      type: "play", placements: [{ index: 63, tileId: local.players[0].rack[0].id }],
    });
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "Budget reached.", code: "GAME_BUDGET" }), { status: 429 }));
    await expect(findOnlineBuzzleMatch()).rejects.toMatchObject({ message: "Budget reached.", code: "GAME_BUDGET", status: 429 });
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(new Response("not json"));
    await expect(findOnlineBuzzleMatch()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
