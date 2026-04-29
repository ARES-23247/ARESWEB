# Phase 32: Admin Fulfillment Dashboard - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous workflow)

<domain>
## Phase Boundary

Build an admin dashboard for tracking physical store orders and toggling their fulfillment status.
</domain>

<decisions>
## Implementation Decisions

### Autonomous Discretion
- **Backend:** Update `storeContract.ts` and `store.ts` to include `GET /api/store/orders` and `PATCH /api/store/orders/:id/fulfill`.
- **Frontend:** Build an admin page `src/pages/Dashboard/StoreAdmin.tsx` or similar. Add it to the internal dashboard.
- **Access Control:** Protect the endpoints and dashboard with Admin permissions.
- **UI:** A data table or card list showing order details, customer email, shipping address, date, and a button to mark as fulfilled/unfulfilled.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.
</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase resolved automatically.
</specifics>

<deferred>
## Deferred Ideas

None.
</deferred>
