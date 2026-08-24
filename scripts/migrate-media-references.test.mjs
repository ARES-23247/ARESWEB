import { describe, expect, it } from "vitest";
import {
  buildBackupManifest,
  parseMigrationArgs,
  planContentMigration,
  planManagedPhotoMigration,
  planNestedPhotoMigration,
  replaceManagedStorageUrls,
  storageObjectFromUrl,
} from "./migrate-media-references.mjs";

const bucket = "aresfirst-portal.firebasestorage.app";
const direct = (path) => `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=redacted`;
const assets = new Map([
  ["gallery/original.jpg", { photoId: "photo-1", path: "gallery/original.jpg", variant: "original" }],
  ["gallery/thumb.webp", { photoId: "photo-1", path: "gallery/thumb.webp", variant: "thumbnail" }],
]);

describe("media reference migration", () => {
  it("requires explicit bounded scope and production confirmations", () => {
    expect(parseMigrationArgs([
      "--project", "aresfirst-portal", "--bucket", bucket,
      "--scope", "content", "--collection", "posts", "--limit", "25",
    ])).toEqual(expect.objectContaining({ apply: false, scope: "content", collection: "posts", limit: 25 }));
    expect(() => parseMigrationArgs([
      "--project", "aresfirst-portal", "--bucket", bucket,
      "--scope", "managed-photos", "--apply",
    ])).toThrow("--confirm-project");
    expect(() => parseMigrationArgs([
      "--project", "aresfirst-portal", "--bucket", bucket,
      "--scope", "content", "--collection", "unknown",
    ])).toThrow("--collection");
  });

  it("parses and replaces managed URLs embedded in Markdown without retaining tokens", () => {
    expect(storageObjectFromUrl(direct("gallery/original.jpg"))).toEqual({ bucket, path: "gallery/original.jpg" });
    const result = replaceManagedStorageUrls(
      `Before ![robot](${direct("gallery/original.jpg")}) after`,
      bucket,
      assets,
      (asset) => `/managed/${asset.photoId}/${asset.variant}`,
    );
    expect(result.value).toBe("Before ![robot](/managed/photo-1/original) after");
    expect(result.references).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("redacted");
  });

  it("plans public content and private revision references by opaque photo ID", () => {
    const post = planContentMigration("posts/build-log", {
      content: `![robot](${direct("gallery/original.jpg")})`,
      thumbnail: direct("gallery/thumb.webp"),
    }, bucket, assets);
    expect(post).toMatchObject({
      eligible: true,
      unresolved: 0,
      updates: {
        content: "![robot](/api/photos/public/content/posts/build-log/photo-1/original)",
        thumbnail: "/api/photos/public/content/posts/build-log/photo-1/thumbnail",
        mediaPhotoIds: ["photo-1"],
      },
    });
    const revision = planContentMigration("posts/build-log/revisions/rev-1", {
      thumbnail: direct("gallery/thumb.webp"),
    }, bucket, assets, "admin");
    expect(revision.updates.thumbnail).toBe("/api/photos/admin/media/photo-1/thumbnail");
  });

  it("blocks unresolved references and removes legacy DTO URL fields", () => {
    const blocked = planContentMigration("posts/blocked", {
      thumbnail: direct("blog/missing.jpg"),
    }, bucket, assets);
    expect(blocked).toMatchObject({ eligible: false, unresolved: 1 });

    expect(planManagedPhotoMigration("imported_photos/photo-1", {
      storagePath: "gallery/original.jpg",
      thumbnailPath: "gallery/thumb.webp",
      publicUrl: direct("gallery/original.jpg"),
      thumbnailUrl: direct("gallery/thumb.webp"),
    }, bucket)).toMatchObject({
      eligible: true,
      unresolved: 0,
      deleteFields: ["publicUrl", "thumbnailUrl"],
    });
  });

  it("retains external URLs and blocks managed URL deletion when path metadata disagrees", () => {
    expect(planManagedPhotoMigration("imported_photos/photo-1", {
      storagePath: "gallery/original.jpg",
      publicUrl: "https://images.example.org/external.jpg",
    }, bucket)).toMatchObject({ eligible: false, unresolved: 0, deleteFields: [] });

    expect(planManagedPhotoMigration("imported_photos/photo-1", {
      storagePath: "gallery/different.jpg",
      publicUrl: direct("gallery/original.jpg"),
    }, bucket)).toMatchObject({ eligible: false, unresolved: 1, deleteFields: [] });

    expect(planNestedPhotoMigration("albums/practice/photos/external", {
      url: "https://images.example.org/external.jpg",
    }, bucket, assets)).toMatchObject({
      eligible: false,
      unresolved: 0,
      deleteFields: [],
    });
  });

  it("converts event associations to source IDs while preserving publication fields", () => {
    expect(planNestedPhotoMigration("events/practice/photos/attached", {
      url: direct("gallery/original.jpg"),
      thumbnailUrl: direct("gallery/thumb.webp"),
      publicationStatus: "published",
    }, bucket, assets)).toMatchObject({
      eligible: true,
      unresolved: 0,
      updates: { sourcePhotoId: "photo-1" },
      deleteFields: ["url", "thumbnailUrl"],
    });
  });

  it("builds a token-free rollback manifest with integrity hashes", () => {
    const plan = planContentMigration("posts/build-log", {
      content: `![robot](${direct("gallery/original.jpg")})`,
      thumbnail: direct("gallery/thumb.webp"),
      mediaPhotoIds: ["existing-photo"],
    }, bucket, assets);
    const manifest = buildBackupManifest({
      project: "aresfirst-portal",
      bucket,
      scope: "content",
      collection: "posts",
    }, [plan], "2026-08-23T00:00:00.000Z");
    expect(manifest.entries[0]).toMatchObject({
      documentPath: "posts/build-log",
      originalOpaqueFields: {
        mediaPhotoIds: { present: true, value: ["existing-photo"] },
      },
    });
    expect(manifest.entries[0].expectedUpdateHashes.content).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(manifest)).not.toContain("redacted");
    expect(JSON.stringify(manifest)).not.toContain("![robot]");
  });
});
