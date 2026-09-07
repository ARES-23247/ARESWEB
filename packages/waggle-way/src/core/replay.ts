import {
  applyCommand,
  createRun,
  stepRun,
  type RecordedCommand,
  type RunCommand,
  type RunState,
} from "./engine";
import {
  validateLevel,
  serializeLevel,
  type Direction,
  type LevelDefinition,
} from "./level";

export const MAX_REPLAY_TICKS = 54_000;
export const MAX_REPLAY_ACTIONS = 10_000;
export interface RunReplay {
  version: 1;
  rulesVersion: LevelDefinition["rulesVersion"];
  levelDefinition: string;
  endTick: number;
  commands: RecordedCommand[];
}

function exactObject(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Replay data must be an object.");
  const source = value as Record<string, unknown>;
  if (
    Object.keys(source).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(source, key))
  )
    throw new Error("Replay contains unsupported or missing fields.");
  return source;
}

function boundedInteger(value: unknown, min: number, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error("Replay contains an out-of-range number.");
  return value;
}

export function parseRunCommand(value: unknown): RunCommand {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid replay command.");
  const type = (value as Record<string, unknown>).type;
  if (type === "start" || type === "finish") {
    exactObject(value, ["type"]);
    return { type };
  }
  if (
    type !== "rally" &&
    type !== "assign" &&
    type !== "release" &&
    type !== "adjust" &&
    type !== "place" &&
    type !== "recover" &&
    type !== "move"
  )
    throw new Error("Unsupported replay command.");
  const keys =
    type === "rally"
      ? ["type", "objectId", "mode"]
      : type === "adjust"
        ? ["type", "objectId", "direction", "strength"]
        : type === "place"
          ? ["type", "objectId", "stockId", "x", "y"]
          : type === "move"
            ? ["type", "objectId", "x", "y"]
            : ["type", "objectId"];
  const source = exactObject(value, keys);
  if (
    typeof source.objectId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(source.objectId)
  )
    throw new Error("Invalid replay object ID.");
  const objectId = source.objectId;
  if (type === "rally") {
    if (source.mode !== "hold" && source.mode !== "release")
      throw new Error("Invalid rally mode.");
    return { type, objectId, mode: source.mode };
  }
  if (type === "place") {
    if (
      typeof source.stockId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(source.stockId)
    )
      throw new Error("Invalid replay supply ID.");
    return {
      type,
      objectId,
      stockId: source.stockId,
      x: boundedInteger(source.x, 0, 127),
      y: boundedInteger(source.y, 0, 71),
    };
  }
  if (type === "adjust")
    return {
      type,
      objectId,
      direction: boundedInteger(source.direction, 0, 7) as Direction,
      strength: boundedInteger(source.strength, 1, 3),
    };
  if (type === "move")
    return {
      type,
      objectId,
      x: boundedInteger(source.x, 0, 127),
      y: boundedInteger(source.y, 0, 71),
    };
  return { type, objectId };
}

/** Local compatibility uses exact canonical content, not a collision-prone hash. */
export function validateReplay(
  level: LevelDefinition,
  value: unknown,
): RunReplay {
  const source = exactObject(value, [
    "version",
    "rulesVersion",
    "levelDefinition",
    "endTick",
    "commands",
  ]);
  if (
    source.version !== 1 ||
    source.rulesVersion !== level.rulesVersion ||
    source.levelDefinition !== serializeLevel(level)
  )
    throw new Error(
      "This replay belongs to a different garden revision or rules version.",
    );
  const endTick = boundedInteger(source.endTick, 0, MAX_REPLAY_TICKS);
  if (
    !Array.isArray(source.commands) ||
    source.commands.length > MAX_REPLAY_ACTIONS
  )
    throw new Error("Replay has too many actions.");
  let previousTick = 0;
  const commands = source.commands.map((entry): RecordedCommand => {
    const action = exactObject(entry, ["tick", "command"]);
    const tick = boundedInteger(action.tick, previousTick, endTick);
    previousTick = tick;
    return { tick, command: parseRunCommand(action.command) };
  });
  return {
    version: 1,
    rulesVersion: level.rulesVersion,
    levelDefinition: source.levelDefinition as string,
    endTick,
    commands,
  };
}

export function captureReplay(
  level: LevelDefinition,
  run: RunState,
): RunReplay {
  return validateReplay(level, {
    version: 1,
    rulesVersion: level.rulesVersion,
    levelDefinition: serializeLevel(level),
    endTick: run.tick,
    commands: run.commands,
  });
}

export interface ReplayPlayback {
  readonly level: LevelDefinition;
  readonly replay: RunReplay;
  readonly run: RunState;
  readonly cursor: number;
}

/** Own validated input copies so later editor changes cannot change this attempt. */
export function createReplayPlayback(
  level: LevelDefinition,
  value: unknown,
): ReplayPlayback {
  const replay = validateReplay(level, value);
  const definition = validateLevel(level);
  return seekReplay(
    { level: definition, replay, run: createRun(definition), cursor: 0 },
    0,
  );
}

/** Advance incrementally, or reconstruct when seeking backward. Commands at the target tick are included. */
export function seekReplay(
  playback: ReplayPlayback,
  targetTick: number,
): ReplayPlayback {
  const { level, replay } = playback;
  boundedInteger(targetTick, 0, replay.endTick);
  let run = targetTick < playback.run.tick ? createRun(level) : playback.run;
  let cursor = targetTick < playback.run.tick ? 0 : playback.cursor;
  while (run.tick <= targetTick) {
    while (
      cursor < replay.commands.length &&
      replay.commands[cursor].tick === run.tick
    ) {
      const next = applyCommand(level, run, replay.commands[cursor].command);
      if (next.commands.length !== run.commands.length + 1)
        throw new Error(
          `Replay action ${cursor + 1} was rejected: ${next.notice}`,
        );
      run = next;
      cursor++;
    }
    if (run.tick === targetTick) break;
    const next = stepRun(level, run);
    if (next.tick === run.tick)
      throw new Error("Replay extends beyond an active attempt.");
    run = next;
  }
  return { level, replay, run, cursor };
}

/** Deterministic verification for bounded local fixtures; not public-server attestation. */
export function replayRun(level: LevelDefinition, value: unknown): RunState {
  const playback = createReplayPlayback(level, value);
  return seekReplay(playback, playback.replay.endTick).run;
}
