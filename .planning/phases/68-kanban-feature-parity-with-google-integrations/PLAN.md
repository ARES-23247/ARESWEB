# Phase 68: Kanban Feature Parity with Google Integrations

## Goal
Upgrade the ARESWEB Kanban system to achieve parity with Trello/kanbn, focusing on deep Google integration for attachments.

## Proposed Changes

### Database Layer
Modify the Drizzle ORM schema to support the new features.

#### [MODIFY] `src/db/schema.ts`
- **Tasks Table Expansion**: Add `start_date` (text), `estimated_minutes` (integer), `cover_color` (text), and `cover_image_url` (text) to the `tasks` table.
- **Task Labels**: Create `task_labels` (id, name, color, created_at) and `task_label_assignments` (taskId, labelId) tables.
- **Task Checklists**: Create `task_checklists` (id, taskId, title, sortOrder) and `task_checklist_items` (id, checklistId, content, isCompleted, sortOrder).
- **Task Attachments**: Create `task_attachments` (id, taskId, title, url, type, createdBy, createdAt) to store Google Docs/Sheets links.
- **Task Dependencies**: Leverage the existing `entity_links` table (sourceType='task', targetType='task', linkType='blocks' | 'relates_to') instead of creating a new table.

#### [MODIFY] `shared/db/schema-zod.ts` & `shared/routes/tasks.ts`
- Generate new Zod schemas for the new tables.
- Expand `TaskSchema` to include relations for `labels`, `checklists`, `attachments`, and `dependencies`.
- Add new OpenAPI routes for managing these sub-resources.

### Backend API Handlers
Implement the business logic and database queries for the new features.

#### [MODIFY] `functions/api/routes/tasks.ts`
- Update the main `GET /api/tasks` query to fetch or join the new relations (labels, checklist progress, attachments).
- Add specific route handlers for creating/deleting checklist items, adding/removing labels, and attaching Google links.
- **Activity Log**: Ensure all task mutation endpoints automatically write an entry to the global `audit_log` table with `resourceType = 'task'`.

### Frontend API Client
Bind the new API routes to the React Query client.

#### [MODIFY] `src/api/tasks.ts`
- Update the TypeScript definitions (`Task` interface) to match the expanded schema.
- Export new React Query hooks: `useAddTaskLabel`, `useManageChecklist`, `useAddGoogleAttachment`, `useGetTaskHistory`, etc.

### Frontend UI Components
Update the Kanban interface to visually display and interact with the new data.

#### [MODIFY] `src/components/kanban/TaskDetailsModal.tsx`
- **Header/Cover**: Add UI to display and set a card cover color or image.
- **Labels Section**: Add a label picker dropdown.
- **Dates & Estimates**: Add inputs for `Start Date` and `Estimated Time (Minutes)`.
- **Google Attachments**: Add a section to paste Google links. Render a rich attachment card with the Google Favicon.
- **Checklists**: Render native checklist components with progress bars.
- **Activity Feed**: Add an "Activity" tab next to the "Description" that fetches and displays the `audit_log` entries for this specific task.
- **Dependencies**: Add a section to link other tasks that block or are blocked by the current task.

#### [MODIFY] `src/components/kanban/GenericKanbanBoard.tsx` & `TaskTableView.tsx`
- **Board Cards**: Update the draggable cards to display label pills, cover colors, checklist progress (e.g., "3/5"), and an attachment icon if Google Docs are attached.
- **Table View**: Add columns for Labels, Start Date, and Estimates.

## Verification Plan
1. Automate types checks: `npx tsc --noEmit` and `npx eslint .`.
2. Ensure E2E tests still pass.
3. Manually test full Kanban feature suite (labels, checklists, Google links, activity log).
