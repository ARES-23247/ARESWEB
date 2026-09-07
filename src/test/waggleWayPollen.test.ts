import { describe, expect, it } from "vitest";
import {
  createBlankLevel,
  makeObject,
  validateLevel,
  serializeLevel,
  parseLevelFile,
  upgradeLevel,
  GARDEN_THEMES,
} from "@ares/waggle-way/level";
import {
  applyCommand,
  createRun,
  stepRun,
  pollenCounts,
  populationCounts,
} from "@ares/waggle-way/engine";
import {
  addObject,
  createEditor,
  editLevel,
  undoEdit,
} from "@ares/waggle-way/editor";
import { captureReplay, replayRun } from "@ares/waggle-way/replay";
import {
  loadProgress,
  saveProgress,
  progressFor,
  isLevelUnlocked,
} from "@ares/waggle-way/progress";

function garden() {
  const e = addObject(createEditor(createBlankLevel()), "pollen", 4, 7);
  return validateLevel({ ...e.level, objectives: { pollen: 1 } });
}
const stock = {
  id: "fans",
  kind: "fan" as const,
  count: 2,
  width: 1,
  height: 1,
  direction: 0 as const,
  range: 2,
  strength: 1,
};
describe("optional pollen and garden themes", () => {
  it("allows stock placement and movement with an optional zero-tool goal without changing that goal", () => {
    const level = validateLevel({
      ...garden(),
      inventory: [stock],
      objectives: { pollen: 1, maxTools: 0 },
    });
    const original = serializeLevel(level);
    let run = applyCommand(level, createRun(level), {
      type: "place",
      stockId: "fans",
      objectId: "placed",
      x: 8,
      y: 2,
    });
    expect(run.deployed).toHaveLength(1);
    run = applyCommand(level, run, {
      type: "move",
      objectId: "placed",
      x: 9,
      y: 2,
    });
    expect(run.objects.find((o) => o.id === "placed")?.x).toBe(9);
    const rejected = applyCommand(level, run, {
      type: "move",
      objectId: "placed",
      x: 4,
      y: 7,
    });
    expect(rejected.commands).toEqual(run.commands);
    run = applyCommand(level, run, { type: "recover", objectId: "placed" });
    expect(run.peakToolsPlaced).toBe(1);
    expect(run.deployed).toHaveLength(0);
    expect(serializeLevel(level)).toBe(original);
  });
  it("strictly validates goals, themes and legacy versions without silently upgrading", () => {
    const level = garden();
    for (const theme of GARDEN_THEMES)
      expect(parseLevelFile(serializeLevel({ ...level, theme })).theme).toBe(
        theme,
      );
    for (const version of [1, 2, 3, 4] as const) {
      const old = createBlankLevel(version);
      const raw = serializeLevel(old);
      expect(serializeLevel(parseLevelFile(raw))).toBe(raw);
      expect(createRun(old).pollen).toBeUndefined();
      expect(() => validateLevel({ ...old, theme: "sunny" })).toThrow(
        "Upgrade",
      );
      expect(() =>
        validateLevel({ ...old, objectives: { pollen: 0 } }),
      ).toThrow("Upgrade");
      expect(() =>
        validateLevel({
          ...old,
          objects: [...old.objects, makeObject("p", "pollen", 4, 7)],
        }),
      ).toThrow("unsupported");
      expect(upgradeLevel(old)).toMatchObject({
        schemaVersion: 5,
        theme: "sunny",
        objectives: { pollen: 0 },
      });
      expect(serializeLevel(old)).toBe(raw);
    }
    for (const patch of [
      { theme: "https://example.com/art" },
      { theme: null },
      { objectives: null },
      { objectives: { pollen: 2 } },
      { objectives: { pollen: -1 } },
      { objectives: { pollen: 0.5 } },
      { objectives: { pollen: 1, code: "run" } },
      { objectives: { pollen: 1, maxTools: 0 } },
    ])
      expect(() => validateLevel({ ...level, ...patch })).toThrow();
    expect(
      validateLevel({
        ...level,
        inventory: [stock],
        objectives: { pollen: 1, maxTools: 1 },
      }).objectives,
    ).toEqual({ pollen: 1, maxTools: 1 });
    expect(() =>
      validateLevel({
        ...level,
        inventory: [stock],
        objectives: { pollen: 1, maxTools: 3 },
      }),
    ).toThrow("tool limit");
    const e = createEditor(level);
    const changed = editLevel(e, { ...level, theme: "wildflower" });
    expect(undoEdit(changed).level).toEqual(level);
    expect(() =>
      editLevel(e, {
        ...level,
        objects: level.objects.filter((o) => o.kind !== "pollen"),
      }),
    ).toThrow("Pollen");
  });

  it("counts delivery rather than contact and replays the exact collectible state", () => {
    const level = garden();
    let run = createRun(level);
    expect(pollenCounts(run)).toEqual({
      available: 1,
      carried: 0,
      delivered: 0,
    });
    expect(stepRun(level, run)).toBe(run);
    const setup = run;
    run = applyCommand(level, run, { type: "start" });
    for (let i = 0; i < 80; i++) run = stepRun(level, run);
    expect(pollenCounts(run)).toEqual({
      available: 0,
      carried: 1,
      delivered: 0,
    });
    expect(pollenCounts(setup).available).toBe(1);
    while (run.phase !== "finished") run = stepRun(level, run);
    expect(pollenCounts(run)).toEqual({
      available: 0,
      carried: 0,
      delivered: 1,
    });
    expect(populationCounts(run).rescued).toBe(8);
    expect(replayRun(level, captureReplay(level, run))).toEqual(run);
    expect(pollenCounts(createRun(createBlankLevel(4))).delivered).toBe(0);
  });

  it("returns pollen from a lost carrier and lets a later bee collect it once", () => {
    const level = validateLevel({
      ...garden(),
      population: 2,
      rescueTarget: 1,
      guideLimit: 2,
      releaseInterval: 300,
      objects: [...garden().objects, makeObject("pond", "water", 5, 7)],
    });
    let run = applyCommand(level, createRun(level), { type: "start" });
    while (run.tick < 30) run = stepRun(level, run);
    expect(pollenCounts(run).carried).toBe(1);
    while (run.tick < 60) run = stepRun(level, run);
    expect(run.bees[0].status).toBe("lost");
    expect(pollenCounts(run).available).toBe(1);
    while (run.tick < 330) run = stepRun(level, run);
    expect(run.pollen![0].carrierId).toBe(1);
    expect(pollenCounts(run).delivered).toBe(0);
  });

  it("keeps carried pollen through waiting, helper assignment and release", () => {
    const base = garden();
    const level = validateLevel({
      ...base,
      objects: [
        ...base.objects,
        makeObject("gather", "rally", 6, 7),
        makeObject("guide", "perch", 7, 7),
      ],
    });
    let run = applyCommand(level, createRun(level), { type: "start" });
    while (run.tick < 75) run = stepRun(level, run);
    expect(run.bees[0].status).toBe("waiting");
    expect(run.pollen![0].carrierId).toBe(0);
    run = applyCommand(level, run, {
      type: "rally",
      objectId: "gather",
      mode: "release",
    });
    run = stepRun(level, run);
    run = applyCommand(level, run, { type: "assign", objectId: "guide" });
    expect(run.bees[0].status).toBe("assigned");
    expect(run.pollen![0].carrierId).toBe(0);
    run = applyCommand(level, run, { type: "release", objectId: "guide" });
    while (run.phase !== "finished" && run.tick < 1000)
      run = stepRun(level, run);
    expect(pollenCounts(run).delivered).toBe(1);
  });

  it("keeps optional achievements separate, bounded and tied to successful exact revisions", () => {
    const level = validateLevel({
      ...garden(),
      inventory: [stock],
      objectives: { pollen: 1, maxTools: 1 },
    });
    let raw: string | null = null;
    const storage = {
      getItem: () => raw,
      setItem: (_key: string, value: string) => {
        raw = value;
      },
    };
    const completed = saveProgress(storage, level, {
      type: "completed",
      rescued: 8,
      pollen: 0,
      peakTools: 2,
    });
    expect(
      isLevelUnlocked([level, { ...level, id: "next" }], completed, 1),
    ).toBe(true);
    const improved = saveProgress(storage, level, {
      type: "completed",
      rescued: 8,
      pollen: 1,
      peakTools: 1,
    });
    expect(improved[0]).toMatchObject({ bestPollen: 1, fewestTools: 1 });
    expect(saveProgress(storage, level, { type: "skipped" })).toEqual(improved);
    expect(
      saveProgress(storage, level, { type: "completed", rescued: 8 }),
    ).toEqual(improved);
    expect(loadProgress(storage)).toEqual(improved);
    expect(
      progressFor(improved, { ...level, theme: "wildflower" }),
    ).toBeUndefined();
    const saved = raw;
    for (const result of [
      { rescued: 8, pollen: 2 },
      { rescued: 8, pollen: -1 },
      { rescued: 8, peakTools: 3 },
      { rescued: 1, pollen: 1 },
    ])
      expect(() =>
        saveProgress(storage, level, { type: "completed", ...result }),
      ).toThrow();
    expect(() =>
      saveProgress(storage, createBlankLevel(4), {
        type: "completed",
        rescued: 8,
        pollen: 0,
      }),
    ).toThrow("optional");
    expect(raw).toBe(saved);
    const original = JSON.parse(saved!);
    for (const patch of [
      { bestPollen: 9 },
      { fewestTools: -1 },
      { bestPollen: "1" },
      { fewestTools: 0.5 },
      { bestPollen: undefined, completed: false, bestRescued: 0 },
    ]) {
      raw = JSON.stringify({
        ...original,
        records: [{ ...original.records[0], ...patch }],
      });
      expect(() => loadProgress(storage)).toThrow("preserved");
    }
    raw = saved;
    const reset = saveProgress(
      storage,
      { ...level, title: "Revised" },
      { type: "skipped" },
    );
    expect(reset[0].bestPollen).toBeUndefined();
    expect(reset[0].fewestTools).toBeUndefined();
  });
});
