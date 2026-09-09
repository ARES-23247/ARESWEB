import { describe, expect, it } from "vitest";
import { CHALLENGE_GARDENS } from "../../packages/waggle-way/src/content/challenges";
import {
  applyCommand,
  createRun,
  populationCounts,
  stepRun,
  type RunCommand,
  type RunState,
} from "@ares/waggle-way/engine";
import { parseLevelFile, serializeLevel } from "@ares/waggle-way/level";
import { captureReplay, replayRun } from "@ares/waggle-way/replay";

const place = (
  stockId: string,
  objectId: string,
  x: number,
  y: number,
): RunCommand => ({ type: "place", stockId, objectId, x, y });
const assign = (objectId: string): RunCommand => ({ type: "assign", objectId });
const routes: { setup: RunCommand[]; release: string[] }[] = [
  {
    setup: [assign("switch-1"), place("left-dancer", "guide", 20, 12)],
    release: ["switch-1", "guide"],
  },
  {
    setup: [
      { type: "adjust", objectId: "switch-1", direction: 0, strength: 1 },
      assign("switch-1"),
      place("left-dancer", "guide", 20, 12),
    ],
    release: ["switch-1", "guide"],
  },
  {
    setup: [
      assign("switch-1"),
      assign("switch-2"),
      place("left-dancer", "guide", 28, 12),
    ],
    release: ["switch-1", "switch-2", "guide"],
  },
  { setup: [assign("switch-1")], release: ["guide"] },
  {
    setup: [
      place("left-dancer", "guide", 24, 12),
      place("leaf-cover", "cover-1", 6, 5),
      place("leaf-cover", "cover-2", 16, 5),
    ],
    release: ["guide"],
  },
  {
    setup: [
      assign("switch-1"),
      assign("switch-2"),
      place("left-dancer", "guide", 30, 16),
      place("leaf-cover", "cover", 26, 6),
    ],
    release: ["switch-1", "switch-2", "guide"],
  },
];

describe("converted challenge gardens", () => {
  it.each(
    CHALLENGE_GARDENS.map((level, index) => ({
      level,
      index,
      title: level.title,
    })),
  )(
    "$title has a complete, replayable all-bees solution",
    ({ level, index }) => {
      expect(parseLevelFile(serializeLevel(level))).toEqual(level);
      let run = createRun(level);
      const command = (action: RunCommand) => {
        const before = run.commands.length;
        run = applyCommand(level, run, action);
        expect(run.commands.length, run.notice).toBe(before + 1);
      };
      const until = (predicate: (state: RunState) => boolean) => {
        const deadline = run.tick + 1800;
        while (
          !predicate(run) &&
          run.tick < deadline &&
          run.phase !== "finished"
        )
          run = stepRun(level, run);
        expect(
          predicate(run),
          JSON.stringify({
            tick: run.tick,
            counts: populationCounts(run),
            bees: run.bees,
          }),
        ).toBe(true);
      };
      routes[index].setup.forEach(command);
      command({ type: "start" });
      if (index === 3) {
        until((state) => populationCounts(state).waiting === 7);
        command({ type: "release", objectId: "switch-1" });
        until((state) => populationCounts(state).waiting === 8);
        command({ type: "rally", objectId: "rally-1", mode: "release" });
        until((state) =>
          state.bees.some(
            (bee) =>
              bee.status === "flying" &&
              Math.hypot(bee.x / 1000 - 22.5, bee.y / 1000 - 10.5) < 0.8,
          ),
        );
        command(place("left-dancer", "guide", 22, 10));
      }
      for (const helper of routes[index].release) {
        until(
          (state) =>
            populationCounts(state).rescued ===
            level.population - populationCounts(state).assigned,
        );
        command({ type: "release", objectId: helper });
      }
      until((state) => populationCounts(state).rescued === level.population);
      expect(run.won).toBe(true);
      expect(populationCounts(run).lost).toBe(0);
      expect(replayRun(level, captureReplay(level, run))).toEqual(run);
    },
  );

  it.each(CHALLENGE_GARDENS)(
    "$title cannot be won by simply opening the hive",
    (level) => {
      let run = applyCommand(level, createRun(level), { type: "start" });
      while (run.tick < 1800 && run.phase !== "finished")
        run = stepRun(level, run);
      expect(run.won).toBe(false);
    },
  );
  it.each([0, 1, 2, 4, 5])(
    "garden %i fails its recorded route when a setup action is omitted",
    (index) => {
      const level = CHALLENGE_GARDENS[index];
      for (let omitted = 0; omitted < routes[index].setup.length; omitted++) {
        let run = createRun(level);
        routes[index].setup.forEach((action, slot) => {
          if (slot !== omitted) run = applyCommand(level, run, action);
        });
        run = applyCommand(level, run, { type: "start" });
        for (const objectId of routes[index].release) {
          const deadline = run.tick + 1500;
          while (
            run.tick < deadline &&
            run.phase !== "finished" &&
            populationCounts(run).rescued <
              level.population - populationCounts(run).assigned
          )
            run = stepRun(level, run);
          run = applyCommand(level, run, { type: "release", objectId });
        }
        for (let tick = 0; tick < 1500 && run.phase !== "finished"; tick++)
          run = stepRun(level, run);
        expect(
          run.won,
          `Omitted ${JSON.stringify(routes[index].setup[omitted])}`,
        ).toBe(false);
      }
    },
  );
  it("Two Doors traps the first operator if the second is rescued first", () => {
    const level = CHALLENGE_GARDENS[2];
    let run = createRun(level);
    routes[2].setup.forEach((action) => {
      run = applyCommand(level, run, action);
    });
    run = applyCommand(level, run, { type: "start" });
    for (const objectId of ["switch-2", "switch-1", "guide"]) {
      const deadline = run.tick + 1600;
      while (
        run.tick < deadline &&
        run.phase !== "finished" &&
        populationCounts(run).rescued <
          level.population - populationCounts(run).assigned
      )
        run = stepRun(level, run);
      run = applyCommand(level, run, { type: "release", objectId });
    }
    for (let tick = 0; tick < 1600 && run.phase !== "finished"; tick++)
      run = stepRun(level, run);
    expect(run.won).toBe(false);
    expect(populationCounts(run).rescued).toBeLessThan(level.population);
  });
});
