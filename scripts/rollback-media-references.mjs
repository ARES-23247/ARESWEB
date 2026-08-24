#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_MANIFEST_BYTES = 2_000_000;
const MAX_ENTRIES = 100;
const VARIANTS = new Set(["original", "medium", "thumbnail"]);
const OPAQUE_FIELDS = new Set(["mediaPhotoIds", "coverPhotoId", "sourcePhotoId"]);
const CONTENT_FIELDS = new Set(["content", "thumbnail"]);
const GATEWAY = /\/api\/photos\/(?:admin\/media\/([A-Za-z0-9_-]{1,300})|public\/content\/(?:posts|docs|documents)\/[A-Za-z0-9_-]{1,300}\/([A-Za-z0-9_-]{1,300}))\/(original|medium|thumbnail)/gu;

function safeDocumentPath(value) {
  if (typeof value !== "string" || value.length > 1_500 || value.includes("\\")) return false;
  const segments = value.split("/");
  return segments.length >= 2 && segments.length % 2 === 0
    && segments.every((segment) => /^[A-Za-z0-9_-]{1,300}$/.test(segment));
}

function safeObjectPath(value) {
  if (typeof value !== "string" || value.length > 1_024 || value.includes("\\")) return false;
  const segments = value.split("/");
  return ["gallery", "blog"].includes(segments[0])
    && segments.every((segment) => segment && segment !== "." && segment !== "..");
}

function fieldHash(value) {
  return createHash("sha256").update(JSON.stringify(value) ?? "undefined").digest("hex");
}

