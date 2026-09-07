import { createEditor, type EditorState } from "./core/editor";
import { pollenCounts, populationCounts, type RunState } from "./core/engine";
import {
  createBlankLevel,
  serializeLevel,
  type LevelDefinition,
} from "./core/level";
import { captureReplay, type RunReplay } from "./core/replay";
import type { CommunityMetadata, CommunityParent } from "./core/community";

/** Session-only ownership hints. The server authorizes every submitted version. */
export interface PublicationBinding {
  id: string;
  version: number;
  accountKey: string;
  metadata: CommunityMetadata;
  needsReload?: boolean;
}

export interface DraftOrigin {
  publication: PublicationBinding | null;
  parent?: CommunityParent;
}

export interface WinningFlight {
  replay: RunReplay;
  rescued: number;
  pollen: number;
  tools: number;
}

export interface WorkshopState {
  editor: EditorState;
  /** Object identity binds undo history; these entries are never exported in level files. */
  origins: Map<LevelDefinition, DraftOrigin | null>;
  flights: WinningFlight[];
  flightError: string | null;
}

export function createWorkshop(level = createBlankLevel()): WorkshopState {
  return {
    editor: createEditor(level),
    origins: new Map(),
    flights: [],
    flightError: null,
  };
}

/** Undefined inherits ownership for ordinary edits; null starts an independent draft. */
export function editWorkshop(
  state: WorkshopState,
  change: (editor: EditorState) => EditorState,
  origin?: DraftOrigin | null,
): WorkshopState {
  const editor = change(state.editor);
  if (editor === state.editor && origin === undefined) return state;
  const origins = new Map(state.origins);
  if (origin !== undefined) origins.set(editor.level, origin);
  else if (!origins.has(editor.level))
    origins.set(editor.level, origins.get(state.editor.level) ?? null);
  const retained = new Set([editor.level, ...editor.past, ...editor.future]);
  for (const level of origins.keys())
    if (!retained.has(level)) origins.delete(level);
  return { editor, origins, flights: [], flightError: null };
}

export function bindPublication(
  state: WorkshopState,
  submittedLevel: LevelDefinition,
  binding: PublicationBinding,
): WorkshopState {
  if (state.editor.level !== submittedLevel) return state;
  const origins = new Map(state.origins);
  // Undo can change content, but must never resurrect an obsolete optimistic version.
  for (const [level, existing] of origins)
    if (
      existing?.publication?.id === binding.id &&
      existing.publication.accountKey === binding.accountKey
    )
      origins.set(level, { ...existing, publication: binding });
  origins.set(submittedLevel, {
    ...origins.get(submittedLevel),
    publication: binding,
  });
  return { ...state, origins };
}

export function forgetPublications(
  state: WorkshopState,
  id?: string,
): WorkshopState {
  const origins = new Map(state.origins);
  for (const [level, origin] of origins) {
    if (id === undefined || origin?.publication?.id === id)
      origins.set(
        level,
        origin?.parent ? { publication: null, parent: origin.parent } : null,
      );
  }
  return { ...state, origins };
}

/** Preserve at most three complementary successful flights; authority remains server-side. */
export function recordWinningFlight(
  state: WorkshopState,
  level: LevelDefinition,
  run: RunState,
): WorkshopState {
  if (state.editor.level !== level || !run.won) return state;
  const rescued = populationCounts(run).rescued;
  if (rescued < level.rescueTarget) return state;
  let replay: RunReplay;
  try {
    replay = captureReplay(level, run);
  } catch {
    return {
      ...state,
      flightError:
        "This flight could not be recorded for sharing. Try a shorter flight with fewer adjustments. Earlier recordings are kept.",
    };
  }
  const next: WinningFlight = {
    replay,
    rescued,
    pollen: pollenCounts(run).delivered,
    tools: run.peakToolsPlaced,
  };
  const candidates = [...state.flights, next];
  const bestRescue = candidates.toSorted(
    (a, b) =>
      b.rescued - a.rescued ||
      b.pollen - a.pollen ||
      a.tools - b.tools ||
      a.replay.endTick - b.replay.endTick,
  )[0];
  const bestPollen = candidates.toSorted(
    (a, b) =>
      b.pollen - a.pollen ||
      b.rescued - a.rescued ||
      a.tools - b.tools ||
      a.replay.endTick - b.replay.endTick,
  )[0];
  const fewestTools = candidates.toSorted(
    (a, b) =>
      a.tools - b.tools ||
      b.rescued - a.rescued ||
      b.pollen - a.pollen ||
      a.replay.endTick - b.replay.endTick,
  )[0];
  return {
    ...state,
    flights: [...new Set([bestRescue, bestPollen, fewestTools])],
    flightError: null,
  };
}

export function submissionEvidence(
  level: LevelDefinition,
  flights: WinningFlight[],
) {
  const canonical = serializeLevel(level);
  const current = flights.filter(
    (flight) => flight.replay.levelDefinition === canonical,
  );
  const bestRescued = Math.max(0, ...current.map((flight) => flight.rescued));
  const bestPollen = Math.max(0, ...current.map((flight) => flight.pollen));
  const fewestTools = current.length
    ? Math.min(...current.map((flight) => flight.tools))
    : null;
  const missing: string[] = [];
  if (bestRescued < level.rescueTarget)
    missing.push(
      `Rescue at least ${level.rescueTarget} bees in a test flight.`,
    );
  if (bestPollen < (level.objectives?.pollen ?? 0))
    missing.push(
      `Deliver ${level.objectives!.pollen} pollen in a successful test flight.`,
    );
  if (
    level.objectives?.maxTools !== undefined &&
    (fewestTools === null || fewestTools > level.objectives.maxTools)
  )
    missing.push(
      `Use at most ${level.objectives.maxTools} tools in a successful test flight.`,
    );
  return {
    replays: current.map((flight) => flight.replay),
    bestRescued,
    bestPollen,
    fewestTools,
    missing,
    ready: missing.length === 0,
  };
}
