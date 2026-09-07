import { describe, expect, it } from "vitest";
import { getBuzzelloRules, type BuzzelloPlayer } from "@/lib/buzzello";
import { getBuzzelloServerRules } from "../../functions/src/lib/buzzelloGame";

describe.each([61, 91])("BUZZELLO %i-cell edition", (size) => {
  it("keeps client and server coordinates, opening, moves and complete games in agreement", () => {
    const client = getBuzzelloRules(size),
      server = getBuzzelloServerRules(size);
    expect(client.BUZZELLO_COORDINATES).toEqual(server.BUZZELLO_COORDINATES);
    expect(client.BUZZELLO_COORDINATES).toHaveLength(size);
    let board = client.createBuzzelloInitialBoard();
    expect(board).toEqual(server.createBuzzelloInitialBoard());
    expect(client.getBuzzelloScores(board)).toEqual({
      yellow: 3,
      black: 3,
      empty: size - 6,
    });
    const radius = size === 91 ? 5 : 4;
    expect(client.BUZZELLO_CORNER_INDICES).toHaveLength(6);
    for (const index of client.BUZZELLO_CORNER_INDICES) {
      const { q, r } = client.getBuzzelloCoordinate(index);
      expect(Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r))).toBe(radius);
      expect(client.getBuzzelloPositionalWeight(index)).toBe(100);
    }
    let player: BuzzelloPlayer = "yellow";
    for (let moveNumber = 0; moveNumber < size - 6; moveNumber++) {
      const moves = client.getBuzzelloLegalMoves(board, player);
      expect(moves).toEqual(server.getBuzzelloLegalMoves([...board], player));
      if (!moves.length) break;
      const move = moves[moveNumber % moves.length];
      const next = client.applyBuzzelloMove(board, player, move.index);
      expect(next).toEqual(
        server.applyBuzzelloMove([...board], player, move.index).board,
      );
      const resolution = client.resolveBuzzelloTurn(next, player);
      expect(resolution.gameOver).toBe(
        server.resolveBuzzelloTurn([...next], player).gameOver,
      );
      board = next;
      player = resolution.nextPlayer;
      if (resolution.gameOver) break;
    }
  });
  it("plays on each outer corner and keeps every AI difficulty inside the board", () => {
    const rules = getBuzzelloRules(size),
      radius = size === 91 ? 5 : 4;
    const board = Array.from(
      { length: size },
      () => null as BuzzelloPlayer | null,
    );
    const at = (q: number, r: number) => rules.getBuzzelloCellIndex(q, r)!;
    board[at(radius - 1, 0)] = "black";
    board[at(radius - 2, 0)] = "yellow";
    const corner = at(radius, 0);
    expect(rules.getBuzzelloFlips(board, corner, "yellow")).toEqual([
      at(radius - 1, 0),
    ]);
    expect(
      getBuzzelloServerRules(size).applyBuzzelloMove(board, "yellow", corner)
        .board[corner],
    ).toBe("yellow");
    for (const difficulty of ["easy", "medium", "master"] as const) {
      const opening = rules.createBuzzelloInitialBoard();
      const move = rules.selectBuzzelloAiMove(opening, "yellow", difficulty, {
        timeLimitMs: 30,
        maxDepth: 2,
        random: () => 0,
      });
      expect(
        rules.getBuzzelloLegalMoves(opening, "yellow").map((m) => m.index),
      ).toContain(move?.index);
    }
  });
});
it("rejects unsupported board sizes", () => {
  expect(() => getBuzzelloRules(62)).toThrow(RangeError);
  expect(() => getBuzzelloServerRules(92)).toThrow(RangeError);
});
