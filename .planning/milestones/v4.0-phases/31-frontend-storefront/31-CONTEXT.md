# Phase 31: Frontend Storefront (React) - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous workflow)

<domain>
## Phase Boundary

Build the `/store` UI and cart state management in React.
</domain>

<decisions>
## Implementation Decisions

### Autonomous Discretion
- **State Management:** Use `zustand` for cart state management (`src/store/useCartStore.ts`).
- **UI Architecture:** 
  - `src/pages/Store.tsx` as the main route.
  - A responsive grid displaying products (`ProductCard` component).
  - A sliding or modal `Cart` component displaying added items, quantities, and a checkout button.
- **Routing:** Add `/store` to `src/App.tsx`.
- **API Client:** Use the shared `apiClient` (`src/api/client.ts`) and `@ts-rest/react-query` to fetch products (`apiClient.store.getProducts.useQuery`).
- **Checkout Action:** On checkout click, call `POST /api/store/checkout` with cart items and redirect `window.location.href` to the Stripe URL returned.

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
