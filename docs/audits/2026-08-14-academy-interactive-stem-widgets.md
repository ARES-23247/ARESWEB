# ARES Academy Interactive STEM Widgets & Physics Calculators Audit

- Date: August 14, 2026
- Audited baseline: `origin/master`
- Branch: `codex/cycle-30-academy-interactive-widgets`
- Scope: ARES Academy interactive STEM education widgets (`src/app/academy/widgets/`), simulation playground integration (`src/app/academy/playground/page.tsx`), dedicated tools portal (`src/app/academy/tools/page.tsx`), and comprehensive unit test verification (`src/test/AcademyInteractiveWidgets.test.tsx`)
- Production mutation: none

---

## Confirmed Findings and Remediation

### STEM-01 — Absence of Mechanical Gearing, Reduction Ratios, and Torque Multiplication Simulator

- **Severity**: medium
- **Confidence**: high
- **Evidence**: Previously, ARES Academy had conceptual markdown guides but lacked an interactive, visual calculator for computing multi-stage mechanical gear reductions, planetary epicyclic stages, bevel gear pairs, motor free speeds, stall torques, and operating power points.
- **Impact**: Robotics students and mentors had to rely on external calculators without ARES-specific motor presets or visual kinematics feedback.
- **Remediation**: Implemented `src/app/academy/widgets/GearboxSimulator.tsx` supporting:
  - Spur gear trains with dynamic stage addition/removal ($R = \prod N_{\text{driven}}/N_{\text{driving}}$).
  - Planetary gearboxes with sun, planet, and stationary ring tooth sizing ($R_{\text{stage}} = 1 + N_{\text{ring}}/N_{\text{sun}}$).
  - 90° Bevel gear reductions with pinion and crown gear ratio calculations.
  - Pre-configured motor curves (goBILDA 5202 YellowJacket, REV HD Hex, AndyMark NeveRest, NEO Brushless, CIM, Falcon 500 / Kraken X60, Custom).
  - Loaded operating point telemetry (speed under load, mechanical power in Watts, peak power limits).
  - Animated SVG visual gear meshing with pitch point markers, play/pause controls, and speed scaling.
  - One-click copy-ready formula summaries.
- **Acceptance test**: `src/test/AcademyInteractiveWidgets.test.tsx` verifies mathematical reductions, speed/torque outputs, preset applications, and copy-to-clipboard interactions.
- **Status**: fixed.

### STEM-02 — Lack of 2D Chassis Center of Mass & Incline Tipping Point Estimator

- **Severity**: medium
- **Confidence**: high
- **Evidence**: Teams designing FTC/FRC robots frequently experience tip-overs during rapid acceleration or steep ramp climbs due to poorly distributed battery, arm, and intake masses, with no in-browser tool to model 2D stability polygons.
- **Impact**: Increased risk of robot damage and lost match performance during autonomous and teleop cycles.
- **Remediation**: Implemented `src/app/academy/widgets/CenterOfMassEstimator.tsx` featuring:
  - Configurable 2D component masses ($m_i$) and Cartesian coordinates $(x_i, y_i)$ for chassis, battery, drivetrain motors, lift arms, and intakes.
  - Exact Center of Mass calculations: $X_{\text{com}} = \sum m_i x_i / M_{\text{total}}$, $Y_{\text{com}} = \sum m_i y_i / M_{\text{total}}$.
  - Static wheel normal load distributions ($F_{\text{rear}}, F_{\text{front}}$) and weight percentages.
  - Critical tipping angles: $\theta_{\text{tip, forward}} = \arctan((L - X_{\text{com}})/Y_{\text{com}})$ and $\theta_{\text{tip, backward}} = \arctan(X_{\text{com}}/Y_{\text{com}})$.
  - Dynamic acceleration limits: $a_{\text{max}} = g \cdot (d / Y_{\text{com}})$.
  - Interactive incline slope slider ($-45^\circ$ to $+45^\circ$) with real-time visual tilt and tipping risk alert banner when the gravity vector falls outside the wheelbase.
  - Full component CRUD controls (add, edit, remove) and FTC/FRC engineering presets.
- **Acceptance test**: `src/test/AcademyInteractiveWidgets.test.tsx` verifies mass summation, coordinate calculations, tipping thresholds on slopes, and component manipulation.
- **Status**: fixed.

### STEM-03 — Missing PID Controller Step-Response & Transient Telemetry Visualizer

- **Severity**: medium
- **Confidence**: high
- **Evidence**: Control theory concepts like proportional gain ($K_p$), integral accumulation ($K_i$), derivative damping ($K_d$), and feedforward ($K_{ff}$) were difficult for students to visualize without live transient step response telemetry.
- **Impact**: Suboptimal tuning leading to oscillatory ringing, high mechanical stress, or sluggish tracking error.
- **Remediation**: Implemented `src/app/academy/widgets/PidTuningVisualizer.tsx` featuring:
  - Discrete-time ODE simulation ($dt = 0.01$ s, $T = 5.0$ s) across multiple physical plant dynamics (rotary arm mechanism, velocity flywheel shooter, and drivetrain heading gyro).
  - Parallel PID+FF control law with anti-windup clamping and output saturation.
  - Dynamic telemetry: peak overshoot percentage ($M_p$), 10%–90% rise time ($t_r$), settling time ($t_s$) within $\pm 2\%$ band, steady-state error ($e_{ss}$), and damping regime classification.
  - Real-time SVG step-response curve with setpoint line, control effort curve $u(t)$, disturbance step pulse at $t=2.5$ s, and hover tooltip cursor.
  - Presets for Critically Damped, Underdamped, Overdamped, Flywheel with Feedforward, and Oscillatory Hunting.
- **Acceptance test**: `src/test/AcademyInteractiveWidgets.test.tsx` verifies simulation steps, telemetry metrics, preset transitions, and copyable control laws.
- **Status**: fixed.

### STEM-04 — Unified STEM Laboratory Navigation & Accessibility Compliance

- **Severity**: low
- **Confidence**: high
- **Evidence**: Interactive tools need structured integration with ARES Academy routing, clear accessibility labels for screen readers and keyboards, and seamless switching alongside the existing WebGL simulation sandbox.
- **Impact**: Poor discoverability and accessibility barriers for students using assistive technology.
- **Remediation**:
  - Implemented `StemWidgetsHub.tsx` with ARIA tablist/tabpanel navigation.
  - Enhanced `src/app/academy/playground/page.tsx` with dual-mode tabs ("STEM Widgets" vs "Code Sandbox") and deep-link query parameter support (`?tool=gearbox`, `?tool=com`, `?tool=pid`).
  - Added dedicated standalone route `/academy/tools` in `src/App.tsx` and `scripts/prerender-static-routes.mjs`.
  - All form controls, steppers, and sliders feature accessible `id`/`htmlFor` pairings, `aria-label` descriptors, and keyboard navigation support.
- **Acceptance test**: `src/test/AcademyInteractiveWidgets.test.tsx` validates tab switching, query parameter initialization, and playground mode toggles.
- **Status**: fixed.

---

## Verification Summary

All unit and integration tests across `src/test/AcademyInteractiveWidgets.test.tsx` have been verified alongside complete TypeScript typechecking and ESLint static analysis.
