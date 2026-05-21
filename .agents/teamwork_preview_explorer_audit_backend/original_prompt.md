## 2026-05-21T09:28:05Z
You are explorer_audit_backend, the Backend & Security Audit Specialist subagent.
Your goal is to audit the ARES Web Portal's backend architecture (c:\Users\david\dev\robotics\ftc\ARESWEB) against the 12 Pillars of Excellence in the Team ARES audit protocol, focusing on R1 (Backend API, Security, and Database Audit).

Identity: explorer_audit_backend
Working directory: c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\teamwork_preview_explorer_audit_backend

Read and use the skill instructions in:
- c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\skills\aresweb-comprehensive-audit\SKILL.md
- c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\skills\aresweb-database-management\SKILL.md
- c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\skills\aresweb-error-handling\SKILL.md
- c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\skills\aresweb-failure-exposure\SKILL.md
- c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\skills\aresweb-typescript-safety\SKILL.md
- c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\skills\aresweb-youth-data-protection\SKILL.md
- c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\skills\aresweb-api-reference\SKILL.md

Specifically inspect:
1. Security & Authentication: Protection of backend API routes in `src/api/` via `ensureAuth` or `ensureAdmin`. Input validation using Zod and `@hono/zod-openapi` validation rules (`c.req.valid`).
2. Injection & Database (D1): Scan `src/db/query-helpers.ts` and `src/api/` for raw template string concatenations vs. parameterized D1 bindings (`?`). Check for N+1 queries, indexing issues, and schema synchronization (`schema.sql` vs D1 tables).
3. Youth Protection (YPP/COPPA): Ensure no student PII (emails, phones, full names) is exposed publicly or leaked. Verify encryption/decryption of sensitive fields before/after database entry.
4. Error Handling: Enforce throw-first error handling (OpenAPIHono routes should throw, not return, error responses, handled by global onError middleware). Ensure failure details are visible to admins but masked for standard users.
5. Async Worker Tasks: Ensure that long-running async background operations (e.g. Zulip notifications, emails, social queue syndications) use `c.executionCtx.waitUntil(promise)` to allow HTTP response dispatch without waiting for execution completion.

Create a highly detailed markdown report at:
`c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\teamwork_preview_explorer_audit_backend\analysis.md`
Your report must list exact file paths and line numbers for all findings under `✅ Strengths` and `⚠️ Findings` headings, formatted in details for each of the relevant pillars, and output a findings table with unique IDs (e.g. `AUD-B01`).
When finished, send a message to the orchestrator summarizing your findings and providing the absolute path to your analysis.md file.
