/** Data-only garden format. Distances in files are grid cells, never pixels. */
export const LEVEL_VERSION = 5;
export const RULES_VERSION = 5;
// New workshop gardens and the campaign explicitly use 8. The default 5 remains
// the server-verified format for existing internal fixtures and API contracts.
export type SupportedVersion = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const DANCE_TYPES = [
  "point",
  "left",
  "right",
  "reverse",
  "lift",
] as const;
export type DanceType = (typeof DANCE_TYPES)[number];
export const MAX_LEVEL_BYTES = 256 * 1024;
export const OBJECT_KINDS = [
  "hive",
  "flowers",
  "terrain",
  "water",
  "perch",
  "fan",
  "shelter",
  "switch",
  "gate",
  "rally",
  "sprinkler",
  "pollen",
  "dancer",
] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];
export type Direction = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const DIRECTION_NAMES = [
  "Right",
  "Down-right",
  "Down",
  "Down-left",
  "Left",
  "Up-left",
  "Up",
  "Up-right",
] as const;
export type Permission = "fixed" | "adjustable" | "movable";
export const TOOL_KINDS = ["perch", "fan", "shelter", "dancer"] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];
export interface ToolStock {
  dance?: DanceType;
  id: string;
  kind: ToolKind;
  count: number;
  width: number;
  height: number;
  direction: Direction;
  range: number;
  strength: number;
}

export interface GardenObject {
  elevation?: "low" | "tall";
  dance?: DanceType;
  id: string;
  kind: ObjectKind;
  x: number;
  y: number;
  width: number;
  height: number;
  direction: Direction;
  range: number;
  strength: number;
  permission: Permission;
  switchId?: string;
  cycle?: {
    dryTicks: number;
    warningTicks: number;
    wetTicks: number;
    offsetTicks: number;
  };
}

export const GARDEN_THEMES = [
  "sunny",
  "meadow",
  "glasshouse",
  "rainy",
  "wildflower",
] as const;
export type GardenTheme = (typeof GARDEN_THEMES)[number];

export interface LevelDefinition {
  schemaVersion: SupportedVersion;
  rulesVersion: SupportedVersion;
  id: string;
  title: string;
  instructions: string;
  width: number;
  height: number;
  population: number;
  rescueTarget: number;
  releaseInterval: number;
  guideLimit: number;
  objects: GardenObject[];
  inventory?: ToolStock[];
  theme?: GardenTheme;
  objectives?: { pollen: number; maxTools?: number };
}

export class LevelValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevelValidationError";
  }
}

function record(
  value: unknown,
  fields: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LevelValidationError(`${label} must be an object.`);
  }
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !fields.includes(key))) {
    throw new LevelValidationError(`${label} contains an unsupported field.`);
  }
  return result;
}

function integer(
  value: unknown,
  min: number,
  max: number,
  label: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new LevelValidationError(
      `${label} must be a whole number from ${min} to ${max}.`,
    );
  }
  return value;
}

function text(
  value: unknown,
  max: number,
  label: string,
  allowEmpty = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!allowEmpty && !value.trim()) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  ) {
    throw new LevelValidationError(
      `${label} must be plain text of at most ${max} characters.`,
    );
  }
  return value;
}

function identifier(value: unknown, label: string): string {
  const result = text(value, 64, label);
  if (!/^[a-zA-Z0-9_-]+$/.test(result))
    throw new LevelValidationError(
      `${label} may use letters, numbers, hyphens, and underscores.`,
    );
  return result;
}

