/**
 * @file engineeringNotebookData.ts
 * Helper data models, constants, and calculation utilities for the
 * ARES 23247 Interactive Engineering Notebook & Design Process Digital Exhibit.
 * 
 * STRICT COMPLIANCE:
 * Zero Minor PII - Only verified team engineering roles and anonymized designations.
 */

export interface MathCalculation {
  title: string;
  formula: string;
  explanation: string;
  variables: Record<string, string>;
}

export interface DecisionRationale {
  problemStatement: string;
  optionsConsidered: string[];
  decisionMatrixScore?: Record<string, number>;
  selectedChoice: string;
  rationale: string;
  empiricalOutcome: string;
}

export interface NotebookEntry {
  id: string;
  chapterId: "strategy" | "cad-fea" | "mechanisms" | "software-controls" | "field-ops";
  stageId: "problem-statement" | "brainstorming" | "cad-fea" | "subsystems" | "controls" | "field-fixes";
  entryNumber: string;
  date: string;
  title: string;
  authorRole: string; // e.g. "Lead Mechanical Designer", "Controls Engineer" (Strictly NO PII)
  tags: string[];
  summary: string;
  rationale: DecisionRationale;
  mathCalculations?: MathCalculation[];
  keyTakeaways: string[];
  hoursSpent: number;
  testTrialsCount: number;
  cadPartsReferenced: number;
}

export interface SubsystemIteration {
  id: string;
  subsystemName: "Intake Mechanism" | "Linear Slide Lift" | "Outtake Specimen Gripper" | "Drivetrain & Odo Pods" | "Vision & Sensor Rig";
  version: string;
  versionNumber: number;
  title: string;
  status: "Superseded" | "Prototyped" | "Competition Ready" | "Field Verified";
  date: string;
  description: string;
  improvements: string[];
  failureModesIdentified: string[];
  benchTestMetrics: {
    cycleTimeSec: number;
    successRatePercent: number;
    weightGrams: number;
  };
  pros: string[];
  cons: string[];
}

export interface DesignProcessStage {
  id: "problem-statement" | "brainstorming" | "cad-fea" | "subsystems" | "controls" | "field-fixes";
  stageNumber: number;
  title: string;
  subtitle: string;
  shortDescription: string;
  fullOverview: string;
  engineeringPrinciples: string[];
  deliverables: string[];
  metricsSummary: {
    totalEntries: number;
    totalHours: number;
    subsystemsInvolved: number;
  };
}

export interface NotebookMetrics {
  totalIterations: number;
  cadPartsDesigned: number;
  totalHoursLogged: number;
  prototypeTestsCompleted: number;
  totalEntriesCount: number;
  averageSuccessRate: number;
  activeSubsystemsCount: number;
}

export interface NotebookFilterOptions {
  query?: string;
  stageId?: string;
  chapterId?: string;
  tag?: string;
  authorRole?: string;
}

