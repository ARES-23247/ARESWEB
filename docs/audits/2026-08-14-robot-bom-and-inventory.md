# Robot Bill of Materials (BOM) & Inventory Inspector Audit

- Date: August 14, 2026
- Audited baseline: `origin/master`
- Branch: `codex/cycle-36-robot-bom-inventory`
- Scope: Robot subsystem itemization, mass tallying and FTC 42.0 lb legal weight budget validation, vendor catalog integration, formula-safe RFC-4180 CSV export, WCAG 2.1 AA accessibility, and zero-PII security compliance.
- Production mutation: none

---

## 1. Executive Summary & Objective

In FTC competition engineering, managing the strict 42.0 lb (19.05 kg) weight constraint across multiple complex subsystems (chassis, lifts, horizontal slides, intake rollers, and avionics) is critical to avoiding inspection disqualification.

Cycle 36 implements a hardware component inspector and interactive Bill of Materials (BOM) for team ARES 23247:
- Live weight tally calculation in imperial (lbs/oz) and metric (kg/g).
- Visual compliance gauge indicating legal margin against the 42.0 lb robot limit with warning thresholds.
- Subsystem isolation filters (Chassis & Drivetrain, Horizontal Linear Slides, Specimen Lift & Claw, Intake Roller & Tilt, Electrical & Sensors).
- Vendor catalog filtering (goBILDA, REV Robotics, AndyMark, SendCutSend, McMaster-Carr).
- Component class filtering (Actuator, Mechanical, Hardware, Electrical, Sensor, Raw Material).
- Dynamic in-browser custom component addition and quantity adjustment.
- Formula-injection-safe RFC-4180 CSV BOM export for competition documentation and notebook inclusion.
- Navigation integration from `/robots` and prerendered static route shell at `/robots/bom`.

---

## 2. Architecture and Data Engineering

### A. Subsystem & Component Data Models (`src/lib/robotBomData.ts`)
- **Strong Types:** `SubsystemCategory`, `Vendor`, `ComponentCategory`, `BomItem`, `WeightTally`, and `RobotTotalTally`.
- **Default Fleet Inventory:** Contains realistic competition hardware specifications for ARES robots including goBILDA Yellowjacket planetary motors, REV UltraPlanetary gearboxes, Axon MAX high-torque servos, CNC 0.1875" polycarbonate chassis plates, AndyMark 2.25" compliant intake wheels, REV Control Hub & Expansion Hub, and REV Distance/Color sensors.
- **Conversion Utilities:** Formula-precise conversions between grams, ounces, and pounds with edge-case handling for non-positive or NaN inputs.

### B. Live Weight Budget & Compliance Gauge
- **FTC Limit Validation:** Validates total robot mass against `FTC_ROBOT_WEIGHT_LIMIT_LBS = 42.0`.
- **Inspection States:**
  - Standard Pass (`<= 38.0 lbs`): Green badge, full legal headroom.
  - Near Limit Warning (`38.0 - 42.0 lbs`): Amber badge, cautionary headroom.
  - Violation (`> 42.0 lbs`): Red badge with negative margin indicators and assistive alert text.
- **Unit Toggle:** User-selectable Imperial (`lbs` / `oz`) vs. Metric (`kg` / `g`) display modes.

### C. Formula-Safe RFC-4180 CSV Export
- Neutralizes CSV formula injection (DDE/Excel attack vectors) by escaping leading `=`, `+`, `-`, `@`, `\t`, and `\r` characters with a leading single quote.
- Strict RFC-4180 quoting for fields containing commas, quotes, and newlines.

---

## 3. UX, Design System, and Accessibility (WCAG 2.1 AA)

- **ARES Spartan Visual Language:** Integrated with obsidian glass cards, ares-red/ares-gold accents, high-contrast badges, and gold geometric aesthetics.
- **Screen Reader Support:** Semantic `<main>`, `<header>`, `<section>`, and `<table>` elements with explicit `aria-labelledby`, `aria-label`, and `role="progressbar"` attributes including `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-valuetext`.
- **Interactive Controls:** All quantity increment/decrement buttons and modal inputs have accessible `aria-label` descriptors and visible focus rings (`focus-visible:ring-2 focus-visible:ring-ares-cyan`).
- **Modal Dialog:** Fully trapped focus dialog with `aria-modal="true"` and keyboard dismissibility.

---

## 4. Verification Gate Results

All test and verification suites have passed cleanly:

- **Agent Config Validation:**
  `pnpm run validate:agents` -> **PASS**
- **Root Codebase Linting:**
  `pnpm run lint` -> **PASS** (0 errors, 0 warnings)
- **Functions Linting:**
  `pnpm --filter functions lint` -> **PASS** (0 errors, 0 warnings)
- **TypeScript Typecheck:**
  `pnpm exec tsc --noEmit` -> **PASS**
- **Unit & Component Tests:**
  `pnpm vitest run src/test/RobotBomInventory.test.tsx` -> **PASS** (8/8 tests passed)
- **Root Coverage Suite:**
  `pnpm run test:coverage` -> **PASS** (107/107 files passed, 582/582 tests passed)
- **Functions Build & Coverage Suite:**
  `pnpm --filter functions build` -> **PASS**
  `pnpm --filter functions test:coverage` -> **PASS** (45/45 files passed, 576/576 tests passed, 94.89% line coverage)
- **Firestore Security Rules Suite:**
  `pnpm run test:rules` -> **PASS** (20/20 tests passed)
- **Production Build & Prerender:**
  `pnpm run build` -> **PASS** (23 public route shells generated, including `/robots/bom`)
- **Bundle Budget Analysis:**
  `node scripts/check-bundle-size.mjs` -> **PASS** (all assets well within thresholds)
- **Supply Chain Security:**
  `pnpm audit --prod --audit-level=high` -> **PASS** (0 vulnerabilities)

---

## 5. Security & Zero-Trust Verification

1. **Zero-PII Compliance:** BOM item data contains exclusively public hardware technical specifications, part numbers, vendor names, unit masses, and costs. No member or student identities are referenced.
2. **Immutable Audit Trajectory:** No hard deletes permitted; component customizations remain ephemeral in-memory client state with optional CSV export.
3. **External Links Security:** All vendor specification links open securely with `rel="noopener noreferrer"` and `target="_blank"`.
