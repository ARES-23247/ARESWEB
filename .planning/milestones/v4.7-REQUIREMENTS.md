# Requirements

## v4.7 Gap Closure (Tech Debt from v4.6 Audit)

### Test Coverage
- [x] **TD-01**: `indexer.ts` and `autoReindex.ts` must have vitest unit tests covering core indexing logic, dynamic import behavior, and error handling.
- [x] **TD-02**: Admin reindex endpoint (`POST /api/ai/reindex`) must have an E2E or integration test verifying auth guard, incremental mode, and force mode.

### Pipeline Hardening
- [x] **TD-03**: `events` and `posts` tables must have `updated_at` columns with automatic update triggers, enabling true incremental timestamp-based indexing instead of full filtered scans.
- [x] **TD-04**: `/api/ai/reindex` endpoint must have rate limiting applied (even though admin-only) to prevent accidental neuron exhaustion.
- [x] **TD-05**: Cron scheduled handler must be validated as executing in production (check Cloudflare dashboard logs or add a KV heartbeat).

### Traceability
- **TD-01** → Phase 51
- **TD-02** → Phase 51
- **TD-03** → Phase 52
- **TD-04** → Phase 52
- **TD-05** → Phase 52

---

## v4.6 RAG Knowledge Base Pipeline

### AI Indexing
- [x] **AI-04**: Site content (events, posts, docs, seasons) must be incrementally indexed into Vectorize for RAG chatbot retrieval. Only public, non-deleted records should be indexed. Cost must stay under free-tier neuron limits.
- [x] **AI-05**: Admin dashboard must provide manual controls to trigger incremental sync and full rebuild of the AI knowledge base.

### Traceability
- **AI-04** → Phase 49
- **AI-05** → Phase 50

---

## v4.3 Inquiries, Notifications & Docs Restoration

### Notifications
- [x] **NOTIF-01**: User notifications must be properly dismissed from the UI and notification bar when marked as read or handled.

### Documentation
- [x] **DOCS-01**: Missing documentation entries must be recovered or re-created in the database to restore championship-grade data quality.

### Inquiries
- [x] **INQ-01**: System must automatically generate a Zulip thread for each new inquiry submitted.
- [x] **INQ-02**: Inquiry details view must include a "Discuss on Zulip" button that links directly to the generated Zulip thread.
- [x] **INQ-03**: Inquiry view must include a "notes" section, functioning similarly to Kanban card notes, for internal tracking and discussion.

### Traceability
- **NOTIF-01** → Phase 41
- **DOCS-01** → Phase 42
- **INQ-01** → Phase 43
- **INQ-02** → Phase 43
- **INQ-03** → Phase 44
