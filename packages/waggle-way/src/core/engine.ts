import {
  validateLevel,
  type Direction,
  type GardenObject,
  type LevelDefinition,
} from "./level";
import { rainZones, sprinklerPhase } from "./weather";

export const UNITS = 1000;
export const TICKS_PER_SECOND = 30;
export const FLIGHT_SPEED = 60;
/** Lift lasts six traveled grid cells, independent of simulation/render speed. */
export const LIFT_DISTANCE = 6 * UNITS;
export const MAX_SPEED = 180;
export const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1000, 0],
  [707, 707],
  [0, 1000],
  [-707, 707],
  [-1000, 0],
  [-707, -707],
  [0, -1000],
  [707, -707],
];
export type BeeStatus =
  "hive" | "flying" | "assigned" | "waiting" | "rescued" | "lost";
export interface Bee {
  id: number;
  x: number;
  y: number;
  direction: Direction;
  status: BeeStatus;
  perchId: string | null;
  signalId: string | null;
  danceVisits?: string[];
  liftRemaining?: number;
  rallyExitId?: string;
  lossReason?: "rain" | "landing";
}
export type RunCommand =
  | { type: "rally"; objectId: string; mode: "hold" | "release" }
  | { type: "start" }
  | { type: "finish" }
  | { type: "assign"; objectId: string }
  | { type: "release"; objectId: string }
  | { type: "place"; stockId: string; objectId: string; x: number; y: number }
  | { type: "recover"; objectId: string }
  | { type: "adjust"; objectId: string; direction: Direction; strength: number }
  | { type: "move"; objectId: string; x: number; y: number };
export interface RecordedCommand {
  tick: number;
  command: RunCommand;
}
export interface RunState {
  tick: number;
  phase: "setup" | "running" | "finished";
  bees: Bee[];
  objects: GardenObject[];
  won: boolean;
  impossible: boolean;
  notice: string;
  commands: RecordedCommand[];
  deployed: Array<{ objectId: string; stockId: string }>;
  peakToolsPlaced: number;
  pollen?: Array<{
    objectId: string;
    carrierId: number | null;
    delivered: boolean;
  }>;
  rallies: Array<{
    objectId: string;
    mode: "hold" | "release";
    nextReleaseTick: number;
  }>;
}

export function objectCenter(object: GardenObject): { x: number; y: number } {
  return {
    x: (object.x + object.width / 2) * UNITS,
    y: (object.y + object.height / 2) * UNITS,
  };
}

export function populationCounts(state: RunState): Record<BeeStatus, number> {
  const counts = {
    hive: 0,
    flying: 0,
    assigned: 0,
    waiting: 0,
    rescued: 0,
    lost: 0,
  };
  for (const bee of state.bees) counts[bee.status]++;
  return counts;
}

export function pollenCounts(state: RunState): {
  available: number;
  carried: number;
  delivered: number;
} {
  const counts = { available: 0, carried: 0, delivered: 0 };
  for (const token of state.pollen ?? [])
    counts[
      token.delivered
        ? "delivered"
        : token.carrierId === null
          ? "available"
          : "carried"
    ]++;
  return counts;
}

export function createRun(input: LevelDefinition): RunState {
  const level = validateLevel(input);
  const hive = level.objects.find((object) => object.kind === "hive")!;
  const center = objectCenter(hive);
  return {
    tick: 0,
    phase: "setup",
    bees: Array.from({ length: level.population }, (_, id) => ({
      id,
      ...center,
      direction: hive.direction,
      status: "hive",
      perchId: null,
      signalId: null,
      ...(level.rulesVersion >= 6 ? { danceVisits: [] } : {}),
    })),
    objects: level.objects,
    won: false,
    impossible: false,
    notice: "Place your guides, then open the hive.",
    commands: [],
    deployed: [],
    peakToolsPlaced: 0,
    ...(level.rulesVersion >= 5
      ? {
          pollen: level.objects
            .filter((object) => object.kind === "pollen")
            .map((object) => ({
              objectId: object.id,
              carrierId: null,
              delivered: false,
            })),
        }
      : {}),
    rallies: level.objects
      .filter((object) => object.kind === "rally")
      .map((object) => ({
        objectId: object.id,
        mode: "hold",
        nextReleaseTick: 0,
      })),
  };
}

