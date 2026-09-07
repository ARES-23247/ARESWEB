import { describe, expect, it } from "vitest";
import {
  createBlankLevel,
  makeObject,
  validateLevel,
  serializeLevel,
  parseLevelFile,
  type DanceType,
  type ToolStock,
} from "@ares/waggle-way/level";
import {
  applyCommand,
  createRun,
  stepRun,
  populationCounts,
} from "@ares/waggle-way/engine";
import { captureReplay, replayRun } from "@ares/waggle-way/replay";
import { FIRST_FLIGHT } from "../../packages/waggle-way/src/content/redesign";

const stock = (dance: DanceType = "point"): ToolStock => ({
  id: "dances",
  kind: "dancer",
  dance,
  count: 1,
  width: 1,
  height: 1,
  direction: 6,
  range: 2,
  strength: 1,
});
const garden = (dance: DanceType = "point") =>
  validateLevel({ ...createBlankLevel(6), inventory: [stock(dance)] });
const place = {
  type: "place",
  stockId: "dances",
  objectId: "helper",
  x: 6,
  y: 7,
} as const;

describe("version 6 free-grid dancers", () => {
  it("rescues the complete first-flight hive using its real supplied dancer and replays the same result", () => {
    let run = applyCommand(FIRST_FLIGHT, createRun(FIRST_FLIGHT), {
      ...place,
      stockId: "pointing-dancer",
      x: 10,
      y: 7,
    });
    run = applyCommand(FIRST_FLIGHT, run, { type: "start" });
    for (let i = 0; i < 400 && populationCounts(run).rescued < 5; i++)
      run = stepRun(FIRST_FLIGHT, run);
    expect(populationCounts(run)).toMatchObject({
      rescued: 5,
      assigned: 1,
      lost: 0,
    });
    run = applyCommand(FIRST_FLIGHT, run, {
      type: "release",
      objectId: "helper",
    });
    for (let i = 0; i < 150 && run.phase !== "finished"; i++)
      run = stepRun(FIRST_FLIGHT, run);
    expect(populationCounts(run).rescued).toBe(6);
    expect(replayRun(FIRST_FLIGHT, captureReplay(FIRST_FLIGHT, run))).toEqual(
      run,
    );
  });
  it("places and relocates a real setup bee without a perch and returns its stock on undo", () => {
    const level = garden();
    const original = createRun(level);
    let run = applyCommand(level, original, place);
    expect(populationCounts(run)).toMatchObject({ hive: 7, assigned: 1 });
    expect(run.objects.find((object) => object.id === "helper")).toMatchObject({
      kind: "dancer",
      dance: "point",
    });
    run = applyCommand(level, run, {
      type: "move",
      objectId: "helper",
      x: 9,
      y: 8,
    });
    expect(run.bees[0]).toMatchObject({ x: 9500, y: 8500, status: "assigned" });
    run = applyCommand(level, run, { type: "recover", objectId: "helper" });
    expect(populationCounts(run)).toMatchObject({ hive: 8, assigned: 0 });
    expect(run.deployed).toEqual([]);
    expect(original.bees.every((bee) => bee.status === "hive")).toBe(true);
    expect(replayRun(level, captureReplay(level, run))).toEqual(run);
  });

  it("rejects placement failures atomically and enforces stock and job limits", () => {
    const level = garden();
    const original = createRun(level);
    for (const command of [
      { ...place, x: -1 },
      { ...place, x: 2 },
      { ...place, stockId: "missing" },
      { ...place, objectId: "hive" },
    ]) {
      const failed = applyCommand(level, original, command);
      expect(failed.bees).toEqual(original.bees);
      expect(failed.deployed).toEqual([]);
      expect(failed.commands).toEqual([]);
    }
    const placed = applyCommand(level, original, place);
    expect(
      applyCommand(level, placed, { ...place, objectId: "second", x: 8 })
        .commands,
    ).toEqual(placed.commands);
    const constrained = validateLevel({
      ...level,
      guideLimit: 1,
      inventory: [{ ...stock(), count: 2 }],
    });
    const first = applyCommand(constrained, createRun(constrained), place);
    expect(
      applyCommand(constrained, first, { ...place, objectId: "second", x: 8 })
        .notice,
    ).toContain("jobs");
  });

  it("spends a launched use, releases the helper along its own heading and never duplicates it", () => {
    const level = garden("left");
    let run = applyCommand(level, createRun(level), place);
    run = applyCommand(level, run, { type: "start" });
    expect(
      applyCommand(level, run, { type: "recover", objectId: "helper" }).notice,
    ).toContain("spent");
    expect(
      applyCommand(level, run, { type: "move", objectId: "helper", x: 8, y: 7 })
        .notice,
    ).toContain("Release");
    run = applyCommand(level, run, { type: "release", objectId: "helper" });
    expect(run.bees[0]).toMatchObject({
      status: "flying",
      direction: 6,
      perchId: null,
    });
    expect(run.objects.some((object) => object.id === "helper")).toBe(false);
    expect(run.deployed).toHaveLength(1);
    const failed = applyCommand(level, run, { ...place, objectId: "another" });
    expect(failed.commands).toEqual(run.commands);
    expect(
      Object.values(populationCounts(run)).reduce(
        (sum, count) => sum + count,
        0,
      ),
    ).toBe(level.population);
    expect(replayRun(level, captureReplay(level, run))).toEqual(run);
  });

  it("requires a nearby flying bee for in-run placement", () => {
    const level = garden();
    let run = applyCommand(level, createRun(level), { type: "start" });
    expect(applyCommand(level, run, place).notice).toContain("within one cell");
    run = stepRun(level, run);
    const nearby = { ...place, x: 3, y: 7 };
    const assigned = applyCommand(level, run, nearby);
    expect(assigned.bees[0].status).toBe("assigned");
    expect(assigned.deployed).toHaveLength(1);
  });

  it.each([
    ["left", 6],
    ["right", 2],
    ["reverse", 4],
    ["point", 6],
  ] as const)(
    "applies %s once per entry and rearms only after leaving",
    (dance, direction) => {
      const level = garden(dance);
      let run = applyCommand(level, createRun(level), place);
      run = applyCommand(level, run, { type: "start" });
      // Inspect a controlled flight state at the influence boundary. Replay is
      // exercised separately with real command histories, not this test fixture.
      Object.assign(run.bees[1], {
        status: "flying",
        x: 5500,
        y: 7500,
        direction: 0,
      });
      run = stepRun(level, run);
      expect(run.bees[1].direction).toBe(direction);
      for (let i = 0; i < 3; i++) run = stepRun(level, run);
      expect(run.bees[1].direction).toBe(direction);
      Object.assign(run.bees[1], { x: 1000, y: 3000, direction: 0 });
      run = stepRun(level, run);
      expect(run.bees[1].danceVisits).toEqual([]);
      Object.assign(run.bees[1], { x: 5500, y: 7500, direction: 0 });
      expect(stepRun(level, run).bees[1].direction).toBe(direction);
    },
  );

  it("makes ordinary water flyable only in new rules and allows a hovering dancer above it", () => {
    const water = { ...makeObject("pond", "water", 3, 7), width: 10 };
    const level = validateLevel({
      ...garden(),
      objects: [...garden().objects, water],
    });
    const placed = applyCommand(level, createRun(level), place);
    expect(placed.deployed).toHaveLength(1);
    for (const version of [5, 6] as const) {
      const testLevel = validateLevel({
        ...createBlankLevel(version),
        objects: [...createBlankLevel(version).objects, water],
      });
      let run = applyCommand(testLevel, createRun(testLevel), {
        type: "start",
      });
      for (let i = 0; i < 20; i++) run = stepRun(testLevel, run);
      expect(run.bees[0].status).toBe(version === 5 ? "lost" : "flying");
    }
  });

  it("keeps old formats exact and rejects malformed dance fields and footprints", () => {
    for (const version of [1, 2, 3, 4, 5] as const) {
      const legacy = createBlankLevel(version);
      expect(serializeLevel(parseLevelFile(serializeLevel(legacy)))).toBe(
        serializeLevel(legacy),
      );
      expect(() =>
        validateLevel({
          ...legacy,
          objects: [...legacy.objects, makeObject("dancer", "dancer", 6, 7)],
        }),
      ).toThrow("unsupported");
    }
    const level = garden();
    for (const invalid of [
      { ...stock(), dance: "spin" },
      { ...stock(), width: 2 },
      { ...stock(), kind: "fan" },
    ]) {
      expect(() => validateLevel({ ...level, inventory: [invalid] })).toThrow();
    }
    expect(() =>
      validateLevel({ ...createBlankLevel(5), inventory: [stock()] }),
    ).toThrow();
    expect(serializeLevel(parseLevelFile(serializeLevel(level)))).toBe(
      serializeLevel(level),
    );
  });
});
