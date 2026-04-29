# STRUCTURE.md

**Date:** 2026-04-28

## Directory Layout

### `/src` - Frontend Application
- `/components`: Reusable React components (UI primitives, complex widgets).
- `/pages`: React Router page components.
- `/hooks`: Custom React hooks.
- `/contexts`: React Context providers.
- `/api`: `ts-rest` client instantiations and frontend API utilities.
- `/store`: Zustand state stores.
- `/utils`: Helper functions.
- `/types`: Frontend-specific TypeScript types.
- `/sims`: Simulation or interactive canvas components.

### `/functions` - Backend Application (Cloudflare Pages Functions)
- `/api`: Hono API route handlers and `ts-rest` implementations.
- `/dashboard`: Specific internal or admin endpoints.
- `/utils`: Backend helper functions.
- `_middleware.ts`: Global Cloudflare Pages middleware (auth, cors, context injection).

### `/shared` - Shared Code
- Contains code imported by both frontend and backend.
- Typically houses `ts-rest` contracts, Zod schemas, and shared types.

### Root Configs
- `schema.sql`: Primary database schema definition for D1.
- `package.json`, `vite.config.ts`, `wrangler.toml`: Tooling and deployment configuration.
- `tailwind.config.ts`: Global styling variables.

## Naming Conventions
- React components: `PascalCase.tsx`.
- Hooks: `useCamelCase.ts`.
- Utilities/Services: `camelCase.ts` or `kebab-case.ts`.
