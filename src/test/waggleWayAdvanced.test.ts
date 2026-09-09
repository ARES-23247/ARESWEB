import { describe, expect, it } from "vitest";
import { ADVANCED_GARDENS } from "../../packages/waggle-way/src/content/advanced";
import {
  applyCommand,
  createRun,
  populationCounts,
  pollenCounts,
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
// Centers deliberately overlap the swarm and released helpers' parallel approach lanes.
const routes = [
  [
    [10, 16],
    [9, 4],
  ],
  [
    [10, 20],
    [9, 6],
    [28, 7],
  ],
  [
    [16, 18],
    [15, 4],
  ],
  [
    [10, 22],
    [9, 8],
    [25, 9],
    [24, 3],
  ],
  [
    [8, 18],
    [9, 4],
  ],
  [
    [25, 22],
    [24, 7],
    [36, 8],
  ],
  [
    [12, 18],
    [11, 4],
  ],
  [
    [12, 20],
    [11, 6],
    [30, 7],
  ],
  [
    [17, 20],
    [16, 4],
  ],
  [
    [13, 24],
    [12, 10],
    [34, 11],
  ],
  [
    [16, 22],
    [15, 4],
  ],
  [
    [25, 24],
    [24, 9],
    [38, 10],
  ],
  [[39, 20]],
  [
    [12, 26],
    [11, 12],
    [29, 13],
    [28, 3],
  ],
  [
    [34, 24],
    [33, 4],
  ],
  [
    [12, 26],
    [11, 12],
    [30, 13],
    [29, 3],
  ],
  [
    [35, 26],
    [34, 4],
  ],
  [
    [33, 28],
    [32, 10],
    [44, 11],
  ],
  [
    [32, 30],
    [31, 15],
    [41, 16],
    [40, 3],
  ],
];
function setup(index: number): RunCommand[] {
  const level = ADVANCED_GARDENS[index];
  const commands: RunCommand[] = level.objects
    .filter((o) => o.kind === "switch")
    .map((o) => ({ type: "assign", objectId: o.id }));
  routes[index].forEach(([x, y], slot) =>
    commands.push(
      place(
        `${index === 4 || slot % 2 === 1 ? "right" : "left"}-dancer`,
        `guide-${slot}`,
        x,
        y,
      ),
    ),
  );
  level.objects
    .filter((o) => o.kind === "sprinkler")
    .slice(
      index === 10 ? 1 : 0,
      (index === 10 ? 1 : 0) +
        (level.inventory!.find((tool) => tool.id === "leaf-cover")?.count ?? 0),
    )
    .forEach((o, slot) =>
      commands.push(place("leaf-cover", `cover-${slot}`, o.x, o.y + 1)),
    );
  level.objects
    .filter((o) => o.kind === "rally" && index !== 8 && index !== 10)
    .forEach((o) =>
      commands.push({ type: "rally", objectId: o.id, mode: "release" }),
    );
  return commands;
}
function solve(
  index: number,
  omitted = -1,
  actions = setup(index),
  reverseRelease = false,
  fault?: "early-cover" | "release-uncovered" | "never-move",
) {
  const level = ADVANCED_GARDENS[index];
  let run = createRun(level);
  actions.forEach((action, slot) => {
    if (slot === omitted) return;
    const before = run.commands.length;
    run = applyCommand(level, run, action);
    if (omitted === -1)
      expect(
        run.commands.length,
        `${level.title}: ${JSON.stringify(action)} ${run.notice}`,
      ).toBe(before + 1);
  });
  run = applyCommand(level, run, { type: "start" });
  const release = actions
    .filter(
      (action) =>
        action.type === "assign" ||
        (action.type === "place" && action.stockId.endsWith("-dancer")),
    )
    .map((action) => ("objectId" in action ? action.objectId : ""));
  const operators = actions
    .filter((action) => action.type === "assign")
    .map((action) => action.objectId);
  let order = reverseRelease
    ? [
        ...operators.toReversed(),
        ...release.filter((id) => !operators.includes(id)),
      ]
    : release;
  const until = (predicate: (state: RunState) => boolean) => {
    const deadline = run.tick + 1800;
    while (!predicate(run) && run.tick < deadline && run.phase !== "finished")
      run = stepRun(level, run);
  };
  const dynamicCommand = (action: RunCommand) => {
    const before = run.commands.length;
    run = applyCommand(level, run, action);
    if (
      omitted === -1 &&
      !fault &&
      actions.filter(
        (action) =>
          action.type === "place" && action.stockId.endsWith("-dancer"),
      ).length === routes[index].length
    )
      expect(run.commands.length, JSON.stringify(action) + run.notice).toBe(
        before + 1,
      );
  };
  if (index === 8) {
    until(
      (state) =>
        populationCounts(state).waiting ===
        level.population - populationCounts(state).assigned,
    );
    if (fault === "early-cover") {
      dynamicCommand({ type: "move", objectId: "cover-0", x: 22, y: 1 });
      // Leave the assigned operator exposed for one full spray cycle.
      for (let tick = 0; tick < 270; tick++) run = stepRun(level, run);
    }
    dynamicCommand({ type: "release", objectId: "switch-1" });
    until(
      (state) =>
        populationCounts(state).waiting ===
        level.population - populationCounts(state).assigned,
    );
    if (fault !== "never-move" && fault !== "early-cover")
      dynamicCommand({ type: "move", objectId: "cover-0", x: 22, y: 1 });
    dynamicCommand({ type: "rally", objectId: "rally-1", mode: "release" });
    order = order.filter((id) => id !== "switch-1");
  }
  if (index === 10) {
    until(
      (state) =>
        populationCounts(state).waiting ===
        level.population - populationCounts(state).assigned,
    );
    if (fault === "early-cover")
      dynamicCommand({ type: "move", objectId: "cover-0", x: 28, y: 1 });
    for (const id of order) {
      dynamicCommand({ type: "release", objectId: id });
      until(
        (state) =>
          populationCounts(state).waiting ===
          level.population - populationCounts(state).assigned,
      );
    }
    if (
      fault !== "never-move" &&
      fault !== "release-uncovered" &&
      fault !== "early-cover"
    )
      dynamicCommand({ type: "move", objectId: "cover-0", x: 28, y: 1 });
    dynamicCommand({ type: "rally", objectId: "rally-1", mode: "release" });
    order = [];
  }
  for (const objectId of order) {
    const deadline = run.tick + 1800;
    while (
      run.tick < deadline &&
      run.phase !== "finished" &&
      populationCounts(run).rescued <
        level.population - populationCounts(run).assigned
    )
      run = stepRun(level, run);
    run = applyCommand(level, run, { type: "release", objectId });
  }
  const deadline = run.tick + 1800;
  while (run.tick < deadline && run.phase !== "finished" && !run.won)
    run = stepRun(level, run);
  return run;
}
describe("advanced converted gardens", () => {
  it.each(ADVANCED_GARDENS.map((level, index) => ({ level, index })))(
    "$level.title has an all-bees replayable solution",
    ({ level, index }) => {
      expect(parseLevelFile(serializeLevel(level))).toEqual(level);
      const run = solve(index);
      expect(
        run.won,
        JSON.stringify({
          index,
          tick: run.tick,
          counts: populationCounts(run),
          bees: run.bees,
        }),
      ).toBe(true);
      expect(populationCounts(run).rescued).toBe(8);
      expect(replayRun(level, captureReplay(level, run))).toEqual(run);
    },
  );
});

describe("advanced route challenge checks", () => {
  it.each(ADVANCED_GARDENS.map((level, index) => ({ level, index })))(
    "$level.title does not rescue itself",
    ({ level }) => {
      let run = applyCommand(level, createRun(level), { type: "start" });
      while (run.tick < 2400 && run.phase !== "finished")
        run = stepRun(level, run);
      expect(run.won).toBe(false);
    },
  );
  it.each(ADVANCED_GARDENS.map((level, index) => ({ level, index })))(
    "$level.title needs every route placement and operator",
    ({ level, index }) => {
      setup(index).forEach((action, omitted) => {
        if (action.type === "rally") return;
        expect(
          solve(index, omitted).won,
          `${level.title}: omitted ${JSON.stringify(action)}`,
        ).toBe(false);
      });
    },
  );
});

it("Garden Route blocks a three-dancer shortcut through its former overlapping openings", () => {
  const run = solve(3, -1, [
    place("left-dancer", "a", 10, 22),
    place("right-dancer", "b", 9, 7),
    place("left-dancer", "c", 34, 8),
  ]);
  expect(run.won).toBe(false);
});

it.each(
  ADVANCED_GARDENS.map((level, index) => ({ level, index })).filter(
    ({ index }) => index !== 12,
  ),
)(
  "$level.title cannot be reduced to one dancer on the departure row",
  ({ level, index }) => {
    const base = setup(index).filter(
      (action) =>
        action.type !== "place" || !action.stockId.endsWith("-dancer"),
    );
    const hive = level.objects.find((object) => object.kind === "hive")!;
    for (const stock of level.inventory!.filter(
      (tool) => tool.kind === "dancer",
    )) {
      for (let x = 0; x < level.width; x++) {
        const action = place(stock.id, "solo", x, hive.y);
        const initial = createRun(level);
        const placed = applyCommand(level, initial, action);
        if (placed.commands.length === 0) continue;
        expect(
          solve(index, -1, [...base, action]).won,
          `${level.title}: ${stock.id} at ${x},${hive.y}`,
        ).toBe(false);
      }
    }
  },
  30000,
);

it.each(
  ADVANCED_GARDENS.map((level, index) => ({ level, index })).filter(
    ({ level }) =>
      level.objects.filter((object) => object.kind === "switch").length > 1,
  ),
)(
  "$level.title cannot rescue its shutter operators in reverse order",
  ({ index }) => {
    expect(solve(index, -1, setup(index), true).won).toBe(false);
  },
);

it("Pollen on the Side can rescue all eight bees and deliver its advertised pollen goal", () => {
  const index = ADVANCED_GARDENS.findIndex(
    (level) => level.title === "Pollen on the Side",
  );
  const level = ADVANCED_GARDENS[index];
  const run = solve(index);
  expect(run.won).toBe(true);
  expect(populationCounts(run).rescued).toBe(level.population);
  expect(pollenCounts(run)).toEqual({ available: 0, carried: 0, delivered: 1 });
  expect(pollenCounts(run).delivered).toBe(level.objectives?.pollen);
  expect(replayRun(level, captureReplay(level, run))).toEqual(run);
});

it.each([
  {
    index: 8,
    fault: "early-cover" as const,
    decision: "keeps the operator sheltered until it reaches the rally",
  },
  {
    index: 8,
    fault: "never-move" as const,
    decision: "reuses the shelter for the second curtain",
  },
  {
    index: 10,
    fault: "early-cover" as const,
    decision:
      "keeps the second curtain sheltered until the route helpers have crossed",
  },
  {
    index: 10,
    fault: "release-uncovered" as const,
    decision: "shelters the final crossing before releasing the rally",
  },
])("staged route $decision", ({ index, fault }) => {
  const run = solve(index, -1, setup(index), false, fault);
  expect(run.won).toBe(false);
  expect(populationCounts(run).lost).toBeGreaterThan(0);
  expect(run.bees.some((bee) => bee.lossReason === "rain")).toBe(true);
});
