#!/usr/bin/env node

import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const COLLECTIONS = [
  "posts",
  "events",
  "albums",
  "imported_photos",
  "docs",
  "documents",
];
const COLLECTION_GROUPS = ["photos", "revisions"];
const STORAGE_PREFIXES = [
  "blog/",
  "events/",
  "gallery/",
  "editor/uploads/",
  "public-media/",
];
const MAX_VALUE_LENGTH = 1_000_000;

function positiveInteger(value, label, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${label} must be an integer from 1 through ${maximum}.`);
  }
  return parsed;
}

export function parseInventoryArgs(argv) {
  const options = { maxDocs: 1_000, maxObjects: 10_000 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!["--project", "--bucket", "--max-docs", "--max-objects"].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    index += 1;
    if (argument === "--project") options.project = value;
    if (argument === "--bucket") options.bucket = value;
    if (argument === "--max-docs") options.maxDocs = positiveInteger(value, "--max-docs", 10_000);
    if (argument === "--max-objects") options.maxObjects = positiveInteger(value, "--max-objects", 100_000);
  }
  if (!options.project || !/^[a-z][a-z0-9-]{4,62}$/.test(options.project)) {
    throw new Error("--project must be an explicit Firebase project ID.");
  }
  if (!options.bucket || !/^[A-Za-z0-9._-]{3,222}$/.test(options.bucket)) {
    throw new Error("--bucket must be an explicit Firebase Storage bucket name.");
  }
  return options;
}

function decoded(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** Parse canonical Google Storage URLs without retaining query strings or tokens. */
export function storageObjectFromUrl(value) {
  if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
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
  const virtualHosted = url.hostname.match(/^(.+)\.storage\.googleapis\.com$/u);
  const path = decoded(url.pathname.replace(/^\//u, ""));
  return virtualHosted?.[1] && path ? { bucket: virtualHosted[1], path } : null;
}

function storageObjectsFromText(value) {
  if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH) return [];
  const candidates = value.match(
    /https:\/\/(?:firebasestorage\.googleapis\.com|storage\.googleapis\.com|[A-Za-z0-9._-]+\.storage\.googleapis\.com)\/[^\s<>"')\]]+/gu,
  ) ?? [];
  return candidates
    .map((candidate) => storageObjectFromUrl(candidate.replace(/[},.;]+$/u, "")))
    .filter(Boolean);
}

function prefixForPath(path) {
  return STORAGE_PREFIXES.find((prefix) => path.startsWith(prefix)) ?? "other";
}

function increment(record, key, amount = 1) {
  record[key] = (record[key] ?? 0) + amount;
}

/** Return only aggregate-safe reference information; never return stored values. */
export function inspectMediaReferences(value, expectedBucket) {
  const fields = {};
  const prefixes = {};
  let references = 0;

  function visit(candidate, fieldPath, ancestors) {
    if (typeof candidate === "string") {
      for (const object of storageObjectsFromText(candidate)) {
        if (object.bucket !== expectedBucket) continue;
        references += 1;
        increment(fields, fieldPath || "<root>");
        increment(prefixes, prefixForPath(object.path));
      }
      return;
    }
    if (!candidate || typeof candidate !== "object" || ancestors.has(candidate)) return;
    ancestors.add(candidate);
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item, `${fieldPath}[]`, ancestors);
    } else {
      for (const [key, child] of Object.entries(candidate)) {
        visit(child, fieldPath ? `${fieldPath}.${key}` : key, ancestors);
      }
    }
    ancestors.delete(candidate);
  }

  visit(value, "", new Set());
  return { references, fields, prefixes };
}

function storageObjectsIn(value, expectedBucket) {
  const objects = [];
  function visit(candidate, ancestors) {
    if (typeof candidate === "string") {
      for (const object of storageObjectsFromText(candidate)) {
        if (object.bucket === expectedBucket) objects.push(object);
      }
      return;
    }
    if (!candidate || typeof candidate !== "object" || ancestors.has(candidate)) return;
    ancestors.add(candidate);
    const children = Array.isArray(candidate) ? candidate : Object.values(candidate);
    for (const child of children) visit(child, ancestors);
    ancestors.delete(candidate);
  }
  visit(value, new Set());
  return objects;
}

export function managedReferenceCoverage(records, managedPaths, expectedBucket) {
  let references = 0;
  let resolvable = 0;
  let unresolved = 0;
  for (const record of records) {
    for (const object of storageObjectsIn(record, expectedBucket)) {
      references += 1;
      if (managedPaths.has(object.path)) resolvable += 1;
      else unresolved += 1;
    }
  }
  return { references, resolvable, unresolved };
}

function mergeCounts(target, source) {
  for (const [key, count] of Object.entries(source)) increment(target, key, count);
}

function loadFirebase(project, bucketName) {
  const requireFromFunctions = createRequire(resolve(process.cwd(), "functions/package.json"));
  const { getApps, initializeApp } = requireFromFunctions("firebase-admin/app");
  const { getFirestore } = requireFromFunctions("firebase-admin/firestore");
  const { getStorage } = requireFromFunctions("firebase-admin/storage");
  const app = getApps()[0] ?? initializeApp({ projectId: project, storageBucket: bucketName });
  return { db: getFirestore(app), bucket: getStorage(app).bucket(bucketName) };
}

async function inventoryQuery(query, expectedBucket, maxDocs) {
  const snapshot = await query.limit(maxDocs + 1).get();
  const documents = snapshot.docs.slice(0, maxDocs);
  const fields = {};
  const prefixes = {};
  let references = 0;
  let documentsWithReferences = 0;
  for (const document of documents) {
    const result = inspectMediaReferences(document.data(), expectedBucket);
    references += result.references;
    if (result.references > 0) documentsWithReferences += 1;
    mergeCounts(fields, result.fields);
    mergeCounts(prefixes, result.prefixes);
  }
  return {
    scanned: documents.length,
    truncated: snapshot.size > maxDocs,
    documentsWithReferences,
    references,
    fields,
    prefixes,
  };
}

async function inventoryStoragePrefix(bucket, prefix, maximum) {
  let pageToken;
  let objects = 0;
  let bytes = 0;
  let truncated = false;
  do {
    const remaining = maximum - objects;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const [files, , response] = await bucket.getFiles({
      prefix,
      autoPaginate: false,
      maxResults: Math.min(1_000, remaining),
      pageToken,
    });
    for (const file of files) {
      objects += 1;
      const size = Number(file.metadata?.size);
      if (Number.isFinite(size) && size > 0) bytes += size;
    }
    pageToken = response?.nextPageToken;
  } while (pageToken);
  if (pageToken) truncated = true;
  return { objects, bytes, truncated };
}

async function relationshipCoverage(db, expectedBucket, maxDocs) {
  const importedSnapshot = await db.collection("imported_photos").limit(maxDocs + 1).get();
  const imported = importedSnapshot.docs.slice(0, maxDocs);
  const managedPaths = new Set();
  const managedFieldCoverage = {
    records: imported.length,
    withOriginalPath: 0,
    withThumbnailPath: 0,
    withMediumPath: 0,
    truncated: importedSnapshot.size > maxDocs,
  };
  for (const document of imported) {
    const data = document.data();
    for (const [field, counter] of [
      ["storagePath", "withOriginalPath"],
      ["thumbnailPath", "withThumbnailPath"],
      ["mediumPath", "withMediumPath"],
    ]) {
      const path = data[field];
      if (typeof path === "string" && path && !path.includes("\\") && !path.includes("..")) {
        managedPaths.add(path);
        managedFieldCoverage[counter] += 1;
      }
    }
  }

  const sources = {};
  for (const name of ["posts", "events", "albums", "docs", "documents"]) {
    const snapshot = await db.collection(name).limit(maxDocs + 1).get();
    sources[name] = {
      ...managedReferenceCoverage(
        snapshot.docs.slice(0, maxDocs).map((document) => document.data()),
        managedPaths,
        expectedBucket,
      ),
      truncated: snapshot.size > maxDocs,
    };
  }
  for (const name of COLLECTION_GROUPS) {
    const snapshot = await db.collectionGroup(name).limit(maxDocs + 1).get();
    const documents = snapshot.docs.slice(0, maxDocs);
    const sourceLinks = name === "photos"
      ? documents.reduce((result, document) => {
          const sourcePhotoId = document.data().sourcePhotoId;
          if (typeof sourcePhotoId !== "string") return result;
          result.present += 1;
          if (imported.some((candidate) => candidate.id === sourcePhotoId)) result.resolvable += 1;
          else result.unresolved += 1;
          return result;
        }, { present: 0, resolvable: 0, unresolved: 0 })
      : undefined;
    sources[`collectionGroup:${name}`] = {
      ...managedReferenceCoverage(
        documents.map((document) => document.data()),
        managedPaths,
        expectedBucket,
      ),
      ...(sourceLinks ? { sourceLinks } : {}),
      truncated: snapshot.size > maxDocs,
    };
  }
  return { importedPhotos: managedFieldCoverage, sources };
}

export async function runMediaInventory(options, dependencies = null) {
  const { db, bucket } = dependencies ?? loadFirebase(options.project, options.bucket);
  const collections = {};
  for (const name of COLLECTIONS) {
    collections[name] = await inventoryQuery(db.collection(name), options.bucket, options.maxDocs);
  }
  const collectionGroups = {};
  for (const name of COLLECTION_GROUPS) {
    collectionGroups[name] = await inventoryQuery(db.collectionGroup(name), options.bucket, options.maxDocs);
  }
  const storage = {};
  for (const prefix of STORAGE_PREFIXES) {
    storage[prefix] = await inventoryStoragePrefix(bucket, prefix, options.maxObjects);
  }
  const relationships = await relationshipCoverage(db, options.bucket, options.maxDocs);
  return {
    mode: "read-only",
    project: options.project,
    bucket: options.bucket,
    limits: { maxDocs: options.maxDocs, maxObjectsPerPrefix: options.maxObjects },
    collections,
    collectionGroups,
    storage,
    relationships,
  };
}

async function main() {
  try {
    const options = parseInventoryArgs(process.argv.slice(2));
    const result = await runMediaInventory(options);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Media inventory failed.");
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
