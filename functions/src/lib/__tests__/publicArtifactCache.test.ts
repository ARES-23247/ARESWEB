import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  let manifest: Record<string, unknown> | null = null;
  const chunks = new Map<string, Record<string, unknown>>();
  const manifestGet = vi.fn(async () => ({
    exists: manifest !== null,
    data: () => manifest ?? undefined,
  }));
  const chunkRef = vi.fn((id: string) => ({ kind: "chunk", id }));
  const artifactRef = {
    kind: "manifest",
    id: "artifact",
    get: manifestGet,
    collection: vi.fn(() => ({ doc: chunkRef })),
  };
  const collection = vi.fn(() => ({ doc: vi.fn(() => artifactRef) }));
  const batchSet = vi.fn((ref: { kind: string; id: string }, data: Record<string, unknown>) => {
    if (ref.kind === "manifest") manifest = data;
    else chunks.set(ref.id, data);
  });
  const batchDelete = vi.fn((ref: { id: string }) => chunks.delete(ref.id));
  const batchCommit = vi.fn(async () => undefined);
  const batch = vi.fn(() => ({ set: batchSet, delete: batchDelete, commit: batchCommit }));
  const getAll = vi.fn(async (...refs: Array<{ id: string }>) => refs.map((ref) => ({
    exists: chunks.has(ref.id),
    data: () => chunks.get(ref.id),
  })));
  return {
    get manifest() { return manifest; },
    set manifest(value: Record<string, unknown> | null) { manifest = value; },
    chunks,
    manifestGet,
    chunkRef,
    artifactRef,
    collection,
    batchSet,
    batchDelete,
    batchCommit,
    batch,
    getAll,
  };
});

vi.mock("../firebase-admin", () => ({
  adminDb: {
    collection: mocks.collection,
    batch: mocks.batch,
    getAll: mocks.getAll,
  },
}));

import {
  readPublicArtifact,
  resetPublicArtifactMemoryCache,
  writePublicArtifact,
} from "../publicArtifactCache";

describe("publicArtifactCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.manifest = null;
    mocks.chunks.clear();
    resetPublicArtifactMemoryCache();
  });

  it("round-trips a compressed artifact through durable opaque chunks", async () => {
    const body = `<?xml version="1.0"?>${"<url>https://aresfirst.org/docs/example</url>".repeat(2_000)}`;
    const written = await writePublicArtifact(
      "sitemap",
      body,
      "application/xml; charset=utf-8",
      "2026-08-26T12:00:00.000Z",
    );
    expect(written.body).toBe(body);
    expect(written.etag).toMatch(/^"[a-f0-9]{64}"$/);
    expect(mocks.batchSet).toHaveBeenCalled();
    expect(JSON.stringify(mocks.manifest)).not.toContain(body);

    resetPublicArtifactMemoryCache();
    const restored = await readPublicArtifact("sitemap");
    expect(restored).toEqual(written);
    expect(mocks.getAll).toHaveBeenCalledTimes(1);
  });

  it("uses a short in-memory layer without re-reading Firestore", async () => {
    await writePublicArtifact("sim-registry", "{\"simulations\":[]}", "application/json");
    vi.clearAllMocks();

    expect(await readPublicArtifact("sim-registry")).toEqual(expect.objectContaining({
      body: "{\"simulations\":[]}",
    }));
    expect(mocks.manifestGet).not.toHaveBeenCalled();
    expect(mocks.getAll).not.toHaveBeenCalled();
  });

  it("returns null for missing, corrupt, or incomplete durable data", async () => {
    expect(await readPublicArtifact("missing-artifact")).toBeNull();

    mocks.manifest = {
      version: 1,
      encoding: "gzip-base64",
      contentType: "application/json",
      chunkCount: 1,
      compressedBytes: 12,
      uncompressedBytes: 10,
      sha256: "a".repeat(64),
      generatedAt: "2026-08-26T12:00:00.000Z",
    };
    resetPublicArtifactMemoryCache();
    expect(await readPublicArtifact("corrupt-artifact")).toBeNull();
  });

  it("removes surplus chunks left by an older larger artifact", async () => {
    mocks.manifest = {
      version: 1,
      encoding: "gzip-base64",
      contentType: "text/plain",
      chunkCount: 3,
      compressedBytes: 900_000,
      uncompressedBytes: 1_000_000,
      sha256: "b".repeat(64),
      generatedAt: "2026-08-25T12:00:00.000Z",
    };
    mocks.chunks.set("0001", { data: "old" });
    mocks.chunks.set("0002", { data: "old" });

    await writePublicArtifact("sitemap", "small", "text/plain");

    expect(mocks.batchDelete).toHaveBeenCalledTimes(2);
    expect(mocks.batchDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "0001" }));
    expect(mocks.batchDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "0002" }));
  });

  it("rejects invalid keys, metadata, and empty artifacts", async () => {
    await expect(readPublicArtifact("Invalid Key")).rejects.toThrow("Invalid public artifact key");
    await expect(writePublicArtifact("valid-key", "", "text/plain")).rejects.toThrow(
      "uncompressed size limit",
    );
    await expect(writePublicArtifact("valid-key", "body", "", "not-a-date")).rejects.toThrow(
      "Invalid public artifact metadata",
    );
  });
});