function distanceSquared(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

/** Slab intersection avoids gaps in fan shadows and fast collision movement. */
export function segmentHits(
  object: Pick<GardenObject, "x" | "y" | "width" | "height">,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): boolean {
  let near = 0;
  let far = 1;
  for (const [start, delta, min, max] of [
    [x1, x2 - x1, object.x * UNITS, (object.x + object.width) * UNITS],
    [y1, y2 - y1, object.y * UNITS, (object.y + object.height) * UNITS],
  ]) {
    if (delta === 0) {
      if (start < min || start >= max) return false;
    } else {
      near = Math.max(
        near,
        Math.min((min - start) / delta, (max - start) / delta),
      );
      far = Math.min(
        far,
        Math.max((min - start) / delta, (max - start) / delta),
      );
      if (near > far) return false;
    }
  }
  return true;
}

export function airflowAt(
  objects: readonly GardenObject[],
  x: number,
  y: number,
  openGates: readonly string[] = [],
): { x: number; y: number } {
  let windX = 0;
  let windY = 0;
  for (const fan of objects) {
    if (fan.kind !== "fan") continue;
    const center = objectCenter(fan);
    const [dx, dy] = DIRECTIONS[fan.direction];
    const along = ((x - center.x) * dx + (y - center.y) * dy) / UNITS;
    const across = Math.abs((x - center.x) * dy - (y - center.y) * dx) / UNITS;
    if (along < 0 || along > fan.range * UNITS || across > 1.5 * UNITS)
      continue;
    if (
      objects.some(
        (object) =>
          (object.kind === "terrain" ||
            object.kind === "shelter" ||
            (object.kind === "gate" && !openGates.includes(object.id))) &&
          segmentHits(object, center.x, center.y, x, y),
      )
    )
      continue;
    windX += Math.trunc((dx * fan.strength * 35) / UNITS);
    windY += Math.trunc((dy * fan.strength * 35) / UNITS);
  }
  return { x: windX, y: windY };
}

/** A closing gate stays passable until its occupied rectangle clears. */
export function gateState(
  state: RunState,
  gate: GardenObject,
): "open" | "closing" | "closed" {
  if (
    state.bees.some(
      (bee) => bee.status === "assigned" && bee.perchId === gate.switchId,
    )
  )
    return "open";
  if (
    state.bees.some(
      (bee) =>
        bee.status === "flying" &&
        segmentHits(gate, bee.x, bee.y, bee.x, bee.y),
    )
  )
    return "closing";
  return "closed";
}

export function eligibleBee(
  state: RunState,
  perch: GardenObject,
  allowWaiting = false,
): Bee | undefined {
  if (state.phase === "setup")
    return state.bees.find((bee) => bee.status === "hive");
  const center = objectCenter(perch);
  return state.bees.find(
    (bee) =>
      (bee.status === "flying" || (allowWaiting && bee.status === "waiting")) &&
      (bee.liftRemaining ?? 0) === 0 &&
      distanceSquared(bee, center) <= UNITS ** 2,
  );
}

function followsLastBee(level: LevelDefinition, object: GardenObject): boolean {
  return (
    level.rulesVersion >= 7 &&
    object.kind === "dancer" &&
    object.dance !== "point"
  );
}

function danceHeading(direction: Direction, signal: GardenObject): Direction {
  if (signal.dance === "lift") return direction;
  return signal.dance === "point"
    ? signal.direction
    : (((direction +
        (signal.dance === "left" ? 6 : signal.dance === "right" ? 2 : 4)) %
        8) as Direction);
}

/** Commands are validated even when invoked without the UI. Failed commands do not enter the replay. */
export function applyCommand(
  level: LevelDefinition,
  original: RunState,
  command: RunCommand,
): RunState {
  const state: RunState = {
    ...original,
    bees: original.bees.map((bee) => ({ ...bee })),
    objects: original.objects.map((object) => ({ ...object })),
    rallies: original.rallies.map((rally) => ({ ...rally })),
  };
  if (state.phase === "finished")
    return {
      ...original,
      notice: "This attempt has finished. Restart to try again.",
    };
  if (state.commands.length >= 10000)
    return {
      ...original,
      notice:
        "This attempt has reached its action limit. Restart to try again.",
    };
  const reject = (notice: string): RunState => ({ ...original, notice });
  if (command.type === "start") {
    if (state.phase !== "setup") return reject("The hive is already open.");
    state.phase = "running";
    state.notice = "The hive is open. Remember to release your guides.";
  } else if (command.type === "finish") {
    if (!state.won) return reject("Reach the rescue target before finishing.");
    state.phase = "finished";
    state.notice = "The hive reached the flower field.";
  } else if (command.type === "place") {
    const stock = level.inventory?.find(
      (entry) => entry.id === command.stockId,
    );
    if (!stock) return reject("This garden does not supply that tool.");
    if (
      state.deployed.filter((entry) => entry.stockId === stock.id).length >=
      stock.count
    )
      return reject(
        "No tools remain in that supply. Return one before placing another.",
      );
    if (
      !/^[a-zA-Z0-9_-]{1,64}$/.test(command.objectId) ||
      state.objects.some((entry) => entry.id === command.objectId) ||
      state.deployed.some((entry) => entry.objectId === command.objectId)
    )
      return reject("Choose a unique tool ID.");
    const object: GardenObject = {
      id: command.objectId,
      kind: stock.kind,
      x: command.x,
      y: command.y,
      width: stock.width,
      height: stock.height,
      direction: stock.direction,
      range: stock.range,
      strength: stock.strength,
      permission: "movable",
      ...(stock.kind === "dancer" ? { dance: stock.dance } : {}),
    };
    const objects = [...state.objects, object];
    try {
      validateLevel({
        ...level,
        objects,
        inventory: [],
        // Runtime geometry includes deployed stock. Exclude the authored stock
        // budget and its optional goal from this geometry-only validation.
        ...(level.objectives
          ? { objectives: { pollen: level.objectives.pollen } }
          : {}),
      });
    } catch (cause) {
      return reject(
        cause instanceof Error && cause.message.includes("dry ground")
          ? cause.message
          : "Choose an empty position inside the garden for this tool.",
      );
    }
    if (object.kind === "dancer") {
      if (populationCounts(state).assigned >= level.guideLimit)
        return reject("All available dancer jobs are assigned.");
      const bee = eligibleBee(state, object, level.rulesVersion >= 8);
      if (!bee)
        return reject(
          state.phase === "setup"
            ? "No bees remain in the hive."
            : "A flying or waiting bee must be within one cell of this position.",
        );
      Object.assign(bee, objectCenter(object), {
        status: "assigned",
        perchId: object.id,
        signalId: null,
        direction: followsLastBee(level, object)
          ? danceHeading(bee.direction, object)
          : object.direction,
        danceVisits: [],
      });
    }
    state.objects = objects;
    state.deployed = [
      ...state.deployed,
      { objectId: object.id, stockId: stock.id },
    ];
    state.peakToolsPlaced = Math.max(
      state.peakToolsPlaced,
      state.deployed.length,
    );
    state.notice =
      object.kind === "dancer"
        ? "Dancer placed. One bee and one dance use are assigned."
        : "Tool placed. Its supply has been reduced by one.";
  } else {
    const object = state.objects.find((item) => item.id === command.objectId);
    if (!object) return reject("That object is not in this garden.");
    if (command.type === "rally") {
      const rally = state.rallies.find((entry) => entry.objectId === object.id);
      if (
        level.rulesVersion < 3 ||
        object.kind !== "rally" ||
        !rally ||
        !["hold", "release"].includes(command.mode)
      )
        return reject("Choose Hold or Release for a rally flower.");
      if (rally.mode === command.mode)
        return reject("This rally flower is already in that mode.");
      rally.mode = command.mode;
      rally.nextReleaseTick = state.tick;
      state.notice =
        command.mode === "hold"
          ? "Rally flower will hold arriving bees."
          : "Rally flower is releasing bees in order.";
    } else if (command.type === "recover") {
      if (!state.deployed.some((entry) => entry.objectId === object.id))
        return reject("Only tools placed from your supply can be returned.");
      if (object.kind === "dancer" && state.phase !== "setup")
        return reject(
          "Dance uses are spent once the hive opens. Release the bee to rescue it.",
        );
      const dancer = state.bees.find((bee) => bee.perchId === object.id);
      if (dancer && object.kind === "dancer") {
        const hive = state.objects.find((entry) => entry.kind === "hive")!;
        Object.assign(dancer, objectCenter(hive), {
          status: "hive",
          direction: hive.direction,
          perchId: null,
          signalId: null,
          danceVisits: [],
        });
      } else if (dancer)
        return reject("Release the guide before returning its perch.");
      state.objects = state.objects.filter((entry) => entry.id !== object.id);
      state.deployed = state.deployed.filter(
        (entry) => entry.objectId !== object.id,
      );
      state.notice = "Tool returned to your supply.";
    } else if (command.type === "assign") {
      if (
        object.kind !== "perch" &&
        object.kind !== "switch" &&
        object.kind !== "dancer"
      )
        return reject(
          "Only guide perches and switch flowers can host a helper.",
        );
      if (state.bees.some((bee) => bee.perchId === object.id))
        return reject("This perch already has a guide.");
      if (
        object.kind === "dancer" &&
        state.phase !== "setup" &&
        state.commands.some(
          ({ command: entry }) =>
            (entry.type === "assign" || entry.type === "place") &&
            entry.objectId === object.id,
        )
      )
        return reject("This dance use has been spent.");
      if (populationCounts(state).assigned >= level.guideLimit)
        return reject("All available guide jobs are assigned.");
      const bee = eligibleBee(state, object, level.rulesVersion >= 8);
      if (!bee)
        return reject(
          state.phase === "setup"
            ? "No bees remain in the hive."
            : "A flying or waiting bee must be within one cell of this piece.",
        );
      Object.assign(bee, objectCenter(object), {
        status: "assigned",
        perchId: object.id,
        signalId: null,
        direction: followsLastBee(level, object)
          ? danceHeading(bee.direction, object)
          : object.direction,
      });
      state.notice =
        object.kind === "switch"
          ? "Operator assigned. Its linked gates are open."
          : "Guide assigned. Release it once the other bees have passed.";
    } else if (command.type === "release") {
      const bee = state.bees.find(
        (item) => item.status === "assigned" && item.perchId === object.id,
      );
      if (!bee) return reject("There is no guide to release here.");
      if (state.phase === "setup") {
        const hive = state.objects.find((item) => item.kind === "hive")!;
        Object.assign(bee, objectCenter(hive), {
          status: "hive",
          direction: hive.direction,
        });
      } else {
        bee.status = "flying";
        if (!followsLastBee(level, object)) bee.direction = object.direction;
        if (object.kind === "dancer" && object.dance === "lift")
          bee.liftRemaining = LIFT_DISTANCE;
      }
      bee.perchId = null;
      bee.signalId = null;
      if (
        object.kind === "dancer" &&
        state.deployed.some((entry) => entry.objectId === object.id)
      ) {
        state.objects = state.objects.filter((entry) => entry.id !== object.id);
        if (state.phase === "setup")
          state.deployed = state.deployed.filter(
            (entry) => entry.objectId !== object.id,
          );
      }
      state.notice =
        object.kind === "switch"
          ? state.phase === "setup"
            ? "The operator returned to the hive."
            : "Operator released. Gates close once clear; guide this bee to the flowers."
          : state.phase === "setup"
            ? "The guide returned to the hive."
            : "The guide is flying toward the flowers.";
    } else {
      if (
        object.kind !== "fan" &&
        object.kind !== "perch" &&
        object.kind !== "dancer" &&
        object.kind !== "shelter" &&
        object.kind !== "switch" &&
        object.kind !== "rally"
      )
        return reject("Terrain and hazards cannot be changed during a puzzle.");
      if (object.permission === "fixed")
        return reject("This object is fixed by the level author.");
      if (command.type === "adjust") {
        if (followsLastBee(level, object))
          return reject(
            "This dancer follows the last bee it guided when released; no separate heading is needed.",
          );
        if (
          !Number.isInteger(command.direction) ||
          command.direction < 0 ||
          command.direction > 7 ||
          !Number.isInteger(command.strength) ||
          command.strength < 1 ||
          command.strength > 3
        )
          return reject("Choose a valid direction and strength.");
        object.direction = command.direction;
        object.strength = command.strength;
        state.notice = "Direction updated.";
      } else {
        if (object.permission !== "movable")
          return reject("This tool can turn but cannot move.");
        if (
          state.bees.some((bee) => bee.perchId === object.id) &&
          !(object.kind === "dancer" && state.phase === "setup")
        )
          return reject("Release the guide before moving its perch.");
        object.x = command.x;
        object.y = command.y;
        try {
          validateLevel({
            ...level,
            objects: state.objects,
            ...(level.schemaVersion !== 1 ? { inventory: [] } : {}),
            ...(level.objectives
              ? { objectives: { pollen: level.objectives.pollen } }
              : {}),
          });
        } catch (cause) {
          return reject(
            cause instanceof Error && cause.message.includes("dry ground")
              ? cause.message
              : "Choose an empty position inside the garden.",
          );
        }
        if (object.kind === "dancer") {
          const dancer = state.bees.find((bee) => bee.perchId === object.id);
          if (dancer) Object.assign(dancer, objectCenter(object));
        }
        state.notice = "Tool moved.";
      }
    }
  }
  state.commands = [
    ...original.commands,
    { tick: original.tick, command: { ...command } },
  ];
  return state;
}

function guideAt(
  position: { x: number; y: number },
  signalId: string | null,
  guides: GardenObject[],
  tolerance = 0,
): GardenObject | undefined {
  const candidates = guides.filter(
    (guide) =>
      distanceSquared(position, objectCenter(guide)) <=
      (guide.range * UNITS) ** 2 + tolerance,
  );
  candidates.sort(
    (a, b) =>
      distanceSquared(position, objectCenter(a)) -
        distanceSquared(position, objectCenter(b)) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  let signal = candidates[0];
  const previous = candidates.find((guide) => guide.id === signalId);
  // Keep the previous signal unless the replacement is at least 1/4 cell closer.
  if (
    previous &&
    signal &&
    Math.sqrt(distanceSquared(position, objectCenter(previous))) -
      Math.sqrt(distanceSquared(position, objectCenter(signal))) <
      UNITS / 4
  )
    signal = previous;
  return signal;
}

function followGuide(
  bee: Bee,
  signal: GardenObject | undefined,
  state: RunState,
  level: LevelDefinition,
): void {
  if (signal?.kind === "dancer") {
    if (!bee.danceVisits?.includes(signal.id)) {
      bee.direction = danceHeading(bee.direction, signal);
      if (signal.dance === "lift") bee.liftRemaining = LIFT_DISTANCE;
      if (followsLastBee(level, signal)) {
        const helper = state.bees.find(
          (candidate) =>
            candidate.status === "assigned" && candidate.perchId === signal.id,
        );
        if (helper) helper.direction = bee.direction;
      }
      bee.danceVisits = [...(bee.danceVisits ?? []), signal.id];
    }
  } else if (signal) bee.direction = signal.direction;
  bee.signalId = signal?.id ?? null;
}

/** First outside-to-inside contact on this tick's straight flight segment. */
function fieldEntry(
  guide: GardenObject,
  start: { x: number; y: number },
  vx: number,
  vy: number,
): number | null {
  const center = objectCenter(guide);
  const ox = start.x - center.x;
  const oy = start.y - center.y;
  const c = ox * ox + oy * oy - (guide.range * UNITS) ** 2;
  const a = vx * vx + vy * vy;
  if (c <= 0 || a === 0) return null;
  const b = ox * vx + oy * vy;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const entry = (-b - Math.sqrt(discriminant)) / a;
  return entry >= 0 && entry <= 1 ? entry : null;
}

function moveBee(
  bee: Bee,
  state: RunState,
  guides: GardenObject[],
  level: LevelDefinition,
  openGates: readonly string[],
): void {
  if (level.rulesVersion >= 6) {
    bee.danceVisits = (bee.danceVisits ?? []).filter((id) =>
      guides.some(
        (guide) =>
          guide.id === id &&
          distanceSquared(bee, objectCenter(guide)) <=
            (guide.range * UNITS + UNITS / 4) ** 2,
      ),
    );
  }
  followGuide(bee, guideAt(bee, bee.signalId, guides), state, level);
  const wind = airflowAt(state.objects, bee.x, bee.y, openGates);
  const [dx, dy] = DIRECTIONS[bee.direction];
  let vx = Math.trunc((dx * FLIGHT_SPEED) / UNITS) + wind.x;
  let vy = Math.trunc((dy * FLIGHT_SPEED) / UNITS) + wind.y;
  const speed = Math.hypot(vx, vy);
  if (speed > MAX_SPEED) {
    vx = Math.trunc((vx * MAX_SPEED) / speed);
    vy = Math.trunc((vy * MAX_SPEED) / speed);
  }
  const x = bee.x + vx;
  const y = bee.y + vy;
  if (
    state.objects.some(
      (object) =>
        ((object.kind === "terrain" &&
          !(object.elevation === "low" && (bee.liftRemaining ?? 0) > 0)) ||
          (object.kind === "gate" && !openGates.includes(object.id))) &&
        segmentHits(object, bee.x, bee.y, x, y),
    )
  ) {
    bee.direction = ((bee.direction + 4) % 8) as Direction;
    bee.signalId = null;
    return;
  }
  if (level.rulesVersion >= 6) {
    // Resolve only the path actually traveled: a rejected solid-contact step
    // cannot activate a field beyond the wall. Entry updates the next tick's
    // heading; it never redraws this tick's path or changes hazard detection.
    const entries = guides
      .filter((guide) => guide.kind === "dancer")
      .flatMap((guide) => {
        const time = fieldEntry(guide, bee, vx, vy);
        return time === null ? [] : [{ guide, time }];
      })
      .sort(
        (a, b) =>
          a.time - b.time ||
          (a.guide.id < b.guide.id ? -1 : a.guide.id > b.guide.id ? 1 : 0),
      );
    for (const { time } of entries) {
      const position = { x: bee.x + vx * time, y: bee.y + vy * time };
      followGuide(
        bee,
        guideAt(position, bee.signalId, guides, 1e-6),
        state,
        level,
      );
    }
  }
  const inWater = state.objects.some(
    (object) =>
      object.kind === "water" && segmentHits(object, bee.x, bee.y, x, y),
  );
  const distance = Math.hypot(vx, vy);
  const lift = bee.liftRemaining ?? 0;
  const landingFraction = lift > 0 ? Math.min(1, lift / distance) : 0;
  const landingX = bee.x + vx * landingFraction;
  const landingY = bee.y + vy * landingFraction;
  if (lift > 0) bee.liftRemaining = Math.max(0, lift - Math.round(distance));
  const grounded = (bee.liftRemaining ?? 0) === 0;
  const badLanding =
    lift > 0 &&
    grounded &&
    state.objects.some(
      (object) =>
        object.kind === "terrain" &&
        object.elevation === "low" &&
        segmentHits(object, landingX, landingY, x, y),
    );
  const atFlowers = state.objects.some(
    (object) =>
      grounded &&
      object.kind === "flowers" &&
      segmentHits(object, landingX, landingY, x, y),
  );
  const rally = state.objects.find(
    (object) =>
      grounded &&
      object.kind === "rally" &&
      object.id !== bee.rallyExitId &&
      state.rallies.some(
        (entry) => entry.objectId === object.id && entry.mode === "hold",
      ) &&
      segmentHits(object, landingX, landingY, x, y),
  );
  bee.x = x;
  bee.y = y;
  if (
    (inWater && level.rulesVersion < 6) ||
    x < 0 ||
    y < 0 ||
    x >= level.width * UNITS ||
    y >= level.height * UNITS
  )
    bee.status = "lost";
  else if (badLanding) {
    bee.status = "lost";
    bee.lossReason = "landing";
  } else if (atFlowers) bee.status = "rescued";
  else if (rally)
    Object.assign(bee, objectCenter(rally), {
      status: "waiting",
      perchId: rally.id,
      signalId: null,
    });
  if (bee.rallyExitId) {
    const exited = state.objects.find(
      (object) => object.id === bee.rallyExitId,
    )!;
    if (!segmentHits(exited, bee.x, bee.y, bee.x, bee.y))
      delete bee.rallyExitId;
  }
}

/** Advance exactly one tick. Pausing means not calling this; rendering rate is irrelevant. */
export function stepRun(level: LevelDefinition, previous: RunState): RunState {
  if (previous.phase !== "running") return previous;
  const state: RunState = {
    ...previous,
    bees: previous.bees.map((bee) => ({ ...bee })),
    rallies: previous.rallies.map((rally) => ({ ...rally })),
    ...(previous.pollen
      ? { pollen: previous.pollen.map((token) => ({ ...token })) }
      : {}),
  };
  if (state.tick % level.releaseInterval === 0) {
    const bee = state.bees.find((item) => item.status === "hive");
    if (bee) bee.status = "flying";
  }
  for (const rally of state.rallies) {
    if (rally.mode !== "release" || state.tick < rally.nextReleaseTick)
      continue;
    const bee = state.bees
      .filter(
        (item) => item.status === "waiting" && item.perchId === rally.objectId,
      )
      .sort((a, b) => a.id - b.id)[0];
    if (!bee) continue;
    const object = state.objects.find((item) => item.id === rally.objectId)!;
    Object.assign(bee, {
      status: "flying",
      perchId: null,
      signalId: null,
      direction: object.direction,
      rallyExitId: object.id,
    });
    rally.nextReleaseTick = state.tick + level.releaseInterval;
  }
  const openGates = state.objects
    .filter(
      (object) =>
        object.kind === "gate" && gateState(state, object) !== "closed",
    )
    .map((object) => object.id);
  const guides = state.objects.filter(
    (object) =>
      (object.kind === "perch" || object.kind === "dancer") &&
      state.bees.some((bee) => bee.perchId === object.id),
  );
  const rain = state.objects
    .filter(
      (object) =>
        object.kind === "sprinkler" &&
        sprinklerPhase(object, state.tick).phase === "rain",
    )
    .flatMap((object) => rainZones(state.objects, object, openGates));
  // Resolve authored token rectangles once per tick, not once per bee/token pair.
  const pollenObjects = new Map(
    state.pollen?.length
      ? state.objects
          .filter((object) => object.kind === "pollen")
          .map((object) => [object.id, object] as const)
      : [],
  );
  for (const bee of state.bees) {
    if (
      bee.status !== "flying" &&
      bee.status !== "assigned" &&
      bee.status !== "waiting"
    )
      continue;
    const { x, y } = bee;
    const liftBeforeMove = bee.liftRemaining ?? 0;
    const wasFlying = bee.status === "flying";
    if (bee.status === "flying") moveBee(bee, state, guides, level, openGates);
    if (rain.some((zone) => segmentHits(zone, x, y, bee.x, bee.y))) {
      bee.status = "lost";
      bee.lossReason = "rain";
      bee.perchId = null;
      bee.signalId = null;
    }
    const finalStatus = bee.status as BeeStatus;
    const traveled = Math.hypot(bee.x - x, bee.y - y);
    const groundedFrom =
      liftBeforeMove > 0 && traveled > 0
        ? Math.min(1, liftBeforeMove / traveled)
        : 0;
    for (const token of state.pollen ?? []) {
      if (token.delivered) continue;
      if (token.carrierId === bee.id && bee.status === "lost")
        token.carrierId = null;
      if (
        wasFlying &&
        (bee.liftRemaining ?? 0) === 0 &&
        bee.status !== "lost" &&
        token.carrierId === null &&
        segmentHits(
          pollenObjects.get(token.objectId)!,
          x + (bee.x - x) * groundedFrom,
          y + (bee.y - y) * groundedFrom,
          bee.x,
          bee.y,
        )
      )
        token.carrierId = bee.id;
      if (token.carrierId === bee.id && finalStatus === "rescued") {
        token.delivered = true;
        token.carrierId = null;
      }
    }
  }
  state.tick++;
  const counts = populationCounts(state);
  state.won = counts.rescued >= level.rescueTarget;
  state.impossible = level.population - counts.lost < level.rescueTarget;
  if (state.won && !previous.won)
    state.notice =
      "Rescue target reached! Keep going to bring every bee home, or finish.";
  if (state.impossible)
    state.notice =
      "Too few bees remain to reach the target. Restart to adjust your route.";
  if (counts.hive + counts.flying + counts.assigned + counts.waiting === 0) {
    state.phase = "finished";
    state.notice = state.won
      ? `${counts.rescued} bees reached the flowers.`
      : "This attempt is over. Restart to try another route.";
  }
  return state;
}

export function previewRoute(
  level: LevelDefinition,
  state: RunState,
  beeId: number,
  ticks = 90,
): Array<{ x: number; y: number }> {
  let preview: RunState = { ...state, phase: "running" };
  const route: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < Math.min(300, Math.max(0, Math.trunc(ticks))); i++) {
    preview = stepRun(level, preview);
    const bee = preview.bees.find((item) => item.id === beeId);
    if (!bee || bee.status === "lost" || bee.status === "rescued") break;
    if (bee.status === "flying") route.push({ x: bee.x, y: bee.y });
  }
  return route;
}
