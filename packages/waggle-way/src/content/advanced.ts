import { begin, exported, piece } from "./authoring";
import { editLevel, updateObject } from "../core/editor";
import type {
  GardenObject,
  GardenTheme,
  ObjectKind,
  ToolStock,
} from "../core/level";

type Piece = [ObjectKind, number, number, Partial<GardenObject>?];
interface Design {
  title: string;
  brief: string;
  size: [number, number];
  hive: [number, number];
  flowers: [number, number, number, number];
  jobs: number;
  left: number;
  right: number;
  lifts?: number;
  covers?: number;
  pieces: Piece[];
}
const spray = (x: number, y: number, range: number, offsetTicks = 0): Piece => [
  "sprinkler",
  x,
  y,
  {
    width: 3,
    range,
    cycle: { dryTicks: 60, warningTicks: 30, wetTicks: 180, offsetTicks },
  },
];
const stock = (dance: "left" | "right" | "lift", count: number): ToolStock => ({
  id: `${dance}-dancer`,
  kind: "dancer",
  dance,
  count,
  width: 1,
  height: 1,
  direction: 0,
  range: 2,
  strength: 1,
});

// Authored current-rule layouts for the three advanced campaign chapters.
const designs: Design[] = [
  {
    title: "Across the Pond",
    brief:
      "Lift over the low fence before making two turns. High flight lasts six traveled cells: leave room to descend on clear ground. The lift helper needs its own way home too.",
    size: [28, 20],
    hive: [2, 16],
    flowers: [23, 3, 3, 5],
    jobs: 3,
    left: 1,
    right: 1,
    lifts: 1,
    pieces: [
      ["terrain", 6, 0, { width: 2, height: 20, elevation: "low" }],
      ["water", 12, 10, { width: 16, height: 10 }],
      ["terrain", 11, 9, { width: 17 }],
    ],
  },
  {
    title: "Mind the Branch",
    brief:
      "Thread the opening between the partitions. A third turn is needed beyond the overhang. Rescue the whole chain of helpers.",
    size: [32, 24],
    hive: [2, 20],
    flowers: [25, 1, 5, 3],
    jobs: 3,
    left: 2,
    right: 1,
    pieces: [
      ["terrain", 12, 10, { height: 14 }],
      ["terrain", 12, 0, { height: 5 }],
      ["water", 16, 12, { width: 16, height: 12 }],
    ],
  },
  {
    title: "Bring Everyone",
    brief:
      "The far operator must join a climbing escape over a low crossbeam. Place the lift after the first turn, leaving a clear landing before the last turn. Recover the operator and upstream dancers before their escape signals leave.",
    size: [32, 22],
    hive: [2, 18],
    flowers: [27, 3, 3, 5],
    jobs: 4,
    left: 1,
    right: 1,
    lifts: 1,
    pieces: [
      ["switch", 11, 18],
      ["gate", 7, 0, { height: 22 }],
      ["terrain", 8, 9, { width: 24, height: 2, elevation: "low" }],
      ["terrain", 17, 11, { width: 15 }],
      ["water", 18, 12, { width: 14, height: 10 }],
    ],
  },
  {
    title: "Garden Route",
    brief:
      "The opening changes sides. Budget two left turns and two right turns through the staggered partitions.",
    size: [36, 26],
    hive: [2, 22],
    flowers: [32, 2, 3, 5],
    jobs: 4,
    left: 2,
    right: 2,
    pieces: [
      ["terrain", 12, 12, { height: 14 }],
      ["terrain", 12, 0, { height: 7 }],
      ["terrain", 27, 7, { height: 19 }],
      ["terrain", 27, 0, { height: 2 }],
    ],
  },
  {
    title: "Return to Sender",
    brief:
      "The wall supplies one reversal for free. Catch the return flight behind the hive, then thread the upper passage.",
    size: [30, 22],
    hive: [12, 18],
    flowers: [25, 2, 3, 5],
    jobs: 2,
    left: 0,
    right: 2,
    pieces: [
      ["terrain", 23, 15, { height: 7 }],
      ["terrain", 15, 10, { width: 15 }],
      ["water", 15, 11, { width: 8, height: 4 }],
    ],
  },
  {
    title: "Rooftop Relay",
    brief:
      "Four helper jobs must do five jobs in sequence. Gather the hive at the rooftop rally, recover the operators and first two dancers, then recruit a waiting bee for the final turn. Keep each shutter open until its upstream operator has escaped.",
    size: [40, 26],
    hive: [2, 22],
    flowers: [33, 1, 5, 3],
    jobs: 4,
    left: 2,
    right: 1,
    pieces: [
      ["switch", 10, 22],
      ["switch", 18, 22],
      ["gate", 7, 0, { height: 26 }],
      ["gate", 15, 0, { height: 26, switchId: "switch-2" }],
      ["terrain", 27, 13, { height: 13 }],
      ["rally", 34, 7, { height: 3 }],
    ],
  },
  {
    title: "Shelter the Swarm",
    brief:
      "One roof must protect the upper turn as well as the lower approach. A roof placed too low on the board leaves the waiting upper dancer exposed. Trace the entire route before placing the shelter.",
    size: [24, 22],
    hive: [2, 18],
    flowers: [20, 3, 3, 5],
    jobs: 2,
    left: 1,
    right: 1,
    covers: 1,
    pieces: [
      spray(11, 0, 16),
      ["terrain", 13, 11, { width: 11 }],
      ["water", 14, 12, { width: 10, height: 10 }],
    ],
  },
  {
    title: "Crosswinds",
    brief:
      "The sideways fan carries the hive into a higher lane without changing its heading. Catch the flight after the gust, then guide it through the sheltered upper crossing. A dancer on the original departure row will miss the swarm.",
    size: [34, 24],
    hive: [2, 20],
    flowers: [27, 1, 5, 3],
    jobs: 3,
    left: 2,
    right: 1,
    covers: 2,
    pieces: [
      spray(5, 8, 14),
      spray(19, 1, 10, 90),
      [
        "fan",
        7,
        22,
        { direction: 6, range: 8, strength: 3, permission: "fixed" },
      ],
      ["terrain", 14, 12, { height: 12 }],
    ],
  },
  {
    title: "Rain Check",
    brief:
      "One shelter must serve two curtains. The rally offers a pause, but the shutter operator still needs a way out.",
    size: [34, 24],
    hive: [2, 20],
    flowers: [29, 3, 3, 5],
    jobs: 3,
    left: 1,
    right: 1,
    covers: 1,
    pieces: [
      ["switch", 10, 20],
      ["rally", 14, 20],
      ["gate", 8, 0, { height: 24 }],
      spray(9, 7, 15),
      spray(22, 0, 10, 120),
      ["terrain", 18, 12, { width: 16 }],
      ["water", 19, 13, { width: 15, height: 11 }],
    ],
  },
  {
    title: "The Long Way Home",
    brief:
      "Lift across the low wall for a shorter rescue with one roof, or take the longer upper passage to bring home pollen. The pollen route crosses a second spray curtain and needs an extra turn and cover. Water is flyable, but the far dancer needs the dry bank.",
    size: [38, 28],
    hive: [2, 24],
    flowers: [31, 1, 5, 3],
    jobs: 3,
    left: 2,
    right: 1,
    lifts: 1,
    covers: 2,
    pieces: [
      spray(5, 11, 15),
      spray(21, 1, 13, 150),
      ["terrain", 15, 15, { width: 3, height: 13, elevation: "low" }],
      ["terrain", 15, 0, { width: 3, height: 9 }],
      ["water", 20, 17, { width: 10, height: 11 }],
      ["pollen", 21, 12],
    ],
  },
  {
    title: "A Place to Wait",
    brief:
      "The fixed roof protects one lane. One portable cover must serve the other two. The final rally has room for everyone, including the bees still teaching the route.",
    size: [38, 26],
    hive: [2, 22],
    flowers: [33, 3, 3, 5],
    jobs: 2,
    left: 1,
    right: 1,
    covers: 1,
    pieces: [
      ["rally", 26, 4, { height: 3 }],
      ["shelter", 6, 10, { permission: "fixed" }],
      spray(6, 9, 15),
      spray(21, 0, 11, 90),
      spray(28, 0, 11, 180),
      ["terrain", 17, 13, { width: 21 }],
      ["water", 18, 14, { width: 20, height: 12 }],
    ],
  },
  {
    title: "After the Storm",
    brief:
      "Four helper jobs and one roof must serve the whole route. Regroup every operator and dancer at the first rally before moving the roof to the second curtain. Gather beyond that curtain, then recruit the final turn from the waiting hive.",
    size: [42, 28],
    hive: [2, 24],
    flowers: [35, 1, 5, 3],
    jobs: 4,
    left: 2,
    right: 1,
    covers: 1,
    pieces: [
      ["switch", 11, 24],
      ["switch", 20, 24],
      ["gate", 7, 0, { height: 28 }],
      ["gate", 16, 0, { height: 28, switchId: "switch-2" }],
      spray(12, 10, 16),
      spray(29, 1, 13, 120),
      ["terrain", 27, 15, { height: 13 }],
      ["rally", 28, 9, { height: 3 }],
      ["rally", 36, 9, { height: 3 }],
    ],
  },
  {
    title: "Factory Entrance",
    brief:
      "Only two helper jobs can run at once. Gather everyone past the shutter, then lift over the low loading wall. Regroup again and recruit a waiting bee beside the final rally for the turn home. Recover the lift helper before dismantling its route.",
    size: [30, 24],
    hive: [2, 20],
    flowers: [24, 2, 3, 4],
    jobs: 2,
    left: 1,
    right: 0,
    lifts: 1,
    pieces: [
      ["switch", 11, 20],
      ["gate", 7, 0, { height: 24 }],
      ["rally", 12, 20],
      ["terrain", 18, 0, { width: 2, height: 24, elevation: "low" }],
      ["rally", 24, 20],
    ],
  },
  {
    title: "Pipework",
    brief:
      "Use the factory end wall to send the hive back, then catch it behind the hive. Lift that returning lane over the low cross-pipe before routing along the upper aisle. Each released helper approaches the next signal from a slightly different lane.",
    size: [42, 28],
    hive: [12, 24],
    flowers: [37, 1, 3, 3],
    jobs: 4,
    left: 1,
    right: 2,
    lifts: 1,
    pieces: [
      ["terrain", 30, 20, { height: 8 }],
      ["terrain", 0, 12, { width: 42, height: 2, elevation: "low" }],
      ["water", 0, 20, { width: 7, height: 8 }],
    ],
  },
  {
    title: "High Road, Low Road",
    brief:
      "Take the short high crossing with a carefully placed lift, or thread the upper gap on normal flight to collect the pollen. Taking off too early means descending inside the wide low wall. Both routes must recover every helper.",
    size: [36, 24],
    hive: [2, 20],
    flowers: [30, 1, 5, 4],
    jobs: 3,
    left: 2,
    right: 1,
    lifts: 1,
    pieces: [
      ["terrain", 14, 9, { width: 3, height: 15, elevation: "low" }],
      ["terrain", 14, 0, { width: 3, height: 5 }],
      ["pollen", 21, 8],
    ],
  },
  {
    title: "Pollen on the Side",
    brief:
      "The upper passage rescues the hive, but leaves the pollen behind. Choose a lower middle crossing to collect it, while leaving both returning helpers room between the partitions.",
    size: [44, 30],
    hive: [2, 26],
    flowers: [39, 2, 3, 5],
    jobs: 4,
    left: 2,
    right: 2,
    covers: 2,
    pieces: [
      spray(5, 12, 16),
      spray(22, 2, 15, 120),
      ["terrain", 14, 18, { height: 12 }],
      ["terrain", 14, 0, { height: 11 }],
      ["terrain", 32, 12, { height: 18 }],
      ["terrain", 32, 0, { height: 2 }],
      ["pollen", 18, 16],
    ],
  },
  {
    title: "The Last Dancer",
    brief:
      "Two low loading walls need separate lifts, with a sheltered landing lane between them. The first lift helper still needs the second lift to escape. Recover the operator, then dismantle the flight chain from the hive outward.",
    size: [38, 24],
    hive: [2, 20],
    flowers: [32, 2, 5, 4],
    jobs: 4,
    left: 1,
    right: 0,
    lifts: 2,
    covers: 1,
    pieces: [
      ["switch", 11, 20],
      ["gate", 7, 0, { height: 24 }],
      ["terrain", 16, 0, { width: 2, height: 24, elevation: "low" }],
      ["terrain", 25, 0, { width: 2, height: 24, elevation: "low" }],
      spray(19, 6, 16),
    ],
  },
  {
    title: "All Together",
    brief:
      "Only three helper jobs can run together. Recover both operators at the first rally, lift the entire hive over the loading wall, then recruit the climb and final turn from the waiting bees. Move the single roof only after the upstream operator is safe.",
    size: [48, 32],
    hive: [2, 28],
    flowers: [41, 10, 5, 3],
    jobs: 3,
    left: 1,
    right: 1,
    lifts: 1,
    covers: 1,
    pieces: [
      ["switch", 10, 28],
      ["switch", 20, 28],
      ["gate", 7, 0, { height: 32 }],
      ["gate", 16, 0, { height: 32, switchId: "switch-2" }],
      ["rally", 21, 28],
      ["terrain", 26, 0, { width: 2, height: 32, elevation: "low" }],
      ["rally", 32, 28],
      ["rally", 32, 10, { height: 3, direction: 6 }],
      spray(11, 14, 16),
      spray(37, 2, 14, 150),
      ["terrain", 35, 17, { height: 15 }],
    ],
  },
  {
    title: "Field of Flowers",
    brief:
      "The final rescue combines a two-lift escape chain with a climb over the last low beam. Gather every helper before rebuilding the route at each rally. Two roofs must serve three spray lanes, and the first lift helper still needs the second lift to escape.",
    size: [52, 34],
    hive: [2, 30],
    flowers: [47, 2, 3, 5],
    jobs: 4,
    left: 1,
    right: 1,
    lifts: 3,
    covers: 2,
    pieces: [
      ["switch", 10, 30],
      ["switch", 19, 30],
      ["gate", 7, 0, { height: 34 }],
      ["gate", 15, 0, { height: 34, switchId: "switch-2" }],
      ["terrain", 24, 0, { width: 2, height: 34, elevation: "low" }],
      ["terrain", 33, 0, { width: 2, height: 34, elevation: "low" }],
      ["terrain", 36, 10, { width: 16, height: 2, elevation: "low" }],
      ["rally", 40, 30],
      ["rally", 40, 14, { direction: 6 }],
      ["rally", 40, 5, { direction: 6 }],
      spray(11, 16, 16),
      spray(27, 16, 16, 90),
      spray(44, 0, 10, 180),
    ],
  },
];

