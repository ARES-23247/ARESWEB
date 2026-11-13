---
name: aresweb-ast-migration
description: Design or run ARESWEB document imports, Markdown/legacy AST migrations, and Academy content releases.
---

# ARESWEB content migration

## Choose the content workflow

For format conversion, inspect `src/components/MarkdownEditor.tsx`,
`src/components/dashboard/DocumentDraftPreview.tsx`,
`src/components/docs/DocsMarkdownRenderer.tsx`, and `src/lib/contentFormatters.ts`
alongside persisted types and validators. Preserve the existing format unless
conversion is requested; do not assume a Tiptap editor is installed. AST records
need a `type: "doc"` root and supported nodes, marks, and attributes, preserving
semantic blocks, links, lists, code, and hard breaks.

For Academy releases, use `content/learning/` and `package.json` scripts
(`content:prepare`, `content:verify`, `content:release-validate`,
`content:readability`, `test:content-migration`, `content:approval`,
`content:migrate`). Preserve proposal digests and `requiresHumanReview: true`
flags. Resolve `ARES-Robotics` provenance only from an immutable public commit
(never dirty local monorepo checkouts) using `scripts/refresh-learning-source-authority.mjs`,
check for stale version references outside dated refresh logs, and record the
source comparison under `docs/`. `AGENTS.md` standing ARES source-refresh
approval excludes production publication and migration.

## Migration requirements

Reuse the existing pipeline when it fits. New converters must be pure and
validated; migration writes must be idempotent, versioned, and deterministic,
skipping current valid records. Cover empty/malformed input, nested lists,
links, code blocks, and already-migrated documents.

Before production writes, validate representative rendering in the editor and
dry-run against exports or emulator data. Report scanned, convertible, skipped,
and failed counts without document contents. Use bounded batches, checkpoints,
isolated record failures, and a reversible backup/export plan (verified GCS
Firestore export). Apply production mutations only with explicit session
approval covering that exact mutation, then verify sample rendering, counts,
and version stamps without logging student content or PII.
