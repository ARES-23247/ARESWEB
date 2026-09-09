import { describe, expect, it } from "vitest";
import {
  createBlankLevel,
  makeObject,
  validateLevel,
  serializeLevel,
  parseLevelFile,
  type LevelDefinition,
} from "@ares/waggle-way/level";
import {
  applyCommand,
  createRun,
  stepRun,
  populationCounts,
  type RunState,
} from "@ares/waggle-way/engine";
import { captureReplay, replayRun } from "@ares/waggle-way/replay";
import { rainZones } from "../../packages/waggle-way/src/core/weather";

function garden(elevation: "low" | "tall" = "low", width = 2): LevelDefinition {
  return validateLevel({
    ...createBlankLevel(8),
    width: 18,
    height: 10,
    population: 3,
    rescueTarget: 3,
    guideLimit: 1,
    objects: [
      makeObject("hive", "hive", 2, 5),
      makeObject("flowers", "flowers", 15, 5),
      { ...makeObject("wall", "terrain", 6, 0), width, height: 10, elevation },
    ],
    inventory: [
      {
        id: "lift",
        kind: "dancer",
        dance: "lift",
        count: 1,
        width: 1,
        height: 1,
        direction: 0,
        range: 1,
        strength: 1,
      },
    ],
  });
}
function fly(level: LevelDefinition, useLift = true) {
  let run = createRun(level);
  if (useLift)
    run = applyCommand(level, run, {
      type: "place",
      stockId: "lift",
      objectId: "helper",
      x: 4,
      y: 5,
    });
  run = applyCommand(level, run, { type: "start" });
  const history: RunState[] = [];
  for (let tick = 0; tick < 650 && run.phase !== "finished"; tick++) {
    if (
      populationCounts(run).rescued === 2 &&
      populationCounts(run).assigned === 1
    )
      run = applyCommand(level, run, { type: "release", objectId: "helper" });
    run = stepRun(level, run);
    history.push(run);
  }
  return { run, history };
}

describe("height flight", () => {
  it.each(["rally", "pollen"] as const)(
    "flies over %s without collecting it while high",
    (kind) => {
      const level = garden();
      level.objects.push(makeObject("pickup", kind, 5, 5));
      const { run, history } = fly(level);
      expect(run.won).toBe(true);
      expect(
        history.every((state) => populationCounts(state).waiting === 0),
      ).toBe(true);
      expect(run.pollen).toEqual(createRun(level).pollen);
    },
  );
  it("does not treat low obstacles as roofs over the spray lane", () => {
    const sprinkler = { ...makeObject("rain", "sprinkler", 6, 0), range: 9 };
    const wall = {
      ...makeObject("wall", "terrain", 6, 3),
      elevation: "low" as const,
    };
    expect(rainZones([sprinkler, wall], sprinkler)).toEqual([
      { x: 6, y: 1, width: 1, height: 9 },
    ]);
    expect(
      rainZones([sprinkler, { ...wall, elevation: "tall" }], sprinkler),
    ).toEqual([{ x: 6, y: 1, width: 1, height: 2 }]);
  });
  it("recruits a waiting bee beside a rally without requiring a timed click", () => {
    const level = garden();
    level.objects = level.objects.filter((object) => object.kind !== "terrain");
    level.objects.push(makeObject("rally", "rally", 5, 5));
    let run = applyCommand(level, createRun(level), { type: "start" });
    while (run.tick < 200 && populationCounts(run).waiting < 3)
      run = stepRun(level, run);
    expect(populationCounts(run).waiting).toBe(3);
    const far = applyCommand(level, run, {
      type: "place",
      stockId: "lift",
      objectId: "far",
      x: 8,
      y: 5,
    });
    expect(far.commands).toEqual(run.commands);
    run = applyCommand(level, run, {
      type: "place",
      stockId: "lift",
      objectId: "near",
      x: 6,
      y: 5,
    });
    expect(populationCounts(run).waiting).toBe(2);
    expect(populationCounts(run).assigned).toBe(1);
    expect(run.bees.find((bee) => bee.status === "assigned")?.perchId).toBe(
      "near",
    );
    expect(replayRun(level, captureReplay(level, run))).toEqual(run);
  });
  it("crosses a low wall and gives the released lift helper its own flight", () => {
    const level = garden();
    const { run, history } = fly(level);
    expect(populationCounts(run).rescued).toBe(3);
    expect(run.won).toBe(true);
    expect(
      history.some((state) =>
        state.bees.some(
          (bee) => bee.x > 6000 && bee.x < 8000 && (bee.liftRemaining ?? 0) > 0,
        ),
      ),
    ).toBe(true);
    expect(replayRun(level, captureReplay(level, run))).toEqual(run);
  });
  it("cannot cross the same barrier at normal flight height", () => {
    expect(fly(garden(), false).run.won).toBe(false);
  });
  it("cannot cross a tall wall with lift", () => {
    const { run, history } = fly(garden("tall"));
    expect(run.won).toBe(false);
    expect(
      history.every((state) => state.bees.every((bee) => bee.x < 6000)),
    ).toBe(true);
  });
  it("loses bees that run out of lift over a wide low obstacle", () => {
    const { run } = fly(garden("low", 8));
    expect(run.won).toBe(false);
    expect(run.bees.some((bee) => bee.lossReason === "landing")).toBe(true);
  });
  it("round-trips height and rejects ambiguous older-rule files", () => {
    const level = garden();
    expect(parseLevelFile(serializeLevel(level))).toEqual({
      ...level,
      objects: [...level.objects].sort((a, b) => a.id.localeCompare(b.id)),
    });
    expect(() =>
      validateLevel({ ...level, schemaVersion: 7, rulesVersion: 7 }),
    ).toThrow();
    expect(() =>
      validateLevel({
        ...level,
        objects: level.objects.map((o) =>
          o.kind === "hive" ? { ...o, elevation: "low" } : o,
        ),
      }),
    ).toThrow();
  });
  it("does not rescue airborne bees just because they pass over flowers", () => {
    const level = garden();
    level.objects = level.objects.map((object) =>
      object.kind === "flowers" ? { ...object, x: 5 } : object,
    );
    expect(populationCounts(fly(level).run).rescued).toBe(0);
  });
  it("does not let lift avoid active spray", () => {
    const level = garden();
    level.objects.push({
      ...makeObject("rain", "sprinkler", 5, 0),
      range: 9,
      cycle: { dryTicks: 1, warningTicks: 1, wetTicks: 1800, offsetTicks: 0 },
    });
    const { run } = fly(level);
    expect(run.won).toBe(false);
    expect(run.bees.some((bee) => bee.lossReason === "rain")).toBe(true);
  });
});
