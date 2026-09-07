import {
  makeObject,
  validateLevel,
  type GardenObject,
  type LevelDefinition,
  type ObjectKind,
} from "./level";

export interface EditorState {
  level: LevelDefinition;
  past: LevelDefinition[];
  future: LevelDefinition[];
}

export function createEditor(level: LevelDefinition): EditorState {
  return { level: validateLevel(level), past: [], future: [] };
}

export function editLevel(
  editor: EditorState,
  level: LevelDefinition,
): EditorState {
  const valid = validateLevel(level);
  if (JSON.stringify(valid) === JSON.stringify(editor.level)) return editor;
  return {
    level: valid,
    past: [...editor.past.slice(-49), editor.level],
    future: [],
  };
}

export function undoEdit(editor: EditorState): EditorState {
  const previous = editor.past.at(-1);
  return previous
    ? {
        level: previous,
        past: editor.past.slice(0, -1),
        future: [editor.level, ...editor.future],
      }
    : editor;
}

export function redoEdit(editor: EditorState): EditorState {
  const next = editor.future[0];
  return next
    ? {
        level: next,
        past: [...editor.past, editor.level],
        future: editor.future.slice(1),
      }
    : editor;
}

export function updateObject(
  editor: EditorState,
  id: string,
  patch: Partial<Omit<GardenObject, "id" | "kind">>,
): EditorState {
  if (!editor.level.objects.some((object) => object.id === id))
    throw new Error("Select an object in this garden.");
  return editLevel(editor, {
    ...editor.level,
    objects: editor.level.objects.map((object) =>
      object.id === id ? { ...object, ...patch } : object,
    ),
  });
}

function nextId(level: LevelDefinition, kind: ObjectKind): string {
  const ids = new Set(level.objects.map((object) => object.id));
  let index = 1;
  while (ids.has(`${kind}-${index}`)) index++;
  return `${kind}-${index}`;
}

export function addObject(
  editor: EditorState,
  kind: ObjectKind,
  x: number,
  y: number,
): EditorState {
  const object = makeObject(nextId(editor.level, kind), kind, x, y);
  if (kind === "gate") {
    const linked = editor.level.objects.find(
      (entry) => entry.kind === "switch",
    );
    if (!linked) throw new Error("Place a switch flower before adding a gate.");
    object.switchId = linked.id;
  }
  return editLevel(editor, {
    ...editor.level,
    objects: [...editor.level.objects, object],
  });
}

export function duplicateObject(
  editor: EditorState,
  id: string,
  x: number,
  y: number,
): EditorState {
  const source = editor.level.objects.find((object) => object.id === id);
  if (!source) throw new Error("Select an object to duplicate.");
  return editLevel(editor, {
    ...editor.level,
    objects: [
      ...editor.level.objects,
      { ...source, id: nextId(editor.level, source.kind), x, y },
    ],
  });
}

export function deleteObject(editor: EditorState, id: string): EditorState {
  const object = editor.level.objects.find((entry) => entry.id === id);
  const links = editor.level.objects.filter((entry) => entry.switchId === id);
  if (links.length)
    throw new Error(
      `Switch ${id} operates gates ${links.map((entry) => entry.id).join(", ")}. Relink or delete those gates first; Undo restores each edit.`,
    );
  if (object?.kind === "hive" || object?.kind === "flowers")
    throw new Error(
      "A garden needs exactly one hive and flower field. Move them instead of deleting them.",
    );
  return editLevel(editor, {
    ...editor.level,
    objects: editor.level.objects.filter((object) => object.id !== id),
  });
}
