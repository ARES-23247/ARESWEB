import { describe, expect, it } from "vitest";
import { buildBackupManifest, planContentMigration, planNestedPhotoMigration } from "./migrate-media-references.mjs";
import { parseRollbackArgs, planRollbackEntry } from "./rollback-media-references.mjs";

const bucket = "aresfirst-portal.firebasestorage.app";
const direct = (path) => `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=secret`;
const assets = new Map([
  ["gallery/original.jpg", { photoId: "photo-1", path: "gallery/original.jpg", variant: "original" }],
  ["gallery/thumb.webp", { photoId: "photo-1", path: "gallery/thumb.webp", variant: "thumbnail" }],
]);
const deleteSentinel = Symbol("delete");

function manifestEntry(plan) {
  return buildBackupManifest({
    project: "aresfirst-portal",
    bucket,
    scope: "content",
    collection: "posts",
  }, [plan], "2026-08-23T00:00:00.000Z").entries[0];
}

describe("media reference rollback", () => {
  it("requires explicit matching confirmation before writes", () => {
    expect(parseRollbackArgs([
      "--project", "aresfirst-portal",
      "--bucket", bucket,
      "--manifest", "backup.json",
    ])).toMatchObject({ apply: false, project: "aresfirst-portal", bucket });
    expect(() => parseRollbackArgs([
      "--project", "aresfirst-portal",
      "--bucket", bucket,
      "--manifest", "backup.json",
      "--apply",
    ])).toThrow("--confirm-project");
  });

  it("reverses owner gateways to token-free canonical Storage URLs", () => {
    const plan = planContentMigration("posts/build-log", {
      content: `![robot](${direct("gallery/original.jpg")})`,
      thumbnail: direct("gallery/thumb.webp"),
      mediaPhotoIds: ["existing-photo"],
    }, bucket, assets);
    const current = {
      ...plan.updates,
      mediaMigrationVersion: 1,
      mediaMigratedAt: "2026-08-23T00:00:00.000Z",
    };
    const updates = planRollbackEntry(manifestEntry(plan), current, bucket, () => deleteSentinel);
    expect(updates.content).toBe(`![robot](https://storage.googleapis.com/${bucket}/gallery/original.jpg)`);
    expect(updates.thumbnail).toBe(`https://storage.googleapis.com/${bucket}/gallery/thumb.webp`);
    expect(updates.mediaPhotoIds).toEqual(["existing-photo"]);
    expect(updates.mediaMigrationVersion).toBe(deleteSentinel);
  });

  it("restores deleted nested URL fields and removes a newly added source ID", () => {
    const plan = planNestedPhotoMigration("events/practice/photos/attached", {
      url: direct("gallery/original.jpg"),
      thumbnailUrl: direct("gallery/thumb.webp"),
    }, bucket, assets);
    const entry = manifestEntry(plan);
    const current = {
      ...plan.updates,
      mediaMigrationVersion: 1,
      mediaMigratedAt: "2026-08-23T00:00:00.000Z",
    };
    const updates = planRollbackEntry(entry, current, bucket, () => deleteSentinel);
    expect(updates.url).toBe(`https://storage.googleapis.com/${bucket}/gallery/original.jpg`);
    expect(updates.thumbnailUrl).toBe(`https://storage.googleapis.com/${bucket}/gallery/thumb.webp`);
    expect(updates.sourcePhotoId).toBe(deleteSentinel);
  });

  it("refuses rollback when a migrated field changed later", () => {
    const plan = planContentMigration("posts/build-log", {
      content: `![robot](${direct("gallery/original.jpg")})`,
    }, bucket, assets);
    expect(() => planRollbackEntry(manifestEntry(plan), {
      ...plan.updates,
      content: "edited after migration",
      mediaMigrationVersion: 1,
    }, bucket, () => deleteSentinel)).toThrow("changed after migration");
  });
});