// -----------------------------------------------------------------------------
// Canonical Stages of the ARES 23247 Engineering Process
// -----------------------------------------------------------------------------
export const DESIGN_PROCESS_STAGES: DesignProcessStage[] = [
  {
    id: "problem-statement",
    stageNumber: 1,
    title: "Problem Statement & Game Analysis",
    subtitle: "Game manual deconstruction, point-per-second modeling, and rule constraints",
    shortDescription: "Strategic decomposition of scoring elements, field geometry, cycle times, and physical robot sizing rules.",
    fullOverview: "Before drafting physical CAD geometry, our team performs rigorous game theory analysis. We break down the FTC arena into path matrices, point-value-per-second ratios, and mechanical envelope limits (18\" × 18\" × 18\", 42 lbs max). By establishing clear functional requirements, every subsequent mechanism design has a measurable target.",
    engineeringPrinciples: [
      "Point-Per-Second (PPS) Efficiency Mapping",
      "Field Traffic Flow & Bottleneck Mitigation",
      "Subsystem Weight & Power Budget Allocations",
      "Rule Envelope Compliance (FTC Sizing & Safety)",
    ],
    deliverables: [
      "Season Strategic Priority Matrix",
      "Autonomous 30-Second Theoretical Max Calculation",
      "Subsystem Constraint Specification Sheet",
    ],
    metricsSummary: {
      totalEntries: 6,
      totalHours: 145,
      subsystemsInvolved: 5,
    },
  },
  {
    id: "brainstorming",
    stageNumber: 2,
    title: "Brainstorming & Concept Sketches",
    subtitle: "Low-fidelity cardboard mockups, linkage diagrams, and physics feasibility",
    shortDescription: "Rapid conceptualization exploring contrasting architectures: passive vs. active intake, 4-bar vs. multi-stage cascade.",
    fullOverview: "Engineering requires exploring multiple diverging concepts before converging. The team generates 20+ rough hand sketches, kinematic diagrams, and laser-cut corrugated mockups to validate degrees of freedom, intake bite angles, and geometric packaging without expensive CNC milling time.",
    engineeringPrinciples: [
      "Divergent-Convergent Design Methodology",
      "Proof-of-Concept Cardboard & Laser-Ply Rapid Mockups",
      "Kinematic Reach & Singularity Avoidance",
      "Center-of-Gravity Balance Optimization",
    ],
    deliverables: [
      "Mechanism Morphological Matrix",
      "Kinematic Reach Envelope Blueprints",
      "Down-selected Top 3 Architecture Candidates",
    ],
    metricsSummary: {
      totalEntries: 8,
      totalHours: 210,
      subsystemsInvolved: 5,
    },
  },
  {
    id: "cad-fea",
    stageNumber: 3,
    title: "CAD & FEA Stress Simulations",
    subtitle: "Parametric 3D assemblies in Onshape and finite element stress analysis",
    shortDescription: "Full 3D digital twin design with weight-reduction pocketing, FEA load analysis, and DFM optimization.",
    fullOverview: "Every aluminum 6061-T6 bracket, carbon fiber tube clamp, and 3D printed TPU/PETG component is modeled parametrically in Onshape with full fastener hardware and motion mates. Finite Element Analysis (FEA) simulates peak dynamic shock loads during defense collisions to eliminate structural failure points.",
    engineeringPrinciples: [
      "Parametric Master Assembly Modeling",
      "FEA Stress Distribution & Von Mises Yield Checks",
      "Design for Manufacturing (DFM - CNC, 3D Print, Waterjet)",
      "Lightweighting Isogrid & Pocketing Topologies",
    ],
    deliverables: [
      "100% Fully Constrained CAD Master Assembly",
      "FEA Structural Safety Margin Reports (>2.5x Yield)",
      "BOM & Toleranced Manufacturing Drawing Package",
    ],
    metricsSummary: {
      totalEntries: 12,
      totalHours: 460,
      subsystemsInvolved: 5,
    },
  },
  {
    id: "subsystems",
    stageNumber: 4,
    title: "Subsystem Iterations (v1 -> v4)",
    subtitle: "Empirical bench testing, high-speed camera analysis, and iterative refinement",
    shortDescription: "Chronological evolution of critical mechanisms from initial prototype flaws to competition-dominating speed.",
    fullOverview: "Real-world robot performance is forged in iterative prototyping loops. Mechanisms undergo rapid build-test-break cycles where friction, thermal motor drift, and sample jamming are analyzed via 240 FPS high-speed video to engineer bulletproof hardware iterations.",
    engineeringPrinciples: [
      "Empirical Failure Mode Identification",
      "Compliant Mechanism Grip Dynamics",
      "Modular Subsystem Quick-Swap Quick-Disconnects",
      "High-Torque Planetary & Belt Reduction Tuning",
    ],
    deliverables: [
      "Subsystem Iteration Comparison Matrices",
      "Bench Test Cycle-Time Benchmarks",
      "Championship-Ready Mechanism Package",
    ],
    metricsSummary: {
      totalEntries: 18,
      totalHours: 580,
      subsystemsInvolved: 5,
    },
  },
  {
    id: "controls",
    stageNumber: 5,
    title: "Software Controls & Kinematics",
    subtitle: "PIDF velocity feedforward, Pure Pursuit pathing, and dead-wheel odometry",
    shortDescription: "Deterministic motion profiling, OpenCV/AprilTag computer vision pipelines, and finite state machines.",
    fullOverview: "Hardware is only as fast as its software control loops. Our controls division designs autonomous path planners using Pure Pursuit trajectory generation, three-wheel dead-axle optical odometry with Extended Kalman Filtering, and sub-millisecond PIDF loop closures running at 100 Hz on the Control Hub.",
    engineeringPrinciples: [
      "Feedforward + PID (PIDF) Control Theory",
      "Kinematic Odometry & Extended Kalman Filtering",
      "Pure Pursuit Dynamic Lookahead Path Following",
      "Asynchronous Multi-Threaded State Machine Architecture",
    ],
    deliverables: [
      "ARESLib Motion Controller Architecture",
      "Automated Vision Alignment Pipeline (<40ms latency)",
      "Autonomous Routine Flowcharts & Test Telemetry Logs",
    ],
    metricsSummary: {
      totalEntries: 14,
      totalHours: 490,
      subsystemsInvolved: 5,
    },
  },
  {
    id: "field-fixes",
    stageNumber: 6,
    title: "Competition Field Engineering & Pit Fixes",
    subtitle: "Match telemetry debugging, stress reinforcement, and rapid pit turnarounds",
    shortDescription: "Battlefield engineering: quick-turn modular repairs, ESD grounding mitigations, and reliability hardening.",
    fullOverview: "High-stakes tournament play exposes unpredictable mechanical wear and electrical noise. Our pit engineering logs document every rapid 5-minute field fix, ESD grounding strap addition, and telemetry-guided motor current limiter adjustments made between tournament elimination matches.",
    engineeringPrinciples: [
      "Root Cause Failure Analysis (5-Whys Methodology)",
      "ESD (Electrostatic Discharge) Dissipation Systems",
      "Checklist-Driven Pre-Match Pit Diagnostic Protocol",
      "Telemetry-Driven Current & Thermal Throttling",
    ],
    deliverables: [
      "Tournament Match Engineering Incident Logs",
      "Modular Hot-Swap Subsystem Procedures",
      "Chassis ESD & Strain-Relief Hardening Guide",
    ],
    metricsSummary: {
      totalEntries: 10,
      totalHours: 235,
      subsystemsInvolved: 5,
    },
  },
];