export function overlaps(
  a: Pick<GardenObject, "x" | "y" | "width" | "height">,
  b: Pick<GardenObject, "x" | "y" | "width" | "height">,
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Rebuild explicitly: imported prototypes, extra fields, and runtime state never survive. */
export function validateLevel(value: unknown): LevelDefinition {
  const source = record(
    value,
    [
      "schemaVersion",
      "rulesVersion",
      "id",
      "title",
      "instructions",
      "width",
      "height",
      "population",
      "rescueTarget",
      "releaseInterval",
      "guideLimit",
      "objects",
      "inventory",
      "theme",
      "objectives",
    ],
    "Level",
  );
  if (
    ![1, 2, 3, 4, 5, 6, 7, 8].includes(source.schemaVersion as number) ||
    source.rulesVersion !== source.schemaVersion
  ) {
    throw new LevelValidationError(
      "This level uses an unsupported format or movement rules version. Keep the original file.",
    );
  }
  if (source.schemaVersion === 1 && Object.hasOwn(source, "inventory"))
    throw new LevelValidationError(
      "Upgrade this version-1 garden before adding a tool inventory.",
    );
  if (
    (source.schemaVersion as number) < 5 &&
    (Object.hasOwn(source, "theme") || Object.hasOwn(source, "objectives"))
  )
    throw new LevelValidationError(
      "Upgrade this garden before adding themes or optional objectives.",
    );
  const width = integer(source.width, 8, 128, "Garden width");
  const height = integer(source.height, 6, 72, "Garden height");
  const population = integer(source.population, 1, 100, "Bee population");
  if (
    !Array.isArray(source.objects) ||
    source.objects.length < 2 ||
    source.objects.length > 512
  ) {
    throw new LevelValidationError(
      "A garden must contain between 2 and 512 objects.",
    );
  }
  const ids = new Set<string>();
  const objects = source.objects.map((value): GardenObject => {
    const object = record(
      value,
      [
        "id",
        "kind",
        "x",
        "y",
        "width",
        "height",
        "direction",
        "range",
        "strength",
        "permission",
        "switchId",
        "cycle",
        "dance",
        "elevation",
      ],
      "Garden object",
    );
    const id = identifier(object.id, "Object ID");
    if (ids.has(id))
      throw new LevelValidationError(`Duplicate object ID: ${id}.`);
    ids.add(id);
    if (
      !OBJECT_KINDS.includes(object.kind as ObjectKind) ||
      (source.schemaVersion === 1 && object.kind === "shelter") ||
      ((source.schemaVersion as number) < 3 &&
        ["switch", "gate", "rally"].includes(object.kind as string)) ||
      ((source.schemaVersion as number) < 4 && object.kind === "sprinkler") ||
      ((source.schemaVersion as number) < 5 && object.kind === "pollen") ||
      ((source.schemaVersion as number) < 6 && object.kind === "dancer")
    )
      throw new LevelValidationError(
        "This garden contains an unsupported object type.",
      );
    if (
      !["fixed", "adjustable", "movable"].includes(object.permission as string)
    )
      throw new LevelValidationError(
        "Object permission must be fixed, adjustable, or movable.",
      );
    const result: GardenObject = {
      id,
      kind: object.kind as ObjectKind,
      x: integer(object.x, 0, width - 1, "Object column"),
      y: integer(object.y, 0, height - 1, "Object row"),
      width: integer(object.width, 1, width, "Object width"),
      height: integer(object.height, 1, height, "Object height"),
      direction: integer(object.direction, 0, 7, "Direction") as Direction,
      range: integer(object.range, 1, 16, "Influence range"),
      strength: integer(object.strength, 1, 3, "Fan strength"),
      permission: object.permission as Permission,
    };
    if (result.kind === "dancer") {
      if (
        !DANCE_TYPES.includes(object.dance as DanceType) ||
        (object.dance === "lift" && (source.schemaVersion as number) < 8) ||
        result.width !== 1 ||
        result.height !== 1
      )
        throw new LevelValidationError(
          "A dancer needs a supported dance and a one-cell footprint.",
        );
      result.dance = object.dance as DanceType;
    } else if (Object.hasOwn(object, "dance")) {
      throw new LevelValidationError("Only dancers may have a dance type.");
    }
    if (Object.hasOwn(object, "elevation")) {
      if (
        (source.schemaVersion as number) < 8 ||
        result.kind !== "terrain" ||
        !["low", "tall"].includes(object.elevation as string)
      )
        throw new LevelValidationError(
          "Only version-8 terrain may have low or tall elevation.",
        );
      result.elevation = object.elevation as "low" | "tall";
    }
    if (result.kind === "gate") {
      result.switchId = identifier(object.switchId, "Gate switch ID");
    } else if (Object.hasOwn(object, "switchId")) {
      throw new LevelValidationError("Only gates may have a switch link.");
    }
    if (result.kind === "sprinkler") {
      const cycle = record(
        object.cycle,
        ["dryTicks", "warningTicks", "wetTicks", "offsetTicks"],
        "Sprinkler cycle",
      );
      const dryTicks = integer(cycle.dryTicks, 1, 1800, "Dry ticks");
      const warningTicks = integer(cycle.warningTicks, 1, 300, "Warning ticks");
      const wetTicks = integer(cycle.wetTicks, 1, 1800, "Rain ticks");
      result.cycle = {
        dryTicks,
        warningTicks,
        wetTicks,
        offsetTicks: integer(
          cycle.offsetTicks,
          0,
          dryTicks + warningTicks + wetTicks - 1,
          "Cycle offset",
        ),
      };
      if (result.y + result.height + result.range > height)
        throw new LevelValidationError(
          "Sprinkler rain must end inside the garden. Reduce its range or move it up.",
        );
    } else if (Object.hasOwn(object, "cycle")) {
      throw new LevelValidationError("Only sprinklers may have a timed cycle.");
    }
    if (result.x + result.width > width || result.y + result.height > height)
      throw new LevelValidationError(`${id} extends beyond the garden.`);
    if (
      result.kind !== "fan" &&
      result.kind !== "perch" &&
      result.kind !== "dancer" &&
      result.kind !== "shelter" &&
      result.kind !== "switch" &&
      result.kind !== "rally" &&
      result.permission !== "fixed"
    )
      throw new LevelValidationError(
        "Only fans, perches, switches, rally flowers, and shelter leaves can be adjustable or movable during play.",
      );
    return result;
  });
  for (const gate of objects.filter((object) => object.kind === "gate")) {
    if (
      !objects.some(
        (object) => object.kind === "switch" && object.id === gate.switchId,
      )
    )
      throw new LevelValidationError(
        `Gate ${gate.id} must link to a switch flower in this garden.`,
      );
  }
  for (const kind of ["hive", "flowers"] as const) {
    if (objects.filter((object) => object.kind === kind).length !== 1)
      throw new LevelValidationError(
        `A garden needs exactly one ${kind === "hive" ? "hive" : "flower field"}.`,
      );
  }
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const pair = [objects[i], objects[j]];
      if (
        (source.schemaVersion as number) >= 7 &&
        overlaps(objects[i], objects[j]) &&
        pair.some((object) => object.kind === "water") &&
        pair.some(
          (object) => object.kind === "dancer" || object.kind === "perch",
        )
      ) {
        throw new LevelValidationError(
          "Dancing guides need dry ground. Bees can still fly across water.",
        );
      }
      if (
        overlaps(objects[i], objects[j]) &&
        !(
          (source.schemaVersion as number) >= 6 &&
          (objects[i].kind === "water" || objects[j].kind === "water")
        )
      )
        throw new LevelValidationError(
          `${objects[i].id} overlaps ${objects[j].id}. Move the objects apart.`,
        );
    }
  }
  let inventory: ToolStock[] | undefined;
  if (source.schemaVersion !== 1) {
    if (!Array.isArray(source.inventory) || source.inventory.length > 20)
      throw new LevelValidationError(
        "Gardens from version 2 onward need an inventory list of at most 20 tool supplies.",
      );
    const stockIds = new Set<string>();
    inventory = source.inventory.map((value): ToolStock => {
      const stock = record(
        value,
        [
          "id",
          "kind",
          "count",
          "width",
          "height",
          "direction",
          "range",
          "strength",
          "dance",
        ],
        "Tool supply",
      );
      const id = identifier(stock.id, "Supply ID");
      if (stockIds.has(id))
        throw new LevelValidationError("Tool supply IDs must be unique.");
      stockIds.add(id);
      if (
        !TOOL_KINDS.includes(stock.kind as ToolKind) ||
        ((source.schemaVersion as number) < 6 && stock.kind === "dancer")
      )
        throw new LevelValidationError(
          "Only guides, fans, and shelter leaves can be supplied to players.",
        );
      if (stock.kind === "dancer") {
        if (
          !DANCE_TYPES.includes(stock.dance as DanceType) ||
          (stock.dance === "lift" && (source.schemaVersion as number) < 8) ||
          stock.width !== 1 ||
          stock.height !== 1
        )
          throw new LevelValidationError(
            "Dancer supply needs a supported dance and a one-cell footprint.",
          );
      } else if (Object.hasOwn(stock, "dance")) {
        throw new LevelValidationError(
          "Only dancer supply may have a dance type.",
        );
      }
      return {
        id,
        kind: stock.kind as ToolKind,
        ...(stock.kind === "dancer" ? { dance: stock.dance as DanceType } : {}),
        count: integer(stock.count, 1, 20, "Tool count"),
        width: integer(stock.width, 1, width, "Tool width"),
        height: integer(stock.height, 1, height, "Tool height"),
        direction: integer(
          stock.direction,
          0,
          7,
          "Tool direction",
        ) as Direction,
        range: integer(stock.range, 1, 16, "Tool range"),
        strength: integer(stock.strength, 1, 3, "Tool strength"),
      };
    });
    if (
      objects.length + inventory.reduce((sum, stock) => sum + stock.count, 0) >
      512
    )
      throw new LevelValidationError(
        "Placed pieces and supplied tools together must fit the 512-object limit.",
      );
  }
  let theme: GardenTheme | undefined;
  let objectives: LevelDefinition["objectives"];
  if ((source.schemaVersion as number) >= 5) {
    if (!GARDEN_THEMES.includes(source.theme as GardenTheme))
      throw new LevelValidationError("Choose a built-in garden theme.");
    theme = source.theme as GardenTheme;
    const goals = record(
      source.objectives,
      ["pollen", "maxTools"],
      "Optional objectives",
    );
    objectives = {
      pollen: integer(
        goals.pollen,
        0,
        objects.filter((object) => object.kind === "pollen").length,
        "Pollen delivery target",
      ),
    };
    if (Object.hasOwn(goals, "maxTools")) {
      const total = inventory!.reduce((sum, stock) => sum + stock.count, 0);
      if (!total)
        throw new LevelValidationError(
          "A fewer-tools objective needs a player tool supply.",
        );
      objectives.maxTools = integer(
        goals.maxTools,
        0,
        total,
        "Optional tool limit",
      );
    }
  }
  return {
    schemaVersion: source.schemaVersion as SupportedVersion,
    rulesVersion: source.rulesVersion as SupportedVersion,
    id: identifier(source.id, "Level ID"),
    title: text(source.title, 80, "Title"),
    instructions: text(source.instructions, 500, "Instructions", true),
    width,
    height,
    population,
    rescueTarget: integer(source.rescueTarget, 1, population, "Rescue target"),
    releaseInterval: integer(
      source.releaseInterval,
      1,
      300,
      "Release interval",
    ),
    guideLimit: integer(source.guideLimit, 0, population, "Guide limit"),
    objects,
    ...(inventory ? { inventory } : {}),
    ...(theme ? { theme, objectives } : {}),
  };
}

