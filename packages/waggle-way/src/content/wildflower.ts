import { editLevel, updateObject, type EditorState } from "../core/editor";
import { begin, piece, exported } from "./authoring";
import type { CampaignPuzzle } from "./campaign";
import type { CampaignSolution } from "./solutions";
import type { RecordedCommand } from "../core/engine";

function valley(number: number, title: string, instructions: string) {
  let e = begin(number, title, instructions, "wildflower", 5);
  e = editLevel(e, { ...e.level, theme: "wildflower", guideLimit: 3 });
  return updateObject(e, "flowers", { x: 21, y: 1, width: 2, height: 12 });
}
function goals(e: EditorState, pollen: number, maxTools?: number) {
  return exported(
    editLevel(e, {
      ...e.level,
      objectives: { pollen, ...(maxTools === undefined ? {} : { maxTools }) },
    }),
  );
}
function pollenOnTheSide() {
  let e = valley(
    25,
    "Pollen on the Side",
    "Turn around the pond with two dancers. For the optional pollen detour, point the middle dancer up and add the top dancer. Pollen counts only when its bee reaches HOME; bring every helper home too.",
  );
  e = updateObject(e, "hive", { y: 10 });
  e = piece(e, "water", 9, 9, { width: 7, height: 3 });
  e = piece(e, "perch", 6, 10, { direction: 6, range: 1 });
  e = piece(e, "perch", 5, 5, { width: 2, range: 1 });
  e = piece(e, "perch", 5, 2, { width: 2, range: 1 });
  e = piece(e, "pollen", 12, 3);
  return goals(e, 1);
}
function twoRoads() {
  let e = valley(
    26,
    "High Road, Low Road",
    "Use the leaf to shelter the upper route from the fan, or move the second dancer below the pond and turn the first dancer down. The lower route delivers pollen without placing a supplied tool.",
  );
  e = piece(e, "perch", 6, 7, { direction: 6, range: 1 });
  e = piece(e, "perch", 5, 2, { width: 2, range: 1, permission: "movable" });
  e = piece(e, "water", 11, 5, { width: 5, height: 4 });
  e = piece(e, "fan", 12, 1, {
    direction: 2,
    range: 8,
    strength: 2,
    permission: "fixed",
  });
  e = piece(e, "pollen", 18, 11);
  e = editLevel(e, {
    ...e.level,
    inventory: [
      {
        id: "leaf",
        kind: "shelter",
        count: 1,
        width: 3,
        height: 1,
        direction: 0,
        range: 2,
        strength: 1,
      },
    ],
  });
  return goals(e, 1, 0);
}
function placeToWait() {
  let e = valley(
    27,
    "A Place to Wait",
    "Gather under the fixed leaf before crossing the gate. One pollen token lies on the swarm's route; the other is on the operator's separate exit. Release both the waiting group and the operator.",
  );
  e = piece(e, "rally", 7, 7);
  e = piece(e, "sprinkler", 6, 1, {
    width: 4,
    range: 11,
    cycle: { dryTicks: 40, warningTicks: 20, wetTicks: 900, offsetTicks: 60 },
  });
  e = piece(e, "shelter", 6, 4, { width: 4, permission: "fixed" });
  e = piece(e, "switch", 12, 2);
  e = piece(e, "gate", 13, 6, { height: 3 });
  e = piece(e, "pollen", 15, 7);
  e = piece(e, "pollen", 18, 2);
  return goals(e, 2);
}
function lastDancer() {
  let e = valley(
    28,
    "The Last Dancer",
    "Guide the swarm around the pond. To retrieve the pollen behind the upper dancer, assign the leftmost return dancer, then point the upper dancer left before releasing it. Keep the return dancer until the carrier has turned home.",
  );
  e = updateObject(e, "hive", { y: 10 });
  e = piece(e, "water", 10, 9, { width: 8, height: 3 });
  e = piece(e, "perch", 7, 10, { direction: 6, range: 1 });
  e = piece(e, "perch", 7, 3, { range: 1 });
  e = piece(e, "perch", 3, 3, { range: 1 });
  e = piece(e, "pollen", 5, 3);
  return goals(e, 1);
}
function allTogether() {
  let e = valley(
    29,
    "All Together",
    "Two operators hold two doors. Gather between them, then release through the sprinkler during a dry interval. Both operators have a separate exit above its spray, and one brings home the remaining pollen.",
  );
  e = piece(e, "rally", 6, 7);
  e = piece(e, "switch", 9, 2);
  e = piece(e, "gate", 10, 6, { height: 3 });
  e = piece(e, "rally", 13, 7);
  e = piece(e, "switch", 16, 2);
  e = piece(e, "gate", 17, 6, { height: 3, switchId: "switch-2" });
  e = piece(e, "sprinkler", 14, 3, {
    width: 2,
    range: 9,
    cycle: { dryTicks: 360, warningTicks: 30, wetTicks: 360, offsetTicks: 390 },
  });
  e = piece(e, "pollen", 12, 7);
  e = piece(e, "pollen", 19, 2);
  return goals(e, 2);
}
function fieldOfFlowers() {
  let e = valley(
    30,
    "Field of Flowers",
    "Bring everyone through two gatherings, a gate and a timed crossing. Re-hold the first rally to catch the last dancer. A supplied leaf protects the crossing; the optional zero-tool route waits for a second dry interval.",
  );
  e = updateObject(e, "hive", { y: 11 });
  e = updateObject(e, "flowers", { x: 22 });
  e = piece(e, "perch", 6, 11, { direction: 6, range: 1 });
  e = piece(e, "rally", 5, 6, { width: 2 });
  e = piece(e, "switch", 9, 2);
  e = piece(e, "gate", 10, 5, { height: 3 });
  e = piece(e, "rally", 13, 6);
  e = piece(e, "sprinkler", 16, 2, {
    width: 2,
    range: 10,
    cycle: { dryTicks: 360, warningTicks: 30, wetTicks: 360, offsetTicks: 390 },
  });
  e = piece(e, "pollen", 8, 6);
  e = piece(e, "pollen", 20, 2);
  e = piece(e, "pollen", 21, 6);
  e = editLevel(e, {
    ...e.level,
    inventory: [
      {
        id: "leaf",
        kind: "shelter",
        count: 1,
        width: 4,
        height: 1,
        direction: 0,
        range: 2,
        strength: 1,
      },
    ],
  });
  return goals(e, 3, 0);
}
const levels = [
  pollenOnTheSide(),
  twoRoads(),
  placeToWait(),
  lastDancer(),
  allTogether(),
  fieldOfFlowers(),
];
const lessons = [
  "Choose an optional pollen detour",
  "Two routes, different tool costs",
  "Pollen travels with each helper",
  "Keep a return dance for the carrier",
  "Sequence both groups and operators",
  "Give the last helper a second crossing",
];
const hints = [
  [
    "The lower dancer points up; the middle dancer can turn right for the direct route.",
    "For pollen, point the middle dancer up and assign the top dancer too.",
    "Release helpers from bottom to top after the flying group has passed.",
  ],
  [
    "A leaf at column 11, row 2 blocks the downward fan on the high route.",
    "For the low route, move the upper dancer to column 5, row 11 and point the first dancer down.",
    "The low route needs no supplied tools. Release the first dancer before the second.",
  ],
  [
    "Assign the operator before opening the hive. The fixed leaf protects the gathering.",
    "The full group has gathered by tick 260; release the rally once the gate is open.",
    "The operator points right at row 2. Its separate exit delivers the second token.",
  ],
  [
    "Use the lower and upper-right dancers for the ordinary route.",
    "Assign the upper-left return dancer for pollen. Keep the upper-right dancer pointing right until everyone else passes.",
    "Then turn it left and release it. The return dancer turns that carrier right again; release the return dancer last.",
  ],
  [
    "Assign both operators before opening the hive; release the first rally around tick 200.",
    "The next dry interval begins at tick 360. Release the second rally at tick 480, after all four flying bees arrive.",
    "Release operators after the swarm has passed both gates. Their exits stay above the spray.",
  ],
  [
    "Assign the dancer and operator. Release the first rally at tick 300, then hold it again at tick 400.",
    "Release the dancer at tick 450; release the second rally at 540, then the first again at 580.",
    "A leaf at column 15, row 4 protects every crossing. For zero tools, hold the second rally again at 660 and release at the next dry interval, tick 1110. Release the operator after the gate is clear.",
  ],
];
export const WILDFLOWER_CAMPAIGN: readonly CampaignPuzzle[] = levels.map(
  (level, index) => ({
    number: index + 25,
    garden: "Wildflower Valley",
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
const rally = (
  objectId: string,
  tick: number,
  mode: "hold" | "release" = "release",
) => action(tick, { type: "rally", objectId, mode });
const leaf = (x: number, y: number) =>
  action(0, { type: "place", stockId: "leaf", objectId: "placed-leaf", x, y });
export const WILDFLOWER_SOLUTIONS: readonly CampaignSolution[] = [
  {
    levelId: "wildflower-25",
    name: "Direct route",
    minimumRescued: 6,
    minimumPollen: 0,
    actions: [
      assign("perch-1"),
      assign("perch-2"),
      start,
      release("perch-1", 450),
      release("perch-2", 600),
    ],
  },
  {
    levelId: "wildflower-25",
    name: "Pollen detour",
    minimumRescued: 6,
    minimumPollen: 1,
    actions: [
      action(0, {
        type: "adjust",
        objectId: "perch-2",
        direction: 6,
        strength: 1,
      }),
      assign("perch-1"),
      assign("perch-2"),
      assign("perch-3"),
      start,
      release("perch-1", 500),
      release("perch-2", 650),
      release("perch-3", 800),
    ],
  },
  {
    levelId: "wildflower-26",
    name: "Sheltered high road",
    minimumRescued: 6,
    minimumPollen: 0,
    actions: [
      leaf(11, 2),
      assign("perch-1"),
      assign("perch-2"),
      start,
      release("perch-1", 600),
      release("perch-2", 800),
    ],
  },
  {
    levelId: "wildflower-26",
    name: "Low road without supplied tools",
    minimumRescued: 6,
    minimumPollen: 1,
    maximumTools: 0,
    actions: [
      action(0, { type: "move", objectId: "perch-2", x: 5, y: 11 }),
      action(0, {
        type: "adjust",
        objectId: "perch-1",
        direction: 2,
        strength: 1,
      }),
      assign("perch-1"),
      assign("perch-2"),
      start,
      release("perch-1", 600),
      release("perch-2", 800),
    ],
  },
  {
    levelId: "wildflower-27",
    name: "Two deliveries from sheltered staging",
    minimumRescued: 6,
    minimumPollen: 2,
    actions: [
      assign("switch-1"),
      start,
      rally("rally-1", 260),
      release("switch-1", 620),
    ],
  },
  {
    levelId: "wildflower-28",
    name: "Direct helper exit",
    minimumRescued: 6,
    minimumPollen: 0,
    actions: [
      assign("perch-1"),
      assign("perch-2"),
      start,
      release("perch-1", 500),
      release("perch-2", 900),
    ],
  },
  {
    levelId: "wildflower-28",
    name: "Return dancer retrieves the pollen",
    minimumRescued: 6,
    minimumPollen: 1,
    actions: [
      assign("perch-1"),
      assign("perch-2"),
      assign("perch-3"),
      start,
      release("perch-1", 500),
      action(900, {
        type: "adjust",
        objectId: "perch-2",
        direction: 4,
        strength: 1,
      }),
      release("perch-2", 900),
      release("perch-3", 1200),
    ],
  },
  {
    levelId: "wildflower-29",
    name: "Two doors and a dry interval",
    minimumRescued: 6,
    minimumPollen: 2,
    actions: [
      assign("switch-1"),
      assign("switch-2"),
      start,
      rally("rally-1", 200),
      rally("rally-2", 480),
      release("switch-1", 800),
      release("switch-2", 900),
    ],
  },
  {
    levelId: "wildflower-30",
    name: "Shelter the last crossing",
    minimumRescued: 6,
    minimumPollen: 3,
    actions: [
      leaf(15, 4),
      assign("perch-1"),
      assign("switch-1"),
      start,
      rally("rally-1", 300),
      rally("rally-1", 400, "hold"),
      release("perch-1", 450),
      rally("rally-2", 540),
      rally("rally-1", 580),
      release("switch-1", 850),
    ],
  },
  {
    levelId: "wildflower-30",
    name: "Two dry intervals, zero supplied tools",
    minimumRescued: 6,
    minimumPollen: 3,
    maximumTools: 0,
    actions: [
      assign("perch-1"),
      assign("switch-1"),
      start,
      rally("rally-1", 300),
      rally("rally-1", 400, "hold"),
      release("perch-1", 450),
      rally("rally-2", 540),
      rally("rally-1", 580),
      rally("rally-2", 660, "hold"),
      release("switch-1", 850),
      rally("rally-2", 1110),
    ],
  },
];
