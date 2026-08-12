import { describe, expect, it } from "vitest";
import { getSimulationDraft, listSimulationDrafts, saveSimulationDraft } from "../lib/simulationDrafts";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
}

describe("simulation drafts", () => {
  it("saves, lists, and updates named local drafts", () => {
    const storage = memoryStorage();
    const first = saveSimulationDraft({ name: "Drive", files: { "Sim.tsx": "one" } }, storage);
    expect(listSimulationDrafts(storage)).toEqual([first]);
    const updated = saveSimulationDraft({ id: `local:${first.id}`, name: "Drive 2", files: { "Sim.tsx": "two" } }, storage);
    expect(updated.id).toBe(first.id);
    expect(getSimulationDraft(first.id, storage)?.files["Sim.tsx"]).toBe("two");
  });

  it("fails safely for malformed storage and invalid drafts", () => {
    expect(listSimulationDrafts({ getItem: () => "not-json" })).toEqual([]);
    expect(listSimulationDrafts({ getItem: () => JSON.stringify({ drafts: [] }) })).toEqual([]);
    expect(listSimulationDrafts({
      getItem: () => JSON.stringify([
        null,
        { id: "broken", name: "Broken", createdAt: "now", updatedAt: "now", files: { "Sim.tsx": 1 } },
        { id: "valid", name: "Valid", createdAt: "now", updatedAt: "now", files: { "Sim.tsx": "code", ignored: 1 } },
      ]),
    })).toEqual([expect.objectContaining({ id: "valid", files: { "Sim.tsx": "code" }, type: "local" })]);
    const storage = memoryStorage();
    expect(() => saveSimulationDraft({ name: "", files: {} }, storage)).toThrow(/required/i);
    expect(() => saveSimulationDraft({ name: "Large", files: { "Sim.tsx": "x".repeat(2 * 1024 * 1024 + 1) } }, storage)).toThrow(/too large/i);
    expect(getSimulationDraft("missing", storage)).toBeNull();
  });
});
