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
  it("builds the specified 217-cell board and multiplier counts", () => {
    expect(BUZZLE_COORDINATES).toHaveLength(BUZZLE_CELL_COUNT);
    const counts = Object.fromEntries(
      ["plain", "DL", "TL", "DW", "TW", "star"].map((kind) => [
        kind,
        BUZZLE_COORDINATES.filter((_, index) => getBuzzleMultiplier(index) === kind).length,
      ]),
    );
    expect(counts).toEqual({ plain: 162, DL: 24, TL: 6, DW: 18, TW: 6, star: 1 });
    expect(getBuzzleCellIndex(0, 0)).not.toBeNull();
    expect(getBuzzleCellIndex(9, 0)).toBeNull();
  });

  it("creates the official 100-tile distribution", () => {
    const bag = createBuzzleTileBag();
    expect(bag).toHaveLength(100);
    expect(bag.filter(({ letter }) => letter === "E")).toHaveLength(12);
    expect(bag.filter(({ letter }) => letter === "Z")).toHaveLength(1);
    expect(bag.filter(({ blank }) => blank)).toHaveLength(2);
    expect(bag.reduce((total, value) => total + value.points, 0)).toBe(187);
  });

  it("uses standard English Scrabble point values", () => {
    const pointsByLetter = Object.fromEntries(
      createBuzzleTileBag().map(({ letter, points }) => [letter, points]),
    );
    expect(pointsByLetter).toEqual({
      A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
      J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1,
      S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10, "?": 0,
    });
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
    expect(result.score).toBe(64);
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

  it("finishes the game and awards rack points when a player goes out with an empty bag", () => {
    const game = createBuzzleGame(2);
    game.bag = [];
    const tileA = { id: "a-1", letter: "A", points: 1, blank: false };
    const tileT = { id: "t-1", letter: "T", points: 1, blank: false };
    game.players[0].rack = [tileA, tileT];
    game.players[0].score = 100;

    const tileO = { id: "o-1", letter: "O", points: 1, blank: false };
    const tileN = { id: "n-1", letter: "N", points: 1, blank: false };
    game.players[1].rack = [tileO, tileN];
    game.players[1].score = 80;
    game.currentPlayer = 1;

    const center = getBuzzleCellIndex(0, 0)!;
    const neighbor = getBuzzleCellIndex(1, 0)!;
    const placements = [
      { index: center, tile: tileO },
      { index: neighbor, tile: tileN },
    ];
    const { state } = playBuzzleTiles(game, placements, new Set(["on"]));
    expect(state.finished).toBe(true);
    expect(state.players[1].rack).toHaveLength(0);
    // Player 0 had 2 points in rack: deducted 2 pts (100 - 2 = 98)
    expect(state.players[0].score).toBe(98);
    // Player 1 had 80 + word score + 2 award
    expect(state.players[1].score).toBeGreaterThan(82);
    expect(state.winner).toBe(0);
  });
});
