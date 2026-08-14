#!/usr/bin/env node

/**
 * ARESWEB Content AST Normalizer & Repair Script
 * 
 * Safely inspects and normalizes legacy event and blog post descriptions
 * that contain serialized Tiptap / ProseMirror AST JSON strings.
 * 
 * Usage:
 *   node scripts/repair-event-descriptions.mjs [--dry-run] [--apply]
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const isApply = process.argv.includes("--apply");
const isDryRun = !isApply;

const DEFAULT_EVENT_PLACEHOLDER = "Describe your upcoming event or write a full recap here...";

function extractTextFromAst(node) {
  if (!node) return "";
  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }
  if (node.content && Array.isArray(node.content)) {
    const parts = node.content.map(extractTextFromAst).filter(Boolean);
    if (["doc", "bulletList", "orderedList"].includes(node.type)) {
      return parts.join("\n").trim();
    }
    if (["paragraph", "heading", "blockquote", "listItem"].includes(node.type)) {
      return parts.join("").trim();
    }
    return parts.join(" ").trim();
  }
  return "";
}

function parseTiptapAst(content) {
  if (!content || typeof content !== "string") return null;
  const trimmed = content.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && parsed.type === "doc" && Array.isArray(parsed.content)) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

async function repairEvents() {
  console.log(`\n=== Scanning Events Collection (Mode: ${isDryRun ? "DRY RUN" : "APPLY"}) ===`);
  const snapshot = await db.collection("events").get();
  let scanned = 0;
  let convertible = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    scanned++;
    const data = doc.data();
    const rawDescription = typeof data.description === "string" ? data.description : null;

    if (!rawDescription) {
      skipped++;
      continue;
    }

    const ast = parseTiptapAst(rawDescription);
    if (ast) {
      const plainText = extractTextFromAst(ast).trim();
      const cleaned = plainText === DEFAULT_EVENT_PLACEHOLDER ? "" : plainText;
      convertible++;

      console.log(`[Event ${doc.id}] Detected Tiptap JSON AST -> "${cleaned.slice(0, 60)}${cleaned.length > 60 ? "..." : ""}"`);

      if (isApply) {
        await doc.ref.update({
          description: cleaned,
          descriptionAst: rawDescription, // Preserve original AST in secondary field for backward compatibility
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      skipped++;
    }
  }

  console.log(`Events Summary: ${scanned} scanned, ${convertible} identified for repair, ${skipped} skipped.`);
}

async function repairPosts() {
  console.log(`\n=== Scanning Blog Posts Collection (Mode: ${isDryRun ? "DRY RUN" : "APPLY"}) ===`);
  const snapshot = await db.collection("posts").get();
  let scanned = 0;
  let convertible = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    scanned++;
    const data = doc.data();
    const rawSnippet = typeof data.snippet === "string" ? data.snippet : null;

    if (!rawSnippet) {
      skipped++;
      continue;
    }

    const ast = parseTiptapAst(rawSnippet);
    if (ast) {
      const plainText = extractTextFromAst(ast).trim();
      convertible++;

      console.log(`[Post ${doc.id}] Detected Tiptap JSON in snippet -> "${plainText.slice(0, 60)}..."`);

      if (isApply) {
        await doc.ref.update({
          snippet: plainText,
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      skipped++;
    }
  }

  console.log(`Posts Summary: ${scanned} scanned, ${convertible} identified for repair, ${skipped} skipped.`);
}

async function run() {
  try {
    await repairEvents();
    await repairPosts();
    console.log(`\nScan complete. ${isDryRun ? "No changes were made (dry-run mode). Pass --apply to execute." : "All changes applied successfully."}`);
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
}

run();
