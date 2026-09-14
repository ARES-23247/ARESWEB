---
name: aresweb-ast-migration
description: Design or run ARESWEB document imports, Markdown/legacy AST migrations, and Academy content releases.
---

# ARESWEB content migration

## Choose the content workflow

For format conversion, inspect src/components/MarkdownEditor.tsx,
src/components/dashboard/DocumentDraftPreview.tsx,
src/components/docs/DocsMarkdownRenderer.tsx and src/lib/contentFormatters.ts
alongside persisted types and validators. Preserve the existing format unless
conversion is requested; do not assume a Tiptap editor is installed. AST records
need a type: "doc" root and supported nodes, marks and attributes. Preserve
semantic blocks, links, lists, code and hard breaks.

For Academy releases, use content/learning/ and the existing content:prepare,
content:verify, content:release-validate, content:approval and content:migrate
scripts in package.json. Preserve proposal digests and human-review flags.
AGENTS.md's standing ARES source-refresh approval excludes production publication
and migration.

## Migration requirements

Reuse the existing pipeline when it fits. A new converter must be pure and
validated; migration writes must be idempotent, versioned and deterministic,
skipping valid current records. Cover empty/malformed input, nested lists, links,
code blocks and already-migrated documents as applicable.

Before production writes, validate representative rendering in the actual editor
and dry-run against exports or emulator data. Report scanned, convertible,
skipped and failed counts without document contents. Use bounded batches,
checkpoints, isolated record failures and a reversible backup/export plan.

Complete the implementation and dry-run evidence within the authorized scope.
Apply production changes only when explicit session approval covers that exact
mutation; reuse existing authorization. After applying, verify sample rendering,
counts and versions. Use safe administrator-review identifiers, never student
content or PII in logs. Use Application Default Credentials only in an approved
operational environment; never embed service-account credentials.
