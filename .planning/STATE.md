---
milestone: v4.4
name: AI Copilot & CI Stabilization
status: active
progress:
  phases_total: 2
  phases_completed: 2
  tasks_total: 8
  tasks_completed: 8
---

# Project State

## Current Position

Phase: 46 — CI/CD E2E Stabilization (completed)
Plan: —
Status: All phases shipped
Last activity: 2026-04-30 — Circular chunk dependency fix deployed

## Accumulated Context

### Active Blockers
- None

### Deferred Debt
- TODO: Fix Playwright headless WebGL crashes for RobotViewer component in TechStack.tsx. Currently commented out.
- TODO: Remove CI sourcemap diagnostic step once E2E pipeline is confirmed stable over multiple runs.

### Cross-Phase Decisions
- Using Stripe Checkout to handle PCI compliance and mobile wallet payments.
- Using Cloudflare D1 for inventory management and order fulfillment tracking.
- The 3D robot viewer is deferred until an environment configuration for headless WebGL is established.
- GlobalRAGChatbot is lazy-loaded to prevent bundle initialization issues — do not eagerly import it.
- manualChunks: syntax/highlight packages MUST stay in the `markdown` chunk to prevent circular chunk dependencies (syntax -> markdown -> syntax).
- CI E2E uses wrangler.ci.toml (config swap strategy) to bypass Cloudflare remote proxy requirements.
