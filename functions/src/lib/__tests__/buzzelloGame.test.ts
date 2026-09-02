import { describe, expect, it } from "vitest";
import {
  BUZZELLO_CELL_COUNT,
  BUZZELLO_COORDINATES,
  applyBuzzelloMove,
  assertBuzzelloBoard,
  createBuzzelloInitialBoard,
  getBuzzelloCellIndex,
  getBuzzelloFlips,
  getBuzzelloLegalMoves,
  getBuzzelloOpponent,
  getBuzzelloScores,
  getBuzzelloWinner,
  resolveBuzzelloTurn,
  type BuzzelloBoard,
  type BuzzelloCell,
} from "../buzzelloGame";

function emptyBoard(): BuzzelloCell[] {
  return Array.from({ length: BUZZELLO_CELL_COUNT }, () => null);
}

function indexAt(q: number, r: number): number {
  const index = getBuzzelloCellIndex(q, r);
  if (index === null) throw new Error(`Missing test coordinate ${q},${r}`);
  return index;
}

describe("server-authoritative BUZZELLO engine", () => {
  it("creates the radius-four board and validates DTO state", () => {
    const board = createBuzzelloInitialBoard();
    expect(BUZZELLO_COORDINATES).toHaveLength(61);
    expect(board).toHaveLength(61);
    expect(board[indexAt(0, 0)]).toBeNull();
    expect(getBuzzelloCellIndex(5, 0)).toBeNull();
    expect(getBuzzelloScores(board)).toEqual({ yellow: 3, black: 3 });
    expect(assertBuzzelloBoard(board)).not.toBe(board);
    expect(() => assertBuzzelloBoard([null])).toThrow(/invalid/i);
    expect(() => assertBuzzelloBoard([...board.slice(0, 60), "green"])).toThrow(
      /invalid/i,
    );
  });

  it("finds and applies every bracketed direction without mutation", () => {
    const board = emptyBoard();
    board[indexAt(1, 0)] = "black";
    board[indexAt(2, 0)] = "yellow";
    board[indexAt(0, 1)] = "black";
    board[indexAt(0, 2)] = "yellow";
    const center = indexAt(0, 0);

    expect(getBuzzelloFlips(board, "yellow", center)).toEqual(
      expect.arrayContaining([indexAt(1, 0), indexAt(0, 1)]),
    );
    const applied = applyBuzzelloMove(board, "yellow", center);
    expect(applied.flips).toHaveLength(2);
    expect(applied.board[indexAt(1, 0)]).toBe("yellow");
    expect(board[center]).toBeNull();
    expect(getBuzzelloFlips(board, "yellow", -1)).toEqual([]);
    expect(() => applyBuzzelloMove(board, "black", center)).toThrow(/illegal/i);
  });

  it("lists legal moves and resolves ordinary turns", () => {
    const board = createBuzzelloInitialBoard();
    const move = getBuzzelloLegalMoves(board, "yellow")[0];
    const applied = applyBuzzelloMove(board, "yellow", move.index);
    expect(resolveBuzzelloTurn(applied.board, "yellow")).toEqual({
      currentPlayer: "black",
      gameOver: false,
      passedPlayer: null,
      winner: null,
    });
    expect(getBuzzelloOpponent("yellow")).toBe("black");
    expect(getBuzzelloOpponent("black")).toBe("yellow");
  });

  it("resolves automatic passes, wins, and draws", () => {
    const passBoard = Array.from(
      { length: BUZZELLO_CELL_COUNT },
      () => "yellow" as BuzzelloCell,
    );
    passBoard[indexAt(-4, 0)] = null;
    passBoard[indexAt(-3, 0)] = "black";
    expect(resolveBuzzelloTurn(passBoard, "yellow")).toEqual({
      currentPlayer: "yellow",
      gameOver: false,
      passedPlayer: "black",
      winner: null,
    });

    const yellowSweep = Array.from(
      { length: BUZZELLO_CELL_COUNT },
      () => "yellow" as const,
    );
    expect(getBuzzelloWinner(yellowSweep)).toBe("yellow");
    expect(resolveBuzzelloTurn(yellowSweep, "yellow")).toMatchObject({
      gameOver: true,
      winner: "yellow",
    });
    expect(getBuzzelloWinner(["yellow", "black"] as BuzzelloBoard)).toBe(
      "draw",
    );
  });
});
