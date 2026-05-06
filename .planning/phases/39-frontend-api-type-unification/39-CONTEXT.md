# Phase 39 Context: Frontend API Type Unification

## Domain
Re-exporting `z.infer<>` types from `shared/routes/` into frontend hooks and components to eliminate `any` casts for API response data.

## Canonical Refs
- `shared/routes/*.ts`

## Locked Requirements
1. Extract types from the `zod` schemas that define the `ts-rest` or Hono OpenAPI contracts.
2. Replace `as any` casts in frontend components/hooks with these extracted types.
3. Target components: JudgesHub, Events, About, Leaderboard, Academy, PrintPortfolio, MemberImpactOverview, ProfileEditor, TaskBoardPage, RevisionManager, useDashboardSession, SEO, TiptapRenderer.
4. Achieve zero inline `eslint-disable` comments for `no-explicit-any` in these files.

## Decisions
- **Implementation Approach**: We will import the OpenAPI Zod schemas from `shared/routes` and use `z.infer<typeof schema>` to define the frontend component properties instead of using generic `any` mapping. Where `ts-rest` or RPC is used, we will type the response payload accurately.