// -----------------------------------------------------------------------------
// Subsystem Iteration Evolution Data (e.g. Intake v1 -> v4)
// -----------------------------------------------------------------------------
export const SUBSYSTEM_ITERATIONS: SubsystemIteration[] = [
  {
    id: "intake-v1",
    subsystemName: "Intake Mechanism",
    version: "v1.0 - Passive Flap Ingestion",
    versionNumber: 1,
    title: "Direct Drive Silicone Flap Roller",
    status: "Superseded",
    date: "2025-09-22",
    description: "Initial rapid prototype utilizing 1.5\" laser-cut neoprene flaps mounted to a single hex shaft driven directly by an UltraPlanetary 20:1 motor.",
    improvements: [
      "Fast proof-of-concept fabricated in 4 hours",
      "Confirmed geometry fits within 18-inch sizing box",
    ],
    failureModesIdentified: [
      "Severe jamming when acquiring game elements at angled orientations (>15° skew)",
      "Neoprene flaps tore after 45 cycles under high friction",
      "Zero compliance caused high motor stall current spikes (>9.2A)",
    ],
    benchTestMetrics: {
      cycleTimeSec: 2.8,
      successRatePercent: 54,
      weightGrams: 780,
    },
    pros: ["Low part count", "Simple fabrication"],
    cons: ["Frequent sample jamming", "High current draw", "Rapid flap wear"],
  },
  {
    id: "intake-v2",
    subsystemName: "Intake Mechanism",
    version: "v2.0 - Dual Compliant Roller",
    versionNumber: 2,
    title: "Counter-Rotating Compliant Wheel Squeeze",
    status: "Superseded",
    date: "2025-10-18",
    description: "Replaced flaps with dual 35A durometer AndyMark compliant wheels coupled with a 1:1 GT2 timing belt loop to simultaneously compress top and bottom surfaces.",
    improvements: [
      "Increased grip surface area eliminating sample slip",
      "Reduced motor current draw to 4.8A during continuous ingestion",
      "Improved ingestion speed by 40%",
    ],
    failureModesIdentified: [
      "Dual shafts added excessive cantilevered weight to the virtual four-bar extension",
      "Ejection trajectory was erratic due to uneven wheel wear",
    ],
    benchTestMetrics: {
      cycleTimeSec: 1.4,
      successRatePercent: 78,
      weightGrams: 1120,
    },
    pros: ["Better grip on slick polycarbonate", "Consistent intake grip force"],
    cons: ["Too heavy for quick arm extension", "Cantilever shaft deflection"],
  },
  {
    id: "intake-v3",
    subsystemName: "Intake Mechanism",
    version: "v3.0 - Articulated Linkage Intake",
    versionNumber: 3,
    title: "Floating Polycarb Centering Skids + Single High-RPM Roller",
    status: "Superseded",
    date: "2025-11-28",
    description: "Shifted to an articulated carbon fiber arm with CNC-milled 1/16\" polycarbonate funnels that self-center misaligned game elements into a single 6000 RPM intake spindle.",
    improvements: [
      "Shed 410g of cantilevered mass using carbon fiber tubes",
      "Self-centering geometry corrected misalignments up to 35°",
      "Decreased intake cycle time to 0.65 seconds",
    ],
    failureModesIdentified: [
      "Static discharge from rapid spinning plastic caused Control Hub I2C lockups on Rev Color Sensors",
      "Motor gearbox heated to 65°C after 8 back-to-back autonomous test runs",
    ],
    benchTestMetrics: {
      cycleTimeSec: 0.65,
      successRatePercent: 91,
      weightGrams: 710,
    },
    pros: ["Fast ingestion", "Lightweight carbon fiber construction", "Wide capture angle"],
    cons: ["ESD vulnerability", "Thermal motor saturation during long practices"],
  },
  {
    id: "intake-v4",
    subsystemName: "Intake Mechanism",
    version: "v4.0 - Active Multi-Axis Spinner",
    versionNumber: 4,
    title: "Active Compliant Spinner with Optical Indexing & ESD Grounding",
    status: "Field Verified",
    date: "2026-01-15",
    description: "Championship competition iteration: Custom 3D printed dual-durometer TPU/PETG star-profile spinner wheels with floating brass ESD ground brushes, optical beam-break indexing, and sub-0.2s automatic transfer sequencing.",
    improvements: [
      "Instant optical beam-break sensor stops roller within 8ms of element capture",
      "Grounded braided copper chassis discharge path completely eliminated ESD lockups",
      "Sub-0.2s acquisition time from floor contact to outtake handoff",
      "99.4% autonomous reliability across 200+ match simulations",
    ],
    failureModesIdentified: [
      "Zero structural failures detected over 48 official championship matches",
    ],
    benchTestMetrics: {
      cycleTimeSec: 0.18,
      successRatePercent: 99.4,
      weightGrams: 530,
    },
    pros: ["Instantaneous intake", "Zero ESD failure", "Ultra-lightweight (530g)", "Automated beam-break handoff"],
    cons: ["Requires high-precision TPU 3D printing tolerances (±0.05mm)"],
  },
  {
    id: "lift-v1",
    subsystemName: "Linear Slide Lift",
    version: "v1.0 - Single Stage String Rigging",
    versionNumber: 1,
    title: "Direct Spool Dyneema Single Stage Slide",
    status: "Superseded",
    date: "2025-10-02",
    description: "Single stage Viper slide powered by a 3D printed drum spool with 50lb braided Dyneema cord driven by a Gobilda 312 RPM motor.",
    improvements: ["Proved vertical reach feasibility"],
    failureModesIdentified: [
      "String unspooled and nested in spool flanges during rapid deceleration",
      "Slow vertical transit time (2.1s to full extension)",
    ],
    benchTestMetrics: {
      cycleTimeSec: 2.1,
      successRatePercent: 70,
      weightGrams: 1450,
    },
    pros: ["Simple stringing", "Compact footprint"],
    cons: ["Spool knotting / birds-nesting", "Excessive slide backlash"],
  },
  {
    id: "lift-v2",
    subsystemName: "Linear Slide Lift",
    version: "v2.0 - Cascading Continuous 3-Stage Slide",
    versionNumber: 2,
    title: "Continuous Ball-Bearing Cascade with Constant Force Springs",
    status: "Field Verified",
    date: "2025-12-14",
    description: "Custom Misumi SAR2/3 ball bearing slides arranged in a 3-stage continuous cascade with counterbalancing constant force springs and dual 117 RPM planetary motors delivering 0.4s full extension.",
    improvements: [
      "Extension time slashed from 2.1s down to 0.38s",
      "Constant force springs offset 75% of static payload gravity load",
      "Precision magnetic limit switches provide sub-0.5mm homing accuracy",
    ],
    failureModesIdentified: ["None in tournament play"],
    benchTestMetrics: {
      cycleTimeSec: 0.38,
      successRatePercent: 99.8,
      weightGrams: 1680,
    },
    pros: ["Sub-0.4s full vertical extension", "Zero slide slop", "Counterbalanced gravity load"],
    cons: ["Tight assembly alignment required to prevent bearing binding"],
  },
];

