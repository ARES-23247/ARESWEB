import { describe, expect, it, vi } from "vitest";
import {
  BUZZELLO_CELL_COUNT,
  BUZZELLO_COORDINATES,
  BUZZELLO_CORNER_INDICES,
  applyBuzzelloMove,
  createBuzzelloInitialBoard,
  evaluateBuzzelloBoard,
  formatBuzzelloCoordinate,
  getBuzzelloCellIndex,
  getBuzzelloCoordinate,
  getBuzzelloFlips,
  getBuzzelloLegalMoves,
  getBuzzelloOpponent,
  getBuzzelloPositionalWeight,
  getBuzzelloScores,
  getBuzzelloWinner,
  isBuzzelloGameOver,
  resolveBuzzelloTurn,
  selectBuzzelloAiMove,
  type BuzzelloBoard,
  type BuzzelloCell,
} from "@/lib/buzzello";

function emptyBoard(): BuzzelloCell[] {
  return Array.from({ length: BUZZELLO_CELL_COUNT }, () => null);
}

function indexAt(q: number, r: number): number {
  const index = getBuzzelloCellIndex(q, r);
  if (index === null) throw new Error(`Missing test coordinate ${q},${r}`);
  return index;
}

describe("BUZZELLO game engine", () => {
  it("builds the complete radius-four axial board", () => {
    expect(BUZZELLO_COORDINATES).toHaveLength(61);
    expect(
      new Set(BUZZELLO_COORDINATES.map(({ q, r }) => `${q},${r}`)).size,
    ).toBe(61);
    expect(getBuzzelloCellIndex(0, 0)).not.toBeNull();
    expect(getBuzzelloCellIndex(5, 0)).toBeNull();
    expect(getBuzzelloCoordinate(indexAt(-4, 2))).toEqual({ q: -4, r: 2 });
    expect(formatBuzzelloCoordinate(indexAt(2, -1))).toBe("q 2, r -1");
    expect(() => getBuzzelloCoordinate(99)).toThrow(RangeError);
  });

  it("creates the official open-center alternating rosette", () => {
    const board = createBuzzelloInitialBoard();
    expect(board).toHaveLength(61);
    expect(board[indexAt(0, 0)]).toBeNull();
    expect(board[indexAt(1, 0)]).toBe("yellow");
    expect(board[indexAt(0, 1)]).toBe("black");
    expect(board[indexAt(-1, 1)]).toBe("yellow");
    expect(board[indexAt(-1, 0)]).toBe("black");
    expect(board[indexAt(0, -1)]).toBe("yellow");
    expect(board[indexAt(1, -1)]).toBe("black");
    expect(getBuzzelloScores(board)).toEqual({
      yellow: 3,
      black: 3,
      empty: 55,
    });
    expect(getBuzzelloLegalMoves(board, "yellow").length).toBeGreaterThan(0);
    expect(isBuzzelloGameOver(board)).toBe(false);
  });

  it("flips every bracketed axis in one move without mutating the board", () => {
    const board = emptyBoard();
    board[indexAt(1, 0)] = "black";
    board[indexAt(2, 0)] = "yellow";
    board[indexAt(0, 1)] = "black";
    board[indexAt(0, 2)] = "yellow";
    const center = indexAt(0, 0);

    expect(getBuzzelloFlips(board, center, "yellow")).toEqual(
      expect.arrayContaining([indexAt(1, 0), indexAt(0, 1)]),
    );
    const nextBoard = applyBuzzelloMove(board, "yellow", center);
    expect(nextBoard[center]).toBe("yellow");
    expect(nextBoard[indexAt(1, 0)]).toBe("yellow");
    expect(nextBoard[indexAt(0, 1)]).toBe("yellow");
    expect(board[center]).toBeNull();
  });

  it("rejects occupied cells and empty cells that do not flank", () => {
    const board = createBuzzelloInitialBoard();
    expect(getBuzzelloFlips(board, indexAt(1, 0), "black")).toEqual([]);
    expect(() => applyBuzzelloMove(board, "yellow", indexAt(4, 0))).toThrow(
      /not a legal move/u,
    );
  });

  it("scores wins, draws, filled boards, eliminations, and stalled boards", () => {
    const yellowSweep: BuzzelloBoard = Array.from(
      { length: BUZZELLO_CELL_COUNT },
      () => "yellow" as const,
    );
    expect(isBuzzelloGameOver(yellowSweep)).toBe(true);
    expect(getBuzzelloWinner(yellowSweep)).toBe("yellow");

    const draw: BuzzelloBoard = ["yellow", "black"];
    expect(getBuzzelloWinner(draw)).toBe("draw");
    expect(isBuzzelloGameOver(draw)).toBe(true);

    const stalled = emptyBoard();
    stalled[indexAt(-4, 0)] = "yellow";
    stalled[indexAt(4, 0)] = "black";
    expect(isBuzzelloGameOver(stalled)).toBe(true);
  });

  it("resolves ordinary turns, automatic passes, and game over", () => {
    const initial = createBuzzelloInitialBoard();
    const yellowMove = getBuzzelloLegalMoves(initial, "yellow")[0];
    const afterMove = applyBuzzelloMove(initial, "yellow", yellowMove.index);
    expect(resolveBuzzelloTurn(afterMove, "yellow")).toEqual({
      nextPlayer: "black",
      passedPlayer: null,
      gameOver: false,
    });

    const passBoard = Array.from(
      { length: BUZZELLO_CELL_COUNT },
      () => "yellow" as BuzzelloCell,
    );
    passBoard[indexAt(-4, 0)] = null;
    passBoard[indexAt(-3, 0)] = "black";
    expect(isBuzzelloGameOver(passBoard)).toBe(false);
    expect(resolveBuzzelloTurn(passBoard, "yellow")).toEqual({
      nextPlayer: "yellow",
      passedPlayer: "black",
      gameOver: false,
    });

    const finished = [...passBoard];
    finished[indexAt(-4, 0)] = "yellow";
    expect(resolveBuzzelloTurn(finished, "yellow")).toEqual({
      nextPlayer: "black",
      passedPlayer: null,
      gameOver: true,
    });
  });

  it("weights corners, corner danger cells, perimeter cells, and the center", () => {
    expect(BUZZELLO_CORNER_INDICES).toHaveLength(6);
    expect(getBuzzelloPositionalWeight(indexAt(4, 0))).toBe(100);
    expect(getBuzzelloPositionalWeight(indexAt(3, 0))).toBe(-30);
    expect(getBuzzelloPositionalWeight(indexAt(2, 2))).toBe(15);
    expect(getBuzzelloPositionalWeight(indexAt(0, 0))).toBe(0);

    const favorable = emptyBoard();
    favorable[indexAt(4, 0)] = "yellow";
    favorable[indexAt(-4, 0)] = "black";
    favorable[indexAt(0, 0)] = "yellow";
    favorable[indexAt(0, 1)] = "yellow";
    expect(evaluateBuzzelloBoard(favorable, "yellow")).toBeGreaterThan(
      evaluateBuzzelloBoard(favorable, "black"),
    );
    expect(getBuzzelloOpponent("yellow")).toBe("black");
    expect(getBuzzelloOpponent("black")).toBe("yellow");
  });
});

