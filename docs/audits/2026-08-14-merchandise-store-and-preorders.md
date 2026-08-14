# Merchandise Store & Booster Pre-Order Subsystem Audit

- Date: August 14, 2026
- Branch: `codex/cycle-35-merch-store-catalog`
- Audited baseline: `origin/master`
- Scope: Merchandise catalog display, apparel size conversion guides, cart summary drawer, booster pre-order inquiry submission, Firebase App Check security, and zero financial PII protection.
- Production mutation: none

---

## 1. Executive Summary & Deliverables

This development cycle enhances the public team store at `src/app/store/page.tsx` into an interactive team merchandise catalog and season booster pre-order portal. The implementation maintains zero financial PII exposure and zero payment processing risk while providing supporters and students with full merchandise specifications and a streamlined pre-order inquiry flow.

### A. Team Merchandise Catalog
- **Catalog Dataset:** Defined in `src/lib/storeCatalogData.ts` with 5 official team products:
  1. `ares-comp-jersey`: Official Competition Jersey ($55.00)
  2. `ares-foil-hoodie`: Gold Foil Embroidered Hoodie ($65.00)
  3. `ares-pit-cap`: Team Pit Cap ($28.00)
  4. `ares-vinyl-stickers`: Vinyl Sticker Pack ($12.00)
  5. `ares-3d-keychain`: 3D Printed Robot Keychain ($10.00)
- **Interactive Product Cards:** `src/app/store/components/ProductCard.tsx` provides category badges, pricing, feature checkmarks, apparel size selector, quantity stepper with bounds (1-20), and instant feedback animations.
- **Filtering & Search:** Real-time search across product names, categories, descriptions, and feature bullets with category pills and empty-state recovery.

### B. Size Conversion Guide Modal
- **Component:** `src/app/store/components/SizeGuideModal.tsx` provides full apparel sizing dimensions (XS, S, M, L, XL, 2XL, 3XL).
- **Unit Conversion:** Live toggle between imperial (inches) and metric (centimeters) for Chest Width, Body Length, and Sleeve Length.
- **Accessibility & Focus:** Built with Radix Dialog, trap focus, and keyboard escape handling.

### C. Dynamic Cart Drawer & Pre-Order Submission
- **Cart Summary Drawer:** `src/app/store/components/CartDrawer.tsx` features item-level quantity adjustment, item removal, dynamic subtotal calculation, empty cart illustration, and travel fund transparency notice.
- **Pre-Order Inquiry Modal:** `src/app/store/components/PreOrderModal.tsx` collects non-financial booster inquiry data (Name, Email, Pickup/Fulfillment Preference, Notes).
- **App Check & Anti-Spam Protection:** Integrates with `getAppCheckHeader()` and `getRecaptchaToken()` before submitting to the backend encrypted inquiries pipeline.

### D. Zero Financial PII Policy
- **No Payment Gateways:** Explicitly eliminates credit card numbers, CVVs, expiration dates, and bank account inputs.
- **Booster Notice:** Transparent messaging explains that 100% of proceeds support FIRST Tech Challenge competition travel, robot parts, and STEM outreach.

---

## 2. Verification Gate Results

All commands executed with `.\scripts\with-supported-runtime.ps1` on Node 22.13.1, pnpm 11.21.0, and Java OpenJDK 21:

| Verification Step | Command | Status | Notes |
|---|---|---|---|
| Agent Config Validation | `pnpm run validate:agents` | **PASS** | Validated shared skills and config |
| Frontend Linting | `pnpm run lint` | **PASS** | 0 errors, 0 warnings |
| Functions Linting | `pnpm --filter functions lint` | **PASS** | 0 errors, 0 warnings |
| TypeScript Typecheck | `pnpm exec tsc --noEmit` | **PASS** | 0 type errors |
| Frontend Test Coverage | `pnpm run test:coverage` | **PASS** | 107 test files / 589 tests passed; `storeCatalogData.ts` 95.83% lines / 100% funcs |
| Functions Build | `pnpm --filter functions build` | **PASS** | Cloud Functions bundle built |
| Functions Coverage | `pnpm --filter functions test:coverage` | **PASS** | 45 test files / 576 tests passed; 94.89% lines / 98.33% funcs |
| Security Rules | `pnpm run test:rules` | **PASS** | 20 Firestore & Storage zero-trust rules passed |
| Production Build | `pnpm run build` | **PASS** | 22 static routes prerendered successfully |
| Bundle Size Check | `node scripts/check-bundle-size.mjs` | **PASS** | All chunk and bundle budgets within limits |
| E2E Regression Suite | `pnpm run test:e2e --workers=2` | **PASS** | 56/56 tests passed across Chromium, Mobile, Firefox, WebKit |
| Dependency Audit | `pnpm audit --prod --audit-level=high` | **PASS** | 0 vulnerabilities found |

---

## 3. Test Coverage Summary

- **Unit Test Suite:** `src/test/StoreMerchCatalog.test.tsx` (15/15 tests passing)
  - Catalog data models, pricing formatting, metric/imperial conversions
  - Filtering by category and search queries
  - Size guide modal opening, measurement toggles, and dismissal
  - Product card size selector and quantity controls
  - Cart drawer line-item updates, deletions, and dynamic subtotal calculations
  - Pre-order form validation, App Check submission, success confirmation, and error alerts
  - Complete zero-financial PII assertion across the entire DOM tree
- **End-to-End Test Suite:** `e2e/interactive.spec.ts` (Store checkout availability & booster notice verification across all browsers)
