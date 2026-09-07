import { describe, expect, it } from "vitest";
import {
  addObject,
  createEditor,
  deleteObject,
  duplicateObject,
  editLevel,
  redoEdit,
  undoEdit,
  updateObject,
} from "@ares/waggle-way/editor";
import { createBlankLevel, serializeLevel } from "@ares/waggle-way/level";

describe("Waggle Way authoring history", () => {
  it("adds, moves, rotates, duplicates, and removes objects with exact undo/redo", () => {
    const initial = createEditor(createBlankLevel());
    expect(undoEdit(initial)).toBe(initial);
    expect(redoEdit(initial)).toBe(initial);
    expect(editLevel(initial, initial.level)).toBe(initial);
    const added = addObject(initial, "perch", 5, 7);
    const moved = updateObject(added, "perch-1", { x: 6, direction: 6 });
    const copy = duplicateObject(moved, "perch-1", 8, 7);
    expect(copy.level.objects.at(-1)).toMatchObject({
      id: "perch-2",
      direction: 6,
      x: 8,
    });
    const deleted = deleteObject(copy, "perch-1");
    expect(deleted.level.objects).toHaveLength(3);
    expect(serializeLevel(undoEdit(deleted).level)).toBe(
      serializeLevel(copy.level),
    );
    expect(serializeLevel(redoEdit(undoEdit(deleted)).level)).toBe(
      serializeLevel(deleted.level),
    );
    expect(serializeLevel(initial.level)).toBe(
      serializeLevel(createBlankLevel()),
    );
  });

  it("rejects invalid edits without mutating history or the garden", () => {
    const editor = createEditor(createBlankLevel());
    expect(() => addObject(editor, "water", 21, 7)).toThrow("overlaps");
    expect(() => deleteObject(editor, "hive")).toThrow("exactly one");
    expect(() => duplicateObject(editor, "missing", 1, 1)).toThrow("Select");
    expect(() => updateObject(editor, "missing", { x: 1 })).toThrow("Select");
    expect(() =>
      editLevel(editor, { ...editor.level, population: 0 }),
    ).toThrow();
    expect(editor.past).toHaveLength(0);
  });

  it("bounds history and clears redo when a new edit branches", () => {
    let editor = createEditor(createBlankLevel());
    for (let i = 0; i < 55; i++)
      editor = editLevel(editor, { ...editor.level, title: `Garden ${i}` });
    expect(editor.past).toHaveLength(50);
    editor = undoEdit(editor);
    expect(editor.future).toHaveLength(1);
    editor = addObject(editor, "fan", 5, 5);
    expect(editor.future).toHaveLength(0);
  });
});