export function parseLevelFile(contents: string): LevelDefinition {
  if (new TextEncoder().encode(contents).byteLength > MAX_LEVEL_BYTES)
    throw new LevelValidationError(
      "Level files must be no larger than 256 KiB.",
    );
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new LevelValidationError(
      "This file is not valid JSON. Your current garden has not changed.",
    );
  }
  return validateLevel(value);
}

export function serializeLevel(level: LevelDefinition): string {
  const canonical = validateLevel(level);
  canonical.objects.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  canonical.inventory?.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return JSON.stringify(canonical, null, 2);
}

export function makeObject(
  id: string,
  kind: ObjectKind,
  x: number,
  y: number,
): GardenObject {
  return {
    id,
    kind,
    x,
    y,
    width: kind === "shelter" ? 3 : 1,
    height: 1,
    direction: 0,
    range: kind === "fan" ? 8 : kind === "sprinkler" ? 1 : 2,
    strength: 1,
    ...(kind === "dancer" ? { dance: "point" as const } : {}),
    permission:
      kind === "shelter"
        ? "movable"
        : kind === "fan" ||
            kind === "perch" ||
            kind === "dancer" ||
            kind === "switch" ||
            kind === "rally"
          ? "adjustable"
          : "fixed",
    ...(kind === "sprinkler"
      ? {
          cycle: {
            dryTicks: 180,
            warningTicks: 30,
            wetTicks: 180,
            offsetTicks: 0,
          },
        }
      : {}),
  };
}

