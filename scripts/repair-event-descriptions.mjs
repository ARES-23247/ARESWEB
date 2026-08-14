#!/usr/bin/env node

import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_EVENT_PLACEHOLDER =
  "Describe your upcoming event or write a full recap here...";
const MAX_LEGACY_DESCRIPTION_LENGTH = 250_000;
const MIGRATION_VERSION = 1;

function assertOptions(options) {
  if (!options.project || !/^[a-z][a-z0-9-]{4,62}$/.test(options.project)) {
    throw new Error("--project must be an explicit Firebase project ID.");
  }
  if (
    !Number.isInteger(options.limit) ||
    options.limit < 1 ||
    options.limit > 100
  ) {
    throw new Error("--limit must be an integer from 1 through 100.");
  }
  if (options.after && !/^[A-Za-z0-9_-]{1,300}$/.test(options.after)) {
    throw new Error("--after must be a valid event document ID.");
  }
  if (options.apply && options.confirmProject !== options.project) {
    throw new Error(
      "Writes require --confirm-project to exactly match --project.",
    );
  }
}

export function parseRepairArgs(argv) {
  const options = { apply: false, limit: 25, after: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      options.apply = true;
      continue;
    }
    if (
      !["--project", "--confirm-project", "--limit", "--after"].includes(
        argument,
      )
    ) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    index += 1;
    if (argument === "--project") options.project = value;
    if (argument === "--confirm-project") options.confirmProject = value;
    if (argument === "--after") options.after = value;
    if (argument === "--limit") options.limit = Number(value);
  }
  assertOptions(options);
  return options;
}

function parseTiptapAst(content) {
  if (
    typeof content !== "string" ||
    content.length > MAX_LEGACY_DESCRIPTION_LENGTH
  ) {
    return null;
  }
  const trimmed = content.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed &&
      typeof parsed === "object" &&
      parsed.type === "doc" &&
      Array.isArray(parsed.content)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function extractTextFromAst(node) {
  if (!node || typeof node !== "object") return "";
  if (node.type === "text" && typeof node.text === "string") return node.text;
  if (node.type === "hardBreak") return "\n";
  if (!Array.isArray(node.content)) return "";

  const parts = node.content.map(extractTextFromAst).filter(Boolean);
  if (["doc", "bulletList", "orderedList"].includes(node.type)) {
    return parts.join("\n").trim();
  }
  if (["paragraph", "heading", "blockquote", "listItem"].includes(node.type)) {
    return parts.join("").trim();
  }
  return parts.join(" ").trim();
}

export function legacyDescriptionRepair(content) {
  const ast = parseTiptapAst(content);
  if (!ast) return null;
  const extracted = extractTextFromAst(ast).trim();
  return extracted === DEFAULT_EVENT_PLACEHOLDER ? "" : extracted;
}

function loadFirestore(project) {
  const requireFromFunctions = createRequire(
    resolve(process.cwd(), "functions/package.json"),
  );
  const { getApps, initializeApp } = requireFromFunctions("firebase-admin/app");
  const { FieldPath, getFirestore } = requireFromFunctions(
    "firebase-admin/firestore",
  );
  const app = getApps()[0] ?? initializeApp({ projectId: project });
  return { db: getFirestore(app), documentId: FieldPath.documentId() };
}

export async function runEventDescriptionRepair(options, dependencies = null) {
  assertOptions(options);
  const { db, documentId } = dependencies ?? loadFirestore(options.project);
  let query = db.collection("events").orderBy(documentId).limit(options.limit);
  if (options.after) query = query.startAfter(options.after);
  const snapshot = await query.get();
  const candidates = snapshot.docs
    .map((document) => ({
      document,
      original: document.data().description,
      repaired: legacyDescriptionRepair(document.data().description),
    }))
    .filter((candidate) => candidate.repaired !== null);
  const nextCursor = snapshot.docs.at(-1)?.id ?? null;

  if (!options.apply) {
    return {
      mode: "dry-run",
      scanned: snapshot.size,
      eligible: candidates.length,
      updated: 0,
      failed: 0,
      candidateIds: candidates.map(({ document }) => document.id),
      failedIds: [],
      nextCursor,
    };
  }

  let updated = 0;
  const failedIds = [];
  for (const { document, original, repaired } of candidates) {
    try {
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(document.ref);
        const currentDescription = current.data()?.description;
        if (
          !current.exists ||
          currentDescription !== original ||
          legacyDescriptionRepair(currentDescription) === null
        ) {
          throw new Error("Event changed after the repair page was read.");
        }
        const timestamp = new Date().toISOString();
        transaction.update(document.ref, {
          description: repaired,
          descriptionLegacyAst: original,
          descriptionMigrationVersion: MIGRATION_VERSION,
          descriptionMigratedAt: timestamp,
          updatedAt: timestamp,
        });
      });
      updated += 1;
    } catch {
      failedIds.push(document.id);
    }
  }

  return {
    mode: "apply",
    scanned: snapshot.size,
    eligible: candidates.length,
    updated,
    failed: failedIds.length,
    candidateIds: candidates.map(({ document }) => document.id),
    failedIds,
    nextCursor,
  };
}

async function main() {
  try {
    const options = parseRepairArgs(process.argv.slice(2));
    const result = await runEventDescriptionRepair(options);
    console.log(JSON.stringify(result, null, 2));
    if (result.failed > 0) process.exitCode = 1;
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Event description repair failed.",
    );
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
