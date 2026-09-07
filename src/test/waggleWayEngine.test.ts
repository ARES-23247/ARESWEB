import { describe, expect, it } from "vitest";
import {
  airflowAt,
  applyCommand,
  createRun,
  eligibleBee,
  MAX_SPEED,
  objectCenter,
  populationCounts,
  previewRoute,
  segmentHits,
  stepRun,
  UNITS,
  type RunState,
} from "@ares/waggle-way/engine";
import {
  createBlankLevel,
  makeObject,
  type LevelDefinition,
} from "@ares/waggle-way/level";

function garden(): LevelDefinition {
  const level = createBlankLevel();
  level.population = 3;
  level.rescueTarget = 3;
  level.objects.push(
    makeObject("guide", "perch", 6, 7),
    makeObject("fan", "fan", 10, 10),
  );
  return level;
}

function advance(
  level: LevelDefinition,
  initial: RunState,
  ticks: number,
): RunState {
  let state = initial;
  for (let i = 0; i < ticks; i++) state = stepRun(level, state);
  return state;
}

describe("Waggle Way simulation", () => {
  it("conserves the hive and reproduces a full rescue independently of rendering batches", () => {
    const level = garden();
    const initial = createRun(level);
    expect(populationCounts(initial)).toEqual({
      hive: 3,
      flying: 0,
      assigned: 0,
      waiting: 0,
      rescued: 0,
      lost: 0,
    });
    expect(stepRun(level, initial)).toBe(initial);
    const started = applyCommand(level, initial, { type: "start" });
    const oneBatch = advance(level, started, 500);
    const batches = advance(level, advance(level, started, 135), 365);
    expect(batches).toEqual(oneBatch);
    expect(oneBatch.phase).toBe("finished");
    expect(populationCounts(oneBatch).rescued).toBe(3);
    expect(populationCounts(initial).hive).toBe(3);
    expect(stepRun(level, oneBatch)).toBe(oneBatch);
    expect(applyCommand(level, oneBatch, { type: "start" }).notice).toMatch(
      /finished/,
    );
  });

  it("reserves guides from the population, returns them during setup, and rescues the final guide", () => {
    const level = garden();
    let state = applyCommand(level, createRun(level), {
      type: "assign",
      objectId: "guide",
    });
    expect(populationCounts(state)).toMatchObject({ assigned: 1, hive: 2 });
    expect(state.bees[0]).toMatchObject({ x: 6500, y: 7500 });
    expect(
      applyCommand(level, state, { type: "assign", objectId: "guide" }).notice,
    ).toMatch(/already/);
    const returned = applyCommand(level, state, {
      type: "release",
      objectId: "guide",
    });
    expect(returned.bees[0]).toMatchObject({ status: "hive", x: 2500 });
    state = applyCommand(level, state, { type: "start" });
    state = advance(level, state, 400);
    expect(populationCounts(state)).toMatchObject({ rescued: 2, assigned: 1 });
    expect(state.won).toBe(false);
    state = applyCommand(level, state, { type: "release", objectId: "guide" });
    expect(state.commands.at(-1)?.tick).toBe(400);
    state = advance(level, state, 300);
    expect(state.won).toBe(true);
    expect(populationCounts(state).rescued).toBe(3);
  });

  it("allows assignment during flight only near an empty perch", () => {
    const level = garden();
    let state = applyCommand(level, createRun(level), { type: "start" });
    expect(
      applyCommand(level, state, { type: "assign", objectId: "guide" }).notice,
    ).toMatch(/within one cell/);
    state = advance(level, state, 60);
    expect(eligibleBee(state, level.objects[2])).toBeDefined();
    state = applyCommand(level, state, { type: "assign", objectId: "guide" });
    expect(populationCounts(state).assigned).toBe(1);
  });

  it("rejects unavailable jobs and invalid commands without recording successful actions", () => {
    const level = garden();
    const state = createRun(level);
    expect(
      applyCommand(level, state, { type: "assign", objectId: "absent" }).notice,
    ).toMatch(/not in/);
    expect(
      applyCommand(level, state, { type: "assign", objectId: "fan" }).notice,
    ).toMatch(/Only guide/);
    expect(
      applyCommand(level, state, { type: "release", objectId: "guide" }).notice,
    ).toMatch(/no guide/);
    expect(
      applyCommand(level, state, { type: "finish" }).commands,
    ).toHaveLength(0);
    expect(
      applyCommand({ ...level, guideLimit: 0 }, state, {
        type: "assign",
        objectId: "guide",
      }).notice,
    ).toMatch(/All available/);
    expect(
      applyCommand(
        level,
        { ...state, bees: [] },
        { type: "assign", objectId: "guide" },
      ).notice,
    ).toMatch(/No bees/);
    const fullHistory = {
      ...state,
      commands: Array(10000).fill({ tick: 0, command: { type: "start" } }),
    };
    expect(applyCommand(level, fullHistory, { type: "start" }).notice).toMatch(
      /action limit/,
    );
    const running = applyCommand(level, state, { type: "start" });
    expect(applyCommand(level, running, { type: "start" }).notice).toMatch(
      /already open/,
    );
  });

  it("enforces fixed/adjustable/movable tools and occupied perches", () => {
    const level = garden();
    let state = createRun(level);
    expect(
      applyCommand(level, state, {
        type: "adjust",
        objectId: "hive",
        direction: 2,
        strength: 1,
      }).notice,
    ).toMatch(/cannot be changed/);
    state.objects[3].permission = "fixed";
    expect(
      applyCommand(level, state, {
        type: "adjust",
        objectId: "fan",
        direction: 2,
        strength: 1,
      }).notice,
    ).toMatch(/fixed/);
    state.objects[3].permission = "adjustable";
    expect(
      applyCommand(level, state, { type: "move", objectId: "fan", x: 9, y: 9 })
        .notice,
    ).toMatch(/cannot move/);
    expect(
      applyCommand(level, state, {
        type: "adjust",
        objectId: "fan",
        direction: 9 as never,
        strength: 1,
      }).notice,
    ).toMatch(/valid direction/);
    state = applyCommand(level, state, {
      type: "adjust",
      objectId: "fan",
      direction: 6,
      strength: 3,
    });
    expect(state.objects[3]).toMatchObject({ direction: 6, strength: 3 });
    state.objects[3].permission = "movable";
    expect(
      applyCommand(level, state, {
        type: "move",
        objectId: "fan",
        x: 1000,
        y: 9,
      }).notice,
    ).toMatch(/empty position/);
    state = applyCommand(level, state, {
      type: "move",
      objectId: "fan",
      x: 9,
      y: 9,
    });
    expect(state.objects[3]).toMatchObject({ x: 9, y: 9 });
    state.objects[2].permission = "movable";
    state = applyCommand(level, state, { type: "assign", objectId: "guide" });
    expect(
      applyCommand(level, state, {
        type: "move",
        objectId: "guide",
        x: 8,
        y: 7,
      }).notice,
    ).toMatch(/Release the guide/);
  });

  it("marks water and boundary losses once and exposes unreachable targets", () => {
    const level = garden();
    level.objects.push(makeObject("pond", "water", 4, 7));
    let state = advance(
      level,
      applyCommand(level, createRun(level), { type: "start" }),
      100,
    );
    expect(state.impossible).toBe(true);
    expect(populationCounts(state).lost).toBe(3);
    expect(state.phase).toBe("finished");
    const edgeLevel = garden();
    edgeLevel.objects[0].direction = 4;
    state = advance(
      edgeLevel,
      applyCommand(edgeLevel, createRun(edgeLevel), { type: "start" }),
      50,
    );
    expect(state.notice).toMatch(/Too few bees/);
    expect(populationCounts(state).lost).toBe(1);
  });

  it("turns at a solid without penetrating it, including corners", () => {
    const level = garden();
    level.objects.push(makeObject("wall", "terrain", 4, 7));
    const state = advance(
      level,
      applyCommand(level, createRun(level), { type: "start" }),
      26,
    );
    expect(state.bees[0].direction).toBe(4);
    expect(state.bees[0].x).toBeLessThan(4000);
    const wall = level.objects.at(-1)!;
    expect(segmentHits(wall, 3900, 6900, 4100, 7100)).toBe(true);
    expect(segmentHits(wall, 3900, 6900, 3900, 8000)).toBe(false);
    expect(segmentHits(wall, 3000, 7500, 2000, 7500)).toBe(false);
  });

  it("uses nearest signals with stable ties and a switching margin", () => {
    const level = garden();
    const lower = makeObject("a-guide", "perch", 5, 8);
    lower.direction = 2;
    level.objects.push(lower);
    level.objects[2].x = 5;
    level.objects[2].y = 6;
    level.objects[2].direction = 6;
    let state = createRun(level);
    state = applyCommand(level, state, { type: "assign", objectId: "guide" });
    state = applyCommand(level, state, { type: "assign", objectId: "a-guide" });
    state = applyCommand(level, state, { type: "start" });
    state.bees[2] = { ...state.bees[2], x: 5500, y: 7500, status: "flying" };
    const tied = stepRun(level, state);
    expect(tied.bees[2].signalId).toBe("a-guide");
    state.bees[2].signalId = "guide";
    expect(stepRun(level, state).bees[2].signalId).toBe("guide");
    state.bees[2].y = 8300;
    expect(stepRun(level, state).bees[2].signalId).toBe("a-guide");
  });

  it("sums bounded fan streams, respects shadows, and caps flight speed", () => {
    const fan = makeObject("fan", "fan", 2, 2);
    fan.direction = 0;
    fan.strength = 3;
    expect(airflowAt([fan], 4000, 2500)).toEqual({ x: 105, y: 0 });
    expect(airflowAt([fan], 1000, 2500)).toEqual({ x: 0, y: 0 });
    expect(airflowAt([fan], 4000, 6000)).toEqual({ x: 0, y: 0 });
    expect(
      airflowAt([fan, makeObject("wall", "terrain", 3, 2)], 4500, 2500),
    ).toEqual({ x: 0, y: 0 });
    const level = garden();
    level.objects[3] = { ...fan, x: 0, y: 7 };
    level.objects.push({ ...fan, id: "fan-2", x: 1, y: 7 });
    const state = applyCommand(level, createRun(level), { type: "start" });
    const stepped = stepRun(level, state);
    expect(stepped.bees[0].x - state.bees[0].x).toBe(MAX_SPEED);
    const vertical = { ...fan, direction: 6 as const };
    expect(airflowAt([vertical], 2500, 1000)).toEqual({ x: 0, y: -105 });
    expect(objectCenter(fan)).toEqual({ x: 2500, y: 2500 });
  });

  it("lets a player finish at the base target or continue for everyone", () => {
    const level = garden();
    level.rescueTarget = 1;
    const running = advance(
      level,
      applyCommand(level, createRun(level), { type: "start" }),
      309,
    );
    expect(running.won).toBe(true);
    expect(running.notice).toMatch(/target reached/);
    const finished = applyCommand(level, running, { type: "finish" });
    expect(finished.phase).toBe("finished");
    expect(running.phase).toBe("running");
  });

  it("previews the actual engine without changing the attempt", () => {
    const level = garden();
    const state = createRun(level);
    const before = JSON.stringify(state);
    const route = previewRoute(level, state, 0, 30);
    expect(route).toHaveLength(30);
    expect(route[0]).toEqual({ x: 2.5 * UNITS + 60, y: 7.5 * UNITS });
    expect(previewRoute(level, state, 999)).toEqual([]);
    expect(previewRoute(level, state, 0, -1)).toEqual([]);
    const close = {
      ...state,
      bees: state.bees.map((bee) => ({
        ...bee,
        status: "flying" as const,
        x: 20990,
      })),
    };
    expect(previewRoute(level, close, 0)).toEqual([]);
    expect(JSON.stringify(state)).toBe(before);
  });
});
