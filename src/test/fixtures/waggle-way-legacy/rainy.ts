import { editLevel, updateObject } from "../../../../packages/waggle-way/src/core/editor";
import { begin, piece, exported } from "../../../../packages/waggle-way/src/content/authoring";
import type { CampaignPuzzle } from "./campaign";
import type { CampaignSolution } from "./solutions";
import type { RecordedCommand } from "../../../../packages/waggle-way/src/core/engine";

function betweenShowers() {
  let e = begin(
    19,
    "Between Showers",
    "Gather at the rally. Watch the sprinkler forecast, then release the hive at the beginning of a dry interval. Pause gives you time to plan.",
    "rainy",
    4,
  );
  e = piece(e, "rally", 6, 7);
  e = piece(e, "sprinkler", 10, 2, {
    width: 2,
    range: 8,
    cycle: { dryTicks: 300, warningTicks: 30, wetTicks: 240, offsetTicks: 330 },
  });
  return exported(e);
}
function underALeaf() {
  let e = begin(
    20,
    "Under a Leaf",
    "Place the supplied leaf above the crossing. It blocks the falling rain, keeping the space below dry while bees fly through.",
    "rainy",
    4,
  );
  e = piece(e, "sprinkler", 10, 2, {
    width: 5,
    range: 9,
    cycle: { dryTicks: 30, warningTicks: 30, wetTicks: 900, offsetTicks: 60 },
  });
  e = editLevel(e, {
    ...e.level,
    guideLimit: 0,
    inventory: [
      {
        id: "canopy",
        kind: "shelter",
        count: 1,
        width: 5,
        height: 1,
        direction: 0,
        range: 2,
        strength: 1,
      },
    ],
  });
  return exported(e);
}
function waitForEveryone() {
  let e = begin(
    21,
    "Wait for Everyone",
    "The rally waits beneath a leaf while rain falls beside it. Gather all six bees before sending the long line across in the next dry interval.",
    "rainy",
    4,
  );
  e = editLevel(e, { ...e.level, releaseInterval: 60 });
  e = piece(e, "rally", 7, 7);
  e = piece(e, "sprinkler", 6, 1, {
    width: 9,
    range: 10,
    cycle: { dryTicks: 450, warningTicks: 30, wetTicks: 480, offsetTicks: 480 },
  });
  e = piece(e, "shelter", 6, 5, { width: 3, permission: "fixed" });
  return exported(e);
}
function oneMoreTrip() {
  let e = begin(
    22,
    "One More Trip",
    "Use two dancers to reach the rally. Send the first group across, then bring both helpers to the rally and wait for another dry crossing.",
    "rainy",
    4,
  );
  e = updateObject(e, "hive", { y: 9 });
  e = updateObject(e, "flowers", { x: 20, y: 2, width: 2, height: 9 });
  e = piece(e, "perch", 7, 9, { direction: 6, range: 2 });
  e = piece(e, "perch", 7, 3, { direction: 0, range: 2 });
  e = piece(e, "rally", 10, 2, { height: 4 });
  e = piece(e, "sprinkler", 12, 0, {
    width: 2,
    range: 12,
    cycle: { dryTicks: 240, warningTicks: 30, wetTicks: 270, offsetTicks: 270 },
  });
  return exported(e);
}
function dryDetour() {
  let e = begin(
    23,
    "A Dry Detour",
    "Choose a direct timed crossing or guide the hive down beneath the fixed canopy. The lower route takes more helpers but stays dry throughout the cycle.",
    "rainy",
    4,
  );
  e = updateObject(e, "flowers", { y: 7, height: 6 });
  e = piece(e, "rally", 6, 7);
  e = piece(e, "perch", 8, 7, { direction: 2, range: 1 });
  e = piece(e, "perch", 8, 11, { direction: 0, range: 2 });
  e = piece(e, "sprinkler", 10, 0, {
    width: 5,
    range: 12,
    cycle: { dryTicks: 330, warningTicks: 30, wetTicks: 330, offsetTicks: 360 },
  });
  e = piece(e, "shelter", 9, 9, { width: 7, permission: "fixed" });
  return exported(e);
}
function rainCheck() {
  let e = begin(
    24,
    "Rain Check",
    "Open the gate and gather before the sprinkler. Time the group crossing, then send the operator home along the high route above the rain.",
    "rainy",
    4,
  );
  e = updateObject(e, "flowers", { y: 2, height: 9 });
  e = piece(e, "switch", 12, 3);
  e = piece(e, "gate", 9, 6, { height: 3 });
  e = piece(e, "rally", 13, 7);
  e = piece(e, "sprinkler", 16, 4, {
    width: 2,
    range: 7,
    cycle: { dryTicks: 300, warningTicks: 30, wetTicks: 360, offsetTicks: 330 },
  });
  return exported(e);
}
const levels = [
  betweenShowers(),
  underALeaf(),
  waitForEveryone(),
  oneMoreTrip(),
  dryDetour(),
  rainCheck(),
];
const lessons = [
  "Read a predictable rain cycle",
  "Create a dry crossing",
  "Shelter the waiting hive",
  "Give helpers their own crossing",
  "Compare a timed route and a sheltered detour",
  "Combine a gate, rally and rain",
];
const hints = [
  [
    "Open the hive and let six bees gather at the rally.",
    "The first rain ends at tick 240. Release the rally as the dry phase begins.",
  ],
  [
    "Place the canopy at column 10, row 5 before opening the hive.",
    "The leaf covers all five rain columns. Bees pass through the protected space below.",
  ],
  [
    "The fixed leaf keeps the rally dry. Wait until all six bees are gathered.",
    "Release at tick 480, as the next dry interval begins. The last bee needs enough time to clear the wide shower.",
  ],
  [
    "Assign both guides. They point Up, then Right. Let the first group reach the rally.",
    "Release the rally at tick 270, then choose Hold arrivals after that group leaves.",
    "Release the lower guide, then the upper one. Gather both and release them at the next dry interval, tick 810.",
  ],
  [
    "For the direct route, leave both guides empty. Release the rally at tick 330.",
    "For the sheltered route, assign both guides and release the rally immediately. The first dancer points Down and the lower one Right.",
    "On the lower route, release the upper guide before the lower guide so every helper passes beneath the canopy.",
  ],
  [
    "Assign the switch operator before opening the hive. The other bees gather beyond the gate.",
    "Release the rally when the sprinkler becomes dry at tick 360.",
    "The operator's Right arrow points above the sprinkler. Bring it home after the swarm crosses.",
  ],
];
export const RAINY_CAMPAIGN: readonly CampaignPuzzle[] = levels.map(
  (level, index) => ({
    number: index + 19,
    garden: "Rainy Garden",
    lesson: lessons[index],
    hints: hints[index],
    level,
  }),
);
const action = (
  tick: number,
  command: RecordedCommand["command"],
): RecordedCommand => ({ tick, command });
const start = action(0, { type: "start" });
const assign = (objectId: string) => action(0, { type: "assign", objectId });
const release = (objectId: string, tick: number) =>
  action(tick, { type: "release", objectId });
