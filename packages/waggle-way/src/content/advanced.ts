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
const stock = (dance: "left" | "right", count: number): ToolStock => ({
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
      "Two turns, two helpers, no spare jobs. The pond carries the flight but cannot support a dancer.",
    size: [28, 20],
    hive: [2, 16],
    flowers: [23, 3, 3, 5],
    jobs: 2,
    left: 1,
    right: 1,
    pieces: [
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
      "The far operator must join a two-turn escape. Its shutter cannot be abandoned until the last bee has crossed.",
    size: [32, 22],
    hive: [2, 18],
    flowers: [27, 3, 3, 5],
    jobs: 3,
    left: 1,
    right: 1,
    pieces: [
      ["switch", 11, 18],
      ["gate", 7, 0, { height: 22 }],
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
      "Two shutters feed a three-turn climb. Every operator and dancer must make the final crossing.",
    size: [40, 26],
    hive: [2, 22],
    flowers: [33, 1, 5, 3],
    jobs: 5,
    left: 2,
    right: 1,
    pieces: [
      ["switch", 10, 22],
      ["switch", 18, 22],
      ["gate", 7, 0, { height: 26 }],
      ["gate", 15, 0, { height: 26, switchId: "switch-2" }],
      ["terrain", 27, 13, { height: 13 }],
    ],
  },
  {
    title: "Shelter the Swarm",
    brief:
      "A spray curtain cuts the first leg. The dry roof must protect helpers as well as the initial swarm.",
    size: [30, 22],
    hive: [2, 18],
    flowers: [25, 3, 3, 5],
    jobs: 2,
    left: 1,
    right: 1,
    covers: 1,
    pieces: [
      spray(5, 6, 14),
      ["terrain", 13, 11, { width: 17 }],
      ["water", 14, 12, { width: 16, height: 10 }],
    ],
  },
  {
    title: "Crosswinds",
    brief:
      "The fan speeds up the first crossing. Two separate spray columns need protection before the final climb.",
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
      ["fan", 1, 20, { range: 7, permission: "fixed" }],
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
      "The safe route changes height twice. Three turns and two covers must bring every helper home through the rain.",
    size: [38, 28],
    hive: [2, 24],
    flowers: [31, 1, 5, 3],
    jobs: 3,
    left: 2,
    right: 1,
    covers: 2,
    pieces: [
      spray(5, 11, 15),
      spray(21, 1, 13, 150),
      ["terrain", 15, 15, { height: 13 }],
      ["terrain", 15, 0, { height: 9 }],
      ["water", 20, 17, { width: 18, height: 11 }],
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
      "Two operators, three dancers and two roofs share one rescue route. Plan the last five departures before opening the hive.",
    size: [42, 28],
    hive: [2, 24],
    flowers: [35, 1, 5, 3],
    jobs: 5,
    left: 2,
    right: 1,
    covers: 2,
    pieces: [
      ["switch", 11, 24],
      ["switch", 20, 24],
      ["gate", 7, 0, { height: 28 }],
      ["gate", 16, 0, { height: 28, switchId: "switch-2" }],
      spray(12, 10, 16),
      spray(29, 1, 13, 120),
      ["terrain", 27, 15, { height: 13 }],
    ],
  },
  {
    title: "Factory Entrance",
    brief:
      "Three shutters divide the loading hall. Operators must leave in an order that keeps every remaining escape open.",
    size: [42, 24],
    hive: [2, 20],
    flowers: [37, 2, 3, 4],
    jobs: 4,
    left: 1,
    right: 0,
    pieces: [
      ["switch", 11, 20],
      ["switch", 22, 20],
      ["switch", 32, 20],
      ["gate", 7, 0, { height: 24 }],
      ["gate", 18, 0, { height: 24, switchId: "switch-2" }],
      ["gate", 28, 0, { height: 24, switchId: "switch-3" }],
    ],
  },
  {
    title: "Pipework",
    brief:
      "Four bends wind between the factory partitions. There is no spare dancer to patch a poorly chosen turn.",
    size: [42, 30],
    hive: [2, 26],
    flowers: [37, 2, 3, 5],
    jobs: 4,
    left: 2,
    right: 2,
    pieces: [
      ["terrain", 14, 17, { height: 13 }],
      ["terrain", 14, 0, { height: 11 }],
      ["terrain", 31, 11, { height: 19 }],
      ["terrain", 31, 0, { height: 2 }],
      ["water", 18, 19, { width: 24, height: 11 }],
    ],
  },
  {
    title: "High Road, Low Road",
    brief:
      "The floor-level shutters and upper exit need different helpers. No one can be left working in the factory.",
    size: [44, 28],
    hive: [2, 24],
    flowers: [39, 3, 3, 5],
    jobs: 5,
    left: 1,
    right: 1,
    covers: 1,
    pieces: [
      ["switch", 10, 24],
      ["switch", 20, 24],
      ["switch", 29, 24],
      ["gate", 7, 0, { height: 28 }],
      ["gate", 16, 0, { height: 28, switchId: "switch-2" }],
      ["gate", 25, 0, { height: 28, switchId: "switch-3" }],
      spray(34, 0, 11),
      ["terrain", 35, 13, { width: 9 }],
      ["water", 36, 14, { width: 8, height: 14 }],
    ],
  },
  {
    title: "Pollen on the Side",
    brief:
      "Carry the optional pollen through the four-turn route. The rescue is mandatory; collecting pollen is an extra challenge.",
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
      ["pollen", 18, 14],
    ],
  },
  {
    title: "The Last Dancer",
    brief:
      "The last dancer inherits the escape route it teaches. Rescue three operators before dismantling the two-turn chain.",
    size: [46, 30],
    hive: [2, 26],
    flowers: [41, 3, 3, 5],
    jobs: 5,
    left: 1,
    right: 1,
    covers: 2,
    pieces: [
      ["switch", 11, 26],
      ["switch", 22, 26],
      ["switch", 31, 26],
      ["gate", 7, 0, { height: 30 }],
      ["gate", 18, 0, { height: 30, switchId: "switch-2" }],
      ["gate", 27, 0, { height: 30, switchId: "switch-3" }],
      spray(12, 12, 16),
      spray(37, 0, 12, 90),
      ["terrain", 36, 14, { width: 10 }],
      ["water", 37, 15, { width: 9, height: 15 }],
    ],
  },
  {
    title: "All Together",
    brief:
      "A three-shutter departure meets a three-turn escape. Six bees have jobs; the last two depend on the entire route being ready.",
    size: [48, 32],
    hive: [2, 28],
    flowers: [41, 1, 5, 3],
    jobs: 6,
    left: 2,
    right: 1,
    covers: 2,
    pieces: [
      ["switch", 10, 28],
      ["switch", 20, 28],
      ["switch", 29, 28],
      ["gate", 7, 0, { height: 32 }],
      ["gate", 16, 0, { height: 32, switchId: "switch-2" }],
      ["gate", 25, 0, { height: 32, switchId: "switch-3" }],
      spray(11, 14, 16),
      spray(37, 2, 14, 150),
      ["terrain", 35, 17, { height: 15 }],
    ],
  },
  {
    title: "Field of Flowers",
    brief:
      "The final rescue: three shutters, four bends and three spray lanes. Seven helpers must return; releasing one too soon can strand the rest.",
    size: [52, 34],
    hive: [2, 30],
    flowers: [47, 2, 3, 5],
    jobs: 7,
    left: 2,
    right: 2,
    covers: 3,
    pieces: [
      ["switch", 10, 30],
      ["switch", 19, 30],
      ["switch", 28, 30],
      ["gate", 7, 0, { height: 34 }],
      ["gate", 15, 0, { height: 34, switchId: "switch-2" }],
      ["gate", 24, 0, { height: 34, switchId: "switch-3" }],
      spray(11, 16, 16),
      spray(35, 5, 14, 90),
      spray(44, 0, 10, 180),
      ["terrain", 34, 21, { height: 13 }],
      ["terrain", 34, 0, { height: 14 }],
      ["terrain", 43, 11, { height: 23 }],
      ["terrain", 43, 0, { height: 2 }],
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
    7,
  );
  editor = editLevel(editor, {
    ...editor.level,
    width: design.size[0],
    height: design.size[1],
    population: 8,
    rescueTarget: 8,
    guideLimit: design.jobs,
    theme,
    inventory: [stock("left", design.left), stock("right", design.right)]
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
