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
    [12, 15],
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
  if (index === 18)
    return [
      { type: "assign", objectId: "switch-1" },
      { type: "assign", objectId: "switch-2" },
      place("lift-dancer", "first-lift", 22, 30),
      place("lift-dancer", "second-lift", 31, 30),
      place("leaf-cover", "cover-0", 11, 17),
      place("leaf-cover", "cover-1", 27, 17),
    ];
  if (index === 17)
    return [
      { type: "assign", objectId: "switch-1" },
      { type: "assign", objectId: "switch-2" },
      place("lift-dancer", "lift-helper", 24, 28),
      place("leaf-cover", "cover-0", 11, 15),
    ];
  if (index === 13)
    return [
      place("right-dancer", "return-turn", 8, 24),
      place("lift-dancer", "lift-helper", 9, 15),
      place("right-dancer", "upper-turn", 9, 5),
      place("left-dancer", "final-turn", 39, 6),
    ];
  if (index === 9)
    return [
      place("lift-dancer", "lift-helper", 14, 24),
      place("left-dancer", "guide-0", 34, 24),
      place("leaf-cover", "cover-0", 5, 12),
    ];
  if (index === 11)
    return [
      { type: "assign", objectId: "switch-1" },
      { type: "assign", objectId: "switch-2" },
      place("left-dancer", "guide-0", 25, 24),
      place("right-dancer", "guide-1", 24, 9),
      place("leaf-cover", "cover-0", 12, 11),
    ];
  if (index === 2)
    return [
      { type: "assign", objectId: "switch-1" },
      place("left-dancer", "guide-0", 16, 18),
      place("lift-dancer", "lift-helper", 14, 12),
      place("right-dancer", "guide-1", 15, 4),
    ];
  if (index === 5)
    return [
      { type: "assign", objectId: "switch-1" },
      { type: "assign", objectId: "switch-2" },
      place("left-dancer", "guide-0", 25, 22),
      place("right-dancer", "guide-1", 24, 7),
    ];
  if (index === 16)
    return [
      { type: "assign", objectId: "switch-1" },
      place("lift-dancer", "first-lift", 14, 20),
      place("lift-dancer", "second-lift", 23, 20),
      place("left-dancer", "last-turn", 34, 20),
      place("leaf-cover", "cover", 19, 7),
    ];
  if (index === 12)
    return [
      { type: "assign", objectId: "switch-1" },
      place("lift-dancer", "lift-helper", 16, 20),
    ];
  if (index === 14)
    return [
      place("lift-dancer", "lift-helper", 13, 20),
      place("left-dancer", "guide-0", 32, 20),
    ];
  const commands: RunCommand[] = level.objects
    .filter((o) => o.kind === "switch")
    .map((o) => ({ type: "assign", objectId: o.id }));
  if (index === 0) commands.push(place("lift-dancer", "lift-helper", 4, 16));
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
  fault?: "early-cover" | "release-uncovered" | "never-move" | "wide-climb",
  helperOrder?: string[],
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
  if (helperOrder) order = helperOrder;
  const until = (predicate: (state: RunState) => boolean) => {
    const deadline = run.tick + 1800;
    while (!predicate(run) && run.tick < deadline && run.phase !== "finished")
      run = stepRun(level, run);
    return predicate(run);
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
  if (index === 18) {
    const waitingAt = (id: string, count: number) => (state: RunState) =>
      state.bees.filter((bee) => bee.status === "waiting" && bee.perchId === id)
        .length === count;
    if (!until(waitingAt("rally-1", 4))) return run;
    if (fault === "early-cover")
      dynamicCommand({ type: "move", objectId: "cover-0", x: 44, y: 1 });
    let gathered = 4;
    for (const objectId of order) {
      dynamicCommand({ type: "release", objectId });
      if (!until(waitingAt("rally-1", ++gathered))) return run;
    }
    if (fault !== "never-move" && fault !== "early-cover")
      dynamicCommand({ type: "move", objectId: "cover-0", x: 44, y: 1 });
    dynamicCommand(place("left-dancer", "climb", 40, 29));
    dynamicCommand({ type: "rally", objectId: "rally-1", mode: "release" });
    if (!until(waitingAt("rally-2", 7))) return run;
    dynamicCommand({ type: "release", objectId: "climb" });
    if (!until(waitingAt("rally-2", 8))) return run;
    dynamicCommand(place("lift-dancer", "last-lift", 40, 13));
    dynamicCommand({ type: "rally", objectId: "rally-2", mode: "release" });
    if (!until(waitingAt("rally-3", 7))) return run;
    dynamicCommand({ type: "release", objectId: "last-lift" });
    if (!until(waitingAt("rally-3", 8))) return run;
    dynamicCommand(place("right-dancer", "final-turn", 41, 5));
    dynamicCommand({ type: "rally", objectId: "rally-3", mode: "release" });
    order = ["final-turn"];
  }
  if (index === 17) {
    const waitingAt = (id: string, count: number) => (state: RunState) =>
      state.bees.filter((bee) => bee.status === "waiting" && bee.perchId === id)
        .length === count;
    if (!until(waitingAt("rally-1", 5))) return run;
    if (fault === "early-cover")
      dynamicCommand({ type: "move", objectId: "cover-0", x: 37, y: 3 });
    let gathered = 5;
    for (const objectId of order.filter((id) => id.startsWith("switch"))) {
      dynamicCommand({ type: "release", objectId });
      if (!until(waitingAt("rally-1", ++gathered))) return run;
    }
    if (fault !== "never-move" && fault !== "early-cover")
      dynamicCommand({ type: "move", objectId: "cover-0", x: 37, y: 3 });
    dynamicCommand({ type: "rally", objectId: "rally-1", mode: "release" });
    if (!until(waitingAt("rally-2", 7))) return run;
    dynamicCommand({ type: "release", objectId: "lift-helper" });
    if (!until(waitingAt("rally-2", 8))) return run;
    dynamicCommand(
      place(
        "left-dancer",
        "climb",
        fault === "wide-climb" ? 33 : 32,
        fault === "wide-climb" ? 28 : 27,
      ),
    );
    dynamicCommand({ type: "rally", objectId: "rally-2", mode: "release" });
    if (!until(waitingAt("rally-3", 7))) return run;
    dynamicCommand({ type: "release", objectId: "climb" });
    if (!until(waitingAt("rally-3", 8))) return run;
    dynamicCommand(place("right-dancer", "final-turn", 33, 11));
    dynamicCommand({ type: "rally", objectId: "rally-3", mode: "release" });
    order = ["final-turn"];
  }
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
  if (index === 5) {
    const allFreeWaiting = (state: RunState) =>
      populationCounts(state).waiting ===
      level.population - populationCounts(state).assigned;
    until(allFreeWaiting);
    for (const objectId of order) {
      dynamicCommand({ type: "release", objectId });
      until(allFreeWaiting);
    }
    dynamicCommand(place("left-dancer", "final-turn", 35, 8));
    dynamicCommand({ type: "rally", objectId: "rally-1", mode: "release" });
    order = ["final-turn"];
  }
  if (index === 11) {
    const allFreeWaiting = (state: RunState) =>
      populationCounts(state).waiting ===
      level.population - populationCounts(state).assigned;
    until(allFreeWaiting);
    if (fault === "early-cover")
      dynamicCommand({ type: "move", objectId: "cover-0", x: 29, y: 2 });
    for (const objectId of order) {
      dynamicCommand({ type: "release", objectId });
      until(allFreeWaiting);
    }
    if (fault !== "never-move" && fault !== "early-cover")
      dynamicCommand({ type: "move", objectId: "cover-0", x: 29, y: 2 });
    dynamicCommand({ type: "rally", objectId: "rally-1", mode: "release" });
    until(
      (state) =>
        state.bees.filter(
          (bee) => bee.status === "waiting" && bee.perchId === "rally-2",
        ).length === 8,
    );
    dynamicCommand(place("left-dancer", "final-turn", 37, 10));
    dynamicCommand({ type: "rally", objectId: "rally-2", mode: "release" });
    order = ["final-turn"];
  }
  if (index === 12) {
    const waitingAt = (id: string, count: number) => (state: RunState) =>
      state.bees.filter((bee) => bee.status === "waiting" && bee.perchId === id)
        .length === count;
    until(waitingAt("rally-1", 6));
    dynamicCommand({ type: "release", objectId: "switch-1" });
    until(waitingAt("rally-1", 7));
    dynamicCommand({ type: "rally", objectId: "rally-1", mode: "release" });
    until(waitingAt("rally-2", 7));
    dynamicCommand({ type: "release", objectId: "lift-helper" });
    until(waitingAt("rally-2", 8));
    dynamicCommand(place("left-dancer", "guide-0", 25, 20));
    dynamicCommand({ type: "rally", objectId: "rally-2", mode: "release" });
    order = ["guide-0"];
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

it("Mind the Branch resists two-turn routes across the partition gap and its edges", () => {
  const level = ADVANCED_GARDENS[1];
  let checked = 0;
  for (const x of [7, 8, 9, 10, 11])
    for (const y of [19, 20, 21])
      for (const crossing of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
        const actions = [
          place("left-dancer", "first", x, y),
          place("right-dancer", "second", x - 1, crossing),
        ];
        const preview = actions.reduce(
          (state, action) => applyCommand(level, state, action),
          createRun(level),
        );
        if (preview.commands.length !== actions.length) continue;
        checked++;
        expect(
          solve(1, -1, actions).won,
          `first ${x},${y}; crossing ${crossing}`,
        ).toBe(false);
      }
  expect(checked).toBeGreaterThan(100);
}, 30000);

it("Crosswinds shifts the hive out of the departure lane without turning its heading", () => {
  const level = ADVANCED_GARDENS[7];
  let run = createRun(level);
  for (const action of setup(7)) run = applyCommand(level, run, action);
  run = applyCommand(level, run, { type: "start" });
  while (
    run.tick < 500 &&
    !run.bees.some((bee) => bee.status === "flying" && bee.x > 9500)
  )
    run = stepRun(level, run);
  const shifted = run.bees.find(
    (bee) => bee.status === "flying" && bee.x > 9500,
  )!;
  expect(shifted).toBeDefined();
  expect(shifted.direction).toBe(0);
  expect(shifted.y).toBeLessThan(16000);
  expect(shifted.y).toBeGreaterThan(14000);
  const wrongLane = setup(7).map((action): RunCommand =>
    action.type === "place" && action.objectId === "guide-0"
      ? { ...action, y: 20 }
      : action,
  );
  expect(solve(7, -1, wrongLane).won).toBe(false);
});

it("Rooftop Relay requires freeing a helper job before building the final turn", () => {
  const level = ADVANCED_GARDENS[5];
  let run = createRun(level);
  for (const action of setup(5)) run = applyCommand(level, run, action);
  expect(populationCounts(run).assigned).toBe(4);
  const premature = applyCommand(
    level,
    run,
    place("left-dancer", "final-turn", 35, 8),
  );
  expect(premature.commands).toEqual(run.commands);
  expect(premature.objects.some((object) => object.id === "final-turn")).toBe(
    false,
  );
  const completed = solve(5);
  expect(completed.won).toBe(true);
  const recruitment = completed.commands.find(
    ({ command }) =>
      command.type === "place" && command.objectId === "final-turn",
  );
  expect(recruitment?.tick).toBeGreaterThan(0);
});

it("Rooftop Relay strands the first operator behind the second shutter if released backwards", () => {
  const run = solve(5, -1, setup(5), true);
  expect(run.won).toBe(false);
  expect(populationCounts(run).lost).toBe(0);
  expect(run.bees.some((bee) => bee.status === "flying" && bee.x < 15000)).toBe(
    true,
  );
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
  const rescueOnly = solve(index);
  expect(rescueOnly.won).toBe(true);
  expect(pollenCounts(rescueOnly)).toEqual({
    available: 1,
    carried: 0,
    delivered: 0,
  });
  const pollenRoute = setup(index).map((action): RunCommand =>
    action.type === "place" && action.objectId === "guide-1"
      ? { ...action, y: 14 }
      : action.type === "place" && action.objectId === "guide-2"
        ? { ...action, y: 15 }
        : action,
  );
  const run = solve(index, -1, pollenRoute);
  expect(run.won).toBe(true);
  expect(populationCounts(run).rescued).toBe(level.population);
  expect(pollenCounts(run)).toEqual({ available: 0, carried: 0, delivered: 1 });
  expect(pollenCounts(run).delivered).toBe(level.objectives?.pollen);
  expect(replayRun(level, captureReplay(level, run))).toEqual(run);
});

it("High Road, Low Road offers a shorter lift route and a separate pollen route", () => {
  const level = ADVANCED_GARDENS[14];
  const high = solve(14);
  const low = solve(14, -1, [
    place("left-dancer", "guide-0", 12, 20),
    place("right-dancer", "guide-1", 11, 6),
    place("left-dancer", "guide-2", 32, 7),
  ]);
  expect(high.won).toBe(true);
  expect(low.won).toBe(true);
  expect(pollenCounts(high).delivered).toBe(0);
  expect(pollenCounts(low).delivered).toBe(1);
  expect(high.peakToolsPlaced).toBe(2);
  expect(low.peakToolsPlaced).toBe(3);
  expect(replayRun(level, captureReplay(level, low))).toEqual(low);
});

it("The Long Way Home trades an extra turn and sheltered crossing for pollen", () => {
  const level = ADVANCED_GARDENS[9];
  const short = solve(9);
  const long = solve(9, -1, [
    place("left-dancer", "guide-0", 13, 24),
    place("right-dancer", "guide-1", 12, 10),
    place("left-dancer", "guide-2", 34, 11),
    place("leaf-cover", "cover-0", 5, 12),
    place("leaf-cover", "cover-1", 21, 2),
  ]);
  expect(short.won).toBe(true);
  expect(long.won).toBe(true);
  expect(pollenCounts(short).delivered).toBe(0);
  expect(pollenCounts(long).delivered).toBe(1);
  expect(short.peakToolsPlaced).toBe(3);
  expect(long.peakToolsPlaced).toBe(5);
  expect(replayRun(level, captureReplay(level, long))).toEqual(long);
});

it("Pipework's return dancer must catch westbound bees behind the hive", () => {
  const actions = setup(13).map((action): RunCommand =>
    action.type === "place" && action.objectId === "return-turn"
      ? { ...action, x: 16 }
      : action,
  );
  const run = solve(13, -1, actions);
  expect(run.won).toBe(false);
  expect(
    run.bees.some(
      (bee) => bee.status === "lost" && bee.direction === 2 && bee.y > 28000,
    ),
  ).toBe(true);
});

it("Shelter the Swarm exposes the upper helper when its roof is placed too low", () => {
  const actions = setup(6).map((action): RunCommand =>
    action.type === "place" && action.stockId === "leaf-cover"
      ? { ...action, y: 10 }
      : action,
  );
  const run = solve(6, -1, actions);
  expect(run.won).toBe(false);
  expect(run.bees.find((bee) => bee.id === 1)).toMatchObject({
    status: "lost",
    lossReason: "rain",
  });
});

it("High Road, Low Road rejects a lift that starts too early for the wide obstacle", () => {
  const run = solve(14, -1, [
    place("lift-dancer", "lift-helper", 12, 20),
    place("left-dancer", "guide-0", 32, 20),
  ]);
  expect(run.won).toBe(false);
  expect(run.bees.some((bee) => bee.lossReason === "landing")).toBe(true);
});

it("The Last Dancer strands the first lift helper if the second lift leaves first", () => {
  const run = solve(16, -1, setup(16), false, undefined, [
    "switch-1",
    "second-lift",
    "first-lift",
    "last-turn",
  ]);
  expect(run.won).toBe(false);
  expect(populationCounts(run).lost).toBe(0);
  expect(
    run.bees.some(
      (bee) => bee.status === "flying" && bee.x > 18000 && bee.x < 25000,
    ),
  ).toBe(true);
});

it("Field of Flowers keeps the second lift until the first lift helper escapes", () => {
  const run = solve(18, -1, setup(18), false, undefined, [
    "switch-1",
    "switch-2",
    "second-lift",
    "first-lift",
  ]);
  expect(run.won).toBe(false);
  expect(populationCounts(run).lost).toBe(0);
  expect(
    run.bees.some(
      (bee) => bee.status === "flying" && bee.x > 26000 && bee.x < 33000,
    ),
  ).toBe(true);
});

it("All Together needs the climb helper's lane to meet the upper rally", () => {
  const run = solve(17, -1, setup(17), false, "wide-climb");
  expect(run.won).toBe(false);
  expect(populationCounts(run).waiting).toBe(7);
  expect(
    run.bees.some(
      (bee) => bee.status === "lost" && bee.x === 33500 && bee.y < 0,
    ),
  ).toBe(true);
});

it("Bring Everyone needs the lift to remain until the first turn helper crosses", () => {
  const run = solve(2, -1, setup(2), false, undefined, [
    "switch-1",
    "lift-helper",
    "guide-0",
    "guide-1",
  ]);
  expect(run.won).toBe(false);
  expect(populationCounts(run).rescued).toBe(7);
  // The first turn helper has no lift, bounces south off the low crossbeam,
  // and exits the bottom boundary; it does not fail a placement command.
  expect(run.bees.find((bee) => bee.id === 1)).toMatchObject({
    status: "lost",
    direction: 2,
  });
  expect(run.bees.find((bee) => bee.id === 1)!.y).toBeGreaterThan(22000);
});

it.each([
  {
    index: 17,
    fault: "early-cover" as const,
    decision:
      "protects the upstream operator before the all-together roof transfer",
  },
  {
    index: 17,
    fault: "never-move" as const,
    decision: "protects the all-together final flight with the reused roof",
  },
  {
    index: 18,
    fault: "early-cover" as const,
    decision: "protects the final campaign operators during their escape",
  },
  {
    index: 18,
    fault: "never-move" as const,
    decision: "transfers a roof to the last campaign spray lane",
  },
  {
    index: 11,
    fault: "early-cover" as const,
    decision:
      "keeps the first storm curtain covered for the returning operators",
  },
  {
    index: 11,
    fault: "never-move" as const,
    decision: "moves the only roof before the second storm crossing",
  },
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
