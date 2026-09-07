import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface FieldOverride {
  collectionGroup: string;
  fieldPath: string;
  ttl?: boolean;
  indexes: unknown[];
}

describe("Firestore index source of truth", () => {
  it("keeps distributed quota and private garden audit expiry enabled and unindexed", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firestore.indexes.json"), "utf8"),
    ) as { fieldOverrides: FieldOverride[] };

    expect(config.fieldOverrides).toContainEqual({
      collectionGroup: "internal_api_quotas",
      fieldPath: "expiresAt",
      ttl: true,
      indexes: [],
    });
    expect(config.fieldOverrides).toContainEqual({
      collectionGroup: "waggle_events",
      fieldPath: "expiresAt",
      ttl: true,
      indexes: [{ order: "ASCENDING", queryScope: "COLLECTION" }],
    });
  });

  it("supports one bounded collection-group query for calendar occurrence dates", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firestore.indexes.json"), "utf8"),
    ) as { fieldOverrides: FieldOverride[] };

    expect(config.fieldOverrides).toContainEqual({
      collectionGroup: "occurrences",
      fieldPath: "date",
      indexes: [{ order: "ASCENDING", queryScope: "COLLECTION_GROUP" }],
    });
  });
});
