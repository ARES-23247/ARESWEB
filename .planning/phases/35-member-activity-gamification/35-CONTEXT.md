# Phase 35: Member Activity Gamification

## Current State
The project has robust member management, including profile and badge assignments, but lacks a numerical point system to track overall participation and gamify contributions.

## Goals
1. **Points Ledger**: Introduce an immutable ledger of point transactions, documenting how and when users earn or lose points.
2. **API Routes**: Expose admin endpoints to manually award or deduct points for users.
3. **Aggregate Views**: Provide user-facing API routes to fetch the user's total accrued points and recent transaction history.

## Requirements (from REQUIREMENTS.md)
- **POINTS-01**: Establish a `points_ledger` D1 table for immutable activity tracking.
- **POINTS-02**: Develop `ts-rest` endpoints for admin point allocation.
- **POINTS-03**: Create secure routes for users to fetch their current point balance.
