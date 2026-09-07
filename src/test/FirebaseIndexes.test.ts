import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface FirestoreIndex {
  collectionGroup?: string;
  queryScope?: string;
  fields?: Array<{ fieldPath?: string; order?: string; arrayConfig?: string }>;
}

describe("Firestore index configuration", () => {
  it("supports every Waggle Way discovery filter combination and deterministic cursors", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firestore.indexes.json"), "utf8"),
    ) as { indexes: FirestoreIndex[] };
    for (let mask = 0; mask < 8; mask++) {
      const fields: NonNullable<FirestoreIndex["fields"]> = [
        { fieldPath: "isDeleted", order: "ASCENDING" },
        { fieldPath: "visibility", order: "ASCENDING" },
      ];
      if (mask & 1)
        fields.push({
          fieldPath: "publishedCard.mechanics",
          arrayConfig: "CONTAINS",
        });
      if (mask & 2)
        fields.push({
          fieldPath: "publishedCard.difficulty",
          order: "ASCENDING",
        });
      if (mask & 4)
        fields.push({
          fieldPath: "publishedCard.estimatedLength",
          order: "ASCENDING",
        });
      fields.push(
        { fieldPath: "publishedAt", order: "DESCENDING" },
        { fieldPath: "__name__", order: "ASCENDING" },
      );
      expect(config.indexes).toContainEqual({
        collectionGroup: "waggle_levels",
        queryScope: "COLLECTION",
        fields,
      });
    }
    expect(config.indexes).toContainEqual({
      collectionGroup: "waggle_levels",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "isDeleted", order: "ASCENDING" },
        { fieldPath: "candidateStatus", order: "ASCENDING" },
        { fieldPath: "updatedAt", order: "DESCENDING" },
        { fieldPath: "__name__", order: "ASCENDING" },
      ],
    });
    expect(config.indexes).toContainEqual({
      collectionGroup: "waggle_levels",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "ownerUid", order: "ASCENDING" },
        { fieldPath: "isDeleted", order: "ASCENDING" },
      ],
    });
  });
  it("supports bounded report moderation and tombstone retirement", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firestore.indexes.json"), "utf8"),
    ) as { indexes: FirestoreIndex[] };
    for (const [collectionGroup, filter, expiry] of [
      ["waggle_levels", "isDeleted", "retireAt"],
      ["waggle_reports", "status", "expiresAt"],
    ]) {
      expect(config.indexes).toContainEqual({
        collectionGroup,
        queryScope: "COLLECTION",
        fields: [
          { fieldPath: filter, order: "ASCENDING" },
          { fieldPath: expiry, order: "ASCENDING" },
          { fieldPath: "__name__", order: "ASCENDING" },
        ],
      });
    }
  });
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
