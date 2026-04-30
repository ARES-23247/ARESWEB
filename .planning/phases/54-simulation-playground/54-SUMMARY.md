---
phase: 54
name: Simulation Playground
status: completed
requirements_completed: []
files_changed:
  - src/components/SimulationPlayground.tsx
  - src/components/editor/SimPreviewFrame.tsx
  - src/components/dashboard/DashboardRoutes.tsx
  - src/components/dashboard/DashboardSidebar.tsx
  - functions/api/routes/simulations.ts
  - functions/api/[[route]].ts
  - migrations/0005_add_simulations.sql
---

# Phase 54 Summary: Simulation Playground

## What Was Built

### SimulationPlayground.tsx — 3-Pane Layout
- **Left pane (40%)**: Monaco code editor with JSX syntax, JetBrains Mono font
- **Center pane (25%)**: z.AI conversational chat for iterative simulation authoring
- **Right pane (35%)**: Sandboxed iframe with live React preview
- Draggable resize handles between all 3 panes (using `<button>` elements for a11y)
- Header toolbar: Run, Copy, Reset, Save buttons + editable simulation name

### SimPreviewFrame.tsx — Sandboxed Preview
- Uses `srcdoc` with React 18 CDN + Babel standalone for JSX transpilation
- Runtime error capture via `window.onerror` → `postMessage` → parent
- Built-in CSS classes: `.sim-container`, `.sim-title`, `.sim-label`, `.sim-slider`, etc.
- Error boundary display with red-highlighted error messages

### z.AI Chat Integration
- Conversational flow: describe what you want, AI generates full `SimComponent`
- Auto-applies code when response contains `function SimComponent`
- Strips markdown fences before applying
- Chat history with clear button, Enter-to-send, Shift+Enter for multiline

### Backend: Simulations CRUD
- `POST /api/simulations` — Create or update (rate-limited 10/min, admin-only)
- `GET /api/simulations` — List all simulations
- `GET /api/simulations/:id` — Get single simulation
- `DELETE /api/simulations/:id` — Delete (admin-only)
- D1 migration `0005_add_simulations.sql`: `simulations` table with `id`, `name`, `code`, `author_id`, timestamps

### Dashboard Integration
- Route: `/dashboard/simulations` (admin-only, lazy-loaded)
- Sidebar: "Sim Playground" entry under Quick Create with Sparkles icon

### z.AI Model Upgrade
- RAG chatbot upgraded from Workers AI (Llama 3.1) to z.ai (zai-5.1) as primary
- Workers AI preserved as fallback when z.ai unavailable
- Embedding generation remains on Cloudflare AI (required for Vectorize)
