import { describe, expect, it } from "vitest";
import {
  addObject,
  createEditor,
  updateObject,
  undoEdit,
} from "@ares/waggle-way/editor";
import {
  applyCommand,
  createRun,
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
import { captureReplay, replayRun } from "@ares/waggle-way/replay";
import {
  rainZones,
  sprinklerPhase,
} from "../../packages/waggle-way/src/core/weather";

function rainy() {
  const e = addObject(createEditor(createBlankLevel()), "sprinkler", 10, 1);
  return updateObject(e, "sprinkler-1", {
    width: 3,
    range: 10,
    cycle: { dryTicks: 10, warningTicks: 5, wetTicks: 300, offsetTicks: 15 },
  }).level;
}
function advance(level: LevelDefinition, initial: RunState, ticks: number) {
  let state = initial;
  for (let i = 0; i < ticks; i++) state = stepRun(level, state);
  return state;
}
describe("Rainy Garden rules", () => {
  it("uses exact repeatable phase boundaries and freezes before the hive opens", () => {
    const level = rainy();
    const s = {
      ...level.objects.at(-1)!,
      cycle: { dryTicks: 10, warningTicks: 5, wetTicks: 20, offsetTicks: 0 },
    };
    expect(sprinklerPhase(s, 0)).toEqual({ phase: "dry", ticksRemaining: 10 });
    expect(sprinklerPhase(s, 9)).toEqual({ phase: "dry", ticksRemaining: 1 });
    expect(sprinklerPhase(s, 10)).toEqual({
      phase: "warning",
      ticksRemaining: 5,
    });
    expect(sprinklerPhase(s, 14)).toEqual({
      phase: "warning",
      ticksRemaining: 1,
    });
    expect(sprinklerPhase(s, 15)).toEqual({
      phase: "rain",
      ticksRemaining: 20,
    });
    expect(sprinklerPhase(s, 34)).toEqual({ phase: "rain", ticksRemaining: 1 });
    expect(sprinklerPhase(s, 35)).toEqual(sprinklerPhase(s, 0));
    expect(
      sprinklerPhase({ ...s, cycle: { ...s.cycle, offsetTicks: 34 } }, 1),
    ).toEqual(sprinklerPhase(s, 0));
    const setup = createRun(level);
    expect(advance(level, setup, 100)).toBe(setup);
  });
  it("rejects malformed, unsupported and out-of-bounds cycles without destroying a draft", () => {
    const level = rainy();
    const s = level.objects.at(-1)!;
    for (const patch of [
      { cycle: undefined },
      { cycle: { ...s.cycle, warningTicks: 0 } },
      { cycle: { ...s.cycle, dryTicks: 1801 } },
      { cycle: { ...s.cycle, wetTicks: -1 } },
      { cycle: { ...s.cycle, offsetTicks: 315 } },
      { cycle: { ...s.cycle, extra: true } },
      { range: 16 },
      { permission: "movable" },
    ]) {
      expect(() =>
        validateLevel({
          ...level,
          objects: [...level.objects.slice(0, -1), { ...s, ...patch }],
        }),
      ).toThrow();
    }
    expect(() =>
      validateLevel({
        ...level,
        objects: level.objects.map((o) =>
          o.kind === "hive" ? { ...o, cycle: s.cycle } : o,
        ),
      }),
    ).toThrow("Only sprinklers");
    for (const version of [1, 2, 3] as const) {
      const old = createBlankLevel(version);
      const text = serializeLevel(old);
      expect(serializeLevel(parseLevelFile(text))).toBe(text);
      const completed = advance(
        old,
        applyCommand(old, createRun(old), { type: "start" }),
        1000,
      );
      expect(replayRun(old, captureReplay(old, completed))).toEqual(completed);
      expect(() =>
        validateLevel({ ...old, objects: [...old.objects, s] }),
      ).toThrow("unsupported");
      expect(upgradeLevel(old).rulesVersion).toBe(5);
    }
    const edited = updateObject(createEditor(level), s.id, {
      cycle: { ...s.cycle!, offsetTicks: 0 },
    });
    expect(undoEdit(edited).level).toEqual(level);
    expect(serializeLevel(parseLevelFile(serializeLevel(edited.level)))).toBe(
      serializeLevel(edited.level),
    );
  });
  it("projects partial shelter and selects the nearest blocker in each column", () => {
    const level = rainy();
    const s = level.objects.at(-1)!;
    const leaf = { ...makeObject("leaf", "shelter", 11, 5), width: 1 };
    const lower = { ...makeObject("branch", "terrain", 10, 9), width: 3 };
    expect(rainZones([...level.objects, leaf, lower], s)).toEqual([
      { x: 10, y: 2, width: 1, height: 7 },
      { x: 11, y: 2, width: 1, height: 3 },
      { x: 12, y: 2, width: 1, height: 7 },
    ]);
    const cap = { ...leaf, x: 10, y: 2, width: 3 };
    expect(rainZones([...level.objects, cap], s)).toEqual([]);
    const gate = {
      ...lower,
      id: "gate",
      kind: "gate" as const,
      y: 4,
      switchId: "s",
    };
    expect(rainZones([...level.objects, gate], s)).toEqual([
      { x: 10, y: 2, width: 3, height: 2 },
    ]);
    expect(rainZones([...level.objects, gate], s, ["gate"])).toEqual([
      { x: 10, y: 2, width: 3, height: 10 },
    ]);
  });
  it("loses exposed bees but a canopy saves the same hive; replay and preview use the same rain", () => {
    const level = rainy();
    const run = applyCommand(level, createRun(level), { type: "start" });
    const wet = advance(level, run, 600);
    expect(populationCounts(wet).lost).toBe(8);
    expect(wet.bees.every((bee) => bee.lossReason === "rain")).toBe(true);
    expect(replayRun(level, captureReplay(level, wet))).toEqual(wet);
    const dry = validateLevel({
      ...level,
      objects: [
        ...level.objects,
        { ...makeObject("leaf", "shelter", 10, 5), width: 3 },
      ],
    });
    const sheltered = advance(
      dry,
      applyCommand(dry, createRun(dry), { type: "start" }),
      700,
    );
    expect(populationCounts(sheltered).rescued).toBe(8);
    expect(previewRoute(level, run, 0, 300).length).toBeLessThan(
      previewRoute(dry, createRun(dry), 0, 300).length,
    );
    expect(run.bees.every((bee) => bee.status === "hive")).toBe(true);
  });
  it("rain reaches operators and waiting bees, while warning leaves them safe", () => {
    for (const kind of ["switch", "rally"] as const) {
      const level = addObject(createEditor(rainy()), kind, 11, 7).level;
      let state = createRun(level);
      if (kind === "switch")
        state = applyCommand(level, state, {
          type: "assign",
          objectId: "switch-1",
        });
      else
        state = {
          ...state,
          bees: state.bees.map((bee, index) =>
            index === 0
              ? {
                  ...bee,
                  x: 11500,
                  y: 7500,
                  status: "waiting",
                  perchId: "rally-1",
                }
              : bee,
          ),
        };
      state = applyCommand(level, state, { type: "start" });
      const wet = stepRun(level, state);
      expect(wet.bees[0]).toMatchObject({
        status: "lost",
        lossReason: "rain",
        perchId: null,
      });
      const warningLevel = validateLevel({
        ...level,
        objects: level.objects.map((o) =>
          o.kind === "sprinkler"
            ? { ...o, cycle: { ...o.cycle!, offsetTicks: 10 } }
            : o,
        ),
      });
      const warningState = { ...state, objects: warningLevel.objects };
      expect(stepRun(warningLevel, warningState).bees[0].status).toBe(
        kind === "switch" ? "assigned" : "waiting",
      );
    }
  });
});
