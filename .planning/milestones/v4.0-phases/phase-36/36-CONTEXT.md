# Phase 36: Documentation Refresh - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the v4.0 System Hardening, Storefront & Member Incentives milestone by documenting the tech stack, the Liveblocks/Tiptap collaborative editor implementation, and the GSD orchestration tools.

</domain>

<decisions>
## Implementation Decisions

### Audience & Tone
- New team developers — Focuses on practical onboarding, local setup, and repository navigation.
- 8th-grade reading level — Adheres strictly to the `aresweb-documentation-readability` skill.
- Standard Markdown (.md) — Using GitHub Flavored Markdown for compatibility with GSD and the repository viewer.

### Liveblocks & Tiptap Documentation
- Explain provider setup, extension integration, & AST migration — Provides critical, project-specific context on how we use Liveblocks/Tiptap, rather than just linking to official docs.
- `.planning/ARCHITECTURE.md` — Keeps technical implementation details within the planning and architecture domain, keeping `README.md` clean.
- Document Y.js / CRDT conflict resolution patterns — Since we migrated to Tiptap collaborative, noting how conflicts and cursors are handled will prevent future bugs.

### GSD Orchestration Documentation
- Project-specific `.planning` structure & workflows — Focuses on how GSD integrates with ARESWEB specifically (e.g., UI specs, PR creation), not just generic AI concepts.
- Yes, summarize key ARESWEB skills — Provide a high-level overview of skills like `aresweb-ci` and `aresweb-database-management` in the architecture docs, deferring to `SKILL.md` for deep details.
- `.planning/GSD-ORCHESTRATION.md` — A dedicated file within the planning directory ensures it remains focused on contributor orchestration.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `aresweb-documentation-readability` skill (for ensuring 8th grade reading level)
- `aresweb-ci` and `aresweb-database-management` skills (to summarize in GSD documentation)
- Tiptap / Liveblocks provider wrappers inside the codebase

### Established Patterns
- Centralized planning documents inside `.planning/`
- Skill definitions under `.agents/skills/`

### Integration Points
- Documentation links to existing `README.md` and repository structure.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches as long as they follow the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
