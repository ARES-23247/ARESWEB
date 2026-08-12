import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface FirestoreIndex {
  collectionGroup?: string;
  queryScope?: string;
  fields?: Array<{ fieldPath?: string; order?: string }>;
}

describe("Firestore index configuration", () => {
  it("declares the active robots feed index used in production", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firestore.indexes.json"), "utf8"),
    ) as { indexes?: FirestoreIndex[] };

    expect(config.indexes).toContainEqual({
      collectionGroup: "robots",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "isDeleted", order: "ASCENDING" },
        { fieldPath: "createdAt", order: "DESCENDING" },
      ],
    });
    expect(config.indexes).toContainEqual({
      collectionGroup: "videos",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "status", order: "ASCENDING" },
        { fieldPath: "isDeleted", order: "ASCENDING" },
        { fieldPath: "createdAt", order: "DESCENDING" },
      ],
    });
  });
});