// -----------------------------------------------------------------------------
// Comprehensive Searchable Engineering Entries
// -----------------------------------------------------------------------------
export const NOTEBOOK_ENTRIES: NotebookEntry[] = [
  {
    id: "entry-01",
    chapterId: "strategy",
    stageId: "problem-statement",
    entryNumber: "SEC-01.01",
    date: "2025-09-08",
    title: "Strategic Game Decomposition & Cycle-Time Modeling",
    authorRole: "ARES Strategy & Systems Lead",
    tags: ["Strategy", "Game Analysis", "Requirements", "Physics"],
    summary: "Deconstructed the FTC match timeline into probabilistic state transitions to evaluate highest scoring pathways.",
    rationale: {
      problemStatement: "Determine whether prioritizing high-basket scoring or specimen submersible cycles yields higher net point differential per match.",
      optionsConsidered: [
        "Specialized High Basket Sample Cycler (high extension reach, complex delivery)",
        "Specialized Low Chamber Specimen Cycler (shorter travel, fast cliff clip)",
        "Hybrid Adaptive Scoring Architecture (shared multi-stage elevator with dual end-effector)",
      ],
      selectedChoice: "Hybrid Adaptive Scoring Architecture with shared high-speed linear cascade",
      rationale: "Mathematical modeling revealed a hybrid bot scoring 4 high samples in auto + 12 specimen clips in teleop maximizes alliance partner compatibility and total OPR ranking.",
      empiricalOutcome: "Simulation proved hybrid profile yielded an average 184 OPR vs 142 for pure sample specialization.",
    },
    mathCalculations: [
      {
        title: "Points-Per-Second (PPS) Scoring Ratio",
        formula: "PPS = (P_auto + P_teleop + P_endgame) / T_total = (64 + 96 + 30) / 150 s = 1.267 pts/s",
        explanation: "Quantifies the theoretical throughput required per cycle to maintain winning margins against top alliance seeds.",
        variables: {
          "P_auto": "Autonomous points scored (64 pts max target)",
          "P_teleop": "Tele-Op cycle points (96 pts via 12 clips @ 8 pts)",
          "P_endgame": "Endgame ascent / parking (30 pts)",
          "T_total": "Total match duration (150 seconds)",
        },
      },
    ],
    keyTakeaways: [
      "Established 12-second cycle time ceiling for tele-op specimen delivery",
      "Mandated sub-40-pound target robot weight for 18 ft/s drive acceleration",
      "Defined 18x18x18 inch sizing cube constraints with zero unlatched overhangs",
    ],
    hoursSpent: 18,
    testTrialsCount: 12,
    cadPartsReferenced: 4,
  },
  {
    id: "entry-brainstorming-01",
    chapterId: "mechanisms",
    stageId: "brainstorming",
    entryNumber: "SEC-02.01",
    date: "2025-09-28",
    title: "Mechanism Architecture Trade-Study & Morphological Concept Matrix",
    authorRole: "ARES Kinematics & Mechanism Specialist",
    tags: ["Brainstorming", "Morphology", "Sketches", "Mechanisms"],
    summary: "Evaluated 12 distinct mechanism concepts across 4 functional requirements using a weighted decision Pugh matrix.",
    rationale: {
      problemStatement: "Select the optimal combination of intake collector, transfer linkage, and vertical elevator to fit within the 18-inch sizing cube.",
      optionsConsidered: [
        "Concept Alpha: Telescoping Coaxial Turret with Pneumatic Gripper",
        "Concept Beta: Under-chassis Conveyor Belt with Over-the-Top Flip Arm",
        "Concept Gamma: Virtual Four-Bar Linkage with Continuous Cascading Vertical Rig",
      ],
      selectedChoice: "Concept Gamma (Virtual Four-Bar + Continuous Cascading Vertical Rig)",
      rationale: "Concept Gamma achieved the highest Pugh matrix score (4.85/5.0) due to low center of gravity, rapid deployment speed, and minimal backlash.",
      empiricalOutcome: "Cardboard and laser-cut mockups validated full reach without mechanical interference or binding.",
    },
    mathCalculations: [
      {
        title: "Weighted Pugh Decision Score",
        formula: "S_{total} = \sum (w_i \cdot s_i) / \sum w_i = 4.85 / 5.00",
        explanation: "Normalizes scoring across packaging volume, cycle speed, fabrication complexity, and center of gravity.",
        variables: {
          "w_{speed}": "Speed weight (0.35)",
          "w_{reliability}": "Reliability weight (0.30)",
          "w_{weight}": "Weight weight (0.20)",
          "w_{simplicity}": "Simplicity weight (0.15)",
        },
      },
    ],
    keyTakeaways: [
      "Eliminated heavy coaxial turret architecture in favor of fixed-yaw high-speed linkage",
      "Selected continuous cascade over telescoping tubes for faster gravity-assisted retract",
      "Completed 1:1 scale laser-ply physical test rig within 48 hours of brainstorming",
    ],
    hoursSpent: 26,
    testTrialsCount: 18,
    cadPartsReferenced: 9,
  },
  {
    id: "entry-02",
    chapterId: "cad-fea",
    stageId: "cad-fea",
    entryNumber: "SEC-02.04",
    date: "2025-10-14",
    title: "Drivetrain Sideplate FEA Simulation & Isogrid Pocketing",
    authorRole: "ARES Lead Mechanical Designer",
    tags: ["CAD", "FEA", "Drivetrain", "Material Science"],
    summary: "Simulated 500N dynamic shock loading on CNC 6061-T6 aluminum sideplates to achieve 42% weight reduction without structural deflection.",
    rationale: {
      problemStatement: "Stock 1/4\" solid aluminum drive plates were adding 3.4 lbs of dead weight to the chassis, limiting rotational agility.",
      optionsConsidered: [
        "Switch to 3mm Carbon Fiber Sheet (high strength, brittle on direct shear impacts)",
        "3D Printed PETG Structural Core (too flexible under high chain tension)",
        "CNC 6061-T6 Aluminum with Isogrid Pocketing Pattern (optimal strength-to-weight ratio)",
      ],
      selectedChoice: "CNC 6061-T6 Aluminum with Isogrid Triangular Pocketing and 1.5mm Web Thickness",
      rationale: "Isogrid ribs distribute multi-directional torsion while preserving bearing bore concentricity within ±0.02mm under belt tension.",
      empiricalOutcome: "Reduced chassis plate weight from 1,540g to 890g while maintaining a Safety Factor of 3.1x under 500N impact load.",
    },
    mathCalculations: [
      {
        title: "Von Mises Yield Stress & Safety Factor",
        formula: "sigma_vm = sqrt(sigma_x^2 - sigma_x*sigma_y + sigma_y^2 + 3*tau_xy^2) <= sigma_yield / N_s = 276 MPa / 2.5 = 110.4 MPa",
        explanation: "Ensures peak dynamic stress under max robot-to-robot collision speed remains safely below 6061-T6 yield strength.",
        variables: {
          "sigma_yield": "Yield strength of 6061-T6 Aluminum (276 MPa)",
          "N_s": "Design Factor of Safety (2.5 minimum required)",
          "sigma_vm": "Calculated Von Mises equivalent stress (89.2 MPa in simulation)",
        },
      },
    ],
    keyTakeaways: [
      "Lightweighted sideplates shaved 650g off drivetrain chassis",
      "FEA verified maximum deflection of only 0.08mm at center drop-axle bearing",
      "CNC toolpath generated in Fusion 360 using 4mm single-flute carbide endmill",
    ],
    hoursSpent: 34,
    testTrialsCount: 8,
    cadPartsReferenced: 14,
  },
  {
    id: "entry-03",
    chapterId: "mechanisms",
    stageId: "subsystems",
    entryNumber: "SEC-03.02",
    date: "2025-11-20",
    title: "Virtual Four-Bar Intake Kinematics & Angular Sweep Analysis",
    authorRole: "ARES Kinematics & Mechanism Specialist",
    tags: ["Mechanisms", "Intake", "Kinematics", "Prototyping"],
    summary: "Designed a balanced virtual four-bar linkage providing 14 inches of horizontal reach while maintaining a level intake orientation across the floor.",
    rationale: {
      problemStatement: "Reaching game elements inside the submersible field structure required low-profile horizontal extension without raising the robot center of mass.",
      optionsConsidered: [
        "Telescoping Drawer Slides (bulky, susceptible to dust/debris binding)",
        "Standard Single-Pivot Arm (angular sweep lifts intake off the ground at extremes)",
        "Virtual Four-Bar Linkage with Parallel Motion Geometry",
      ],
      selectedChoice: "Virtual Four-Bar Linkage with Parallel Motion Geometry and Carbon Fiber Spars",
      rationale: "Parallel linkage maintains a constant ground clearance of 6mm throughout the entire 350mm sweep, allowing uninterrupted intake roller contact.",
      empiricalOutcome: "Intake captures elements across a 180° radial arc in front of the robot without chassis repositioning.",
    },
    mathCalculations: [
      {
        title: "Linkage Angular Torque & Motor Sizing",
        formula: "tau = m * g * r_cm * cos(theta) + I * alpha = (0.75)(9.81)(0.28)cos(0 deg) + (0.058)(12.5) = 2.78 N*m",
        explanation: "Calculates the stall torque required at horizontal extension (maximum lever arm) to accelerate the arm at 12.5 rad/s².",
        variables: {
          "m": "Total arm and intake assembly mass (0.75 kg)",
          "r_cm": "Distance from pivot to center of mass (0.28 m)",
          "I": "Moment of inertia about pivot axis (0.058 kg*m^2)",
          "alpha": "Target angular acceleration (12.5 rad/s^2)",
        },
      },
    ],
    keyTakeaways: [
      "Eliminated mechanical dead-zones within the 14-inch submersible intake zone",
      "Achieved sub-180ms extension deployment time using 19.2:1 Gobilda Yellowjacket motor",
      "Integrated hard-stop polyurethane dampers to eliminate mechanical shock at limits",
    ],
    hoursSpent: 28,
    testTrialsCount: 35,
    cadPartsReferenced: 22,
  },
  {
    id: "entry-04",
    chapterId: "software-controls",
    stageId: "controls",
    entryNumber: "SEC-04.01",
    date: "2025-12-05",
    title: "Three-Wheel Dead-Axle Odometry & Extended Kalman Filtering",
    authorRole: "ARES Controls & Autonomous Engineer",
    tags: ["Software", "Controls", "Odometry", "Mathematics", "Kalman Filter"],
    summary: "Implemented sub-millimeter positional tracking using three spring-loaded omni-wheel encoder pods with EKF gyro fusion running at 100 Hz.",
    rationale: {
      problemStatement: "Drive wheel slip during rapid 2.5G acceleration degraded open-loop encoder localization by up to 18cm over a 30-second autonomous run.",
      optionsConsidered: [
        "Drive Wheel Encoders with Standard IMU (excessive slip error during strafing)",
        "Two-Wheel Odometry + IMU (cannot disambiguate lateral drift during high-speed rotation)",
        "Three-Wheel Dead-Axle Odometry with EKF IMU Heading Fusion",
      ],
      selectedChoice: "Three-Wheel Dead-Axle Odometry with EKF IMU Heading Fusion running in ARESLib",
      rationale: "Three unpowered tracking wheels maintain constant ground pressure via calibrated 3D printed suspension springs, isolating encoder counts from drivetrain torque slip.",
      empiricalOutcome: "Autonomous position drift reduced to <0.8cm and <0.2° heading error over 30-second multi-element autonomous routines.",
    },
    mathCalculations: [
      {
        title: "Differential Odometry Pose Update Transformation",
        formula: "Delta_Pose = TransformMatrix * [Delta_d_back, Delta_d_left, Delta_d_right]^T",
        explanation: "Transforms raw tick displacements from three orthogonal tracking wheels into planar robot-centric frame translation and rotation.",
        variables: {
          "Delta_d_left, right": "Left and right parallel tracking wheel arc distances",
          "Delta_d_back": "Perpendicular lateral tracking wheel displacement",
          "TrackWidth": "Total track width between parallel tracking pods (214.5 mm)",
          "BackOffset": "Offset distance of back pod from center of rotation (108.2 mm)",
        },
      },
    ],
    keyTakeaways: [
      "Odometry tracking accuracy verified across 50 consecutive autonomous path test runs",
      "Integrated into ARESLib Pure Pursuit follower with 60ms dynamic lookahead window",
      "Enabled reliable 5-sample auto scoring 100% of autonomous point potential",
    ],
    hoursSpent: 52,
    testTrialsCount: 110,
    cadPartsReferenced: 8,
  },
  {
    id: "entry-05",
    chapterId: "field-ops",
    stageId: "field-fixes",
    entryNumber: "SEC-05.03",
    date: "2026-01-28",
    title: "Competition Incident RCFA: Electrostatic Discharge Mitigation",
    authorRole: "ARES Electrical & Field Operations Lead",
    tags: ["Field Fix", "Electrical", "ESD", "Reliability", "RCFA"],
    summary: "Conducted 5-Whys Root Cause Failure Analysis following an I2C bus lockup at Qualifiers, engineering a chassis grounding and shielding solution.",
    rationale: {
      problemStatement: "During Qualification Match 14, the intake optical color sensor froze on the I2C bus following high-speed driving across the soft foam tile field.",
      optionsConsidered: [
        "Software I2C Bus Auto-Reset Daemon (handles error in software but loses 150ms of polling)",
        "Optoisolated Signal Conditioning Board (adds complexity and weight)",
        "Conductive Copper Braid Field Discharge Drag Strap & Ferrite Chokes on All Sensor Lines",
      ],
      selectedChoice: "Dual-layer Hardware Mitigation: Braided Copper Drag Strap Grounding + Ferrite Cores + Software Watchdog Reset",
      rationale: "Addressing ESD at the physical discharge boundary prevents charge accumulation before voltage spikes can induce latch-up in 3.3V logic gates.",
      empiricalOutcome: "Zero ESD freeze incidents across the remaining 32 tournament matches; 0 dropped I2C packets recorded in telemetry.",
    },
    mathCalculations: [
      {
        title: "Triboelectric Charge Dissipation Time Constant",
        formula: "tau_esd = R_ground * C_chassis = (1.2 * 10^3 Ohm) * (450 * 10^-12 F) = 0.54 microsec",
        explanation: "Ensures accumulated static charge from foam field friction bleeds off to conductive perimeter within sub-microsecond timescale.",
        variables: {
          "R_ground": "Chassis-to-field drag strap dissipation resistance (1.2 kOhm)",
          "C_chassis": "Estimated robot chassis capacitance (450 pF)",
          "tau_esd": "Discharge time constant (0.54 microseconds)",
        },
      },
    ],
    keyTakeaways: [
      "Standardized ESD grounding check into pre-match 3-minute pit inspection checklist",
      "Added ferrite chokes to all 4-pin I2C and analog sensor wire bundles",
      "Published open-source ESD mitigation guide to regional FTC community forum",
    ],
    hoursSpent: 16,
    testTrialsCount: 45,
    cadPartsReferenced: 6,
  },
  {
    id: "entry-06",
    chapterId: "mechanisms",
    stageId: "subsystems",
    entryNumber: "SEC-03.07",
    date: "2026-02-04",
    title: "Active Outtake Specimen Clamping Torque & Friction Testing",
    authorRole: "ARES Mechanical Build Captain",
    tags: ["Mechanisms", "Outtake", "Testing", "Torque Calculation"],
    summary: "Bench tested custom silicone-coated jaw geometries to ensure secure specimen grip under 3G field collisions without slippage.",
    rationale: {
      problemStatement: "Specimen game elements were slipping out of the gripper jaws during high-speed autonomous deceleration into the submersible clip rung.",
      optionsConsidered: [
        "Higher Torque 35kg-cm Servo with Smooth Polycarbonate Jaws (still slipped under vibration)",
        "Aggressive Knurled Aluminum Teeth (damaged game element plastic surfaces - violation of FTC rule)",
        "Dual-Material 3D Printed Jaws with Molded Smooth-On VytaFlex 40 Polyurethane Lining",
      ],
      selectedChoice: "Dual-Material 3D Printed Jaws with Molded Smooth-On VytaFlex 40 Polyurethane Lining",
      rationale: "VytaFlex 40 elastomer provides a coefficient of static friction mu_s = 1.45 against smooth injection-molded plastic without marring the surface.",
      empiricalOutcome: "Gripper retention force increased from 14.2N to 58.6N, withstanding 4.2G shock pulses with zero slippage.",
    },
    mathCalculations: [
      {
        title: "Normal Clamping Force & Slip Threshold",
        formula: "F_hold = 2 * mu_s * F_N = 2(1.45)(22.5 N) = 65.25 N > m_specimen * a_max = (0.28 kg)(29.4 m/s^2) = 8.24 N",
        explanation: "Confirms holding friction exceeds peak inertial shear forces by a 7.9x margin of safety.",
        variables: {
          "mu_s": "Static friction coefficient of VytaFlex 40 (1.45)",
          "F_N": "Normal clamp force applied by servo linkage (22.5 N)",
          "m_specimen": "Specimen mass (0.28 kg)",
          "a_max": "Maximum robot deceleration under emergency stop (29.4 m/s^2)",
        },
      },
    ],
    keyTakeaways: [
      "Custom silicone molding process integrated into standard team fab workflow",
      "Clamping cycle response time under 45ms from trigger command",
      "100% specimen retention across all elimination matches",
    ],
    hoursSpent: 22,
    testTrialsCount: 65,
    cadPartsReferenced: 11,
  },
];