export const ADVANCED_GARDENS = designs.map((design, index) => {
  const theme: GardenTheme =
    index < 6 ? "meadow" : index < 12 ? "rainy" : "glasshouse";
  let editor = begin(
    index + 12,
    design.title,
    `${design.brief} Water is safe to fly over; dancers need dry ground. Rescue all eight bees.`,
    "adventure",
    8,
  );
  editor = editLevel(editor, {
    ...editor.level,
    width: design.size[0],
    height: design.size[1],
    population: 8,
    rescueTarget: 8,
    guideLimit: design.jobs,
    theme,
    inventory: [
      stock("left", design.left),
      stock("right", design.right),
      stock("lift", design.lifts ?? 0),
    ]
      .filter((tool) => tool.count > 0)
      .concat(
        design.covers
          ? [
              {
                id: "leaf-cover",
                kind: "shelter",
                count: design.covers,
                width: 3,
                height: 1,
                direction: 0,
                range: 2,
                strength: 1,
              },
            ]
          : [],
      ),
  });
  editor = updateObject(editor, "hive", {
    x: design.hive[0],
    y: design.hive[1],
  });
  editor = updateObject(editor, "flowers", {
    x: design.flowers[0],
    y: design.flowers[1],
    width: design.flowers[2],
    height: design.flowers[3],
  });
  for (const [kind, x, y, patch] of design.pieces)
    editor = piece(editor, kind, x, y, patch);
  if (design.pieces.some(([kind]) => kind === "pollen"))
    editor = editLevel(editor, { ...editor.level, objectives: { pollen: 1 } });
  return exported(editor);
});