describe("BUZZELLO AI", () => {
  it("returns null when no move exists", () => {
    const board = Array.from(
      { length: BUZZELLO_CELL_COUNT },
      () => "yellow" as const,
    );
    expect(selectBuzzelloAiMove(board, "black", "master")).toBeNull();
  });

  it("supports both random and greedy rookie choices", () => {
    const board = createBuzzelloInitialBoard();
    const random = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0.8);
    const randomMove = selectBuzzelloAiMove(board, "yellow", "easy", {
      random,
    });
    const greedyMove = selectBuzzelloAiMove(board, "yellow", "easy", {
      random: () => 0.9,
    });
    const legalIndices = getBuzzelloLegalMoves(board, "yellow").map(
      (move) => move.index,
    );
    expect(legalIndices).toContain(randomMove?.index);
    expect(legalIndices).toContain(greedyMove?.index);
    expect(random).toHaveBeenCalledTimes(2);
  });

  it("chooses legal tactical and master moves", () => {
    const board = createBuzzelloInitialBoard();
    const legalIndices = getBuzzelloLegalMoves(board, "yellow").map(
      (move) => move.index,
    );
    const medium = selectBuzzelloAiMove(board, "yellow", "medium");
    const master = selectBuzzelloAiMove(board, "yellow", "master", {
      maxDepth: 3,
      timeLimitMs: 5_000,
    });
    expect(legalIndices).toContain(medium?.index);
    expect(legalIndices).toContain(master?.index);
  });

  it("keeps the best completed master iteration when the clock expires", () => {
    const board = createBuzzelloInitialBoard();
    const now = vi.fn().mockReturnValueOnce(0).mockReturnValue(2_000);
    const move = selectBuzzelloAiMove(board, "yellow", "master", {
      maxDepth: 6,
      timeLimitMs: 1,
      now,
    });
    expect(move).not.toBeNull();
    expect(
      getBuzzelloLegalMoves(board, "yellow").map((item) => item.index),
    ).toContain(move?.index);
  });

  it("solves a bounded endgame to its only legal move", () => {
    const board = Array.from(
      { length: BUZZELLO_CELL_COUNT },
      () => "yellow" as BuzzelloCell,
    );
    const onlyMove = indexAt(-4, 0);
    board[onlyMove] = null;
    board[indexAt(-3, 0)] = "black";
    const move = selectBuzzelloAiMove(board, "yellow", "master", {
      maxDepth: 1,
      now: () => 0,
    });
    expect(move?.index).toBe(onlyMove);
  });
});
