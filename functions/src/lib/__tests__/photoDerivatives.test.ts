import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import {
  firebaseStoragePublicUrl,
  generatePhotoDerivatives,
  deleteStoredPhotoAssets,
  photoDerivativeDtoFields,
  deleteStoredPhotoDerivatives,
  storeGeneratedPhotoDerivatives,
  storePhotoAssets,
} from "../photoDerivatives";

describe("photo derivatives", () => {
  it("creates bounded WebP variants without enlarging the source", async () => {
    const source = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: "#c00000" },
    }).jpeg().toBuffer();

    const result = await generatePhotoDerivatives(source);

    expect(result).toMatchObject({ width: 1600, height: 900 });
    expect(result.original).toMatchObject({ width: 1600, height: 900 });
    expect((await sharp(result.original.buffer).metadata()).format).toBe("jpeg");
    expect(result.thumbnail).toMatchObject({ width: 480, height: 270 });
    expect(result.medium).toMatchObject({ width: 1280, height: 720 });
    expect((await sharp(result.thumbnail.buffer).metadata()).format).toBe("webp");
    expect((await sharp(result.medium.buffer).metadata()).format).toBe("webp");
  });

  it("does not upscale small images", async () => {
    const source = await sharp({
      create: { width: 320, height: 180, channels: 3, background: "#1a1a1a" },
    }).png().toBuffer();

    const result = await generatePhotoDerivatives(source);
    expect(result.thumbnail).toMatchObject({ width: 320, height: 180 });
    expect(result.medium).toMatchObject({ width: 320, height: 180 });
    expect((await sharp(result.original.buffer).metadata()).format).toBe("png");
  });

  it("removes EXIF and other source metadata from generated variants", async () => {
    const source = await sharp({
      create: { width: 640, height: 360, channels: 3, background: "#00334d" },
    })
      .withMetadata({ orientation: 6, exif: { IFD0: { Artist: "private source metadata" } } })
      .jpeg()
      .toBuffer();
    expect((await sharp(source).metadata()).exif).toBeDefined();

    const result = await generatePhotoDerivatives(source);
    expect(result).toMatchObject({ width: 360, height: 640 });
    expect(result.original).toMatchObject({ width: 360, height: 640 });

    for (const variant of [result.original, result.thumbnail, result.medium]) {
      const metadata = await sharp(variant.buffer).metadata();
      expect(metadata.exif).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
    }
  });

  it("rejects content that cannot be decoded as an image", async () => {
    await expect(generatePhotoDerivatives(Buffer.from("not an image"))).rejects.toThrow();
  });

  it("rejects decoder-supported formats outside the upload allowlist", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10"/></svg>');
    await expect(generatePhotoDerivatives(svg)).rejects.toThrow("Only decoded JPEG, PNG, and WebP");
  });

  it("stores all assets with immutable metadata and returns explicit locations", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);
    const file = vi.fn(() => ({ save, delete: remove }));
    const bucket = { name: "team-bucket", file };
    const generated = {
      width: 1600,
      height: 900,
      original: { buffer: Buffer.from("sanitized"), width: 1600, height: 900, fileSize: 7 },
      thumbnail: { buffer: Buffer.from("thumb"), width: 480, height: 270, fileSize: 5 },
      medium: { buffer: Buffer.from("medium"), width: 1280, height: 720, fileSize: 6 },
    };

    const stored = await storePhotoAssets(
      bucket,
      { path: "gallery/uploads/photo.jpg", mimeType: "image/jpeg" },
      "gallery/derivatives/photo",
      generated,
    );

    expect(file).toHaveBeenCalledTimes(3);
    expect(save).toHaveBeenCalledTimes(3);
    expect(save).toHaveBeenCalledWith(Buffer.from("sanitized"), expect.anything());
    expect(save).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({
      metadata: expect.objectContaining({ cacheControl: "public,max-age=31536000,immutable" }),
      resumable: false,
    }));
    expect(stored).toMatchObject({
      publicUrl: expect.stringContaining("gallery%2Fuploads%2Fphoto.jpg"),
      thumbnailUrl: expect.stringContaining("photo-thumbnail.webp"),
      mediumUrl: expect.stringContaining("photo-medium.webp"),
      width: 1600,
      height: 900,
    });
    expect(remove).not.toHaveBeenCalled();
    expect(firebaseStoragePublicUrl("bucket", "a/b.webp")).toContain("a%2Fb.webp");
  });

  it("removes every target when any Storage write fails", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    let calls = 0;
    const file = vi.fn(() => ({
      save: vi.fn(async () => {
        calls += 1;
        if (calls === 2) throw new Error("Storage unavailable");
      }),
      delete: remove,
    }));
    const generated = {
      width: 20,
      height: 10,
      original: { buffer: Buffer.from("sanitized"), width: 20, height: 10, fileSize: 7 },
      thumbnail: { buffer: Buffer.from("thumb"), width: 20, height: 10, fileSize: 5 },
      medium: { buffer: Buffer.from("medium"), width: 20, height: 10, fileSize: 6 },
    };

    await expect(storePhotoAssets(
      { name: "team-bucket", file },
      { path: "gallery/original.jpg", mimeType: "image/jpeg" },
      "gallery/derivatives/photo",
      generated,
    )).rejects.toThrow("Storage unavailable");
    expect(remove).toHaveBeenCalledTimes(3);
  });

  it("waits for late Storage writes to settle before partial-write cleanup", async () => {
    const order: string[] = [];
    let call = 0;
    const file = vi.fn(() => {
      call += 1;
      const current = call;
      return {
        save: vi.fn(async () => {
          if (current === 2) throw new Error("variant failed");
          await new Promise((resolve) => setTimeout(resolve, current === 3 ? 10 : 1));
          order.push(`save-${current}`);
        }),
        delete: vi.fn(async () => {
          order.push(`delete-${current}`);
        }),
      };
    });
    const generated = {
      width: 20,
      height: 10,
      original: { buffer: Buffer.from("sanitized"), width: 20, height: 10, fileSize: 7 },
      thumbnail: { buffer: Buffer.from("thumb"), width: 20, height: 10, fileSize: 5 },
      medium: { buffer: Buffer.from("medium"), width: 20, height: 10, fileSize: 6 },
    };

    await expect(storePhotoAssets(
      { name: "team-bucket", file },
      { path: "gallery/original.jpg", mimeType: "image/jpeg" },
      "gallery/derivatives/photo",
      generated,
    )).rejects.toThrow("variant failed");

    expect(order.indexOf("delete-1")).toBeGreaterThan(order.indexOf("save-3"));
    expect(order.filter((entry) => entry.startsWith("delete-"))).toHaveLength(3);
  });

  it("removes stored assets by their private paths without exposing URLs", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const file = vi.fn(() => ({ save: vi.fn(), delete: remove }));
    await deleteStoredPhotoAssets({ name: "bucket", file }, {
      storagePath: "gallery/original.jpg",
      thumbnailPath: "gallery/thumb.webp",
      mediumPath: "gallery/medium.webp",
    });
    expect(file).toHaveBeenCalledTimes(3);
    expect(remove).toHaveBeenCalledTimes(3);
  });

  it("returns safe nullable derivative DTO fields for legacy and malformed records", () => {
    expect(photoDerivativeDtoFields({
      thumbnailUrl: "https://images.example.org/thumb.webp",
      thumbnailWidth: 480,
      thumbnailHeight: -1,
      mediumUrl: "javascript:alert(1)",
      mediumWidth: 1.5,
      width: 1600,
      height: 900,
    })).toEqual({
      thumbnailUrl: "https://images.example.org/thumb.webp",
      thumbnailWidth: 480,
      thumbnailHeight: null,
      mediumUrl: null,
      mediumWidth: null,
      mediumHeight: null,
      width: 1600,
      height: 900,
    });
  });

  it("stores and removes derivative-only backfill assets", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);
    const file = vi.fn(() => ({ save, delete: remove }));
    const generated = {
      width: 20,
      height: 10,
      original: { buffer: Buffer.from("sanitized"), width: 20, height: 10, fileSize: 7 },
      thumbnail: { buffer: Buffer.from("thumb"), width: 20, height: 10, fileSize: 5 },
      medium: { buffer: Buffer.from("medium"), width: 20, height: 10, fileSize: 6 },
    };
    const stored = await storeGeneratedPhotoDerivatives(
      { name: "bucket", file },
      "gallery/derivatives/photo",
      generated,
    );
    expect(save).toHaveBeenCalledTimes(2);
    await deleteStoredPhotoDerivatives({ name: "bucket", file }, stored);
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("cleans derivative-only targets after a failed write", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const file = vi.fn()
      .mockReturnValueOnce({ save: vi.fn().mockResolvedValue(undefined), delete: remove })
      .mockReturnValueOnce({ save: vi.fn().mockRejectedValue(new Error("failed")), delete: remove });
    const generated = {
      width: 20,
      height: 10,
      original: { buffer: Buffer.from("sanitized"), width: 20, height: 10, fileSize: 7 },
      thumbnail: { buffer: Buffer.from("thumb"), width: 20, height: 10, fileSize: 5 },
      medium: { buffer: Buffer.from("medium"), width: 20, height: 10, fileSize: 6 },
    };
    await expect(storeGeneratedPhotoDerivatives(
      { name: "bucket", file },
      "gallery/derivatives/photo",
      generated,
    )).rejects.toThrow("failed");
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
