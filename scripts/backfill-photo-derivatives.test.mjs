import { describe, expect, it, vi } from "vitest";
import { isEligiblePhotoRecord, parseBackfillArgs, runPhotoDerivativeBackfill } from "./backfill-photo-derivatives.mjs";

describe("photo derivative backfill safety", () => {
  it("defaults to a bounded dry run", () => {
    expect(parseBackfillArgs([
      "--project", "aresfirst-portal",
      "--bucket", "aresfirst-portal.firebasestorage.app",
    ])).toEqual(expect.objectContaining({ apply: false, limit: 25, after: null }));
  });

  it("performs no Storage or Firestore writes during a dry run", async () => {
    const document = {
      id: "photo-legacy",
      data: () => ({
        storagePath: "gallery/uploads/photo.jpg",
        mimeType: "image/jpeg",
        isDeleted: 0,
      }),
    };
    const query = {
      orderBy: () => query,
      limit: () => query,
      startAfter: () => query,
      get: async () => ({ docs: [document], size: 1 }),
    };
    const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn() };
    const bucket = vi.fn();
    const result = await runPhotoDerivativeBackfill({
      apply: false,
      project: "aresfirst-portal",
      bucket: "aresfirst-portal.firebasestorage.app",
      limit: 25,
      after: null,
    }, {
      firebase: {
        adminDb: { collection: () => query, batch: () => batch },
        adminStorage: { bucket },
        adminFieldPath: { documentId: () => "__name__" },
        default: { firestore: { FieldPath: { documentId: () => "__name__" } } },
      },
      imageImport: {},
      derivatives: {},
    });

    expect(result).toEqual({
      mode: "dry-run",
      scanned: 1,
      eligible: 1,
      updated: 0,
      failed: 0,
      nextCursor: "photo-legacy",
    });
    expect(bucket).not.toHaveBeenCalled();
    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("requires exact project confirmation before writes", () => {
    expect(() => parseBackfillArgs([
      "--project", "aresfirst-portal",
      "--bucket", "aresfirst-portal.firebasestorage.app",
      "--apply",
    ])).toThrow("--confirm-project");
    expect(() => parseBackfillArgs([
      "--project", "aresfirst-portal",
      "--bucket", "aresfirst-portal.firebasestorage.app",
      "--apply",
      "--confirm-project", "different-project",
    ])).toThrow("exactly match");
    expect(() => parseBackfillArgs([
      "--project", "aresfirst-portal",
      "--bucket", "aresfirst-portal.firebasestorage.app",
      "--apply",
      "--confirm-project", "aresfirst-portal",
    ])).toThrow("--confirm-bucket");
    expect(() => parseBackfillArgs([
      "--project", "aresfirst-portal",
      "--bucket", "aresfirst-portal.firebasestorage.app",
      "--apply",
      "--confirm-project", "aresfirst-portal",
      "--confirm-bucket", "other-bucket",
    ])).toThrow("exactly match");
  });

  it("enforces write confirmations when invoked as a module", async () => {
    await expect(runPhotoDerivativeBackfill({
      apply: true,
      project: "aresfirst-portal",
      bucket: "aresfirst-portal.firebasestorage.app",
      limit: 1,
      after: null,
    })).rejects.toThrow("--confirm-project");
  });

  it("removes generated variants when an apply-mode Firestore commit fails", async () => {
    const document = {
      id: "photo-legacy",
      ref: { path: "imported_photos/photo-legacy" },
      data: () => ({
        storagePath: "gallery/uploads/photo.jpg",
        mimeType: "image/jpeg",
        isDeleted: 0,
      }),
    };
    const query = {
      orderBy: () => query,
      limit: () => query,
      startAfter: () => query,
      get: async () => ({ docs: [document], size: 1 }),
    };
    const commit = vi.fn().mockRejectedValue(new Error("Firestore unavailable"));
    const sourceFile = {
      getMetadata: vi.fn().mockResolvedValue([{ size: "4", contentType: "image/jpeg" }]),
      download: vi.fn().mockResolvedValue([Buffer.from([0xff, 0xd8, 0xff, 0xd9])]),
    };
    const stored = {
      thumbnailPath: "gallery/derivatives/backfill/photo-legacy-thumbnail.webp",
      mediumPath: "gallery/derivatives/backfill/photo-legacy-medium.webp",
    };
    const deleteStoredPhotoDerivatives = vi.fn().mockResolvedValue(undefined);
    const result = await runPhotoDerivativeBackfill({
      apply: true,
      project: "aresfirst-portal",
      bucket: "aresfirst-portal.firebasestorage.app",
      confirmProject: "aresfirst-portal",
      confirmBucket: "aresfirst-portal.firebasestorage.app",
      limit: 1,
      after: null,
    }, {
      firebase: {
        adminDb: {
          collection: () => query,
          batch: () => ({ set: vi.fn(), commit }),
        },
        adminStorage: { bucket: () => ({ file: () => sourceFile }) },
        adminFieldPath: { documentId: () => "__name__" },
        default: { firestore: { FieldPath: { documentId: () => "__name__" } } },
      },
      imageImport: { validateImageMagicBytes: () => ({ valid: true, format: "jpg" }) },
      derivatives: {
        generatePhotoDerivatives: vi.fn().mockResolvedValue({}),
        storeGeneratedPhotoDerivatives: vi.fn().mockResolvedValue(stored),
        deleteStoredPhotoDerivatives,
      },
    });

    expect(result).toEqual(expect.objectContaining({ mode: "apply", updated: 0, failed: 1 }));
    expect(commit).toHaveBeenCalledOnce();
    expect(deleteStoredPhotoDerivatives).toHaveBeenCalledWith(expect.anything(), stored);
  });

  it("rejects unbounded, malformed, and ambiguous arguments", () => {
    expect(() => parseBackfillArgs([])).toThrow("--project");
    expect(() => parseBackfillArgs(["--project", "aresfirst-portal", "--bucket", "bucket", "--limit", "101"])).toThrow("--limit");
    expect(() => parseBackfillArgs(["--project", "aresfirst-portal", "--bucket", "bucket", "--limit", "25items"])).toThrow("--limit");
    expect(() => parseBackfillArgs(["--project", "aresfirst-portal", "--bucket", "bucket", "--after", "../bad"])).toThrow("--after");
    expect(() => parseBackfillArgs(["--project", "aresfirst-portal", "--bucket", "bucket", "--unknown"])).toThrow("Unknown argument");
  });

  it("selects only active original-only safe image records", () => {
    const base = {
      storagePath: "gallery/uploads/2026-08-12/photo.jpg",
      mimeType: "image/jpeg",
      isDeleted: 0,
    };
    expect(isEligiblePhotoRecord(base)).toBe(true);
    expect(isEligiblePhotoRecord({ ...base, thumbnailUrl: "https://example.org/thumb.webp" })).toBe(false);
    expect(isEligiblePhotoRecord({ ...base, mediumUrl: "https://example.org/medium.webp" })).toBe(false);
    expect(isEligiblePhotoRecord({ ...base, isDeleted: 1 })).toBe(false);
    expect(isEligiblePhotoRecord({ ...base, storagePath: "../private/photo.jpg" })).toBe(false);
    expect(isEligiblePhotoRecord({ ...base, mimeType: "image/svg+xml" })).toBe(false);
  });
});
