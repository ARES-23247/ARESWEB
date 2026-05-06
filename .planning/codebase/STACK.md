# STACK.md

**Date:** 2026-05-06

## Core Technologies

- **Language:** TypeScript 5.x
- **Frontend Framework:** React 18, Vite 6
- **Backend Framework:** Hono 4.x with `@hono/zod-openapi` (OpenAPI route definitions)
- **Database:** Cloudflare D1 (SQLite) with Kysely Query Builder
- **Deployment:** Cloudflare Pages (dist output)

## Key Dependencies

- **Styling:** Tailwind CSS 3.4
- **Component Libraries:** Radix UI (`@radix-ui/*`), Headless UI, Tremor (charts)
- **State Management:** Zustand, React Query (`@tanstack/react-query`)
- **API Contracts:**
  - Backend: `@hono/zod-openapi` with Zod schemas
  - Frontend: `@ts-rest/core`, `@ts-rest/react-query` (to be migrated)
- **Authentication:** Better Auth (`better-auth`) with Kysely Adapter
- **Editor:** Tiptap (ProseMirror based)
- **3D Graphics:** Three.js (`three`, `@react-three/fiber`, `@react-three/drei`)
- **Animations:** Framer Motion

## Rationale & Notes
- Cloudflare Pages + Functions is used for an edge-first, serverless architecture.
- **Backend routes** use `@hono/zod-openapi` with Zod for runtime validation and full type inference in handlers.
- **Frontend client** uses `ts-rest` for type-safe API calls (286 usages - migration deferred).
- Kysely provides typesafe SQL query building for D1.
- Better Auth handles robust authentication integrated with the D1 database.
