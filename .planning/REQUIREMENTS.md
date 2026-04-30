# Simulation Playground Evolution (v4.9) Requirements

## Scope
Transform the existing Simulation Playground into a comprehensive robotics development environment by adding advanced IntelliSense, multi-file sandboxes, live telemetry, visual AI context, physics abstractions, and cloud saving.

## Requirements

### SIM-03: Hardware & Physics IntelliSense
- **Requirement**: The Monaco editor MUST provide autocomplete and type definitions for React, Three.js, and ARESLib physics.
- **Acceptance**: When users type `new SwerveDrive(`, they receive accurate parameter hints and JSDoc explanations.

### SIM-04: Multi-File Sandbox & Templates
- **Requirement**: The UI MUST support a multi-file tree structure, allowing separation of `Components`, `Constants`, and `Controllers`.
- **Acceptance**: Users can switch between files in a sidebar. The playground MUST provide starting templates (e.g., Swerve Drive, Elevator).

### SIM-05: Real-Time Telemetry & Data Inspector
- **Requirement**: The environment MUST include a real-time data inspection panel.
- **Acceptance**: Users can graph numerical variables via a custom hook (e.g., `useTelemetry`) or direct `console.log` integration, plotting outputs like velocity or PID error over time.

### SIM-06: Visual AI Feedback Loop
- **Requirement**: The AI auto-healing and code generation system MUST have visual context of the rendered simulation.
- **Acceptance**: The simulation iframe can be screenshotted and passed as an image to the z.ai model to guide UI/physics adjustments iteratively.

### SIM-07: Built-in Physics Engine Abstractions
- **Requirement**: The sandbox MUST natively support `@react-three/fiber` and `@react-three/drei` environments without manual setup boilerplate.
- **Acceptance**: Global helpers like `<SwerveModule />` or `<PhysicsWorld />` are available natively within the simulation context.

### SIM-08: Cloud Save & Collaborative Sharing
- **Requirement**: Simulations MUST be savable to the Cloudflare D1 database.
- **Acceptance**: Users can generate and share unique URL links (e.g., `aresfirst.org/sim/xyz`) that load a fully configured simulation workspace.
