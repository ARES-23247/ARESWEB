import { describe, expect, it } from "vitest";
import { contentMediaUrl, normalizeDocumentMedia } from "@/lib/documentMedia";

describe("document media references", () => {
  it("builds owner-qualified same-origin URLs", () => {
    expect(contentMediaUrl("posts", "build-log", "photo-1", "thumbnail"))
      .toBe("/api/photos/public/content/posts/build-log/photo-1/thumbnail");
  });

  it("normalizes admin previews and records unique opaque photo IDs", () => {
    expect(normalizeDocumentMedia(
      "![robot](/api/photos/admin/media/photo-1/medium)\n![again](https://aresfirst.org/api/photos/admin/media/photo-1/original)",
      "/api/photos/admin/media/photo-2/thumbnail",
      "posts",
      "build-log",
    )).toEqual({
      content:
        "![robot](/api/photos/public/content/posts/build-log/photo-1/medium)\n![again](/api/photos/public/content/posts/build-log/photo-1/original)",
      thumbnail:
        "/api/photos/public/content/posts/build-log/photo-2/thumbnail",
      mediaPhotoIds: ["photo-1", "photo-2"],
    });
  });

  it("preserves external HTTPS images and rejects direct Storage delivery", () => {
    expect(normalizeDocumentMedia(
      "![external](https://images.example.org/robot.jpg)",
      "",
      "docs",
      "safe-doc",
    )).toEqual({
      content: "![external](https://images.example.org/robot.jpg)",
      thumbnail: "",
      mediaPhotoIds: [],
    });
    expect(normalizeDocumentMedia(
      "",
      "https://firebasestorage.googleapis.com/v0/b/team/o/gallery%2Fphoto.jpg?alt=media",
      "posts",
      "unsafe-post",
    )).toEqual(expect.objectContaining({ error: expect.stringContaining("ARES Gallery") }));
  });
});
