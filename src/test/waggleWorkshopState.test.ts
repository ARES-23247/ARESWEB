import { describe, expect, it } from "vitest";
import {
  createBlankLevel,
  makeObject,
  serializeLevel,
  type LevelDefinition,
} from "@ares/waggle-way/level";
import { applyCommand, createRun, stepRun } from "@ares/waggle-way/engine";
import { editLevel, redoEdit, undoEdit } from "@ares/waggle-way/editor";
import { replayRun } from "@ares/waggle-way/replay";
import {
  bindPublication,
  createWorkshop,
  editWorkshop,
  forgetPublications,
  recordWinningFlight,
  submissionEvidence,
  type PublicationBinding,
} from "../../packages/waggle-way/src/workshopState";

const metadata = {
  nickname: "Clover",
  difficulty: "gentle" as const,
  estimatedLength: "short" as const,
};
const binding: PublicationBinding = {
  id: "community-copy",
  version: 1,
  accountKey: "private-account-key",
  metadata,
};
function fly(level: LevelDefinition, tools = false, stopAtTarget = false) {
  let run = createRun(level);
  if (tools)
    run = applyCommand(level, run, {
      type: "place",
      stockId: "fan-stock",
      objectId: "placed-fan",
      x: 0,
      y: 0,
    });
  run = applyCommand(level, run, { type: "start" });
  while (run.phase !== "finished" && !(stopAtTarget && run.won))
    run = stepRun(level, run);
  return run;
}

