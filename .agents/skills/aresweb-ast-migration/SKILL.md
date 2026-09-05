---
name: aresweb-ast-migration
description: Design or execute ARESWEB Markdown and legacy AST content migrations. Use for document imports, AST repair, Academy release batches, schema migrations, or Firestore content backfills.
---

# ARESWEB content migration

The current editor is `src/components/MarkdownEditor.tsx`. Preview and rendering
support Markdown and legacy Tiptap/ProseMirror JSON: inspect
`src/components/dashboard/DocumentDraftPreview.tsx`,
`src/components/docs/DocsMarkdownRenderer.tsx`, and `src/lib/contentFormatters.ts`.
Do not convert all documents to AST or assume a Tiptap editor is installed.
Preserve the existing format unless the requested migration changes it. For AST
records, validate a `type: "doc"` root and supported nodes, marks and attributes.
Preserve semantic blocks, links, lists, code and hard breaks in either format.

## Workflow

1. Read the current renderers, validators and persisted document types before
   defining the target schema.
2. Build a pure converter and validator first. Cover empty input, malformed
   Markdown, nested lists, links, code blocks, and already-migrated documents.
3. Run fixtures locally and inspect representative output in the actual editor.
4. Create an idempotent migration with a schema version and deterministic
   result. Skip valid current records.
5. Dry-run against exported or emulator data. Report counts for scanned,
   convertible, skipped, and failed records without printing document content.
6. Use bounded batches, checkpoints, and a reversible backup/export plan.
7. Confirm that explicit user approval covers the exact production mutation
   before applying it. Honor existing session authorization; do not ask twice
   for the same approved operation.
8. Re-read a sample after migration and verify rendering, counts, and versions.

Never place service-account credentials in a migration script or repository.
Use Application Default Credentials only in an approved operational environment.
Keep one-record failures isolated and produce identifiers safe for administrator
review rather than logging student-authored content or PII.

For Academy content, use `content/learning/` and the existing `content:prepare`,
`content:verify`, `content:release-validate`, `content:approval`, and
`content:migrate` scripts from `package.json`. Preserve exact proposal digests
and human-review flags. The standing ARES source-refresh approval in `AGENTS.md`
does not authorize production content publication or migration.