export function createBlankLevel(
  version: SupportedVersion = LEVEL_VERSION,
): LevelDefinition {
  return validateLevel({
    schemaVersion: version,
    rulesVersion: version,
    id: "my-garden",
    title: "My garden",
    instructions: "Guide the hive to the flowers.",
    width: 24,
    height: 14,
    population: 8,
    rescueTarget: 8,
    releaseInterval: 30,
    guideLimit: 3,
    objects: [
      makeObject("hive", "hive", 2, 7),
      makeObject("flowers", "flowers", 21, 7),
    ],
    ...(version !== 1 ? { inventory: [] } : {}),
    ...(version >= 5 ? { theme: "sunny", objectives: { pollen: 0 } } : {}),
  });
}

/** Explicit, lossless editor upgrade. Reading a legacy file never rewrites it. */
export function upgradeLevel(level: LevelDefinition): LevelDefinition {
  const valid = validateLevel(level);
  if (valid.schemaVersion >= LEVEL_VERSION) return valid;
  return validateLevel({
    ...valid,
    schemaVersion: LEVEL_VERSION,
    rulesVersion: RULES_VERSION,
    inventory: valid.inventory ?? [],
    theme: valid.theme ?? "sunny",
    objectives: valid.objectives ?? { pollen: 0 },
  });
}
