import { describe, expect, it } from "vitest";
import {
  HEX_CELLS,
  BUZZHEX_SIZE,
  applyHexAction,
  canSwapHex,
  createHexGame,
  decodeHexSave,
  encodeHexSave,
  hexNeighbors,
  hexWinningPath,
  undoHexAction,
  type HexState,
} from "@ares/buzzhex/rules";

function blackWin(swap = false): HexState {
  let state = applyHexAction(createHexGame(), { type: "place", index: 5 })!;
  if (swap) state = applyHexAction(state, { type: "swap" })!;
  const yellow = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10];
  for (let q = 1; q < 11; q++) {
    state = applyHexAction(state, { type: "place", index: yellow[q - 1] })!;
    state = applyHexAction(state, { type: "place", index: q * 11 + 5 })!;
  }
  return state;
}

describe("BUZZHEX engine", () => {
  it("matches the 121-cell physical lattice and six edge neighbors", () => {
    expect(BUZZHEX_SIZE).toBe(11);
    expect(new Set(HEX_CELLS.map((c) => c.label)).size).toBe(121);
    expect(hexNeighbors(60).sort((a, b) => a - b)).toEqual([
      49, 50, 59, 61, 70, 71,
    ]);
    expect(hexNeighbors(60)).not.toContain(72);
    expect(hexNeighbors(0)).toEqual([11, 1]);
    expect(hexNeighbors(120)).toEqual([109, 119]);
    for (const invalid of [-1, 121, 1.5, NaN])
      expect(hexNeighbors(invalid)).toEqual([]);
    for (const c of HEX_CELLS) {
      const physical = HEX_CELLS.filter(
        (n) => Math.abs(Math.hypot(n.x - c.x, n.y - c.y) - 34) < 1e-7,
      ).map((n) => n.index);
      expect(hexNeighbors(c.index).sort((a, b) => a - b)).toEqual(physical);
    }
  });
  it("rejects illegal placements and invalid opening swaps without mutating state", () => {
    const state = createHexGame();
    expect(canSwapHex(state)).toBe(false);
    expect(applyHexAction(state, { type: "swap" })).toBeNull();
    for (const index of [-1, 121, 1.2, NaN])
      expect(applyHexAction(state, { type: "place", index })).toBeNull();
    const first = applyHexAction(state, { type: "place", index: 60 })!;
    expect(state.board[60]).toBeNull();
    expect(applyHexAction(first, { type: "place", index: 60 })).toBeNull();
    const second = applyHexAction(first, { type: "place", index: 61 })!;
    expect(canSwapHex(second)).toBe(false);
    expect(applyHexAction(second, { type: "swap" })).toBeNull();
  });
  it("exchanges humans' colors without moving or flipping the opening tile", () => {
    const first = applyHexAction(createHexGame(), {
      type: "place",
      index: 29,
    })!;
    expect(canSwapHex(first)).toBe(true);
    const swapped = applyHexAction(first, { type: "swap" })!;
    expect(swapped.board).toEqual(first.board);
    expect(swapped.board[29]).toBe("black");
    expect(swapped.colors).toEqual(["yellow", "black"]);
    expect(swapped.current).toBe(0);
    expect(swapped.board.filter(Boolean)).toHaveLength(1);
    expect(canSwapHex(swapped)).toBe(false);
    expect(applyHexAction(swapped, { type: "swap" })).toBeNull();
    const next = applyHexAction(swapped, { type: "place", index: 30 })!;
    expect(next.board[30]).toBe("yellow");
    expect(next.current).toBe(1);
    expect(undoHexAction(swapped)).toEqual(first);
    expect(undoHexAction(first)).toEqual(createHexGame());
    expect(undoHexAction(createHexGame())).toEqual(createHexGame());
  });
  it("finds straight, winding, and corner wins and rejects gaps and false diagonals", () => {
    const board = createHexGame().board;
    for (let q = 0; q < 11; q++) board[q * 11 + 5] = "black";
    expect(hexWinningPath(board, "black")).toHaveLength(11);
    board[60] = null;
    expect(hexWinningPath(board, "black")).toEqual([]);
    const yellow = createHexGame().board;
    for (let r = 0; r < 11; r++) yellow[r] = "yellow";
    expect(hexWinningPath(yellow, "yellow")).toEqual(
      Array.from({ length: 11 }, (_, i) => i),
    );
    const winding = createHexGame().board;
    for (let q = 0; q < 11; q++) {
      winding[q * 11 + 4] = "black";
      winding[q * 11 + 5] = "black";
    }
    winding[5 * 11 + 4] = null;
    winding[7 * 11 + 5] = null;
    const path = hexWinningPath(winding, "black");
    expect(path.length).toBeGreaterThanOrEqual(11);
    expect(new Set(path.map((index) => index % 11)).size).toBeGreaterThan(1);
    path
      .slice(1)
      .forEach((index, i) => expect(hexNeighbors(path[i])).toContain(index));
    const diagonal = createHexGame().board;
    for (let q = 0; q < 11; q++) diagonal[q * 11 + q] = "black";
    expect(hexWinningPath(diagonal, "black")).toEqual([]);
  });
  it.each([false, true])(
    "identifies the winning human, freezes play and undoes victory (swap=%s)",
    (swap) => {
      const won = blackWin(swap);
      expect(won.winner).toBe(swap ? 1 : 0);
      expect(won.path).toHaveLength(11);
      expect(applyHexAction(won, { type: "place", index: 60 })).toBeNull();
      expect(applyHexAction(won, { type: "swap" })).toBeNull();
      const before = undoHexAction(won);
      expect(before.winner).toBeNull();
      expect(before.path).toEqual([]);
      expect(before.board[115]).toBeNull();
      expect(applyHexAction(before, { type: "place", index: 115 })).toEqual(
        won,
      );
    },
  );
  it("round-trips saved actions including a swap and winner", () => {
    const game = blackWin(true),
      names: [string, string] = ["Bee", "Buzz"];
    expect(decodeHexSave(encodeHexSave({ game, names }))).toEqual({
      game,
      names,
    });
    const opening = applyHexAction(createHexGame(), {
      type: "place",
      index: 29,
    })!;
    const swapped = applyHexAction(opening, { type: "swap" })!;
    expect(
      decodeHexSave(encodeHexSave({ game: swapped, names }))?.game,
    ).toEqual(swapped);
  });
  it("rejects malformed saves and illegal action histories", () => {
    const wrap = (actions: unknown) =>
      JSON.stringify({ version: 1, names: ["P1", "P2"], actions });
    for (const raw of [
      "{",
      "null",
      "[]",
      " ".repeat(16001),
      '{"version":2}',
      JSON.stringify({ version: 1, names: ["", "P2"], actions: [] }),
      JSON.stringify({
        version: 1,
        names: ["x".repeat(29), "P2"],
        actions: [],
      }),
      wrap({}),
      wrap(Array(123).fill({ type: "swap" })),
      wrap([null]),
      wrap([{}]),
      wrap([{ type: "nope" }]),
      wrap([{ type: "place", index: "60" }]),
      wrap([{ type: "place", index: 121 }]),
      wrap([{ type: "swap" }]),
      wrap([
        { type: "place", index: 1 },
        { type: "place", index: 1 },
      ]),
      wrap([
        ...blackWin().history.map((e) => e.action),
        { type: "place", index: 66 },
      ]),
    ]) {
      expect(decodeHexSave(raw), raw.slice(0, 90)).toBeNull();
    }
  });
});
