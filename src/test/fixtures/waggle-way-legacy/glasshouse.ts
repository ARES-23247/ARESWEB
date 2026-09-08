import { editLevel, updateObject } from "../../../../packages/waggle-way/src/core/editor";
import { begin, piece, exported } from "../../../../packages/waggle-way/src/content/authoring";
import type { CampaignPuzzle } from "./campaign";
import type { CampaignSolution } from "./solutions";
import type { RecordedCommand } from "../../../../packages/waggle-way/src/core/engine";

function openSesame() {
  let e = begin(
    13,
    "Open Sesame",
    "A helper on the switch holds the gate open. Bring the other bees through, then release the operator on the far side.",
    "glass",
    3,
  );
  e = piece(e, "switch", 18, 7);
  e = piece(e, "gate", 10, 6, { height: 3 });
  return exported(e);
}
function afterYou() {
  let e = begin(
    14,
    "After You",
    "The switch is above the main flight path. Choose a safe direction for the operator before releasing it; the gate will close behind the swarm.",
    "glass",
    3,
  );
  e = updateObject(e, "hive", { y: 8 });
  e = updateObject(e, "flowers", { x: 20, y: 2, height: 8 });
  e = piece(e, "switch", 6, 3, { direction: 2 });
  e = piece(e, "gate", 10, 7, { height: 3 });
  e = piece(e, "terrain", 7, 5, { width: 10 });
  return exported(e);
}
function gatherRound() {
  let e = begin(
    15,
    "Gather Round",
    "Let the hive gather at the rally flower. Release the group when the switch operator has opened their route.",
    "glass",
    3,
  );
  e = piece(e, "switch", 18, 7);
  e = piece(e, "gate", 12, 6, { height: 3 });
  e = piece(e, "rally", 6, 7);
  return exported(e);
}
function twoDoors() {
  let e = begin(
    16,
    "Two Doors",
    "Two operators hold separate gates. Release the first operator while the second gate is still open, then bring the last helper home.",
    "glass",
    3,
  );
  e = piece(e, "switch", 12, 7);
  e = piece(e, "switch", 19, 7);
  e = piece(e, "gate", 8, 6, { height: 3 });
  e = piece(e, "gate", 16, 6, { height: 3, switchId: "switch-2" });
  return exported(e);
}
function changeOfShift() {
  let e = begin(
    17,
    "Change of Shift",
    "There is only one helper job. Gather everyone beyond the gate, then turn a released bee into the dancer for the final climb.",
    "glass",
    3,
  );
  e = editLevel(e, { ...e.level, guideLimit: 1 });
  e = updateObject(e, "flowers", { x: 16, y: 1, width: 5, height: 2 });
  e = piece(e, "switch", 12, 7);
  e = piece(e, "gate", 8, 6, { height: 3 });
  e = piece(e, "rally", 15, 7);
  e = piece(e, "perch", 18, 7, { direction: 6, range: 2 });
  return exported(e);
}
function glasshouseEscape() {
  let e = begin(
    18,
    "Glasshouse Escape",
    "Gather the hive beyond the gate. Release the operator into the group, then use the lift and two dancers to reach the high flowers. Every helper needs an exit.",
    "glass",
    3,
  );
  e = editLevel(e, { ...e.level, guideLimit: 3 });
  e = updateObject(e, "hive", { y: 10 });
  e = updateObject(e, "flowers", { x: 21, y: 1, width: 2, height: 5 });
  e = piece(e, "switch", 11, 10);
  e = piece(e, "gate", 8, 9, { height: 3 });
  e = piece(e, "rally", 14, 10);
  e = piece(e, "fan", 17, 13, {
    direction: 6,
    strength: 2,
    range: 10,
    permission: "fixed",
  });
  e = piece(e, "perch", 17, 7, { direction: 6, range: 1 });
  e = piece(e, "perch", 17, 2, { direction: 0, range: 2 });
  return exported(e);
}
const definitions = [
  openSesame(),
  afterYou(),
  gatherRound(),
  twoDoors(),
  changeOfShift(),
  glasshouseEscape(),
];
const lessons = [
  "Hold a gate open",
  "Plan the operator's own exit",
  "Gather and release a group",
  "Sequence two operators",
  "Reuse one helper job",
  "Combine gates, rallies and lift",
];
const hints = [
  [
    "Assign the switch operator before opening the hive.",
    "The switch is beyond the gate. Release its bee after five rescues.",
  ],
  [
    "Turn the switch arrow Right before assigning its operator.",
    "The upper route passes above the gate. Release the operator after five rescues.",
  ],
  [
    "Assign the operator and open the hive. Waiting bees remain safe at the rally.",
    "Select the rally and choose Release rally. Bring the switch operator home last.",
  ],
  [
    "Assign both switch flowers before opening the hive. Each line shows its gate.",
    "Release switch-1 first. Wait for that bee to reach the flowers before releasing switch-2.",
  ],
  [
    "Assign the switch, then open the hive. Release its operator after the other bees gather at the rally.",
    "Release the rally. Pause when its first bee is within one cell of the guide, then assign that bee. The operator job must be free.",
    "Keep the guide pointing Up until the other five bees are rescued. Then release it.",
  ],
  [
    "Assign the switch and both guides. The lower guide points Up and the upper guide points Right.",
    "After the swarm gathers, release the operator into the rally. Release the group through the lift.",
    "Release the lower guide after the group reaches the flowers. Keep the upper guide until that helper has passed.",
  ],
];
export const GLASSHOUSE_CAMPAIGN: readonly CampaignPuzzle[] = definitions.map(
  (level, index) => ({
    number: index + 13,
    garden: "Glasshouse",
    lesson: lessons[index],
    hints: hints[index],
    level,
  }),
);
const action = (
  tick: number,
  command: RecordedCommand["command"],
): RecordedCommand => ({ tick, command });
const assign = (objectId: string, tick = 0) =>
  action(tick, { type: "assign", objectId });
