import { describe, expect, it } from "vitest";
import { chooseHexAction } from "@ares/buzzhex/ai";
import {
  applyHexAction,
  createHexGame,
  decodeHexSave,
  encodeHexSave,
  type HexState,
} from "@ares/buzzhex/rules";

describe("BUZZHEX computer", () => {
  it.each(["easy", "medium", "hard"] as const)(
    "plays legal %s moves without changing its input",
    (level) => {
      let game = createHexGame();
      for (let turn = 0; turn < 8; turn++) {
        const before = structuredClone(game);
        const action = chooseHexAction(game, level, () => 0.8);
        expect(game).toEqual(before);
        expect(action).not.toBeNull();
        game = applyHexAction(game, action!)!;
        expect(game).not.toBeNull();
      }
    },
  );
  it.each(["easy", "medium", "hard"] as const)(
    "takes an immediate win on %s, including exchanged colors",
    (level) => {
      const game = createHexGame();
      game.colors = ["yellow", "black"];
      game.current = 1;
      for (let q = 0; q < 10; q++) game.board[q * 11 + 5] = "black";
      const action = chooseHexAction(game, level);
      expect(applyHexAction(game, action!)?.winner).toBe(1);
    },
  );
  it.each(["medium", "hard"] as const)(
    "blocks a one-cell winning gap on %s",
    (level) => {
      const game = createHexGame();
      for (let r = 0; r < 11; r++) if (r !== 5) game.board[55 + r] = "yellow";
      expect(chooseHexAction(game, level)).toEqual({
        type: "place",
        index: 60,
      });
    },
  );
  it("uses the swap for central openings and declines weak corner openings", () => {
    const center = applyHexAction(createHexGame(), {
      type: "place",
      index: 60,
    })!;
    const corner = applyHexAction(createHexGame(), {
      type: "place",
      index: 0,
    })!;
    for (const level of ["medium", "hard"] as const) {
      expect(chooseHexAction(center, level)).toEqual({ type: "swap" });
      expect(chooseHexAction(corner, level)?.type).toBe("place");
    }
    expect(chooseHexAction(center, "easy", () => 0)).toEqual({ type: "swap" });
    expect(chooseHexAction(center, "easy", () => 1)?.type).toBe("place");
  });
  it("stops on completed or full boards", () => {
    expect(
      chooseHexAction({ ...createHexGame(), winner: 0 }, "hard"),
    ).toBeNull();
    expect(
      chooseHexAction(
        { ...createHexGame(), board: Array(121).fill("black") },
        "hard",
      ),
    ).toBeNull();
  });
  it("handles late positions and a blocked connection", () => {
    const game: HexState = {
      ...createHexGame(),
      board: Array(121).fill("yellow"),
    };
    game.board[60] = null;
    expect(chooseHexAction(game, "hard")).toEqual({ type: "place", index: 60 });
    const blocked = createHexGame();
    for (let r = 0; r < 11; r++) blocked.board[55 + r] = "yellow";
    expect(chooseHexAction(blocked, "hard")?.type).toBe("place");
  });
  it("persists the mode and all difficulties while accepting older local saves", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const session = {
        game: createHexGame(),
        names: ["Bee", "Buzz"] as [string, string],
        mode: "computer" as const,
        difficulty,
      };
      expect(decodeHexSave(encodeHexSave(session))).toEqual(session);
    }
    const old = { version: 1, names: ["Bee", "Buzz"], actions: [] };
    expect(decodeHexSave(JSON.stringify(old))?.mode).toBeUndefined();
    for (const settings of [
      { mode: "remote" },
      { difficulty: "impossible" },
      { mode: null },
      { difficulty: {} },
    ]) {
      expect(decodeHexSave(JSON.stringify({ ...old, ...settings }))).toBeNull();
    }
  });
});
