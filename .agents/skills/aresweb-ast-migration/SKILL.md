---
name: aresweb-ast-migration
description: Design or execute safe migrations from Markdown or malformed legacy content to ARESWEB Tiptap/ProseMirror JSON documents. Use for document imports, AST repair, schema migrations, or Firestore content backfills.
---

# Tiptap AST migration

Represent editor content as a ProseMirror document with `type: "doc"` and a
validated `content` array. Preserve semantic blocks, marks, links, lists, code,
and hard breaks; do not store HTML as a shortcut.

## Workflow

1. Read the current editor extensions and persisted document types before
   defining the target schema.
2. Build a pure converter and validator first. Cover empty input, malformed
   Markdown, nested lists, links, code blocks, and already-migrated documents.
3. Run fixtures locally and inspect representative output in the actual editor.
4. Create an idempotent migration with a schema version and deterministic
   result. Skip valid current records.
5. Dry-run against exported or emulator data. Report counts for scanned,
   convertible, skipped, and failed records without printing document content.
6. Use bounded batches, checkpoints, and a reversible backup/export plan.
7. Obtain explicit user approval immediately before changing production data.
8. Re-read a sample after migration and verify rendering, counts, and versions.

Never place service-account credentials in a migration script or repository.
Use Application Default Credentials only in an approved operational environment.
Keep one-record failures isolated and produce identifiers safe for administrator
review rather than logging student-authored content or PII.
