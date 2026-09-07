import { describe, expect, it } from "vitest";
import {
  airflowAt,
  applyCommand,
  createRun,
  stepRun,
} from "@ares/waggle-way/engine";
import {
  createBlankLevel,
  makeObject,
  parseLevelFile,
  serializeLevel,
  upgradeLevel,
  validateLevel,
  type ToolStock,
} from "@ares/waggle-way/level";
import {
  captureReplay,
  replayRun,
  parseRunCommand,
} from "@ares/waggle-way/replay";

const stock: ToolStock = {
  id: "guides",
  kind: "perch",
  count: 1,
  width: 1,
  height: 1,
  direction: 0,
  range: 2,
  strength: 1,
};
const garden = () => ({ ...createBlankLevel(), inventory: [stock] });
const place = {
  type: "place",
  stockId: "guides",
  objectId: "placed-1",
  x: 6,
  y: 7,
} as const;

describe("shelter and player inventory", () => {
  it("preserves exact version-1 files and upgrades only on request", () => {
    const legacy = createBlankLevel(1);
    const original = serializeLevel(legacy);
    expect(serializeLevel(parseLevelFile(original))).toBe(original);
    expect(upgradeLevel(legacy)).toMatchObject({
      schemaVersion: 5,
      rulesVersion: 5,
      objects: legacy.objects,
      inventory: [],
    });
    expect(serializeLevel(legacy)).toBe(original);
    expect(upgradeLevel(garden()).inventory).toEqual([stock]);
    expect(() => validateLevel({ ...legacy, inventory: [] })).toThrow(
      "Upgrade",
    );
    expect(() =>
      validateLevel({
        ...legacy,
        objects: [...legacy.objects, makeObject("leaf", "shelter", 4, 4)],
      }),
    ).toThrow("unsupported");
    expect(replayRun(legacy, captureReplay(legacy, createRun(legacy)))).toEqual(
      createRun(legacy),
    );
  });

  it("bounds supplies and preserves template details during canonical export", () => {
    const level = garden();
    expect(parseLevelFile(serializeLevel(level)).inventory).toEqual(
      level.inventory,
    );
    expect(serializeLevel(parseLevelFile(serializeLevel(level)))).toBe(
      serializeLevel(level),
    );
    for (const inventory of [
      undefined,
      {},
      Array(21).fill(stock),
      [stock, stock],
      [{ ...stock, kind: "water" }],
      [{ ...stock, count: 0 }],
      [{ ...stock, width: 129 }],
      [{ ...stock, code: "script" }],
    ])
      expect(() => validateLevel({ ...level, inventory })).toThrow();
    const maxObjects = Array.from({ length: 511 }, (_, index) =>
      makeObject(
        `branch-${index}`,
        "terrain",
        index % 128,
        2 + Math.floor(index / 128),
      ),
    );
    expect(() =>
      validateLevel({
        ...level,
        width: 128,
        height: 72,
        objects: [...level.objects, ...maxObjects.slice(0, 510)],
      }),
    ).toThrow("supplied tools");
  });

  it("consumes and refunds stock without duplicating bees or changing the author draft", () => {
    const level = garden();
    const initial = createRun(level);
    let run = applyCommand(level, initial, place);
    expect(run.deployed).toEqual([{ objectId: "placed-1", stockId: "guides" }]);
    expect(run.peakToolsPlaced).toBe(1);
    expect(initial.objects).toHaveLength(2);
    expect(run.bees).toEqual(initial.bees);
    const denied = applyCommand(level, run, {
      ...place,
      objectId: "another",
      x: 8,
    });
    expect(denied.notice).toContain("No tools remain");
    expect(denied.commands).toEqual(run.commands);
    run = applyCommand(level, run, { type: "assign", objectId: "placed-1" });
    expect(
      applyCommand(level, run, { type: "recover", objectId: "placed-1" })
        .notice,
    ).toContain("Release the guide");
    run = applyCommand(level, run, { type: "release", objectId: "placed-1" });
    run = applyCommand(level, run, { type: "recover", objectId: "placed-1" });
    expect(run.objects).toEqual(initial.objects);
    expect(run.deployed).toEqual([]);
    expect(run.peakToolsPlaced).toBe(1);
    run = applyCommand(level, run, place);
    run = applyCommand(level, run, {
      type: "move",
      objectId: "placed-1",
      x: 7,
      y: 7,
    });
    expect(run.objects.at(-1)?.x).toBe(7);
    expect(replayRun(level, captureReplay(level, run))).toEqual(run);
    expect(level.objects).toHaveLength(2);
  });

  it("rejects unknown, overlapping, duplicate, and author-owned tool commands", () => {
    const level = garden();
    const run = createRun(level);
    for (const command of [
      { ...place, stockId: "missing" },
      { ...place, objectId: "hive" },
      { ...place, objectId: "bad id" },
      { ...place, x: 2 },
      { ...place, x: -1 },
      { type: "recover", objectId: "flowers" } as const,
    ]) {
      const result = applyCommand(level, run, command);
      expect(result.commands).toHaveLength(0);
      expect(result.objects).toEqual(run.objects);
    }
    expect(() => parseRunCommand({ ...place, stockId: "bad id" })).toThrow(
      "supply ID",
    );
  });

  it("blocks wind at leaves while letting bees fly through their full rectangle", () => {
    const fan = {
      ...makeObject("fan", "fan", 3, 10),
      direction: 6 as const,
      strength: 3,
    };
    const leaf = { ...makeObject("leaf", "shelter", 2, 8), width: 4 };
    expect(airflowAt([fan], 3500, 7500).y).toBe(-105);
    expect(airflowAt([fan, leaf], 3500, 7500)).toEqual({ x: 0, y: 0 });
    const level = createBlankLevel();
    level.objects.push({ ...leaf, x: 3, y: 7 });
    let run = applyCommand(level, createRun(level), { type: "start" });
    for (let tick = 0; tick < 100; tick++) run = stepRun(level, run);
    expect(run.bees[0].x).toBeGreaterThan(7000);
    expect(run.bees[0].status).toBe("flying");
  });
});
