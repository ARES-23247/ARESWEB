import { describe, expect, it } from "vitest";
import {
  addObject,
  createEditor,
  deleteObject,
  duplicateObject,
  undoEdit,
  updateObject,
} from "@ares/waggle-way/editor";
import {
  applyCommand,
  airflowAt,
  createRun,
  gateState,
  populationCounts,
  previewRoute,
  stepRun,
  type RunState,
} from "@ares/waggle-way/engine";
import {
  createBlankLevel,
  makeObject,
  parseLevelFile,
  serializeLevel,
  upgradeLevel,
  validateLevel,
  type LevelDefinition,
} from "@ares/waggle-way/level";
import {
  captureReplay,
  parseRunCommand,
  replayRun,
} from "@ares/waggle-way/replay";

function gated() {
  let e = createEditor(createBlankLevel());
  e = addObject(e, "switch", 18, 7);
  e = addObject(e, "gate", 10, 6);
  return updateObject(e, "gate-1", { height: 3 }).level;
}
function advance(level: LevelDefinition, initial: RunState, ticks: number) {
  let run = initial;
  for (let i = 0; i < ticks; i++) run = stepRun(level, run);
  return run;
}
function rallyGarden() {
  return addObject(createEditor(createBlankLevel()), "rally", 6, 7).level;
}