const release = (objectId: string, tick: number) =>
  action(tick, { type: "release", objectId });
const start = action(0, { type: "start" });
const rally = (tick: number) =>
  action(tick, { type: "rally", objectId: "rally-1", mode: "release" });
export const GLASSHOUSE_SOLUTIONS: readonly CampaignSolution[] = [
  {
    levelId: "glass-13",
    name: "Operator beyond the gate",
    minimumRescued: 6,
    actions: [assign("switch-1"), start, release("switch-1", 500)],
  },
  {
    levelId: "glass-14",
    name: "Upper operator exit",
    minimumRescued: 6,
    actions: [
      action(0, {
        type: "adjust",
        objectId: "switch-1",
        direction: 0,
        strength: 1,
      }),
      assign("switch-1"),
      start,
      release("switch-1", 500),
    ],
  },
  {
    levelId: "glass-15",
    name: "Gather before the crossing",
    minimumRescued: 6,
    actions: [assign("switch-1"), start, rally(300), release("switch-1", 800)],
  },
  {
    levelId: "glass-16",
    name: "First operator passes the second door",
    minimumRescued: 6,
    actions: [
      assign("switch-1"),
      assign("switch-2"),
      start,
      release("switch-1", 450),
      release("switch-2", 750),
    ],
  },
  {
    levelId: "glass-17",
    name: "Operator becomes a dancer",
    minimumRescued: 6,
    actions: [
      assign("switch-1"),
      start,
      release("switch-1", 350),
      rally(500),
      assign("perch-1", 540),
      release("perch-1", 850),
    ],
  },
  {
    levelId: "glass-18",
    name: "Rally, lift and final helpers",
    minimumRescued: 6,
    actions: [
      assign("switch-1"),
      assign("perch-1"),
      assign("perch-2"),
      start,
      release("switch-1", 400),
      rally(500),
      release("perch-1", 850),
      release("perch-2", 1100),
    ],
  },
];
