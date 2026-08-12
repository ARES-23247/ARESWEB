import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

function assertBackfillOptions(options) {
  if (!options.project || !/^[a-z][a-z0-9-]{4,62}$/.test(options.project)) {
    throw new Error("--project must be an explicit Firebase project ID.");
  }
  if (!options.bucket || !/^[A-Za-z0-9._-]{3,222}$/.test(options.bucket)) {
    throw new Error("--bucket must be an explicit Firebase Storage bucket name.");
  }
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) {
    throw new Error("--limit must be an integer from 1 through 100.");
  }
  if (options.after && !/^[A-Za-z0-9_-]{1,300}$/.test(options.after)) {
    throw new Error("--after must be a valid photo document ID.");
  }
  if (options.apply && options.confirmProject !== options.project) {
    throw new Error("Writes require --confirm-project to exactly match --project.");
  }
  if (options.apply && options.confirmBucket !== options.bucket) {
    throw new Error("Writes require --confirm-bucket to exactly match --bucket.");
  }
}

export function parseBackfillArgs(argv) {
  const options = { apply: false, limit: 25, after: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      options.apply = true;
      continue;
    }
    if (!["--project", "--bucket", "--confirm-project", "--confirm-bucket", "--limit", "--after"].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    index += 1;
    if (argument === "--project") options.project = value;
    if (argument === "--bucket") options.bucket = value;
    if (argument === "--confirm-project") options.confirmProject = value;
    if (argument === "--confirm-bucket") options.confirmBucket = value;
    if (argument === "--after") options.after = value;
    if (argument === "--limit") options.limit = Number(value);
  }

  assertBackfillOptions(options);
  return options;
}

export function isEligiblePhotoRecord(data) {
  return data
    && data.isDeleted !== 1
    && typeof data.storagePath === "string"
    && data.storagePath.startsWith("gallery/")
    && !data.storagePath.includes("..")
    && !data.storagePath.includes("\\")
    && data.storagePath.length <= 1024
    && ["image/jpeg", "image/png", "image/webp"].includes(data.mimeType)
    && !(typeof data.thumbnailUrl === "string" && data.thumbnailUrl.startsWith("https://"))
    && !(typeof data.mediumUrl === "string" && data.mediumUrl.startsWith("https://"));
}

function loadBackfillDependencies() {
  return {
    firebase: require("../functions/lib/lib/firebase-admin.js"),
    imageImport: require("../functions/lib/lib/imageImport.js"),
    derivatives: require("../functions/lib/lib/photoDerivatives.js"),
  };
}

export async function runPhotoDerivativeBackfill(options, dependencies = null) {
  assertBackfillOptions(options);
  process.env.GCLOUD_PROJECT = options.project;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = options.project;
  process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: options.project,
    storageBucket: options.bucket,
  });

  const { firebase, imageImport, derivatives } = dependencies ?? loadBackfillDependencies();
  const { adminDb, adminStorage } = firebase;
  const admin = firebase.default;

  let query = adminDb.collection("imported_photos")
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(options.limit);
  if (options.after) query = query.startAfter(options.after);
  const snapshot = await query.get();
  const eligible = snapshot.docs.filter((document) => isEligiblePhotoRecord(document.data()));
  const nextCursor = snapshot.docs.at(-1)?.id ?? null;

  if (!options.apply) {
    return { mode: "dry-run", scanned: snapshot.size, eligible: eligible.length, updated: 0, failed: 0, nextCursor };
  }

  const bucket = adminStorage.bucket(options.bucket);
  let updated = 0;
  let failed = 0;
  for (const document of eligible) {
    const data = document.data();
    let stored = null;
    try {
      const sourceFile = bucket.file(data.storagePath);
      const [metadata] = await sourceFile.getMetadata();
      const sourceSize = Number.parseInt(String(metadata.size ?? ""), 10);
      if (!Number.isFinite(sourceSize) || sourceSize < 1 || sourceSize > MAX_SOURCE_BYTES) {
        throw new Error("Source object is outside the supported size limit.");
      }
      if (metadata.contentType !== data.mimeType) {
        throw new Error("Source object content type does not match Firestore metadata.");
      }
      const [source] = await sourceFile.download();
      const validation = imageImport.validateImageMagicBytes(
        source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength),
        MAX_SOURCE_BYTES,
        ["jpg", "png", "webp"],
      );
      const expectedFormat = data.mimeType === "image/jpeg" ? "jpg" : data.mimeType.slice("image/".length);
      if (!validation.valid || validation.format !== expectedFormat) {
        throw new Error("Source object failed format validation.");
      }

      const generated = await derivatives.generatePhotoDerivatives(source);
      stored = await derivatives.storeGeneratedPhotoDerivatives(
        bucket,
        `gallery/derivatives/backfill/${document.id}`,
        generated,
      );
      const update = { ...stored, derivativeGeneratedAt: new Date().toISOString() };
      const batch = adminDb.batch();
      batch.set(document.ref, update, { merge: true });
      if (typeof data.albumId === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(data.albumId)) {
        batch.set(
          adminDb.collection("albums").doc(data.albumId).collection("photos").doc(document.id),
          update,
          { merge: true },
        );
      }
      await batch.commit();
      updated += 1;
    } catch {
      if (stored) await derivatives.deleteStoredPhotoDerivatives(bucket, stored);
      failed += 1;
    }
  }

  return { mode: "apply", scanned: snapshot.size, eligible: eligible.length, updated, failed, nextCursor };
}

async function main() {
  try {
    const options = parseBackfillArgs(process.argv.slice(2));
    const result = await runPhotoDerivativeBackfill(options);
    console.log(JSON.stringify(result, null, 2));
    if (result.failed > 0) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Photo derivative backfill failed.");
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
