import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ authenticatedFetch: vi.fn() }));

vi.mock("@/lib/api", () => ({
  authenticatedFetch: apiMocks.authenticatedFetch,
}));

import {
  BuzzelloOnlineError,
  createOnlineBuzzelloGame,
  findOnlineBuzzelloMatch,
  findTeamBuzzelloMatch,
  joinOnlineBuzzelloGame,
  parseOnlineBuzzelloGame,
  playOnlineBuzzelloMove,
  syncOnlineBuzzelloGame,
} from "@/lib/buzzelloOnline";

const playerToken = "a".repeat(43);

function gameFixture() {
  return {
    gameId: "4a968b62-f99f-4b3b-8431-a1f01e581f4a",
    gameType: "buzzello",
    status: "active",
    youAre: "yellow",
    playerIndex: 0,
    playerCount: 2,
    desiredPlayers: 2,
    version: 2,
    actionSequence: 1,
    state: {
      board: Array.from({ length: 61 }, () => null),
      currentPlayer: "yellow",
      moveNumber: 1,
      history: [{ player: "yellow", index: 30, flippedCount: 2 }],
      winner: null,
      lastMove: {
        player: "yellow",
        index: 30,
        flippedCount: 2,
        flipped: [29, 31],
      },
      passedPlayer: null,
      scores: { yellow: 6, black: 2 },
    },
    expiresAt: "2026-09-01T18:00:00.000Z",
    syncsRemaining: 479,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("BUZZELLO online client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses and defensively copies an explicit game DTO", () => {
    const fixture = gameFixture();
    const parsed = parseOnlineBuzzelloGame(fixture);

    expect(parsed).toMatchObject({
      gameId: fixture.gameId,
      youAre: "yellow",
      scores: { yellow: 6, black: 2 },
      lastMove: { flipped: [29, 31] },
    });
    expect(parsed.board).not.toBe(fixture.state.board);
    expect(parsed.history).not.toBe(fixture.state.history);
  });

  it("rejects malformed records and nested move data", () => {
    expect(() => parseOnlineBuzzelloGame(null)).toThrow(BuzzelloOnlineError);
    expect(() =>
      parseOnlineBuzzelloGame({
        ...gameFixture(),
        state: { ...gameFixture().state, board: [null] },
      }),
    ).toThrow(/invalid match/i);
    expect(() =>
      parseOnlineBuzzelloGame({
        ...gameFixture(),
        state: {
          ...gameFixture().state,
          history: [{ player: "yellow", index: 99, flippedCount: 1 }],
        },
      }),
    ).toThrow(/invalid match/i);
    expect(() =>
      parseOnlineBuzzelloGame({
        ...gameFixture(),
        state: {
          ...gameFixture().state,
          lastMove: {
            player: "yellow",
            index: 30,
            flippedCount: 1,
            flipped: [],
          },
        },
      }),
    ).toThrow(/invalid match/i);
  });

  it("creates friend invites and validates the returned capability", async () => {
    apiMocks.authenticatedFetch.mockResolvedValueOnce(
      jsonResponse(
        {
          inviteCode: "ABC23456",
          playerToken,
          game: gameFixture(),
        },
        201,
      ),
    );

    await expect(createOnlineBuzzelloGame()).resolves.toMatchObject({
      inviteCode: "ABC23456",
      playerToken,
    });
    expect(apiMocks.authenticatedFetch).toHaveBeenCalledWith(
      "/api/buzzello/games",
      expect.objectContaining({ method: "POST", body: "{}" }),
    );

    apiMocks.authenticatedFetch.mockResolvedValueOnce(
      jsonResponse({
        inviteCode: "ABC23456",
        playerToken: "short",
        game: gameFixture(),
      }),
    );
    await expect(createOnlineBuzzelloGame()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("joins friend links and starts blind matchmaking without identity data", async () => {
    apiMocks.authenticatedFetch
      .mockResolvedValueOnce(jsonResponse({ playerToken, game: gameFixture() }))
      .mockResolvedValueOnce(jsonResponse({ playerToken, game: gameFixture() }))
      .mockResolvedValueOnce(
        jsonResponse({ playerToken, game: gameFixture() }),
      );

    await joinOnlineBuzzelloGame("  abc23456 ");
    await findOnlineBuzzelloMatch();
    await findTeamBuzzelloMatch();

    expect(apiMocks.authenticatedFetch).toHaveBeenNthCalledWith(
      1,
      "/api/buzzello/join",
      expect.objectContaining({ body: JSON.stringify({ code: "ABC23456" }) }),
    );
    expect(apiMocks.authenticatedFetch).toHaveBeenNthCalledWith(
      2,
      "/api/buzzello/matchmaking",
      expect.any(Object),
    );
    expect(apiMocks.authenticatedFetch).toHaveBeenNthCalledWith(
      3,
      "/api/buzzello/matchmaking/team",
      expect.any(Object),
    );
  });

  it("sends the match capability only on sync and move requests", async () => {
    apiMocks.authenticatedFetch
      .mockResolvedValueOnce(jsonResponse({ game: gameFixture() }))
      .mockResolvedValueOnce(jsonResponse({ game: gameFixture() }));

    await syncOnlineBuzzelloGame("game/id", playerToken);
    await playOnlineBuzzelloMove("game/id", 30, 2, playerToken);

    for (const call of apiMocks.authenticatedFetch.mock.calls) {
      const headers = new Headers(call[1]?.headers);
      expect(headers.get("X-Game-Player")).toBe(playerToken);
    }
    expect(apiMocks.authenticatedFetch.mock.calls[0][0]).toContain(
      "game%2Fid/sync",
    );
    expect(apiMocks.authenticatedFetch.mock.calls[1][1]?.body).toBe(
      JSON.stringify({ index: 30, expectedVersion: 2 }),
    );
  });

  it("preserves bounded server errors and rejects non-JSON success bodies", async () => {
    apiMocks.authenticatedFetch
      .mockResolvedValueOnce(
        jsonResponse(
          { error: "Match expired.", code: "BUZZELLO_EXPIRED" },
          410,
        ),
      )
      .mockResolvedValueOnce(
        new Response("not json", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ playerToken: "invalid", game: gameFixture() }),
      );

    await expect(findOnlineBuzzelloMatch()).rejects.toMatchObject({
      message: "Match expired.",
      code: "BUZZELLO_EXPIRED",
      status: 410,
    });
    await expect(findOnlineBuzzelloMatch()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    await expect(joinOnlineBuzzelloGame("ABC23456")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
});
