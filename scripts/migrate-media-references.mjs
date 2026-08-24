#!/usr/bin/env node

import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MIGRATION_VERSION = 1;
const CONTENT_COLLECTIONS = new Set(["posts", "docs", "documents", "events", "albums"]);
const SCOPES = new Set(["managed-photos", "content", "revisions", "nested-photos"]);
const DIRECT_STORAGE_URL = /https:\/\/(?:firebasestorage\.googleapis\.com|storage\.googleapis\.com|[A-Za-z0-9._-]+\.storage\.googleapis\.com)\/[^\s<>"')\]]+/gu;
const EXISTING_GATEWAY = /\/api\/photos\/(?:admin\/media\/[A-Za-z0-9_-]{1,300}|public\/content\/(?:posts|docs|documents)\/[A-Za-z0-9_-]{1,300}\/[A-Za-z0-9_-]{1,300})\/(?:original|medium|thumbnail)/gu;

function integer(value, label, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${label} must be an integer from 1 through ${maximum}.`);
  }
  return parsed;
}

function safeDocumentPath(value) {
  if (typeof value !== "string" || value.length > 1_500 || value.includes("\\")) return false;
  const segments = value.split("/");
  return segments.length >= 2 && segments.length % 2 === 0 && segments.every((segment) => /^[A-Za-z0-9_-]{1,300}$/.test(segment));
}

function fieldHash(value) {
  return createHash("sha256").update(JSON.stringify(value) ?? "undefined").digest("hex");
}

export function parseMigrationArgs(argv) {
  const options = { apply: false, limit: 50 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      options.apply = true;
      continue;
    }
    if (![
      "--project", "--bucket", "--scope", "--collection", "--limit",
      "--after-path", "--confirm-project", "--confirm-bucket", "--backup-file",
    ].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    index += 1;
    if (argument === "--project") options.project = value;
    if (argument === "--bucket") options.bucket = value;
    if (argument === "--scope") options.scope = value;
    if (argument === "--collection") options.collection = value;
    if (argument === "--limit") options.limit = integer(value, "--limit", 100);
    if (argument === "--after-path") options.afterPath = value;
    if (argument === "--confirm-project") options.confirmProject = value;
    if (argument === "--confirm-bucket") options.confirmBucket = value;
    if (argument === "--backup-file") options.backupFile = value;
  }
  if (!options.project || !/^[a-z][a-z0-9-]{4,62}$/.test(options.project)) {
    throw new Error("--project must be an explicit Firebase project ID.");
  }
  if (!options.bucket || !/^[A-Za-z0-9._-]{3,222}$/.test(options.bucket)) {
    throw new Error("--bucket must be an explicit Firebase Storage bucket name.");
  }
  if (!SCOPES.has(options.scope)) throw new Error("--scope must name a supported migration scope.");
  if (options.scope === "content" && !CONTENT_COLLECTIONS.has(options.collection)) {
    throw new Error("The content scope requires --collection posts, docs, documents, events, or albums.");
  }
  if (options.afterPath && !safeDocumentPath(options.afterPath)) {
    throw new Error("--after-path must be a valid full Firestore document path.");
  }
  if (options.apply) {
    if (options.confirmProject !== options.project) throw new Error("Writes require --confirm-project to exactly match --project.");
    if (options.confirmBucket !== options.bucket) throw new Error("Writes require --confirm-bucket to exactly match --bucket.");
    if (!options.backupFile) throw new Error("Writes require --backup-file.");
    if (existsSync(resolve(options.backupFile))) throw new Error("The backup file already exists; choose a new path.");
  }
  return options;
}

function decoded(value) {
  try { return decodeURIComponent(value); } catch { return null; }
}

export function storageObjectFromUrl(value) {
  if (typeof value !== "string" || value.length > 4_096) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:") return null;
  if (url.hostname === "firebasestorage.googleapis.com") {
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/u);
    const bucket = match?.[1] ? decoded(match[1]) : null;
    const path = match?.[2] ? decoded(match[2]) : null;
    return bucket && path ? { bucket, path } : null;
  }
  if (url.hostname === "storage.googleapis.com") {
    const match = url.pathname.match(/^\/([^/]+)\/(.+)$/u);
    const bucket = match?.[1] ? decoded(match[1]) : null;
    const path = match?.[2] ? decoded(match[2]) : null;
    return bucket && path ? { bucket, path } : null;
  }
  const virtual = url.hostname.match(/^(.+)\.storage\.googleapis\.com$/u);
  const path = decoded(url.pathname.replace(/^\//u, ""));
  return virtual?.[1] && path ? { bucket: virtual[1], path } : null;
}

function publicGateway(collection, contentId, photoId, variant) {
  return `/api/photos/public/content/${collection}/${encodeURIComponent(contentId)}/${encodeURIComponent(photoId)}/${variant}`;
}

function adminGateway(photoId, variant) {
  return `/api/photos/admin/media/${encodeURIComponent(photoId)}/${variant}`;
}

function existingGatewayPhotoIds(value) {
  if (typeof value !== "string") return [];
  return [...value.matchAll(EXISTING_GATEWAY)].flatMap((match) => {
    const parts = match[0].split("/");
    const marker = parts.indexOf("media");
    if (marker >= 0) return parts[marker + 1] ? [parts[marker + 1]] : [];
    const content = parts.indexOf("content");
    return content >= 0 && parts[content + 3] ? [parts[content + 3]] : [];
  });
}

export function replaceManagedStorageUrls(value, expectedBucket, assetByPath, replacement) {
  if (typeof value !== "string") return { value, references: [], unresolved: 0 };
  const references = [];
  let unresolved = 0;
  const replaced = value.replace(DIRECT_STORAGE_URL, (candidate) => {
    const normalizedCandidate = candidate.replace(/[},.;]+$/u, "");
    const suffix = candidate.slice(normalizedCandidate.length);
    const object = storageObjectFromUrl(normalizedCandidate);
    if (!object || object.bucket !== expectedBucket) return candidate;
    const asset = assetByPath.get(object.path);
    if (!asset) {
      unresolved += 1;
      return candidate;
    }
    references.push(asset);
    return `${replacement(asset)}${suffix}`;
  });
  return { value: replaced, references, unresolved };
}

export function planContentMigration(documentPath, data, expectedBucket, assetByPath, mode = "public") {
  const segments = documentPath.split("/");
  const collection = segments[0];
  const contentId = segments[1];
  const isRevision = segments.length === 4 && segments[2] === "revisions";
  const fields = collection === "events"
    ? ["coverImage"]
    : collection === "albums"
      ? ["coverImageUrl"]
      : ["content", "thumbnail"];
  const updates = {};
  const deleteFields = [];
  const references = [];
  let unresolved = 0;

  for (const field of fields) {
    const current = data[field];
    if (typeof current !== "string" || !current) continue;
    const result = replaceManagedStorageUrls(
      current,
      expectedBucket,
      assetByPath,
      (asset) => mode === "admin" || isRevision
        ? adminGateway(asset.photoId, asset.variant)
        : publicGateway(collection, contentId, asset.photoId, asset.variant),
    );
    unresolved += result.unresolved;
    references.push(...result.references);
    if (result.value !== current) updates[field] = result.value;
  }

  if (collection === "events" && references.length > 0) {
    updates.coverPhotoId = references[0].photoId;
    deleteFields.push("coverImage");
    delete updates.coverImage;
  }
  if (collection === "albums" && references.length > 0) {
    updates.coverPhotoId = references[0].photoId;
    deleteFields.push("coverImageUrl");
    delete updates.coverImageUrl;
  }
  if (["posts", "docs", "documents"].includes(collection)) {
    const currentMediaPhotoIds = Array.isArray(data.mediaPhotoIds)
      ? data.mediaPhotoIds.filter((id) => typeof id === "string").slice(0, 100)
      : [];
    const ids = new Set([
      ...currentMediaPhotoIds,
      ...existingGatewayPhotoIds(data.content),
      ...existingGatewayPhotoIds(data.thumbnail),
      ...references.map((asset) => asset.photoId),
    ]);
    const nextMediaPhotoIds = [...ids].slice(0, 100);
    const hasCanonicalMediaPhotoIds = Array.isArray(data.mediaPhotoIds)
      && data.mediaPhotoIds.length === currentMediaPhotoIds.length
      && nextMediaPhotoIds.length === currentMediaPhotoIds.length
      && nextMediaPhotoIds.every((id, index) => id === currentMediaPhotoIds[index]);
    if (nextMediaPhotoIds.length > 0 && !hasCanonicalMediaPhotoIds) {
      updates.mediaPhotoIds = nextMediaPhotoIds;
    }
  }
  return {
    documentPath,
    eligible: Object.keys(updates).length > 0 || deleteFields.length > 0,
    unresolved,
    updates,
    deleteFields,
    references: references.map(({ photoId, path, variant }) => ({ photoId, path, variant })),
    original: Object.fromEntries(
      [...fields, "mediaPhotoIds", "coverPhotoId"]
        .map((field) => [field, data[field]]),
    ),
  };
}

export function planManagedPhotoMigration(documentPath, data, expectedBucket) {
  const photoId = documentPath.split("/").at(-1);
  const fieldPaths = {
    publicUrl: [data.storagePath],
    thumbnailUrl: [data.thumbnailPath, data.storagePath],
    mediumUrl: [data.mediumPath, data.storagePath],
  };
  const fieldVariants = {
    publicUrl: "original",
    thumbnailUrl: "thumbnail",
    mediumUrl: "medium",
  };
  const deleteFields = [];
  const references = [];
  let unresolved = 0;
  for (const field of Object.keys(fieldPaths)) {
    const object = storageObjectFromUrl(data[field]);
    if (!object || object.bucket !== expectedBucket) continue;
    const knownPaths = fieldPaths[field].filter((path) => typeof path === "string" && path);
    if (!knownPaths.includes(object.path)) {
      unresolved += 1;
      continue;
    }
    deleteFields.push(field);
    references.push({ photoId, path: object.path, variant: fieldVariants[field] });
  }
  return {
    documentPath,
    eligible: deleteFields.length > 0,
    unresolved,
    updates: {},
    deleteFields,
    references,
    original: Object.fromEntries(
      [...deleteFields, "sourcePhotoId"].map((field) => [field, data[field]]),
    ),
  };
}

export function planNestedPhotoMigration(documentPath, data, expectedBucket, assetByPath) {
  const segments = documentPath.split("/");
  const parentCollection = segments[0];
  const candidateFields = ["publicUrl", "url", "thumbnailUrl", "mediumUrl"].filter(
    (field) => typeof data[field] === "string" && data[field],
  );
  const deleteFields = [];
  const references = [];
  let unresolved = 0;
  for (const field of candidateFields) {
    const result = replaceManagedStorageUrls(data[field], expectedBucket, assetByPath, (asset) => adminGateway(asset.photoId, asset.variant));
    if (result.references.length > 0 || result.unresolved > 0) deleteFields.push(field);
    references.push(...result.references);
    unresolved += result.unresolved;
  }
  const updates = {};
  if (parentCollection === "events") {
    const sourcePhotoId = typeof data.sourcePhotoId === "string"
      ? data.sourcePhotoId
      : references.find((asset) => asset.variant === "original")?.photoId;
    if (sourcePhotoId) updates.sourcePhotoId = sourcePhotoId;
    else if (deleteFields.length > 0) unresolved += 1;
  }
  return {
    documentPath,
    eligible: deleteFields.length > 0 || Object.keys(updates).length > 0,
    unresolved,
    updates,
    deleteFields,
    references: references.map(({ photoId, path, variant }) => ({ photoId, path, variant })),
    original: Object.fromEntries(deleteFields.map((field) => [field, data[field]])),
  };
}

function loadFirebase(project, bucketName) {
  const requireFromFunctions = createRequire(resolve(process.cwd(), "functions/package.json"));
  const { getApps, initializeApp } = requireFromFunctions("firebase-admin/app");
  const { FieldPath, FieldValue, getFirestore } = requireFromFunctions("firebase-admin/firestore");
  const app = getApps()[0] ?? initializeApp({ projectId: project, storageBucket: bucketName });
  return { db: getFirestore(app), documentId: FieldPath.documentId(), deleteField: FieldValue.delete };
}

async function buildAssetIndex(db, documentId) {
  const assetByPath = new Map();
  let cursor = null;
  let count = 0;
  while (true) {
    let query = db.collection("imported_photos").orderBy(documentId).limit(500);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    for (const document of snapshot.docs) {
      for (const [field, variant] of [["storagePath", "original"], ["thumbnailPath", "thumbnail"], ["mediumPath", "medium"]]) {
        const path = document.data()[field];
        if (typeof path !== "string" || !path) continue;
        if (assetByPath.has(path)) throw new Error("Two managed photo records claim the same Storage path.");
        assetByPath.set(path, { photoId: document.id, path, variant });
      }
      count += 1;
      if (count > 10_000) throw new Error("Managed photo index exceeds the reviewed 10,000-record bound.");
    }
    if (snapshot.size < 500) break;
    cursor = snapshot.docs.at(-1);
  }
  return assetByPath;
}

async function migrationQuery(db, documentId, options) {
  let query;
  if (options.scope === "managed-photos") query = db.collection("imported_photos").orderBy(documentId);
  if (options.scope === "content") query = db.collection(options.collection).orderBy(documentId);
  if (options.scope === "revisions") query = db.collectionGroup("revisions").orderBy(documentId);
  if (options.scope === "nested-photos") query = db.collectionGroup("photos").orderBy(documentId);
  if (options.afterPath) {
    const cursor = await db.doc(options.afterPath).get();
    if (!cursor.exists) throw new Error("The requested checkpoint document does not exist.");
    query = query.startAfter(cursor);
  }
  return query.limit(options.limit).get();
}

function planDocument(document, options, assetByPath) {
  const path = document.ref.path;
  const data = document.data();
  if (options.scope === "managed-photos") return planManagedPhotoMigration(path, data, options.bucket);
  if (options.scope === "nested-photos") return planNestedPhotoMigration(path, data, options.bucket, assetByPath);
  if (options.scope === "revisions") {
    const parentCollection = path.split("/")[0];
    if (!["posts", "docs", "documents"].includes(parentCollection)) {
      return { documentPath: path, eligible: false, unresolved: 0, updates: {}, deleteFields: [], references: [], original: {} };
    }
  }
  return planContentMigration(path, data, options.bucket, assetByPath, options.scope === "revisions" ? "admin" : "public");
}

export function buildBackupManifest(options, plans, createdAt = new Date().toISOString()) {
  return {
    migrationVersion: MIGRATION_VERSION,
    project: options.project,
    bucket: options.bucket,
    scope: options.scope,
    collection: options.collection ?? null,
    createdAt,
    entries: plans.map((plan) => ({
      documentPath: plan.documentPath,
      changedFields: [...Object.keys(plan.updates), ...plan.deleteFields],
      updateFields: Object.keys(plan.updates),
      deleteFields: plan.deleteFields,
      expectedUpdateHashes: Object.fromEntries(
        Object.entries(plan.updates).map(([field, value]) => [field, fieldHash(value)]),
      ),
      originalOpaqueFields: Object.fromEntries(
        ["mediaPhotoIds", "coverPhotoId", "sourcePhotoId"]
          .filter((field) => Object.prototype.hasOwnProperty.call(plan.updates, field))
          .map((field) => [field, {
            present: Object.prototype.hasOwnProperty.call(plan.original, field)
              && plan.original[field] !== undefined,
            value: plan.original[field] ?? null,
          }]),
      ),
      references: plan.references,
    })),
  };
}

function writeBackup(path, options, plans) {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  const manifest = buildBackupManifest(options, plans);
  writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

async function applyPlans(db, deleteField, plans) {
  if (plans.length === 0) return { updated: 0, failed: 0 };
  try {
    await db.runTransaction(async (transaction) => {
      const targets = [];
      for (const plan of plans) {
        const ref = db.doc(plan.documentPath);
        const current = await transaction.get(ref);
        if (!current.exists) throw new Error("Document disappeared after planning.");
        for (const [field, original] of Object.entries(plan.original)) {
          if (fieldHash(current.data()[field]) !== fieldHash(original)) {
            throw new Error("Document changed after planning.");
          }
        }
        targets.push({ plan, ref });
      }
      const migratedAt = new Date().toISOString();
      for (const { plan, ref } of targets) {
        transaction.update(ref, {
          ...plan.updates,
          ...Object.fromEntries(plan.deleteFields.map((field) => [field, deleteField()])),
          mediaMigrationVersion: MIGRATION_VERSION,
          mediaMigratedAt: migratedAt,
        });
      }
    });
    return { updated: plans.length, failed: 0 };
  } catch {
    return { updated: 0, failed: plans.length };
  }
}

export async function runMediaMigration(options, dependencies = null) {
  const { db, documentId, deleteField } = dependencies ?? loadFirebase(options.project, options.bucket);
  const assetByPath = await buildAssetIndex(db, documentId);
  const snapshot = await migrationQuery(db, documentId, options);
  const plans = snapshot.docs.map((document) => planDocument(document, options, assetByPath));
  const eligible = plans.filter((plan) => plan.eligible);
  const blocked = plans.filter((plan) => plan.unresolved > 0);
  const nextCursor = snapshot.docs.at(-1)?.ref.path ?? null;
  const summary = {
    mode: options.apply ? "apply" : "dry-run",
    scope: options.scope,
    collection: options.collection ?? null,
    scanned: snapshot.size,
    eligible: eligible.length,
    blocked: blocked.length,
    replacements: eligible.reduce((total, plan) => total + plan.references.length, 0),
    deletedLegacyFields: eligible.reduce((total, plan) => total + plan.deleteFields.length, 0),
    updated: 0,
    failed: 0,
    nextCursor,
  };
  if (!options.apply) return summary;
  if (blocked.length > 0) throw new Error("Apply refused because one or more references could not be resolved.");
  writeBackup(options.backupFile, options, eligible);
  const result = await applyPlans(db, deleteField, eligible);
  return { ...summary, ...result };
}

async function main() {
  try {
    const options = parseMigrationArgs(process.argv.slice(2));
    const result = await runMediaMigration(options);
    console.log(JSON.stringify(result, null, 2));
    if (result.failed > 0 || result.blocked > 0) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Media migration failed.");
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
