import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { adminDb } from "./firebase-admin";
import { logger } from "./logger";

const ARTIFACT_COLLECTION = "internal_public_artifacts";
const CHUNK_BYTES = 300 * 1024;
const MAX_CHUNKS = 128;
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MEMORY_TTL_MS = 60_000;
const ARTIFACT_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

interface ArtifactManifest {
  version: 1;
  encoding: "gzip-base64";
  contentType: string;
  chunkCount: number;
  compressedBytes: number;
  uncompressedBytes: number;
  sha256: string;
  generatedAt: string;
}

export interface PublicArtifact {
  body: string;
  contentType: string;
  generatedAt: string;
  etag: string;
}

interface MemoryEntry {
  artifact: PublicArtifact;
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryEntry>();

function assertArtifactKey(key: string): void {
  if (!ARTIFACT_KEY_PATTERN.test(key)) throw new Error("Invalid public artifact key.");
}

function isManifest(value: unknown): value is ArtifactManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<ArtifactManifest>;
  return manifest.version === 1
    && manifest.encoding === "gzip-base64"
    && typeof manifest.contentType === "string"
    && manifest.contentType.length > 0
    && manifest.contentType.length <= 200
    && Number.isSafeInteger(manifest.chunkCount)
    && (manifest.chunkCount ?? 0) >= 1
    && (manifest.chunkCount ?? 0) <= MAX_CHUNKS
    && Number.isSafeInteger(manifest.compressedBytes)
    && (manifest.compressedBytes ?? 0) >= 1
    && (manifest.compressedBytes ?? 0) <= CHUNK_BYTES * MAX_CHUNKS
    && Number.isSafeInteger(manifest.uncompressedBytes)
    && (manifest.uncompressedBytes ?? 0) >= 1
    && (manifest.uncompressedBytes ?? 0) <= MAX_UNCOMPRESSED_BYTES
    && typeof manifest.sha256 === "string"
    && /^[a-f0-9]{64}$/.test(manifest.sha256)
    && typeof manifest.generatedAt === "string"
    && Number.isFinite(Date.parse(manifest.generatedAt));
}

function artifactRef(key: string) {
  return adminDb.collection(ARTIFACT_COLLECTION).doc(key);
}

function chunkId(index: number): string {
  return String(index).padStart(4, "0");
}

/**
 * Reads an internal, compressed public artifact without querying its source
 * collections. Corrupt/missing artifacts fail closed to a caller-owned fallback.
 */
export async function readPublicArtifact(key: string): Promise<PublicArtifact | null> {
  assertArtifactKey(key);
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.artifact;

  try {
    const ref = artifactRef(key);
    const manifestSnapshot = await ref.get();
    const manifestValue = manifestSnapshot.data();
    if (!manifestSnapshot.exists || !isManifest(manifestValue)) return null;
    const manifest = manifestValue;
    const chunkRefs = Array.from(
      { length: manifest.chunkCount },
      (_, index) => ref.collection("chunks").doc(chunkId(index)),
    );
    const chunkSnapshots = await adminDb.getAll(...chunkRefs);
    const chunks: Buffer[] = [];
    for (const snapshot of chunkSnapshots) {
      const data = snapshot.data()?.data;
      if (!snapshot.exists || typeof data !== "string" || data.length > CHUNK_BYTES * 2) return null;
      chunks.push(Buffer.from(data, "base64"));
    }

    const compressed = Buffer.concat(chunks);
    if (compressed.length !== manifest.compressedBytes) return null;
    const digest = createHash("sha256").update(compressed).digest("hex");
    if (digest !== manifest.sha256) return null;
    const bodyBuffer = gunzipSync(compressed, { maxOutputLength: MAX_UNCOMPRESSED_BYTES });
    if (bodyBuffer.length !== manifest.uncompressedBytes) return null;

    const artifact = {
      body: bodyBuffer.toString("utf8"),
      contentType: manifest.contentType,
      generatedAt: manifest.generatedAt,
      etag: `"${manifest.sha256}"`,
    };
    memoryCache.set(key, { artifact, expiresAt: Date.now() + MEMORY_TTL_MS });
    return artifact;
  } catch (error) {
    logger.warn("public-artifact", "Unable to read durable public artifact", {
      artifactKey: key,
      error,
    });
    return null;
  }
}

/** Stores a bounded artifact in Firestore chunks below the per-document limit. */
export async function writePublicArtifact(
  key: string,
  body: string,
  contentType: string,
  generatedAt = new Date().toISOString(),
): Promise<PublicArtifact> {
  assertArtifactKey(key);
  if (!contentType || contentType.length > 200 || !Number.isFinite(Date.parse(generatedAt))) {
    throw new Error("Invalid public artifact metadata.");
  }
  const bodyBuffer = Buffer.from(body, "utf8");
  if (bodyBuffer.length < 1 || bodyBuffer.length > MAX_UNCOMPRESSED_BYTES) {
    throw new Error("Public artifact exceeds its uncompressed size limit.");
  }
  const compressed = gzipSync(bodyBuffer, { level: 9 });
  const chunks = Array.from(
    { length: Math.ceil(compressed.length / CHUNK_BYTES) },
    (_, index) => compressed.subarray(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES),
  );
  if (chunks.length < 1 || chunks.length > MAX_CHUNKS) {
    throw new Error("Public artifact exceeds its compressed chunk limit.");
  }

  const ref = artifactRef(key);
  const prior = await ref.get();
  const priorCount = isManifest(prior.data()) ? prior.data()!.chunkCount : 0;
  const digest = createHash("sha256").update(compressed).digest("hex");
  const manifest: ArtifactManifest = {
    version: 1,
    encoding: "gzip-base64",
    contentType,
    chunkCount: chunks.length,
    compressedBytes: compressed.length,
    uncompressedBytes: bodyBuffer.length,
    sha256: digest,
    generatedAt,
  };

  const batch = adminDb.batch();
  batch.set(ref, manifest);
  chunks.forEach((chunk, index) => {
    batch.set(ref.collection("chunks").doc(chunkId(index)), { data: chunk.toString("base64") });
  });
  for (let index = chunks.length; index < priorCount; index += 1) {
    batch.delete(ref.collection("chunks").doc(chunkId(index)));
  }
  await batch.commit();

  const artifact = {
    body,
    contentType,
    generatedAt,
    etag: `"${digest}"`,
  };
  memoryCache.set(key, { artifact, expiresAt: Date.now() + MEMORY_TTL_MS });
  return artifact;
}

/** Test seam for deterministic cache and corruption coverage. */
export function resetPublicArtifactMemoryCache(): void {
  memoryCache.clear();
}

