# Phase 68: Kanban Feature Parity with Google Integrations - Research

## Context and Goals
The objective is to achieve feature parity with standard Kanban tools (Trello) while integrating Google Workspace for task attachments. This involves adding Labels, Checklists, Task Dependencies, Date/Estimates, Covers, and Google Link processing.

## 1. Database Schema Additions (Drizzle ORM)
Target File: `src/db/schema.ts`

### Modifications to existing `tasks` table:
- Add `startDate: text("start_date")`
- Add `estimatedMinutes: integer("estimated_minutes")`
- Add `coverImage: text("cover_image")`

### New Tables Required:
1. **`labels`**: Global workspace labels.
   - `id: text().primaryKey()`
   - `name: text().notNull()`
   - `colorTheme: text("color_theme")` (e.g., ARES brand colors)
2. **`taskLabels`**: Join table for task-label assignment.
   - `taskId: text("task_id")`
   - `labelId: text("label_id")`
3. **`taskChecklists`**: Plain text checklists.
   - `id: text().primaryKey()`
   - `taskId: text("task_id")`
   - `content: text().notNull()`
   - `isCompleted: integer("is_completed").default(0)`
   - `sortOrder: integer("sort_order").default(0)`
4. **`taskAttachments`**: Attachments (specifically Google Docs/Sheets links).
   - `id: text().primaryKey()`
   - `taskId: text("task_id")`
   - `url: text().notNull()`
   - `title: text().notNull()`
   - `type: text().notNull()` (e.g., 'document', 'spreadsheet', 'presentation')
   - `thumbnailUrl: text("thumbnail_url")`
   - `createdAt: text("created_at")`

### Dependencies:
- The existing `entityLinks` table (`source_type`, `source_id`, `target_type`, `target_id`, `link_type`) perfectly supports task dependencies. We can use `linkType = "blocks"` where source is the blocking task and target is the blocked task.

## 2. API Layer Updates
Target Files: `shared/routes/tasks.ts`, `functions/api/routes/tasks.ts`

- **Contracts**: `TaskSchema` must be expanded to include `startDate`, `estimatedMinutes`, `coverImage`, and nested arrays for `labels`, `checklists`, `attachments`, and `dependencies`.
- **Sub-routes**: We will need new endpoints under the tasks router or separate routers for managing checklists, attachments, and labels to keep mutations atomic.
  - `POST /api/tasks/:id/attachments` -> Triggers Server-Side Unfurling.
  - `POST /api/tasks/:id/checklists`
  - `PATCH /api/tasks/:id/checklists/:checklistId` -> Triggers Zulip alert if 100% complete.
  - `POST /api/tasks/:id/labels`
  - `POST /api/tasks/:id/dependencies` -> Triggers Zulip cross-link alert.

## 3. Server-Side Unfurling (Google Link Processing)
When a user POSTs an attachment URL:
1. The backend `tasksRouter` receives the URL.
2. It fetches the URL locally (from the Cloudflare edge) to bypass CORS.
3. It parses the `<title>` tag using a simple regex or HTML parser to get the document name.
4. It sets the type and thumbnail based on the URL domain/path (e.g., `docs.google.com/document`, `docs.google.com/spreadsheets`).
5. It inserts the record into `taskAttachments` and fires the Zulip alert: *"📎 User attached a Google Doc: **Document Title**"*.

## 4. Frontend Integration
Target Files: `src/components/kanban/TaskDetailsModal.tsx`, `src/components/kanban/GenericKanbanBoard.tsx`, `src/api/tasks.ts`

- **GenericKanbanBoard**: Update task cards to render full pill badges for labels, a cover image block at the top, and visual warning icons if the task is blocked by another task.
- **TaskDetailsModal**: Implement new sections:
  - **Checklist Module**: Simple text input for new items, checkboxes for completion, and a progress bar.
  - **Attachments Module**: Render rich preview cards for Google links.
  - **Label Picker**: Dropdown mapping to global labels.
  - **Dates & Estimates**: UI inputs for `startDate` and `estimatedMinutes`.
- **API Hooks**: Add `useTaskChecklistMutation`, `useTaskAttachmentMutation`, etc., via `@ts-rest/react-query`.

## 5. Zulip Sync
Target File: `functions/api/routes/tasks.ts`

We will utilize `sendZulipMessage(env, "kanban", topicName, content)` for milestones. The topicName for a task is usually `Task-ID: Title`. We need to query the task to reconstruct its topic name when firing sub-resource alerts.

## Validation Architecture
- **Schema Validation**: Drizzle migrations must successfully execute, adding new tables without breaking existing relations.
- **Unfurling**: The server-side link unfurler must correctly identify Google Docs vs generic links without crashing on inaccessible documents.
- **Zulip Integration**: Attachments, full-checklist completions, and dependency additions must correctly dispatch to the specific task's Zulip topic without silent failures.

## RESEARCH COMPLETE
