# STACK.md

**Date:** 2026-04-28

## Core Technologies

- **Language:** TypeScript 5.x
- **Frontend Framework:** React 18, Vite 6
- **Backend Framework:** Hono 4.x (Cloudflare Workers via `ts-rest-hono`)
- **Database:** Cloudflare D1 (SQLite) with Kysely Query Builder
- **Deployment:** Cloudflare Pages (dist output)

## Key Dependencies

- **Styling:** Tailwind CSS 3.4
- **Component Libraries:** Radix UI (`@radix-ui/*`), Headless UI, Tremor (charts)
- **State Management:** Zustand, React Query (`@tanstack/react-query`)
- **Data Fetching/Contracts:** `@ts-rest/core`, `@ts-rest/react-query`
- **Authentication:** Better Auth (`better-auth`) with Kysely Adapter
- **Editor:** Tiptap (ProseMirror based)
- **3D Graphics:** Three.js (`three`, `@react-three/fiber`, `@react-three/drei`)
- **Animations:** Framer Motion

## Rationale & Notes
- Cloudflare Pages + Functions is used for an edge-first, serverless architecture.
- `ts-rest` establishes a typesafe RPC-like contract between the frontend and the Hono backend.
- Kysely provides typesafe SQL query building for D1.
- Better Auth handles robust authentication integrated with the D1 database.
