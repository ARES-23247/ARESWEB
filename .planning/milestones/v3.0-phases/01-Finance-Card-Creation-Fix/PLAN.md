# Phase 1: Finance Card Creation Fix

## Objective
Fix the silent validation failures preventing users from creating sponsorship cards and transactions on the Finance Dashboard.

## Context
The React Hook Form `DashboardInput` for numeric values (`estimated_value`, `amount`) is missing the `error` prop. Because Zod strictly expects a `number().min(...)`, submitting the form with an empty value coerces it to `NaN`, failing validation silently. Additionally, `season_id` is improperly converted to a string before hitting the Kysely database query.

## Tasks

### 1. Fix Schema Numeric Validation
**File:** `shared/schemas/financeSchema.ts`
- Change `estimated_value` in `sponsorshipPipelineSchema` to `z.coerce.number().catch(0)` to prevent `NaN` crashes.
- Change `amount` in `financeTransactionSchema` to `z.coerce.number().min(0.01)` for proper strict float coercion.

### 2. Add Error Bindings to Finance Dashboard UI
**File:** `src/components/FinanceManager.tsx`
- Pass `error={pipelineForm.formState.errors.estimated_value?.message}` to the `estimated_value` input.
- Pass `error={transactionForm.formState.errors.amount?.message}` to the `amount` input.
- Remove `valueAsNumber: true` from the `register` hooks (coercion is now handled by Zod).

### 3. Fix Backend Season ID Type
**File:** `functions/api/routes/finance.ts`
- Inside `savePipeline` and `saveTransaction`, remove `body.season_id.toString()`.
- Ensure it evaluates to a number or null: `body.season_id ? Number(body.season_id) : null` to safely match the Kysely database schema.

## Verification
- `npx vitest run finance.test.ts` must pass 100%.
- UI compilation must succeed without type errors.
