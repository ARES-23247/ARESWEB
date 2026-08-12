import { STORAGE_KEYS } from "../utils/storageKeys";

export interface SimulationDraft {
  id: string;
  name: string;
  files: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  type: "local";
}

const MAX_DRAFTS = 25;
const MAX_SERIALIZED_BYTES = 2 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDraft(value: unknown): SimulationDraft | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string" ||
      typeof value.createdAt !== "string" || typeof value.updatedAt !== "string" || !isRecord(value.files)) return null;
  const files = Object.fromEntries(Object.entries(value.files).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  if (Object.keys(files).length === 0) return null;
  return { id: value.id, name: value.name, files, createdAt: value.createdAt, updatedAt: value.updatedAt, type: "local" };
}

export function listSimulationDrafts(storage: Pick<Storage, "getItem"> = window.localStorage): SimulationDraft[] {
  try {
    const raw = storage.getItem(STORAGE_KEYS.SIM_DRAFTS);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.flatMap((value) => parseDraft(value) ?? []).slice(0, MAX_DRAFTS) : [];
  } catch {
    return [];
  }
}

export function getSimulationDraft(id: string, storage: Pick<Storage, "getItem"> = window.localStorage): SimulationDraft | null {
  const normalizedId = id.replace(/^local:/, "");
  return listSimulationDrafts(storage).find((draft) => draft.id === normalizedId) ?? null;
}

export function saveSimulationDraft(
  input: { id?: string | null; name: string; files: Record<string, string> },
  storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage,
): SimulationDraft {
  const name = input.name.trim().slice(0, 120);
  if (!name || Object.keys(input.files).length === 0) throw new Error("A draft name and at least one file are required.");
  const serializedFiles = JSON.stringify(input.files);
  if (serializedFiles.length > MAX_SERIALIZED_BYTES) throw new Error("This draft is too large for local browser storage.");

  const existing = input.id ? getSimulationDraft(input.id, storage) : null;
  const now = new Date().toISOString();
  const draft: SimulationDraft = {
    id: existing?.id ?? crypto.randomUUID(),
    name,
    files: input.files,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    type: "local",
  };
  const drafts = [draft, ...listSimulationDrafts(storage).filter((item) => item.id !== draft.id)].slice(0, MAX_DRAFTS);
  storage.setItem(STORAGE_KEYS.SIM_DRAFTS, JSON.stringify(drafts));
  return draft;
}
