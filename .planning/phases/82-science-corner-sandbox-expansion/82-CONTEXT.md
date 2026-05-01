# Phase 82 Context: Science Corner & Sandbox Expansion

## Domain
Expansion of the interactive Simulation Playground and addition of a new dedicated "Science Corner" for educational experiments.

## Decisions

### Scope & Integration
- **Content:** Focused on general science, math, and non-FTC robotics lessons.
- **Access:** Designed as a standalone, public-facing page so anyone can access the lessons without an account.

### State Persistence
- **Browser Memory:** User progress and setup configurations will be saved locally in the browser memory (localStorage or IndexedDB). This provides a seamless experience for public users without requiring backend accounts or D1 database overhead.

### Simulation Engine & Visuals
- **Hybrid Approach (A & B):** 
  - We will integrate generic web-native engines (like `matter.js` for 2D physics or `three.js` for 3D) for complex physics demonstrations.
  - We will build custom lightweight React and HTML Canvas components tailored individually to simpler math and logic lessons.
  - This intentionally decouples the Science Corner from the existing `Dyn4j` / FTC telemetry infrastructure used in the main simulation sandbox.

## Canonical Refs
None currently specified.

## Code Context
- Will introduce new routing for public standalone pages.
- Will require local storage hooks/providers to manage browser-based persistence.
