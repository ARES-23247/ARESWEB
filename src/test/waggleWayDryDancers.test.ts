import { describe, expect, it } from "vitest";
import {
  createBlankLevel,
  makeObject,
  validateLevel,
  type DanceType,
  type Direction,
} from "@ares/waggle-way/level";
import {
  applyCommand,
  createRun,
  previewRoute,
  stepRun,
} from "@ares/waggle-way/engine";
import {
  addObject,
  createEditor,
  updateObject,
  editLevel,
  undoEdit,
} from "@ares/waggle-way/editor";
import { captureReplay, replayRun } from "@ares/waggle-way/replay";

function garden(version: 6 | 7 = 7, dance: DanceType = "right") {
  const base = createBlankLevel(version);
  return validateLevel({
    ...base,
    objects: [
      ...base.objects,
      { ...makeObject("pond", "water", 5, 7), width: 2 },
    ],
    inventory: [
      {
        id: "dances",
        kind: "dancer",
        dance,
        count: 1,
        width: 1,
        height: 1,
        direction: 4,
        range: 1,
        strength: 1,
      },
    ],
  });
}
const placement = {
  type: "place",
  stockId: "dances",
  objectId: "guide",
  x: 7,
  y: 7,
} as const;

describe("version 7 dry-ground dancers and automatic helper departure", () => {
  it("returns a supplied guide before launch and allows its refunded use to be placed again", () => {
    const level = garden();
    const original = createRun(level);
    const placed = applyCommand(level, original, placement);
    const returned = applyCommand(level, placed, {
      type: "release",
      objectId: "guide",
    });
    expect(returned.deployed).toEqual([]);
    expect(returned.objects).toEqual(original.objects);
    expect(returned.bees).toEqual(original.bees);
    const replaced = applyCommand(level, returned, placement);
    expect(replaced.deployed).toHaveLength(1);
    expect(
      replaced.bees.filter((bee) => bee.status === "assigned"),
    ).toHaveLength(1);
    expect(replayRun(level, captureReplay(level, replaced))).toEqual(replaced);
  });

  it.each([6, 7] as const)(
    "keeps an authored version-%i dance spent after its launched helper is released",
    (version) => {
      const base = garden(version);
      const level = validateLevel({
        ...base,
        objects: [
          ...base.objects,
          makeObject("authored-guide", "dancer", 7, 7),
        ],
      });
      let run = applyCommand(level, createRun(level), {
        type: "assign",
        objectId: "authored-guide",
      });
      run = applyCommand(level, run, { type: "start" });
      run = applyCommand(level, run, {
        type: "release",
        objectId: "authored-guide",
      });
      const rejected = applyCommand(level, run, {
        type: "assign",
        objectId: "authored-guide",
      });
      expect(rejected.notice).toContain("dance use has been spent");
      expect(rejected.commands).toEqual(run.commands);
      expect(rejected.bees).toEqual(run.bees);
      expect(replayRun(level, captureReplay(level, run))).toEqual(run);
    },
  );

  it("upgrades a dry version-6 draft undoably and preserves one needing water-placement repair", () => {
    const old = createEditor(garden(6));
    const upgraded = editLevel(old, {
      ...old.level,
      schemaVersion: 7,
      rulesVersion: 7,
    });
    expect(upgraded.level.rulesVersion).toBe(7);
    expect(undoEdit(upgraded).level).toEqual(old.level);
    const wet = addObject(old, "dancer", 5, 7);
    expect(() =>
      editLevel(wet, { ...wet.level, schemaVersion: 7, rulesVersion: 7 }),
    ).toThrow(/dry ground/);
    expect(wet.level.rulesVersion).toBe(6);
  });
  it("rejects water placement and movement without spending stock or altering the existing helper", () => {
    const level = garden();
    const original = createRun(level);
    const blocked = applyCommand(level, original, { ...placement, x: 5 });
    expect(blocked.commands).toEqual([]);
    expect(blocked.bees).toEqual(original.bees);
    expect(blocked.deployed).toEqual([]);
    const placed = applyCommand(level, original, placement);
    const moved = applyCommand(level, placed, {
      type: "move",
      objectId: "guide",
      x: 6,
      y: 7,
    });
    expect(moved.commands).toEqual(placed.commands);
    expect(moved.objects).toEqual(placed.objects);
    expect(moved.bees).toEqual(placed.bees);
    expect(
      applyCommand(garden(6), createRun(garden(6)), { ...placement, x: 5 })
        .commands,
    ).toHaveLength(1);
  });

  it("enforces dry ground in the builder in either object order and preserves rejected edits", () => {
    const level = garden();
    const editor = createEditor(level);
    expect(() => addObject(editor, "dancer", 5, 7)).toThrow(/dry ground/);
    expect(() => addObject(editor, "perch", 5, 7)).toThrow(/dry ground/);
    const placed = addObject(editor, "dancer", 7, 7);
    expect(() => updateObject(placed, "pond", { x: 7 })).toThrow(/dry ground/);
    const overlap = {
      ...level,
      objects: [{ ...makeObject("guide", "dancer", 5, 7) }, ...level.objects],
    };
    expect(() => validateLevel(overlap)).toThrow(/dry ground/);
    expect(editor.level).toEqual(level);
  });

  it.each([
    ["left", 6],
    ["right", 2],
    ["reverse", 4],
  ] as const)(
    "uses the arrival heading for an unvisited %s helper's departure",
    (dance, direction) => {
      const level = garden(7, dance);
      let run = applyCommand(level, createRun(level), placement);
      run = applyCommand(level, run, { type: "start" });
      run = applyCommand(level, run, { type: "release", objectId: "guide" });
      expect(run.bees[0]).toMatchObject({ status: "flying", direction });
    },
  );

  it("learns the latest guided exit heading deterministically without leaking preview state", () => {
    const level = garden();
    let run = applyCommand(level, createRun(level), placement);
    run = applyCommand(level, run, { type: "start" });
    run = {
      ...run,
      tick: 1,
      bees: run.bees.map((bee) =>
        bee.id === 1
          ? {
              ...bee,
              status: "flying" as const,
              x: 8400,
              y: 7500,
              direction: 4 as Direction,
            }
          : bee,
      ),
    };
    const snapshot = structuredClone(run);
    previewRoute(level, run, 1, 2);
    expect(run).toEqual(snapshot);
    const next = stepRun(level, run);
    expect(next.bees[0].direction).toBe(6);
    expect(next.bees[1].direction).toBe(6);
    expect(run.bees[0].direction).toBe(2);
    const adjusted = applyCommand(level, next, {
      type: "adjust",
      objectId: "guide",
      direction: 0,
      strength: 1,
    });
    expect(adjusted.commands).toEqual(next.commands);
    expect(adjusted.notice).toMatch(/no separate heading/);
    expect(
      applyCommand(level, next, { type: "release", objectId: "guide" }).bees[0]
        .direction,
    ).toBe(6);
  });

  it("retains manual departure in version 6 and the pointing arrow in version 7", () => {
    for (const level of [garden(6), garden(7, "point")]) {
      let run = applyCommand(level, createRun(level), placement);
      run = applyCommand(level, run, {
        type: "adjust",
        objectId: "guide",
        direction: 6,
        strength: 1,
      });
      run = applyCommand(level, run, { type: "start" });
      expect(
        applyCommand(level, run, { type: "release", objectId: "guide" }).bees[0]
          .direction,
      ).toBe(6);
    }
  });
});
