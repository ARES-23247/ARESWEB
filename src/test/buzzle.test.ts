import { describe, expect, it } from "vitest";
import {
  BUZZLE_CELL_COUNT,
  BUZZLE_COORDINATES,
  analyzeBuzzlePlay,
  createBuzzleGame,
  createBuzzleTileBag,
  exchangeBuzzleTiles,
  getBuzzleCellIndex,
  getBuzzleMultiplier,
  passBuzzleTurn,
  playBuzzleTiles,
  type BuzzlePlacement,
  type BuzzleBoardTile,
  type BuzzleTile,
} from "@/lib/buzzle";

function tile(letter: string, points: number, id = letter): BuzzleTile {
  return { id, letter, points, blank: letter === "?" };
}

function placement(q: number, r: number, value: BuzzleTile): BuzzlePlacement {
  return { index: getBuzzleCellIndex(q, r)!, tile: value };
}

describe("BUZZLE geometry and inventory", () => {
  it("builds the specified 127-cell board and multiplier counts", () => {
    expect(BUZZLE_COORDINATES).toHaveLength(BUZZLE_CELL_COUNT);
    const counts = Object.fromEntries(
      ["plain", "DL", "TL", "DW", "TW", "star"].map((kind) => [
        kind,
        BUZZLE_COORDINATES.filter((_, index) => getBuzzleMultiplier(index) === kind).length,
      ]),
    );
    expect(counts).toEqual({ plain: 70, DL: 26, TL: 6, DW: 18, TW: 6, star: 1 });
    expect(getBuzzleCellIndex(0, 0)).not.toBeNull();
    expect(getBuzzleCellIndex(7, 0)).toBeNull();
  });

  it("creates the official 100-tile distribution", () => {
    const bag = createBuzzleTileBag();
    expect(bag).toHaveLength(100);
    expect(bag.filter(({ letter }) => letter === "E")).toHaveLength(12);
    expect(bag.filter(({ letter }) => letter === "Z")).toHaveLength(1);
    expect(bag.filter(({ blank }) => blank)).toHaveLength(2);
    expect(bag.reduce((total, value) => total + value.points, 0)).toBe(187);
  });
});

describe("BUZZLE play validation and scoring", () => {
  it("requires the opening word to cross the center and scores it", () => {
    const board = Array.from({ length: BUZZLE_CELL_COUNT }, () => null);
    const placements = [
      placement(-1, 0, tile("C", 3, "c")),
      placement(0, 0, tile("A", 1, "a")),
      placement(1, 0, tile("T", 1, "t")),
    ];
    expect(analyzeBuzzlePlay(board, placements, new Set(["cat"]))).toMatchObject({
      score: 10,
      hiveFlush: false,
      words: [{ word: "CAT", score: 10 }],
    });
    expect(() =>
      analyzeBuzzlePlay(board, placements.slice(0, 1), new Set(["c"])),
    ).toThrow(/center star/u);
  });

  it("rejects bent, disconnected, invalid, and unassigned blank plays", () => {
    const board = Array.from({ length: BUZZLE_CELL_COUNT }, () => null);
    const occupiedBoard = [...board] as Array<BuzzleBoardTile | null>;
    occupiedBoard[getBuzzleCellIndex(-1, 1)!] = {
      ...tile("I", 1, "existing"),
      playedBy: 1,
    };
    expect(() =>
      analyzeBuzzlePlay(
        occupiedBoard,
        [placement(0, 0, tile("A", 1, "a")), placement(1, 0, tile("T", 1, "t")), placement(1, -1, tile("E", 1, "e"))],
        new Set(["ate"]),
      ),
    ).toThrow(/straight/u);
    expect(() =>
      analyzeBuzzlePlay(
        board,
        [placement(0, 0, tile("?", 0, "blank")), placement(1, 0, tile("T", 1, "t"))],
        new Set(["at"]),
      ),
    ).toThrow(/blank tile/u);
    expect(() =>
      analyzeBuzzlePlay(
        board,
        [placement(0, 0, tile("A", 1, "a")), placement(1, 0, tile("T", 1, "t"))],
        new Set(["nope"]),
      ),
    ).toThrow(/not in/u);
    expect(() =>
      analyzeBuzzlePlay(
        occupiedBoard,
        [placement(-1, 0, tile("A", 1, "gap-a")), placement(1, 0, tile("T", 1, "gap-t"))],
        new Set(["a", "t"]),
      ),
    ).toThrow(/empty gaps/u);
  });

  it("applies a play, draws the rack, and rotates turns", () => {
    const game = createBuzzleGame(2, () => 0);
    const activeRack = [tile("C", 3, "c"), tile("A", 1, "a"), tile("T", 1, "t")];
    game.players[0].rack = [...activeRack];
    const result = playBuzzleTiles(
      game,
      [
        placement(-1, 0, activeRack[0]),
        placement(0, 0, activeRack[1]),
        placement(1, 0, activeRack[2]),
      ],
      new Set(["cat"]),
    );
    expect(result.analysis.score).toBe(10);
    expect(result.state.players[0].score).toBe(10);
    expect(result.state.players[0].rack).toHaveLength(7);
    expect(result.state.currentPlayer).toBe(1);
    expect(result.state.bag).toHaveLength(79);
  });

  it("extends an existing word with a single connected tile", () => {
    const board = Array.from({ length: BUZZLE_CELL_COUNT }, () => null) as Array<BuzzleBoardTile | null>;
    board[getBuzzleCellIndex(0, 0)!] = { ...tile("A", 1, "a"), playedBy: 0 };
    board[getBuzzleCellIndex(1, 0)!] = { ...tile("T", 1, "t"), playedBy: 0 };
    const result = analyzeBuzzlePlay(
      board,
      [placement(2, 0, tile("E", 1, "e"))],
      new Set(["ate"]),
      1,
    );
    expect(result.words).toEqual([expect.objectContaining({ word: "ATE" })]);
  });

  it("scores a seven-tile Hive Flush and assigns a blank", () => {
    const letters = [
      tile("R", 1, "r"), tile("E", 1, "e"), tile("A", 1, "a"),
      tile("?", 0, "blank"), tile("I", 1, "i"), tile("N", 1, "n"), tile("G", 2, "g"),
    ];
    const placements = letters.map((value, offset) => ({
      ...placement(offset - 3, 0, value),
      ...(value.blank ? { assignedLetter: "D" } : {}),
    }));
    const result = analyzeBuzzlePlay(
      Array.from({ length: BUZZLE_CELL_COUNT }, () => null),
      placements,
      new Set(["reading"]),
    );
    expect(result.hiveFlush).toBe(true);
    expect(result.score).toBe(122);
  });
});

describe("BUZZLE turn options", () => {
  it("exchanges rack tiles and ends after three full rounds of passes", () => {
    const game = createBuzzleGame(2, () => 0);
    const exchanged = exchangeBuzzleTiles(game, [game.players[0].rack[0].id], () => 0.5);
    expect(exchanged.currentPlayer).toBe(1);
    expect(exchanged.players[0].rack).toHaveLength(7);
    expect(exchanged.bag).toHaveLength(86);
    let passed = game;
    for (let count = 0; count < 6; count += 1) passed = passBuzzleTurn(passed);
    expect(passed.finished).toBe(true);
    expect(passed.winner === "draw" || typeof passed.winner === "number").toBe(true);
  });
});