describe("workshop submission evidence and identity", () => {
  it("captures faithful winning flights, ignores stale/unsuccessful callbacks and invalidates after edits and undo", () => {
    let state = createWorkshop();
    const level = state.editor.level;
    const run = fly(level);
    expect(recordWinningFlight(state, level, createRun(level))).toBe(state);
    expect(recordWinningFlight(state, { ...level }, run)).toBe(state);
    expect(
      recordWinningFlight(state, level, { ...createRun(level), won: true }),
    ).toBe(state);
    state = recordWinningFlight(state, level, run);
    expect(state.flights).toHaveLength(1);
    expect(replayRun(level, state.flights[0].replay)).toEqual(run);
    expect(submissionEvidence(level, state.flights).ready).toBe(true);
    const recorded = state;
    expect(editWorkshop(state, (editor) => editor)).toBe(state);
    state = editWorkshop(state, (editor) =>
      editLevel(editor, { ...editor.level, title: "Changed" }),
    );
    expect(state.flights).toEqual([]);
    expect(submissionEvidence(state.editor.level, recorded.flights).ready).toBe(
      false,
    );
    state = editWorkshop(state, undoEdit);
    expect(state.editor.level).toBe(level);
    expect(state.flights).toEqual([]);
    state = editWorkshop(state, redoEdit);
    expect(state.editor.level.title).toBe("Changed");
    expect(state.flights).toEqual([]);
  });

  it("keeps complementary rescue/pollen/tool witnesses and replaces dominated flights", () => {
    let state = createWorkshop({
      ...createBlankLevel(),
      rescueTarget: 1,
      objectives: { pollen: 2, maxTools: 0 },
      objects: [
        ...createBlankLevel().objects,
        makeObject("pollen-one", "pollen", 10, 7),
        makeObject("pollen-two", "pollen", 12, 7),
      ],
      inventory: [
        {
          id: "fan-stock",
          kind: "fan",
          count: 1,
          width: 1,
          height: 1,
          direction: 0,
          range: 2,
          strength: 1,
        },
      ],
    });
    const level = state.editor.level;
    expect(submissionEvidence(level, []).missing).toHaveLength(3);
    const early = fly(level, false, true);
    state = recordWinningFlight(state, level, early);
    expect(submissionEvidence(level, state.flights).ready).toBe(true);
    const fullWithTool = fly(level, true);
    const toolWorkshop = createWorkshop(level);
    expect(
      submissionEvidence(
        level,
        recordWinningFlight(
          toolWorkshop,
          toolWorkshop.editor.level,
          fullWithTool,
        ).flights,
      ).missing,
    ).toEqual(["Use at most 0 tools in a successful test flight."]);
    state = recordWinningFlight(state, level, fullWithTool);
    expect(state.flights).toHaveLength(2);
    expect(submissionEvidence(level, state.flights)).toMatchObject({
      ready: true,
      bestRescued: 8,
      bestPollen: 2,
      fewestTools: 0,
    });
    for (const witness of state.flights)
      expect(replayRun(level, witness.replay).won).toBe(true);
    const full = fly(level);
    state = recordWinningFlight(state, level, full);
    expect(state.flights).toHaveLength(1);
    state = recordWinningFlight(state, level, full);
    expect(state.flights).toHaveLength(1);
    expect(state.flights[0].tools).toBe(0);
    // A tool-only witness does not satisfy the advertised tool ceiling on its own.
    expect(
      submissionEvidence(level, [
        { replay: state.flights[0].replay, rescued: 8, pollen: 2, tools: 1 },
      ]).missing,
    ).toEqual(["Use at most 0 tools in a successful test flight."]);
  });

  it("preserves older evidence and the playable draft when a flight exceeds recording bounds", () => {
    let state = createWorkshop(createBlankLevel(1));
    const level = state.editor.level;
    const run = fly(level);
    state = recordWinningFlight(state, level, run);
    const prior = state.flights;
    state = recordWinningFlight(state, level, { ...run, tick: 54_001 });
    expect(state.flights).toBe(prior);
    expect(state.flightError).toContain("Earlier recordings are kept");
    expect(state.editor.level).toBe(level);
    state = recordWinningFlight(state, level, run);
    expect(state.flightError).toBeNull();
  });

  it("keeps ownership across ordinary edits/undo but never imports it from a matching level ID", () => {
    let state = createWorkshop();
    const level = state.editor.level;
    state = bindPublication(state, level, binding);
    state = editWorkshop(state, (editor) =>
      editLevel(editor, { ...editor.level, title: "Edited" }),
    );
    expect(state.origins.get(state.editor.level)?.publication).toEqual(binding);
    state = editWorkshop(
      state,
      (editor) =>
        editLevel(editor, {
          ...editor.level,
          instructions: "Imported instructions",
        }),
      null,
    );
    expect(state.origins.get(state.editor.level)).toBeNull();
    state = editWorkshop(state, undoEdit);
    expect(state.origins.get(state.editor.level)?.publication).toEqual(binding);
    state = editWorkshop(state, redoEdit);
    expect(state.origins.get(state.editor.level)).toBeNull();
    expect(serializeLevel(state.editor.level)).not.toContain(
      "private-account-key",
    );
    expect(serializeLevel(state.editor.level)).not.toContain("community-copy");
    // Even a byte-identical import explicitly starts an independent draft.
    state = bindPublication(state, state.editor.level, binding);
    state = editWorkshop(
      state,
      (editor) => editLevel(editor, editor.level),
      null,
    );
    expect(state.origins.get(state.editor.level)).toBeNull();
  });

  it("updates optimistic versions throughout retained history and ignores late bindings to replaced drafts", () => {
    let state = createWorkshop();
    const initial = state.editor.level;
    state = bindPublication(state, initial, binding);
    state = editWorkshop(state, (editor) =>
      editLevel(editor, { ...editor.level, title: "Revision" }),
    );
    const submitted = state.editor.level;
    state = bindPublication(state, submitted, {
      ...binding,
      version: 2,
      needsReload: true,
    });
    state = editWorkshop(state, undoEdit);
    expect(state.origins.get(initial)?.publication?.version).toBe(2);
    expect(state.origins.get(initial)?.publication?.needsReload).toBe(true);
    expect(bindPublication(state, submitted, { ...binding, version: 3 })).toBe(
      state,
    );
    for (let index = 0; index < 80; index++)
      state = editWorkshop(state, (editor) =>
        editLevel(editor, { ...editor.level, title: `Revision ${index}` }),
      );
    expect(state.origins.size).toBeLessThanOrEqual(51);
    expect(state.origins.has(initial)).toBe(false);
  });

  it("clears private bindings on deletion/account changes while retaining public remix source references", () => {
    let state = createWorkshop();
    const parent = { id: "public-parent", revision: 1 };
    state = editWorkshop(state, (editor) => editor, {
      publication: binding,
      parent,
    });
    const first = state.editor.level;
    state = editWorkshop(
      state,
      (editor) => editLevel(editor, { ...editor.level, title: "Second" }),
      { publication: { ...binding, id: "second" } },
    );
    const second = state.editor.level;
    state = forgetPublications(state, binding.id);
    expect(state.origins.get(first)).toEqual({ publication: null, parent });
    expect(state.origins.get(second)?.publication?.id).toBe("second");
    state = forgetPublications(state);
    expect(state.origins.get(first)).toEqual({ publication: null, parent });
    expect(state.origins.get(second)).toBeNull();
    expect(state.editor.level).toBe(second);
  });
});