const rally = (tick: number, mode: "hold" | "release" = "release") =>
  action(tick, { type: "rally", objectId: "rally-1", mode });
export const RAINY_SOLUTIONS: readonly CampaignSolution[] = [
  {
    levelId: "rainy-19",
    name: "First dry interval",
    minimumRescued: 6,
    actions: [start, rally(240)],
  },
  {
    levelId: "rainy-20",
    name: "Canopy over the crossing",
    minimumRescued: 6,
    actions: [
      action(0, {
        type: "place",
        stockId: "canopy",
        objectId: "placed-canopy",
        x: 10,
        y: 5,
      }),
      start,
    ],
  },
  {
    levelId: "rainy-21",
    name: "A dry window for the full line",
    minimumRescued: 6,
    actions: [start, rally(480)],
  },
  {
    levelId: "rainy-22",
    name: "Two crossings include both dancers",
    minimumRescued: 6,
    actions: [
      assign("perch-1"),
      assign("perch-2"),
      start,
      rally(270),
      rally(450, "hold"),
      release("perch-1", 600),
      release("perch-2", 700),
      rally(810),
    ],
  },
  {
    levelId: "rainy-23",
    name: "Direct timed route",
    minimumRescued: 6,
    actions: [start, rally(330)],
  },
  {
    levelId: "rainy-23",
    name: "Longer sheltered route",
    minimumRescued: 6,
    actions: [
      assign("perch-1"),
      assign("perch-2"),
      start,
      rally(0),
      release("perch-1", 450),
      release("perch-2", 650),
    ],
  },
  {
    levelId: "rainy-24",
    name: "Gate crossing and a dry operator exit",
    minimumRescued: 6,
    actions: [assign("switch-1"), start, rally(360), release("switch-1", 600)],
  },
];
