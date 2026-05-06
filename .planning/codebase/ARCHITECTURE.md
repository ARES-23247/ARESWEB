# ARCHITECTURE.md

**Date:** 2026-05-06

## System Overview
ARESWEB is a monolithic full-stack application built for edge deployment on Cloudflare's network. It features a React SPA frontend and a serverless Hono API backend, both written in TypeScript and sharing type contracts.

## Architectural Layers

1. **Frontend Layer (React/Vite)**
   - Single Page Application (SPA) driven by React Router.
   - Global state via `Zustand`.
   - Asynchronous data fetching, caching, and synchronization via `@tanstack/react-query` using `ts-rest` hooks.
   - PWA configured via `vite-plugin-pwa`.

2. **API Contract Layer (Hybrid)**
   - **Backend**: `shared/routes/` uses `@hono/zod-openapi` with Zod schemas for type-safe route definitions.
   - **Frontend**: `shared/schemas/contracts/` uses `ts-rest` for client-side API calls (286 usages).
   - Both layers enforce typesafe communication without duplicated models.

3. **Backend Layer (Hono/Cloudflare Pages Functions)**
   - Entry point: `functions/api/[[route]].ts` (catch-all).
   - Handlers built on `@hono/zod-openapi` (full type inference via `c.req.valid()`).
   - Middleware handles authentication (via Better Auth) and cross-cutting concerns.

4. **Data Access Layer (Kysely)**
   - Strongly-typed query builder interacting directly with Cloudflare D1.
   - Schemas correspond to local `schema.sql` migrations.

## Data Flow
- User interacts with React UI.
- React components trigger `ts-rest` React Query hooks.
- Hooks formulate requests to `/api/*` endpoints.
- Cloudflare Pages Functions intercept `/api` routes and pass them to the Hono instance.
- Hono handlers parse input via Zod validation, interact with D1 via Kysely, and return strongly-typed responses.
