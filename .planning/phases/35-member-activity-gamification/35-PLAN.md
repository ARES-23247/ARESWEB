# Phase 35: Member Activity Gamification - Plan

## Step 1: Database Schema Expansion
1. Create migration `0003_add_points_ledger.sql` introducing the `points_ledger` table with fields `id`, `user_id`, `points_delta`, `reason`, `created_by`, `created_at`.
2. Update `shared/schemas/database.ts` with the new `PointsLedger` interface.

## Step 2: Contract Definition
1. Create `shared/schemas/contracts/pointsContract.ts` defining endpoints:
   - `GET /api/points/balance/:user_id` (User/Admin)
   - `GET /api/points/history/:user_id` (User/Admin)
   - `POST /api/points/transaction` (Admin only)

## Step 3: Hono Backend Router
1. Implement `functions/api/routes/points.ts` hooking into `ts-rest-hono`.
2. Connect endpoints to `mockDb` or production Kysely D1 `db` instance.
3. Validate user roles (admin for creation, user constraint for fetching).

## Step 4: Unit Testing
1. Implement `functions/api/routes/points.test.ts` to ensure 100% test coverage.
2. Validate the correct 401/403 status codes when non-admins try to allocate points.

## Step 5: Verification
1. Run local tests (`npm run test`).
2. Mark POINTS-01, POINTS-02, and POINTS-03 as completed.