describe("Glasshouse shared mechanics", () => {
  it("preserves both legacy formats and explicitly upgrades to the current version", () => {
    for (const version of [1, 2] as const) {
      const old = createBlankLevel(version);
      const text = serializeLevel(old);
      expect(serializeLevel(parseLevelFile(text))).toBe(text);
      expect(upgradeLevel(old)).toMatchObject({
        schemaVersion: 5,
        rulesVersion: 5,
        objects: old.objects,
      });
      expect(old.schemaVersion).toBe(version);
      expect(() =>
        validateLevel({
          ...old,
          objects: [...old.objects, makeObject("s", "switch", 5, 5)],
        }),
      ).toThrow("unsupported");
      const run = advance(
        old,
        applyCommand(old, createRun(old), { type: "start" }),
        700,
      );
      expect(replayRun(old, captureReplay(old, run))).toEqual(run);
      expect(run.won).toBe(true);
    }
  });
  it("validates gate links and requires deliberate relinking before switch deletion", () => {
    const e = createEditor(gated());
    expect(() =>
      addObject(createEditor(createBlankLevel()), "gate", 8, 4),
    ).toThrow("Place a switch");
    expect(() => deleteObject(e, "switch-1")).toThrow("gate-1");
    expect(() => updateObject(e, "gate-1", { switchId: "hive" })).toThrow(
      "must link",
    );
    expect(() => updateObject(e, "gate-1", { switchId: "missing" })).toThrow(
      "must link",
    );
    expect(() => updateObject(e, "switch-1", { switchId: "switch-1" })).toThrow(
      "Only gates",
    );
    let next = addObject(e, "switch", 17, 4);
    next = updateObject(next, "gate-1", { switchId: "switch-2" });
    const deleted = deleteObject(next, "switch-1");
    expect(undoEdit(deleted)).toMatchObject({ level: next.level });
    const copied = duplicateObject(e, "gate-1", 13, 6);
    expect(copied.level.objects.at(-1)?.switchId).toBe("switch-1");
    expect(serializeLevel(parseLevelFile(serializeLevel(copied.level)))).toBe(
      serializeLevel(copied.level),
    );
  });
  it("uses switches for gates without emitting a dance and shares helper jobs", () => {
    const level = gated();
    level.guideLimit = 1;
    level.objects.push(makeObject("p", "perch", 4, 4));
    const initial = createRun(level);
    const run = applyCommand(level, initial, {
      type: "assign",
      objectId: "switch-1",
    });
    const gate = run.objects.find((object) => object.kind === "gate")!;
    expect(gateState(initial, gate)).toBe("closed");
    expect(gateState(run, gate)).toBe("open");
    expect(
      applyCommand(level, run, { type: "assign", objectId: "p" }).commands,
    ).toEqual(run.commands);
    const straight = advance(
      level,
      applyCommand(level, run, { type: "start" }),
      500,
    );
    expect(populationCounts(straight).rescued).toBe(7);
    expect(straight.bees.every((bee) => bee.signalId === null)).toBe(true);
    const released = applyCommand(level, straight, {
      type: "release",
      objectId: "switch-1",
    });
    expect(gateState(released, gate)).toBe("closed");
    const done = advance(level, released, 100);
    expect(populationCounts(done).rescued).toBe(8);
    expect(replayRun(level, captureReplay(level, done))).toEqual(done);
  });
  it("closed gates block wind and flight while open gates pass both", () => {
    const level = gated();
    const fan = { ...makeObject("f", "fan", 2, 5), range: 16 };
    const objects = [...level.objects, fan];
    expect(airflowAt(objects, 12000, 6500)).toEqual({ x: 0, y: 0 });
    expect(airflowAt(objects, 12000, 6500, ["gate-1"]).x).toBe(35);
    const closed = advance(
      level,
      applyCommand(level, createRun(level), { type: "start" }),
      700,
    );
    expect(populationCounts(closed).rescued).toBe(0);
    expect(populationCounts(closed).lost).toBe(8);
  });
  it("defers closure for bees inside and never changes their positions on release", () => {
    const level = gated();
    let run = applyCommand(level, createRun(level), {
      type: "assign",
      objectId: "switch-1",
    });
    run = applyCommand(level, run, { type: "start" });
    Object.assign(run.bees[1], { status: "flying", x: 10500, y: 7500 });
    const next = applyCommand(level, run, {
      type: "release",
      objectId: "switch-1",
    });
    const gate = next.objects.find((object) => object.kind === "gate")!;
    expect(gateState(next, gate)).toBe("closing");
    expect(next.bees[1]).toEqual(run.bees[1]);
    const moved = advance(level, next, 12);
    expect(moved.bees[1].x).toBeGreaterThan(11000);
    expect(moved.bees[1].status).toBe("flying");
    expect(gateState(moved, gate)).toBe("closed");
    expect(next.bees[1].x).toBe(10500);
  });
  it("rallies hold the whole hive alive, release in order, and survive replay", () => {
    const level = rallyGarden();
    let run = advance(
      level,
      applyCommand(level, createRun(level), { type: "start" }),
      500,
    );
    expect(populationCounts(run)).toEqual({
      hive: 0,
      flying: 0,
      waiting: 8,
      assigned: 0,
      rescued: 0,
      lost: 0,
    });
    expect(run.phase).toBe("running");
    expect(previewRoute(level, run, 0)).toEqual([]);
    expect(
      applyCommand(level, run, { type: "release", objectId: "rally-1" })
        .commands,
    ).toEqual(run.commands);
    const held = run;
    run = applyCommand(level, run, {
      type: "rally",
      objectId: "rally-1",
      mode: "release",
    });
    expect(held.rallies[0].mode).toBe("hold");
    run = stepRun(level, run);
    expect(run.bees[0].status).toBe("flying");
    expect(populationCounts(run).waiting).toBe(7);
    run = advance(level, run, level.releaseInterval - 1);
    expect(populationCounts(run).waiting).toBe(7);
    run = stepRun(level, run);
    expect(run.bees[1].status).toBe("flying");
    const done = advance(level, run, 600);
    expect(done.phase).toBe("finished");
    expect(populationCounts(done).rescued).toBe(8);
    expect(replayRun(level, captureReplay(level, done))).toEqual(done);
  });
  it("re-holding does not immediately recapture a bee leaving the same flower", () => {
    const level = rallyGarden();
    let run = advance(
      level,
      applyCommand(level, createRun(level), { type: "start" }),
      500,
    );
    run = stepRun(
      level,
      applyCommand(level, run, {
        type: "rally",
        objectId: "rally-1",
        mode: "release",
      }),
    );
    run = applyCommand(level, run, {
      type: "rally",
      objectId: "rally-1",
      mode: "hold",
    });
    run = stepRun(level, run);
    expect(run.bees[0].status).toBe("flying");
    expect(populationCounts(run).waiting).toBe(7);
    const moved = applyCommand(
      level,
      {
        ...run,
        objects: run.objects.map((o) => ({
          ...o,
          permission: o.kind === "rally" ? "movable" : o.permission,
        })),
      },
      { type: "move", objectId: "rally-1", x: 5, y: 5 },
    );
    expect(moved.commands.length).toBe(run.commands.length);
  });
  it("validates rally command shape, object type, mode and redundant changes", () => {
    const level = rallyGarden();
    const initial = createRun(level);
    const command = {
      type: "rally",
      objectId: "rally-1",
      mode: "release",
    } as const;
    expect(parseRunCommand(command)).toEqual(command);
    expect(() => parseRunCommand({ ...command, mode: "invalid" })).toThrow(
      "rally mode",
    );
    expect(() => parseRunCommand({ ...command, extra: true })).toThrow(
      "fields",
    );
    expect(
      applyCommand(level, initial, { ...command, objectId: "hive" }).commands,
    ).toEqual([]);
    expect(
      applyCommand(level, initial, { ...command, mode: "hold" }).commands,
    ).toEqual([]);
    expect(
      applyCommand(level, initial, { ...command, mode: "invalid" } as never)
        .commands,
    ).toEqual([]);
  });
});