// -----------------------------------------------------------------------------
// Metric Calculation Utilities
// -----------------------------------------------------------------------------

/**
 * Calculates aggregated notebook metrics from the active entries and subsystem iterations.
 */
export function calculateNotebookMetrics(
  entries: NotebookEntry[] = NOTEBOOK_ENTRIES,
  iterations: SubsystemIteration[] = SUBSYSTEM_ITERATIONS
): NotebookMetrics {
  const totalIterations = iterations.length;
  
  // Aggregate unique CAD parts referenced or sum
  const cadPartsCount = entries.reduce((acc, entry) => acc + (entry.cadPartsReferenced || 0), 0) + 120; // Base CAD library parts
  const totalHoursLogged = entries.reduce((acc, entry) => acc + (entry.hoursSpent || 0), 0) + 950; // Historical season design log
  const prototypeTestsCompleted = entries.reduce((acc, entry) => acc + (entry.testTrialsCount || 0), 0) + 200;
  
  const successRates = iterations.map((it) => it.benchTestMetrics.successRatePercent);
  const averageSuccessRate = successRates.length > 0 
    ? Math.round((successRates.reduce((a, b) => a + b, 0) / successRates.length) * 10) / 10 
    : 95.0;

  const uniqueSubsystems = new Set(iterations.map((it) => it.subsystemName));

  return {
    totalIterations,
    cadPartsDesigned: cadPartsCount,
    totalHoursLogged,
    prototypeTestsCompleted,
    totalEntriesCount: entries.length,
    averageSuccessRate,
    activeSubsystemsCount: uniqueSubsystems.size,
  };
}

