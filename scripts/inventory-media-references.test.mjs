import { describe, expect, it } from "vitest";
import {
  inspectMediaReferences,
  managedReferenceCoverage,
  parseInventoryArgs,
  storageObjectFromUrl,
} from "./inventory-media-references.mjs";

describe("media reference inventory", () => {
  it("requires explicit bounded production identifiers", () => {
    expect(parseInventoryArgs([
      "--project", "aresfirst-portal",
      "--bucket", "aresfirst-portal.firebasestorage.app",
      "--max-docs", "250",
      "--max-objects", "5000",
    ])).toEqual({
      project: "aresfirst-portal",
      bucket: "aresfirst-portal.firebasestorage.app",
      maxDocs: 250,
      maxObjects: 5000,
    });
    expect(() => parseInventoryArgs(["--project", "aresfirst-portal"])).toThrow("--bucket");
    expect(() => parseInventoryArgs([
      "--project", "aresfirst-portal",
      "--bucket", "aresfirst-portal.firebasestorage.app",
      "--max-docs", "10001",
    ])).toThrow("--max-docs");
  });

  it("parses canonical Firebase and Google Storage URLs", () => {
    expect(storageObjectFromUrl(
      "https://firebasestorage.googleapis.com/v0/b/team.firebasestorage.app/o/gallery%2Fphoto.jpg?alt=media&token=secret",
    )).toEqual({ bucket: "team.firebasestorage.app", path: "gallery/photo.jpg" });
    expect(storageObjectFromUrl(
      "https://storage.googleapis.com/team.appspot.com/editor/uploads/image.webp",
    )).toEqual({ bucket: "team.appspot.com", path: "editor/uploads/image.webp" });
    expect(storageObjectFromUrl("https://images.example.org/photo.jpg")).toBeNull();
  });

  it("reports aggregate field and prefix counts without returning source values", () => {
    const sourceUrl = "https://firebasestorage.googleapis.com/v0/b/team.firebasestorage.app/o/blog%2Fhero.webp?alt=media&token=secret";
    const result = inspectMediaReferences({
      thumbnail: sourceUrl,
      content: {
        nodes: [
          { attrs: { src: sourceUrl } },
          { attrs: { src: "https://images.example.org/external.jpg" } },
        ],
      },
    }, "team.firebasestorage.app");

    expect(result).toEqual({
      references: 2,
      fields: { thumbnail: 1, "content.nodes[].attrs.src": 1 },
      prefixes: { "blog/": 2 },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("hero.webp");
  });

  it("counts which legacy references can be replaced by managed photo paths", () => {
    const managedUrl = "https://firebasestorage.googleapis.com/v0/b/team.firebasestorage.app/o/gallery%2Fmanaged.webp?alt=media";
    const legacyUrl = "https://storage.googleapis.com/team.firebasestorage.app/blog/legacy.webp";
    expect(managedReferenceCoverage(
      [{ thumbnail: managedUrl }, { content: `![legacy](${legacyUrl})` }],
      new Set(["gallery/managed.webp"]),
      "team.firebasestorage.app",
    )).toEqual({ references: 2, resolvable: 1, unresolved: 1 });
  });
});
