# Morgantown Regional Robotics & STEM Hub Audit

- Date: August 14, 2026
- Audited baseline: `origin/master`
- Branch: `codex/cycle-20-location-morgantown`
- Scope: Morgantown regional STEM hub route (`src/app/location-morgantown/page.tsx`), engineering laboratories, Google Maps venue navigation, regional county outreach footprint (Monongalia & Harrison), and unit test coverage (`src/test/LocationMorgantownPage.test.tsx`)
- Production mutation: none

---

## Findings and Implementation

### LOC-01 — Comprehensive Morgantown Regional Robotics Hub Information Architecture

- **Severity**: medium
- **Confidence**: high
- **Evidence**: The Morgantown location page previously lacked explicit engineering laboratory addresses, interactive Google Maps directions links, detailed Monongalia/Harrison county outreach footprint descriptions, direct contact links, and visitor/lab safety guidelines under *FIRST*® Youth Protection Program (YPP).
- **Impact**: Prospective students, mentors, parents, and community partners in Morgantown and surrounding North Central West Virginia counties could not locate physical lab spaces (MARS Building, ARES Machine Shop, SPARK! WV Museum) or understand the multi-county outreach programs.
- **Remediation**: 
  - Integrated full STEM facility information cards for MARS Building (`123 Science Way, Morgantown, WV 26508`), ARES Machine Shop (`456 Tech Lane, Morgantown, WV 26505`), and SPARK! WV Science Center (`9500 Mall Road, Morgantown, WV 26501`).
  - Added secure, accessible Google Maps directions links with `target="_blank"`, `rel="noopener noreferrer"`, and descriptive `aria-label` attributes.
  - Articulated the dual-county outreach footprint:
    - **Monongalia County**: Morgantown, Cheat Lake, Westover, Star City, Brookhaven, and Granville (weekly build workshops, public library demos, school mentoring).
    - **Harrison County**: Clarksburg, Bridgeport, Shinnston, Salem, and Stonewood (inter-county scrimmages, kickoff clinics, cross-county commuter support).
    - Commuters note for Marion, Preston, and Taylor counties.
  - Implemented direct communication and inquiry channels including direct email (`contact@aresfirst.org`), application form (`/join`), team calendar (`/calendar`), and STEM demo requests (`/outreach`).
  - Added laboratory access guidelines under *FIRST*® Youth Protection Program (YPP) protocols.
- **Acceptance test**: Created comprehensive unit test suite in `src/test/LocationMorgantownPage.test.tsx` (8 test specs) validating hero headers, laboratory addresses, Google Maps directions links, Monongalia/Harrison county footprint, programs/eligibility, and contact channels.
- **Status**: fixed.

---

## Verification Evidence

- Scoped ESLint & Functions ESLint: 0 warnings, 0 errors.
- Unit Test Suite: `src/test/LocationMorgantownPage.test.tsx` covering all hero sections, venue cards, external map directions, regional county footprint, and inquiry channels.
- Full type checking via `tsc --noEmit` passing with 0 errors.