function canonicalStorageUrl(bucket, path) {
  return `https://storage.googleapis.com/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function parseRollbackArgs(argv) {
  const options = { apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      options.apply = true;
      continue;
    }
    if (!["--project", "--bucket", "--manifest", "--confirm-project", "--confirm-bucket"].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    index += 1;
    options[argument.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())] = value;
  }
  if (!options.project || !/^[a-z][a-z0-9-]{4,62}$/.test(options.project)) {
    throw new Error("--project must be an explicit Firebase project ID.");
  }
  if (!options.bucket || !/^[A-Za-z0-9._-]{3,222}$/.test(options.bucket)) {
    throw new Error("--bucket must be an explicit Firebase Storage bucket name.");
  }
  if (!options.manifest) throw new Error("--manifest is required.");
  if (options.apply) {
    if (options.confirmProject !== options.project) throw new Error("Writes require --confirm-project to exactly match --project.");
    if (options.confirmBucket !== options.bucket) throw new Error("Writes require --confirm-bucket to exactly match --bucket.");
  }
  return options;
}

export function readRollbackManifest(path, expectedProject, expectedBucket) {
  const target = resolve(path);
  if (statSync(target).size > MAX_MANIFEST_BYTES) throw new Error("Rollback manifest exceeds the 2 MB limit.");
  const manifest = JSON.parse(readFileSync(target, "utf8"));
  if (manifest?.migrationVersion !== 1) throw new Error("Unsupported rollback manifest version.");
  if (manifest.project !== expectedProject || manifest.bucket !== expectedBucket) {
    throw new Error("Rollback manifest project or bucket does not match the explicit target.");
  }
  if (!Array.isArray(manifest.entries) || manifest.entries.length > MAX_ENTRIES) {
    throw new Error("Rollback manifest must contain at most 100 entries.");
  }
  for (const entry of manifest.entries) {
    if (!safeDocumentPath(entry?.documentPath)) throw new Error("Rollback manifest contains an invalid document path.");
    if (!Array.isArray(entry.updateFields) || !Array.isArray(entry.deleteFields) || !Array.isArray(entry.references)) {
      throw new Error("Rollback manifest entry is incomplete.");
    }
    if (![...entry.updateFields, ...entry.deleteFields].every((field) => typeof field === "string" && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(field))) {
      throw new Error("Rollback manifest contains an invalid field name.");
    }
    for (const reference of entry.references) {
      if (!/^[A-Za-z0-9_-]{1,300}$/.test(reference?.photoId)
        || !safeObjectPath(reference?.path)
        || !VARIANTS.has(reference?.variant)) {
        throw new Error("Rollback manifest contains an invalid media reference.");
      }
    }
  }
  return manifest;
}

function referenceMap(entry) {
  return new Map(entry.references.map((reference) => [
    `${reference.photoId}:${reference.variant}`,
    reference,
  ]));
}

function reverseGateways(value, bucket, references) {
  if (typeof value !== "string") return value;
  return value.replace(GATEWAY, (candidate, adminId, publicId, variant) => {
    const reference = references.get(`${adminId || publicId}:${variant}`);
    return reference ? canonicalStorageUrl(bucket, reference.path) : candidate;
  });
}

function preferredReference(field, entry) {
  const requestedVariant = field.toLowerCase().includes("thumbnail")
    ? "thumbnail"
    : field.toLowerCase().includes("medium")
      ? "medium"
      : "original";
  return entry.references.find((reference) => reference.variant === requestedVariant)
    ?? entry.references.find((reference) => reference.variant === "original")
    ?? entry.references[0];
}

export function planRollbackEntry(entry, current, bucket, deleteField) {
  if (current.mediaMigrationVersion !== 1) {
    throw new Error("Document is not at media migration version 1.");
  }
  for (const field of entry.updateFields) {
    if (fieldHash(current[field]) !== entry.expectedUpdateHashes?.[field]) {
      throw new Error(`Field ${field} changed after migration.`);
    }
  }
  for (const field of entry.deleteFields) {
    if (Object.prototype.hasOwnProperty.call(current, field)) {
      throw new Error(`Deleted field ${field} changed after migration.`);
    }
  }

  const updates = {};
  const references = referenceMap(entry);
  for (const field of entry.updateFields) {
    if (OPAQUE_FIELDS.has(field)) {
      const original = entry.originalOpaqueFields?.[field];
      updates[field] = original?.present ? original.value : deleteField();
    } else if (CONTENT_FIELDS.has(field)) {
      updates[field] = reverseGateways(current[field], bucket, references);
    }
  }
  for (const field of entry.deleteFields) {
    const reference = preferredReference(field, entry);
    if (!reference) throw new Error(`No managed media reference can restore ${field}.`);
    updates[field] = canonicalStorageUrl(bucket, reference.path);
  }
  updates.mediaMigrationVersion = deleteField();
  updates.mediaMigratedAt = deleteField();
  return updates;
}

function loadFirebase(project, bucketName) {
  const requireFromFunctions = createRequire(resolve(process.cwd(), "functions/package.json"));
  const { getApps, initializeApp } = requireFromFunctions("firebase-admin/app");
  const { FieldValue, getFirestore } = requireFromFunctions("firebase-admin/firestore");
  const app = getApps()[0] ?? initializeApp({ projectId: project, storageBucket: bucketName });
  return { db: getFirestore(app), deleteField: FieldValue.delete };
}

export async function runMediaRollback(options, dependencies = null) {
  const manifest = readRollbackManifest(options.manifest, options.project, options.bucket);
  const { db, deleteField } = dependencies ?? loadFirebase(options.project, options.bucket);
  let eligible = 0;
  let blocked = 0;
  const plans = [];
  for (const entry of manifest.entries) {
    const snapshot = await db.doc(entry.documentPath).get();
    try {
      if (!snapshot.exists) throw new Error("Document no longer exists.");
      const updates = planRollbackEntry(entry, snapshot.data(), options.bucket, deleteField);
      plans.push({ entry, updates });
      eligible += 1;
    } catch {
      blocked += 1;
    }
  }
  const summary = {
    mode: options.apply ? "apply" : "dry-run",
    entries: manifest.entries.length,
    eligible,
    blocked,
    restored: 0,
    failed: 0,
  };
  if (!options.apply) return summary;
  if (blocked > 0) throw new Error("Rollback refused because one or more documents changed after migration.");
  try {
    await db.runTransaction(async (transaction) => {
      const verifiedPlans = [];
      for (const { entry } of plans) {
        const ref = db.doc(entry.documentPath);
        const current = await transaction.get(ref);
        if (!current.exists) throw new Error("Document disappeared before rollback.");
        const verified = planRollbackEntry(entry, current.data(), options.bucket, deleteField);
        verifiedPlans.push({ ref, verified });
      }
      for (const { ref, verified } of verifiedPlans) transaction.update(ref, verified);
    });
    summary.restored = plans.length;
  } catch {
    summary.failed = plans.length;
  }
  return summary;
}

async function main() {
  try {
    const options = parseRollbackArgs(process.argv.slice(2));
    const result = await runMediaRollback(options);
    console.log(JSON.stringify(result, null, 2));
    if (result.failed > 0 || result.blocked > 0) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Media rollback failed.");
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