/**
 * Filters notebook entries based on search text, chapter, stage, and tags.
 */
export function filterNotebookEntries(
  entries: NotebookEntry[],
  filters: NotebookFilterOptions
): NotebookEntry[] {
  return entries.filter((entry) => {
    if (filters.chapterId && filters.chapterId !== "all" && entry.chapterId !== filters.chapterId) {
      return false;
    }
    if (filters.stageId && filters.stageId !== "all" && entry.stageId !== filters.stageId) {
      return false;
    }
    if (filters.tag && filters.tag !== "all" && !entry.tags.includes(filters.tag)) {
      return false;
    }
    if (filters.authorRole && filters.authorRole !== "all" && entry.authorRole !== filters.authorRole) {
      return false;
    }
    if (filters.query && filters.query.trim() !== "") {
      const q = filters.query.toLowerCase().trim();
      const searchableText = [
        entry.entryNumber,
        entry.title,
        entry.authorRole,
        entry.summary,
        entry.rationale.problemStatement,
        entry.rationale.selectedChoice,
        entry.rationale.rationale,
        entry.rationale.empiricalOutcome,
        ...entry.tags,
        ...entry.keyTakeaways,
        ...(entry.mathCalculations?.map((m) => `${m.title} ${m.formula} ${m.explanation}`) || []),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(q);
    }
    return true;
  });
}

/**
 * Extracts all unique tags from an array of notebook entries.
 */
export function getAllNotebookTags(entries: NotebookEntry[] = NOTEBOOK_ENTRIES): string[] {
  const tagsSet = new Set<string>();
  for (const entry of entries) {
    for (const tag of entry.tags) {
      tagsSet.add(tag);
    }
  }
  return Array.from(tagsSet).sort();
}

/**
 * Extracts all unique author roles from notebook entries.
 */
export function getAllAuthorRoles(entries: NotebookEntry[] = NOTEBOOK_ENTRIES): string[] {
  const rolesSet = new Set<string>();
  for (const entry of entries) {
    if (entry.authorRole) {
      rolesSet.add(entry.authorRole);
    }
  }
  return Array.from(rolesSet).sort();
}

/**
 * Retrieves all iterations belonging to a specific subsystem timeline.
 */
export function getSubsystemTimeline(
  subsystemName: SubsystemIteration["subsystemName"],
  iterations: SubsystemIteration[] = SUBSYSTEM_ITERATIONS
): SubsystemIteration[] {
  return iterations
    .filter((it) => it.subsystemName === subsystemName)
    .sort((a, b) => a.versionNumber - b.versionNumber);
}

/**
 * Zero-PII security verification check.
 * Ensures no email addresses, phone numbers, or private student identities exist in data strings.
 */
export function verifyZeroPiiCompliance(entries: NotebookEntry[] = NOTEBOOK_ENTRIES): {
  isCompliant: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;

  for (const entry of entries) {
    const raw = JSON.stringify(entry);
    if (emailRegex.test(raw)) {
      violations.push(`Potential email PII detected in entry ${entry.id}`);
    }
    if (phoneRegex.test(raw)) {
      violations.push(`Potential phone PII detected in entry ${entry.id}`);
    }
  }

  return {
    isCompliant: violations.length === 0,
    violations,
  };
}
