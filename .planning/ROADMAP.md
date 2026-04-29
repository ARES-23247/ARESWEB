# Proposed Roadmap

**2 phases** | **2 requirements mapped**

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 16 | Fix Liveblocks Migration Error | Resolve duplicate column `content_draft` error in migration 048. | REQ-1 | `npx wrangler d1 migrations apply ares-db --local` passes without errors. |
| 17 | Database Simplification & Audit | Simplify and audit the 49 migrations and existing schemas. | REQ-2 | An audit log is produced and any coalescing/dropping of obsolete database elements is successfully executed. |

### Archived Milestones
- [v3.7 - UI Polish & CSS Linting](milestones/v3.7-ROADMAP.md)
- [v3.6 - Collaboration Polish & UI Fixes](milestones/v3.6-ROADMAP.md)
- [v3.5 - Version Control & Contributor Attribution](milestones/v3.5-ROADMAP.md)
