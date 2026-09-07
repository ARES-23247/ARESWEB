import { describe, expect, it } from "vitest";
import {
  applyCommand,
  createRun,
  previewRoute,
  stepRun,
} from "@ares/waggle-way/engine";
import {
  createBlankLevel,
  makeObject,
  validateLevel,
  type GardenObject,
} from "@ares/waggle-way/level";
import { captureReplay, replayRun } from "@ares/waggle-way/replay";

function armed(objects: GardenObject[]) {
  const level = validateLevel({
    ...createBlankLevel(6),
    objects: [...createBlankLevel(6).objects, ...objects],
  });
  let run = createRun(level);
  for (const object of objects.filter((item) => item.kind === "dancer"))
    run = applyCommand(level, run, { type: "assign", objectId: object.id });
  run = applyCommand(level, run, { type: "start" });
  const bee = run.bees.find((item) => item.status === "hive")!;
  bee.status = "flying";
  return { level, run, bee };
}

// Controlled positions isolate contacts that are easy to miss in full solutions.
// Only the separate command-driven test below asserts replay fidelity.
describe("version 6 dance field contacts", () => {
  it("catches a wind-driven crossing whose endpoints are both outside the field", () => {
    const { level, run, bee } = armed([
      { ...makeObject("dance", "dancer", 6, 7), dance: "left", range: 1 },
      { ...makeObject("wind", "fan", 2, 6), strength: 3 },
    ]);
    Object.assign(bee, { x: 6440, y: 6501, direction: 0 });
    const snapshot = structuredClone(run);
    const next = stepRun(level, run);
    expect(next.bees[bee.id]).toMatchObject({
      x: 6605,
      y: 6501,
      direction: 6,
      danceVisits: ["dance"],
    });
    expect(run).toEqual(snapshot);
    const after = stepRun(level, next).bees[bee.id];
    expect(after.direction).toBe(6);
    expect(after.y).toBeLessThan(6501);
    expect(previewRoute(level, run, bee.id, 2)).toEqual([
      { x: 6605, y: 6501 },
      { x: after.x, y: after.y },
    ]);
  });

  it.each([
    [6500, 4], // Exact tangent contact counts as entering the inclusive field.
    [6499, 0], // One unit outside must not turn.
    [8501, 0], // Moving past the opposite side is also a miss.
  ] as const)("distinguishes grazing from missing at y=%i", (y, direction) => {
    const { level, run, bee } = armed([
      { ...makeObject("dance", "dancer", 6, 7), dance: "reverse", range: 1 },
    ]);
    Object.assign(bee, { x: 6470, y, direction: 0 });
    expect(stepRun(level, run).bees[bee.id].direction).toBe(direction);
  });

  it("does not trigger a field along movement rejected by a solid", () => {
    const { level, run, bee } = armed([
      { ...makeObject("dance", "dancer", 7, 7), dance: "left", range: 2 },
      makeObject("wall", "terrain", 6, 6),
    ]);
    Object.assign(bee, { x: 5990, y: 6170, direction: 0 });
    expect(stepRun(level, run).bees[bee.id]).toMatchObject({
      x: 5990,
      y: 6170,
      direction: 4,
      danceVisits: [],
    });
  });

  it.each([6, 7] as const)(
    "leaves a wall/corner after bouncing under pointing dance %i",
    (direction) => {
      const { level, run, bee } = armed([
        { ...makeObject("dance", "dancer", 6, 7), direction },
        makeObject("wall", "terrain", direction === 6 ? 5 : 6, 6),
      ]);
      Object.assign(bee, {
        x: direction === 6 ? 5500 : 5990,
        y: 7010,
        direction: 0,
      });
      const bounced = stepRun(level, run);
      expect(bounced.bees[bee.id]).toMatchObject({
        x: bee.x,
        y: bee.y,
        direction: (direction + 4) % 8,
        danceVisits: ["dance"],
      });
      const escaped = stepRun(level, bounced).bees[bee.id];
      expect(escaped.y).toBeGreaterThan(bee.y);
      expect(escaped.status).toBe("flying");
      expect(escaped.direction).toBe((direction + 4) % 8);
    },
  );

  it("resolves overlaps by distance and stable ID, retains hysteresis, and does not retrigger visited fields", () => {
    const objects = [
      { ...makeObject("a", "dancer", 5, 7), dance: "left" as const },
      { ...makeObject("z", "dancer", 7, 7), dance: "right" as const },
    ];
    for (const order of [objects, [...objects].reverse()]) {
      const { level, run, bee } = armed(order);
      Object.assign(bee, { x: 6500, y: 6500, direction: 0 });
      let next = stepRun(level, run);
      expect(next.bees[bee.id]).toMatchObject({ direction: 6, signalId: "a" });
      Object.assign(next.bees[bee.id], { x: 6640, y: 6500 });
      next = stepRun(level, next);
      expect(next.bees[bee.id]).toMatchObject({ direction: 6, signalId: "a" });
      Object.assign(next.bees[bee.id], { x: 6750, y: 6500 });
      next = stepRun(level, next);
      expect(next.bees[bee.id]).toMatchObject({
        direction: 0,
        signalId: "z",
        danceVisits: ["a", "z"],
      });
      Object.assign(next.bees[bee.id], { x: 6250, y: 6500 });
      next = stepRun(level, next);
      expect(next.bees[bee.id]).toMatchObject({ direction: 0, signalId: "a" });
    }
  });

  it("does not turn again when a pointing arrow changes during the same visit", () => {
    const { level, run, bee } = armed([
      { ...makeObject("dance", "dancer", 6, 7), direction: 6 },
    ]);
    Object.assign(bee, { x: 5500, y: 7500, direction: 0 });
    const turned = stepRun(level, run);
    const changed = applyCommand(level, turned, {
      type: "adjust",
      objectId: "dance",
      direction: 2,
      strength: 1,
    });
    expect(stepRun(level, changed).bees[bee.id].direction).toBe(6);
    const released = applyCommand(level, changed, {
      type: "release",
      objectId: "dance",
    });
    expect(released.bees[0].direction).toBe(2);
    expect(stepRun(level, released).bees[bee.id].danceVisits).toEqual([]);
  });

  it("applies one winner when two fields are entered simultaneously, independent of object order", () => {
    const objects = [
      { ...makeObject("a", "dancer", 5, 7), dance: "left" as const },
      { ...makeObject("z", "dancer", 7, 7), dance: "reverse" as const },
    ];
    for (const order of [objects, [...objects].reverse()]) {
      const { level, run, bee } = armed(order);
      Object.assign(bee, { x: 6500, y: 5750, direction: 2 });
      expect(stepRun(level, run).bees[bee.id]).toMatchObject({
        x: 6500,
        y: 5810,
        direction: 0,
        signalId: "a",
        danceVisits: ["a"],
      });
    }
  });

  it("replays a real commanded route through a relative dancer without fixture positions", () => {
    const level = validateLevel({
      ...createBlankLevel(6),
      objects: [
        ...createBlankLevel(6).objects,
        { ...makeObject("dance", "dancer", 6, 7), dance: "left", range: 1 },
      ],
    });
    let run = applyCommand(level, createRun(level), {
      type: "assign",
      objectId: "dance",
    });
    run = applyCommand(level, run, { type: "start" });
    for (let tick = 0; tick < 60; tick++) run = stepRun(level, run);
    expect(run.bees[1]).toMatchObject({ direction: 6, danceVisits: ["dance"] });
    expect(replayRun(level, captureReplay(level, run))).toEqual(run);
  });
});
