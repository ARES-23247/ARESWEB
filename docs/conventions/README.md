# ARESWEB development conventions

The live source, Firebase configuration, `AGENTS.md`, and relevant repository
skill are authoritative. These human-facing notes cover narrower recurring
patterns; historical audit and migration documents are not architecture guides.

## Current architecture

- Vite and React 19 frontend with React Router
- Firebase Hosting, Firestore, Storage, and second-generation Cloud Functions
- Express API routes under `functions/src/routes/`
- Firebase Authentication, App Check, Secret Manager, and Workload Identity
  Federation for protected operations and deployment

## Convention index

| File | Use it for |
| --- | --- |
| [00-core-patterns.md](00-core-patterns.md) | Shared auth, API, and data patterns |
| [02-api-reference.md](02-api-reference.md) | Express routes and API contracts |
| [04-error-handling.md](04-error-handling.md) | `ApiError`, async handlers, and error UI |
| [05-brand-guidelines.md](05-brand-guidelines.md) | ARES visual and content system |
| [06-accessibility.md](06-accessibility.md) | WCAG 2.2 AA interaction work |
| [08-database.md](08-database.md) | Firestore models, queries, and rules |
| [09-ci-build.md](09-ci-build.md) | Verification and delivery |
| [10-pr-workflow.md](10-pr-workflow.md) | GitHub review workflow |
| [11-cultural-legacy.md](11-cultural-legacy.md) | Team terminology and history |
| [12-pwa-resilience.md](12-pwa-resilience.md) | Service-worker behavior |
| [13-testing.md](13-testing.md) | Unit, rules, and browser tests |
| [14-failure-exposure.md](14-failure-exposure.md) | Honest failure states |
| [15-youth-protection.md](15-youth-protection.md) | Youth data and public identity |
| [18-audit-protocol.md](18-audit-protocol.md) | Evidence-backed repository audits |
| [19-ast-migration.md](19-ast-migration.md) | Tiptap/ProseMirror content repair |

## Repository skills

The six skills under `.agents/skills/` intentionally map to distinct live
boundaries: API work, AST migration, CI/delivery, comprehensive auditing,
accessibility, and zero-trust security. This is the single canonical tree used
by Codex, Gemini CLI, and Google Antigravity. `GEMINI.md` and the Antigravity
workspace rule import `AGENTS.md`; they do not copy the skill bodies. Read only
the skill relevant to the change rather than loading every skill as generic
project context. Run `pnpm run validate:agents` after changing this inventory.

## Verification

Use the complete gate in `AGENTS.md`. Coverage and lint limits are ratchets.
Never weaken authorization, hide failures, or exclude changed production code
to make a check pass.
