import { describe, expect, it } from "vitest";
import {
  buzzleGameDefinition,
  parseBuzzleGameState,
  type BuzzleGameState,
} from "../buzzleGameDefinition";

function indexFor(q: number, r: number): number {
  let index = 0;
  for (let column = -8; column <= 8; column += 1) {
    for (let row = Math.max(-8, -column - 8); row <= Math.min(8, -column + 8); row += 1) {
      if (column === q && row === r) return index;
      index += 1;
    }
  }
  throw new Error("Missing coordinate.");
}

function putTileInRack(state: BuzzleGameState, tileId: string, rackIndex: number, targetPlayer = 0): void {
  const replacement = state.players[targetPlayer].rack[rackIndex];
  const bagIndex = state.bag.findIndex(({ id }) => id === tileId);
  if (bagIndex >= 0) {
    state.players[targetPlayer].rack[rackIndex] = state.bag[bagIndex];
    state.bag[bagIndex] = replacement;
    return;
  }
  for (let sourcePlayer = 0; sourcePlayer < state.players.length; sourcePlayer += 1) {
    const found = state.players[sourcePlayer].rack.findIndex(({ id }) => id === tileId);
    if (found >= 0) {
      state.players[targetPlayer].rack[rackIndex] = state.players[sourcePlayer].rack[found];
      state.players[sourcePlayer].rack[found] = replacement;
      return;
    }
  }
  throw new Error(`Missing tile ${tileId}`);
}

describe("buzzleGameDefinition", () => {
  it.each([[1, 0], [0, 1], [1, -1]])("keeps online word direction and scoring on axis %s,%s", (q, r) => {
    const state = buzzleGameDefinition.createInitialState(2);
    putTileInRack(state, "A-1", 0);
    putTileInRack(state, "T-1", 1);
    const next = buzzleGameDefinition.applyAction(state, 0, {
      type: "play", placements: [
        { index: indexFor(0, 0), tileId: "A-1" },
        { index: indexFor(q, r), tileId: "T-1" },
      ],
    });
    expect(next.players[0].score).toBe(4);
    expect(next.board[indexFor(q, r)]?.letter).toBe("T");
    expect(parseBuzzleGameState(next, 2)).toEqual(next);
    expect(state.board.every((cell) => cell === null)).toBe(true);
  });
  it("creates a bounded two-player game and returns only the requesting rack", () => {
    const state = buzzleGameDefinition.createInitialState(2);
    expect(state.board).toHaveLength(217);
    expect(state.bag).toHaveLength(86);
    expect(state.players.map(({ rack }) => rack)).toEqual([
      expect.arrayContaining([expect.objectContaining({ id: expect.any(String) })]),
      expect.arrayContaining([expect.objectContaining({ id: expect.any(String) })]),
    ]);

    const view = buzzleGameDefinition.toPlayerView(state, 0);
    expect(view.rack).toEqual(state.players[0].rack);
    expect(view.players).toEqual([
      { score: 0, rackCount: 7 },
      { score: 0, rackCount: 7 },
    ]);
    expect(view).not.toHaveProperty("bag");
  });

  it("authoritatively validates and scores a center-opening word", () => {
    const state = buzzleGameDefinition.createInitialState(2);
    putTileInRack(state, "A-1", 0);
    putTileInRack(state, "T-1", 1);
    putTileInRack(state, "E-1", 0, 1);
    const next = buzzleGameDefinition.applyAction(state, 0, {
      type: "play",
      placements: [
        { index: indexFor(0, 0), tileId: "A-1" },
        { index: indexFor(1, 0), tileId: "T-1" },
      ],
    });

    expect(next.players[0].score).toBe(4);
    expect(next.currentPlayer).toBe(1);
    expect(next.board[indexFor(0, 0)]?.letter).toBe("A");
    expect(next.board[indexFor(1, 0)]?.letter).toBe("T");

    const continued = buzzleGameDefinition.applyAction(next, 1, {
      type: "play",
      placements: [{ index: indexFor(2, 0), tileId: "E-1" }],
    });
    expect(continued.board[indexFor(2, 0)]?.letter).toBe("E");
  });

  it("rejects words absent from the server dictionary", () => {
    const state = buzzleGameDefinition.createInitialState(2);
    putTileInRack(state, "Q-1", 0);
    putTileInRack(state, "Z-1", 1);
    expect(() => buzzleGameDefinition.applyAction(state, 0, {
      type: "play",
      placements: [
        { index: indexFor(0, 0), tileId: "Q-1" },
        { index: indexFor(1, 0), tileId: "Z-1" },
      ],
    })).toThrow(/dictionary/u);
  });

  it("rejects duplicated tile identities in stored state", () => {
    const state = buzzleGameDefinition.createInitialState(2);
    state.bag[0] = { ...state.bag[1] };
    expect(() => parseBuzzleGameState(state, 2)).toThrow(/state/u);
  });

  it("supports exchanges and finishes after three full pass rounds", () => {
    const state = buzzleGameDefinition.createInitialState(2);
    const exchangedId = state.players[0].rack[0].id;
    const exchanged = buzzleGameDefinition.applyAction(state, 0, { type: "exchange", tileIds: [exchangedId] });
    expect(exchanged.currentPlayer).toBe(1);
    expect(exchanged.players[0].rack).toHaveLength(7);

    let passed = state;
    for (let count = 0; count < 6; count += 1) {
      passed = buzzleGameDefinition.applyAction(passed, passed.currentPlayer, { type: "pass" });
    }
    expect(passed.finished).toBe(true);
    expect(passed.winner === "draw" || typeof passed.winner === "number").toBe(true);
  });

  it("assigns blanks and rejects disconnected follow-up plays", () => {
    const state = buzzleGameDefinition.createInitialState(2);
    putTileInRack(state, "?-1", 0);
    putTileInRack(state, "T-1", 1);
    const opened = buzzleGameDefinition.applyAction(state, 0, {
      type: "play",
      placements: [
        { index: indexFor(0, 0), tileId: "?-1", assignedLetter: "A" },
        { index: indexFor(1, 0), tileId: "T-1" },
      ],
    });
    expect(opened.board[indexFor(0, 0)]).toMatchObject({ id: "?-1", letter: "A", points: 0 });

    expect(() => buzzleGameDefinition.applyAction(opened, 1, {
      type: "play",
      placements: [{ index: indexFor(-6, 0), tileId: opened.players[1].rack[0].id }],
    })).toThrow(/connect/u);
  });

  it("applies endgame rack penalties when a player empties the last rack", () => {
    const state = buzzleGameDefinition.createInitialState(2);
    putTileInRack(state, "A-1", 0);
    putTileInRack(state, "T-1", 1);
    state.players[0].rack = state.players[0].rack.slice(0, 2);
    state.bag = [];
    const finished = buzzleGameDefinition.applyAction(state, 0, {
      type: "play",
      placements: [
        { index: indexFor(0, 0), tileId: "A-1" },
        { index: indexFor(1, 0), tileId: "T-1" },
      ],
    });
    expect(finished.finished).toBe(true);
    expect(finished.winner).toBe(0);
    expect(finished.players[0].score).toBeGreaterThan(4);
  });
});
