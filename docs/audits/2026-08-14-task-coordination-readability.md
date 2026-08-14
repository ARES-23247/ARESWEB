# Task Coordination Readability Review

- Date: 2026-08-14
- Baseline: `4d91811c9bc558bb43ebcbd4031b8414bb3d21d6` (`origin/master`)
- Branch: `codex/task-description-readability`
- Scope: authenticated Kanban discovery, duplicate visibility, and task-card summaries
- Production data mutation: none

## Confirmed production evidence

Read-only validation of the authenticated task board found a task card whose
description displayed serialized Tiptap JSON, including a Google Drive embed,
instead of a useful summary. The same board contained several active cards with
exact titles that differed only by record identity. The board had no text search
or duplicate-focused view, so finding a task or reviewing accidental duplicates
required scanning every status column.

## Remediation

- Recognized Tiptap document descriptions are summarized as bounded plain text.
  Drive, image, and simulation nodes use truthful attachment labels; embedded
  source URLs and serialized JSON are not displayed on board cards or the
  command-center feed.
- Markdown task descriptions are reduced to readable text for compact surfaces
  while the stored description remains untouched and the full editor keeps the
  original source.
- Search now matches title, readable description, status, priority, and subteam
  across all board columns.
- Active cards with normalized matching titles receive a potential-duplicate
  badge and can be isolated with a dedicated filter. This is advisory only: it
  does not merge or delete team data.
- An explicit status message replaces an unexplained blank board when current
  filters match no tasks.

## Trust and performance boundaries

- Firestore descriptions remain untrusted. JSON is parsed only for the known
  `doc` shape, traversal is iterative and capped at 256 nodes, rendered output
  remains React text, and summaries are capped at 240 characters.
- Duplicate matching is case- and whitespace-insensitive and is limited to the
  already-bounded in-memory board result. Archived cards are excluded from the
  active duplicate count.
- No existing task record, Drive file, or production configuration is changed.

## Verification evidence

- Supported runtime: Node 22.22.2, pnpm 11.21.0, and Microsoft OpenJDK
  21.0.12.
- Frozen install and all shared Codex/Gemini/Antigravity/Copilot agent checks:
  passed.
- Root and Functions ESLint: passed with zero warnings.
- Root TypeScript and Functions build: passed.
- Frontend coverage: 88 files / 503 tests passed; `taskRecord.ts` measured
  100% lines/functions and 92.85% branches.
- Functions coverage: 45 files / 569 tests passed; 94.75% lines and 98.31%
  functions.
- Firestore/Storage emulator rules: 20 tests passed.
- Production build and 22-route prerender: passed; PWA precache remained 17
  entries / 874.90 KiB.
- Bundle budgets: all six passed; initial JavaScript was 714,863 raw / 225,270
  gzip bytes.
- Playwright: 52 tests passed across Chromium, mobile Chromium, Firefox, and
  WebKit.
- Production dependency audit: no known vulnerabilities.
- Diff check: clean apart from Windows line-ending notices.

The complete repository gate, protected pull-request checks, deployment, and
read-only live validation remain release steps. This review does not establish
general security or accessibility conformance.
