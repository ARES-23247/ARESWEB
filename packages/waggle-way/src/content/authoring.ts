import {
  addObject,
  createEditor,
  editLevel,
  updateObject,
  type EditorState,
} from "../core/editor";
import {
  createBlankLevel,
  parseLevelFile,
  serializeLevel,
  type GardenObject,
  type LevelDefinition,
  type ObjectKind,
  type SupportedVersion,
} from "../core/level";

/** Campaign authors use the same validated commands and export path as the workshop. */
export function begin(
  number: number,
  title: string,
  instructions: string,
  prefix = "sunny",
  version: SupportedVersion = 1,
): EditorState {
  const initial = createEditor(createBlankLevel(version));
  return editLevel(initial, {
    ...initial.level,
    id: `${prefix}-${String(number).padStart(2, "0")}`,
    title,
    instructions,
    population: 6,
    rescueTarget: 5,
    guideLimit: 2,
  });
}
export function piece(
  editor: EditorState,
  kind: ObjectKind,
  x: number,
  y: number,
  patch: Partial<GardenObject> = {},
): EditorState {
  const added = addObject(editor, kind, x, y);
  return updateObject(added, added.level.objects.at(-1)!.id, patch);
}
export function exported(editor: EditorState): LevelDefinition {
  return parseLevelFile(serializeLevel(editor.level));
}
