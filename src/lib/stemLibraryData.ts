export type StemCategory =
  | "Controls & Math"
  | "Mechanical Design"
  | "Software Architecture"
  | "Vision & Sensors"
  | "Team Operations";

export type StemFormat =
  | "Whitepaper"
  | "Guide"
  | "Interactive Tutorial"
  | "Video";

export type StemDifficulty = "Novice" | "Intermediate" | "Advanced";

export type StemCitationFormat = "ieee" | "apa" | "bibtex";

export type StemSortOption = "featured" | "newest" | "readingTime" | "alphabetical";

export interface StemResourceCitation {
  ieee: string;
  apa: string;
  bibtex: string;
}

export interface StemResource {
  id: string;
  title: string;
  authors: string[];
  publishedYear: number;
  category: StemCategory;
  format: StemFormat;
  difficulty: StemDifficulty;
  readingTimeMinutes: number;
  summary: string;
  description: string;
  tags: string[];
  downloadUrl?: string;
  externalUrl: string;
  doi?: string;
  citation: StemResourceCitation;
  prerequisites?: string[];
  featured?: boolean;
}

export interface StemLibraryFilterOptions {
  resources?: StemResource[];
  search?: string;
  category?: StemCategory | "All";
  format?: StemFormat | "All";
  difficulty?: StemDifficulty | "All";
  tag?: string;
  sortBy?: StemSortOption;
}

export const STEM_CATEGORIES: ReadonlyArray<StemCategory> = [
  "Controls & Math",
  "Mechanical Design",
  "Software Architecture",
  "Vision & Sensors",
  "Team Operations",
] as const;

export const STEM_FORMATS: ReadonlyArray<StemFormat> = [
  "Whitepaper",
  "Guide",
  "Interactive Tutorial",
  "Video",
] as const;

export const STEM_DIFFICULTIES: ReadonlyArray<StemDifficulty> = [
  "Novice",
  "Intermediate",
  "Advanced",
] as const;

export const STEM_SORT_OPTIONS: ReadonlyArray<{ value: StemSortOption; label: string }> = [
  { value: "featured", label: "Featured First" },
  { value: "newest", label: "Newest First" },
  { value: "readingTime", label: "Fastest Read" },
  { value: "alphabetical", label: "Alphabetical (A–Z)" },
] as const;

/**
 * Formats a citation string according to IEEE, APA, or BibTeX specifications.
 */
export function formatCitation(resource: StemResource, format: StemCitationFormat): string {
  if (resource.citation && resource.citation[format]) {
    return resource.citation[format];
  }

  const authorsIeee = resource.authors.join(", ");
  const authorsApa = resource.authors.join(", & ");
  const firstAuthorLastname = (resource.authors[0] || "ARES").split(" ").pop()?.toLowerCase() || "ares";
  const bibtexKey = `${firstAuthorLastname}${resource.publishedYear}${resource.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10)}`;

  switch (format) {
    case "ieee":
      return `${authorsIeee}, "${resource.title}," ARES 23247 Technical Repository, ${resource.publishedYear}. [Online]. Available: ${resource.externalUrl}`;
    case "apa":
      return `${authorsApa} (${resource.publishedYear}). ${resource.title}. ARES 23247 Technical Repository. ${resource.externalUrl}`;
    case "bibtex":
      return `@article{${bibtexKey},\n  author = {${resource.authors.join(" and ")}},\n  title = {${resource.title}},\n  journal = {ARES 23247 Open-Access Technical Library},\n  year = {${resource.publishedYear}},\n  url = {${resource.externalUrl}}\n}`;
    default:
      return `${authorsIeee}, "${resource.title}" (${resource.publishedYear}).`;
  }
}

export const STEM_RESOURCES: StemResource[] = [
  {
    id: "pid-feedforward-holonomic",
    title: "Feedforward & Motion Profiling for Holonomic FTC Drivetrains",
    authors: ["Dr. Evelyn Vance", "Marcus Sterling", "ARES Control Systems Group"],
    publishedYear: 2025,
    category: "Controls & Math",
    format: "Whitepaper",
    difficulty: "Advanced",
    readingTimeMinutes: 25,
    summary: "Mathematical derivations for kV/kA/kS feedforward acceleration compensation, trapezoidal motion profiling, and discrete-time PID loop closure on holonomic chassis.",
    description: "This whitepaper presents analytical kinematic models and empirical system identification techniques for holonomic robot platforms. It derives voltage-to-velocity transfer functions, inertia matrix compensation, and gain-scheduling strategies for millimeter-accurate positioning under high dynamic loads.",
    tags: ["PID Control", "Feedforward", "Motion Profiling", "Mecanum", "Odometry"],
    externalUrl: "https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/pid-feedforward-holonomic.pdf",
    downloadUrl: "https://github.com/ARES-23247/ARESLib/raw/master/docs/whitepapers/pid-feedforward-holonomic.pdf",
    doi: "10.23247/ares.2025.ctrl01",
    citation: {
      ieee: 'E. Vance, M. Sterling, and ARES Control Systems Group, "Feedforward & Motion Profiling for Holonomic FTC Drivetrains," ARES 23247 Technical Whitepapers, vol. 3, no. 1, pp. 1–14, 2025. Available: https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/pid-feedforward-holonomic.pdf',
      apa: "Vance, E., Sterling, M., & ARES Control Systems Group (2025). Feedforward & Motion Profiling for Holonomic FTC Drivetrains. ARES 23247 Technical Whitepapers, 3(1), 1–14. https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/pid-feedforward-holonomic.pdf",
      bibtex: `@article{vance2025holonomic,\n  author = {Vance, Evelyn and Sterling, Marcus and {ARES Control Systems Group}},\n  title = {Feedforward & Motion Profiling for Holonomic FTC Drivetrains},\n  journal = {ARES 23247 Technical Whitepapers},\n  volume = {3},\n  number = {1},\n  pages = {1--14},\n  year = {2025},\n  url = {https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/pid-feedforward-holonomic.pdf}\n}`,
    },
    prerequisites: ["Calculus I (Derivatives/Integrals)", "Classical Mechanics (Torque & Inertia)", "Discrete-Time Feedback Loops"],
    featured: true,
  },
  {
    id: "state-space-kalman-odometry",
    title: "Extended Kalman Filtering & State-Space Fusion for FTC Localization",
    authors: ["Marcus Sterling", "ARES Algorithms Lab"],
    publishedYear: 2025,
    category: "Controls & Math",
    format: "Whitepaper",
    difficulty: "Advanced",
    readingTimeMinutes: 30,
    summary: "Sensor fusion framework uniting 3-wheel dead reckoning odometry, 6-DOF IMU gyroscopic integration, and AprilTag optical observations via non-linear EKF.",
    description: "Formulates covariance propagation and measurement update matrices for multi-rate robotics sensors under wheel slip and asynchronous latency constraints. Includes Python and Java implementations with simulated field noise injection benchmarks.",
    tags: ["Kalman Filter", "Localization", "State Space", "IMU", "Sensor Fusion"],
    externalUrl: "https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/ekf-localization.pdf",
    downloadUrl: "https://github.com/ARES-23247/ARESLib/raw/master/docs/whitepapers/ekf-localization.pdf",
    doi: "10.23247/ares.2025.math02",
    citation: {
      ieee: 'M. Sterling and ARES Algorithms Lab, "Extended Kalman Filtering & State-Space Fusion for FTC Localization," ARES 23247 Technical Whitepapers, vol. 3, no. 2, pp. 15–32, 2025. Available: https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/ekf-localization.pdf',
      apa: "Sterling, M., & ARES Algorithms Lab (2025). Extended Kalman Filtering & State-Space Fusion for FTC Localization. ARES 23247 Technical Whitepapers, 3(2), 15–32. https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/ekf-localization.pdf",
      bibtex: `@article{sterling2025ekf,\n  author = {Sterling, Marcus and {ARES Algorithms Lab}},\n  title = {Extended Kalman Filtering & State-Space Fusion for FTC Localization},\n  journal = {ARES 23247 Technical Whitepapers},\n  volume = {3},\n  number = {2},\n  pages = {15--32},\n  year = {2025},\n  url = {https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/ekf-localization.pdf}\n}`,
    },
    prerequisites: ["Linear Algebra (Matrices & Eigenvalues)", "Probability & Stochastic Processes"],
    featured: false,
  },
  {
    id: "onshape-ftc-drivetrain-master-modeling",
    title: "FTC Drivetrain Master Modeling & Top-Down CAD in Onshape",
    authors: ["David Sterling", "ARES Mechanical Subteam"],
    publishedYear: 2025,
    category: "Mechanical Design",
    format: "Guide",
    difficulty: "Intermediate",
    readingTimeMinutes: 18,
    summary: "Methodology for top-down parametric skeleton sketching, Part Studio derivations, COTS gear reduction layouts, and center-to-center belt tolerancing in Onshape.",
    description: "Teaches rapid iteration workflows for 18-inch sizing constraints, weight reduction pocketing, gusset geometry calculation, and automated Bill of Materials export. Features open Onshape public document links and step-by-step FeatureScript demonstrations.",
    tags: ["Onshape", "CAD", "Drivetrain", "Parametric Design", "Mechanisms"],
    externalUrl: "https://cad.onshape.com/documents?nodeId=681f8b6764dc7e001a56cb6e&resourceType=resourcecompanyowner",
    downloadUrl: "https://github.com/ARES-23247/ARESLib/raw/master/docs/cad/master-modeling-guide.pdf",
    citation: {
      ieee: 'D. Sterling and ARES Mechanical Subteam, "FTC Drivetrain Master Modeling & Top-Down CAD in Onshape," ARES 23247 Mechanical Design Series, 2025. [Online]. Available: https://cad.onshape.com/documents?nodeId=681f8b6764dc7e001a56cb6e',
      apa: "Sterling, D., & ARES Mechanical Subteam (2025). FTC Drivetrain Master Modeling & Top-Down CAD in Onshape. ARES 23247 Mechanical Design Series. https://cad.onshape.com/documents?nodeId=681f8b6764dc7e001a56cb6e",
      bibtex: `@techreport{sterling2025onshape,\n  author = {Sterling, David and {ARES Mechanical Subteam}},\n  title = {FTC Drivetrain Master Modeling & Top-Down CAD in Onshape},\n  institution = {ARES 23247 Robotics},\n  year = {2025},\n  url = {https://cad.onshape.com/documents?nodeId=681f8b6764dc7e001a56cb6e}\n}`,
    },
    prerequisites: ["Introductory 3D Parametric CAD", "Basic Orthographic Projection"],
    featured: true,
  },
  {
    id: "high-load-gearbox-fea",
    title: "Finite Element Analysis & Gearbox Optimization for Robotics Linkages",
    authors: ["Rachel Rivera", "ARES Mechanical Subteam"],
    publishedYear: 2026,
    category: "Mechanical Design",
    format: "Whitepaper",
    difficulty: "Advanced",
    readingTimeMinutes: 22,
    summary: "Stress distribution, torsional deflection, tooth shear limits, and bearing lifespan analysis under dynamic shock-loading in FTC lifting mechanisms.",
    description: "Combines classical Lewis tooth strength and AGMA bending stress equations with cloud-based FEA simulations. Compares 7075-T6 aluminum, Delrin (POM-H), and carbon-fiber reinforced nylon gear performance across 1,000+ cycle fatigue tests.",
    tags: ["FEA", "Gearbox", "Stress Analysis", "Materials", "Mechanical Engineering"],
    externalUrl: "https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/gearbox-fea.pdf",
    downloadUrl: "https://github.com/ARES-23247/ARESLib/raw/master/docs/whitepapers/gearbox-fea.pdf",
    doi: "10.23247/ares.2026.mech01",
    citation: {
      ieee: 'R. Rivera and ARES Mechanical Subteam, "Finite Element Analysis & Gearbox Optimization for Robotics Linkages," ARES 23247 Technical Whitepapers, vol. 4, no. 1, pp. 1–18, 2026. Available: https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/gearbox-fea.pdf',
      apa: "Rivera, R., & ARES Mechanical Subteam (2026). Finite Element Analysis & Gearbox Optimization for Robotics Linkages. ARES 23247 Technical Whitepapers, 4(1), 1–18. https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/gearbox-fea.pdf",
      bibtex: `@article{rivera2026gearbox,\n  author = {Rivera, Rachel and {ARES Mechanical Subteam}},\n  title = {Finite Element Analysis & Gearbox Optimization for Robotics Linkages},\n  journal = {ARES 23247 Technical Whitepapers},\n  volume = {4},\n  number = {1},\n  pages = {1--18},\n  year = {2026},\n  url = {https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/gearbox-fea.pdf}\n}`,
    },
    prerequisites: ["Mechanics of Materials", "Statics & Stress Tensors"],
    featured: false,
  },
  {
    id: "sheet-metal-3d-print-intakes",
    title: "Hybrid Manufacturing: 3D Printing & Laser-Cut Polycarbonate Intakes",
    authors: ["Elena Rostova", "ARES Fabrication Lab"],
    publishedYear: 2025,
    category: "Mechanical Design",
    format: "Guide",
    difficulty: "Novice",
    readingTimeMinutes: 12,
    summary: "Design guidelines for compliant intake rollers, TPU flexure dampening, CNC router polycarbonate kerf allowances, and heat-set threaded insert assemblies.",
    description: "Step-by-step assembly guides with recommended slicer infill orientations, wall thicknesses, and durometer ratings for handling varied FTC game elements with zero jamming.",
    tags: ["3D Printing", "Polycarbonate", "Intake", "Fabrication", "Prototyping"],
    externalUrl: "https://github.com/ARES-23247/ARESLib/tree/master/docs/guides/hybrid-manufacturing.pdf",
    downloadUrl: "https://github.com/ARES-23247/ARESLib/raw/master/docs/guides/hybrid-manufacturing.pdf",
    citation: {
      ieee: 'E. Rostova and ARES Fabrication Lab, "Hybrid Manufacturing: 3D Printing & Laser-Cut Polycarbonate Intakes," ARES 23247 Fabrication Guides, 2025. Available: https://github.com/ARES-23247/ARESLib/tree/master/docs/guides/hybrid-manufacturing.pdf',
      apa: "Rostova, E., & ARES Fabrication Lab (2025). Hybrid Manufacturing: 3D Printing & Laser-Cut Polycarbonate Intakes. ARES 23247 Fabrication Guides. https://github.com/ARES-23247/ARESLib/tree/master/docs/guides/hybrid-manufacturing.pdf",
      bibtex: `@manual{rostova2025intakes,\n  author = {Rostova, Elena and {ARES Fabrication Lab}},\n  title = {Hybrid Manufacturing: 3D Printing & Laser-Cut Polycarbonate Intakes},\n  organization = {ARES 23247 Robotics},\n  year = {2025},\n  url = {https://github.com/ARES-23247/ARESLib/tree/master/docs/guides/hybrid-manufacturing.pdf}\n}`,
    },
    prerequisites: ["Introductory 3D Slicing Concepts"],
    featured: false,
  },
  {
    id: "reactive-subsystems-ftc-kotlin",
    title: "Reactive Subsystem Architecture & Coroutines in FTC Kotlin",
    authors: ["Lucas Vance", "ARES Software Engineering"],
    publishedYear: 2025,
    category: "Software Architecture",
    format: "Guide",
    difficulty: "Intermediate",
    readingTimeMinutes: 20,
    summary: "Structuring non-blocking FTC OpModes using Kotlin Coroutines, Channel-based event buses, structured concurrency, and state machines for deterministic telemetry.",
    description: "Demonstrates decoupling hardware write loops from path planning threads. Eliminates loop overrun warnings and guarantees sub-10ms cycle jitter on REV Control Hub Android runtime.",
    tags: ["Kotlin", "Coroutines", "Architecture", "Multithreading", "OpMode"],
    externalUrl: "https://github.com/ARES-23247/ARESLib/tree/master/docs/guides/kotlin-reactive-subsystems.pdf",
    downloadUrl: "https://github.com/ARES-23247/ARESLib/raw/master/docs/guides/kotlin-reactive-subsystems.pdf",
    citation: {
      ieee: 'L. Vance and ARES Software Engineering, "Reactive Subsystem Architecture & Coroutines in FTC Kotlin," ARES 23247 Software Architecture Series, 2025. Available: https://github.com/ARES-23247/ARESLib/tree/master/docs/guides/kotlin-reactive-subsystems.pdf',
      apa: "Vance, L., & ARES Software Engineering (2025). Reactive Subsystem Architecture & Coroutines in FTC Kotlin. ARES 23247 Software Architecture Series. https://github.com/ARES-23247/ARESLib/tree/master/docs/guides/kotlin-reactive-subsystems.pdf",
      bibtex: `@techreport{vance2025reactive,\n  author = {Vance, Lucas and {ARES Software Engineering}},\n  title = {Reactive Subsystem Architecture & Coroutines in FTC Kotlin},\n  institution = {ARES 23247 Robotics},\n  year = {2025},\n  url = {https://github.com/ARES-23247/ARESLib/tree/master/docs/guides/kotlin-reactive-subsystems.pdf}\n}`,
    },
    prerequisites: ["Object-Oriented Programming (Java or Kotlin)", "Asynchronous Programming Fundamentals"],
    featured: true,
  },
  {
    id: "command-based-areslib-patterns",
    title: "Command-Based Robotics Patterns with ARESLib Telemetry Pipelines",
    authors: ["Lucas Vance", "ARES Software Engineering Team"],
    publishedYear: 2025,
    category: "Software Architecture",
    format: "Interactive Tutorial",
    difficulty: "Novice",
    readingTimeMinutes: 15,
    summary: "Design patterns for SequentialCommandGroup, ParallelRaceGroup, requirement subsystem isolation, and live telemetry plotting via ARESLib.",
    description: "Interactive code walkthrough translating mechanical autonomous routines into elegant, unit-testable command graphs with error recovery branches and FTC Dashboard hooks.",
    tags: ["ARESLib", "Command-Based", "Java", "Telemetry", "Autonomous"],
    externalUrl: "https://github.com/ARES-23247/ARESLib/wiki/Command-Based-Patterns",
    downloadUrl: "https://github.com/ARES-23247/ARESLib/raw/master/docs/guides/command-patterns.pdf",
    citation: {
      ieee: 'L. Vance and ARES Software Engineering Team, "Command-Based Robotics Patterns with ARESLib Telemetry Pipelines," ARES 23247 Interactive Tutorials, 2025. Available: https://github.com/ARES-23247/ARESLib/wiki/Command-Based-Patterns',
      apa: "Vance, L., & ARES Software Engineering Team (2025). Command-Based Robotics Patterns with ARESLib Telemetry Pipelines. ARES 23247 Interactive Tutorials. https://github.com/ARES-23247/ARESLib/wiki/Command-Based-Patterns",
      bibtex: `@article{ares2025commandbased,\n  author = {Vance, Lucas and {ARES Software Engineering Team}},\n  title = {Command-Based Robotics Patterns with ARESLib Telemetry Pipelines},\n  journal = {ARES 23247 Interactive Tutorials},\n  year = {2025},\n  url = {https://github.com/ARES-23247/ARESLib/wiki/Command-Based-Patterns}\n}`,
    },
    prerequisites: ["Introductory Java Syntax"],
    featured: false,
  },
  {
    id: "realtime-apriltag-pose-estimation",
    title: "Real-Time AprilTag 3D Pose Estimation & Camera Calibration",
    authors: ["Dr. Evelyn Vance", "Jordan Miller", "ARES Vision Systems"],
    publishedYear: 2025,
    category: "Vision & Sensors",
    format: "Whitepaper",
    difficulty: "Intermediate",
    readingTimeMinutes: 24,
    summary: "Intrinsic camera calibration with pinhole distortion models, homography decomposition, and solvePnP optimization for millimeter-accurate field localization.",
    description: "Details lens distortion coefficients (k1, k2, p1, p2), coordinate transformation matrices, and multithreaded frame decimation strategies on Android NDK with OpenCV 4.x.",
    tags: ["AprilTag", "Computer Vision", "Pose Estimation", "OpenCV", "Camera Calibration"],
    externalUrl: "https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/apriltag-pose-estimation.pdf",
    downloadUrl: "https://github.com/ARES-23247/ARESLib/raw/master/docs/whitepapers/apriltag-pose-estimation.pdf",
    doi: "10.23247/ares.2025.vis01",
    citation: {
      ieee: 'E. Vance, J. Miller, and ARES Vision Systems, "Real-Time AprilTag 3D Pose Estimation & Camera Calibration," ARES 23247 Technical Whitepapers, vol. 3, no. 3, pp. 33–48, 2025. Available: https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/apriltag-pose-estimation.pdf',
      apa: "Vance, E., Miller, J., & ARES Vision Systems (2025). Real-Time AprilTag 3D Pose Estimation & Camera Calibration. ARES 23247 Technical Whitepapers, 3(3), 33–48. https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/apriltag-pose-estimation.pdf",
      bibtex: `@article{vance2025apriltag,\n  author = {Vance, Evelyn and Miller, Jordan and {ARES Vision Systems}},\n  title = {Real-Time AprilTag 3D Pose Estimation & Camera Calibration},\n  journal = {ARES 23247 Technical Whitepapers},\n  volume = {3},\n  number = {3},\n  pages = {33--48},\n  year = {2025},\n  url = {https://github.com/ARES-23247/ARESLib/tree/master/docs/whitepapers/apriltag-pose-estimation.pdf}\n}`,
    },
    prerequisites: ["Matrix Transformations", "Basic Coordinate Systems (Cartesian/Homogeneous)"],
    featured: true,
  },
  {
    id: "opencv-color-contour-pipeline",
    title: "Color-Space Pipeline Optimization with HSV Thresholding & Contours",
    authors: ["Jordan Miller", "ARES Vision Systems"],
    publishedYear: 2024,
    category: "Vision & Sensors",
    format: "Interactive Tutorial",
    difficulty: "Novice",
    readingTimeMinutes: 14,
    summary: "Building robust game piece detection pipelines with HSV threshold bounds, morphological opening/closing filters, and bounding box aspect ratio scoring.",
    description: "Interactive visual tutorial demonstrating lighting invariance techniques, dynamic auto-exposure tuning, and live threshold masking on FTC competition fields.",
    tags: ["OpenCV", "HSV", "Image Processing", "Contours", "Sensors"],
    externalUrl: "https://github.com/ARES-23247/ARESLib/wiki/OpenCV-Color-Pipelines",
    downloadUrl: "https://github.com/ARES-23247/ARESLib/raw/master/docs/guides/opencv-color-pipelines.pdf",
    citation: {
      ieee: 'J. Miller and ARES Vision Systems, "Color-Space Pipeline Optimization with HSV Thresholding & Contours," ARES 23247 Vision Guides, 2024. Available: https://github.com/ARES-23247/ARESLib/wiki/OpenCV-Color-Pipelines',
      apa: "Miller, J., & ARES Vision Systems (2024). Color-Space Pipeline Optimization with HSV Thresholding & Contours. ARES 23247 Vision Guides. https://github.com/ARES-23247/ARESLib/wiki/OpenCV-Color-Pipelines",
      bibtex: `@article{miller2024hsv,\n  author = {Miller, Jordan and {ARES Vision Systems}},\n  title = {Color-Space Pipeline Optimization with HSV Thresholding & Contours},\n  journal = {ARES 23247 Vision Guides},\n  year = {2024},\n  url = {https://github.com/ARES-23247/ARESLib/wiki/OpenCV-Color-Pipelines}\n}`,
    },
    prerequisites: ["RGB and HSV Color Theory Basics"],
    featured: false,
  },
  {
    id: "photonvision-sensor-integration-video",
    title: "High-FPS Multi-Camera Vision Setup & Limelight/PhotonVision Masterclass",
    authors: ["ARES Robotics Video Series", "Jordan Miller"],
    publishedYear: 2025,
    category: "Vision & Sensors",
    format: "Video",
    difficulty: "Intermediate",
    readingTimeMinutes: 16,
    summary: "Video walkthrough of dual-camera mounting geometry, exposure locking, network tables latency minimization, and real-time field-coordinate broadcasting.",
    description: "Hands-on video tutorial demonstrating physical camera mounting, FOV overlap calculation, and integration with REV Hub USB buses at 60 FPS.",
    tags: ["Video", "PhotonVision", "Cameras", "Hardware", "Vision"],
    externalUrl: "https://youtube.com/watch?v=ares-vision-masterclass",
    citation: {
      ieee: 'J. Miller and ARES Robotics Video Series, "High-FPS Multi-Camera Vision Setup & Limelight/PhotonVision Masterclass," ARES 23247 Video Hub, 2025. [Video]. Available: https://youtube.com/watch?v=ares-vision-masterclass',
      apa: "Miller, J., & ARES Robotics Video Series (2025). High-FPS Multi-Camera Vision Setup & Limelight/PhotonVision Masterclass [Video]. ARES 23247 Video Hub. https://youtube.com/watch?v=ares-vision-masterclass",
      bibtex: `@misc{ares2025photonvisionvideo,\n  author = {Miller, Jordan and {ARES Robotics Video Series}},\n  title = {High-FPS Multi-Camera Vision Setup & Limelight/PhotonVision Masterclass},\n  howpublished = {Online Video, ARES 23247 Video Hub},\n  year = {2025},\n  url = {https://youtube.com/watch?v=ares-vision-masterclass}\n}`,
    },
    prerequisites: ["Basic USB Camera Hardware Setup"],
    featured: false,
  },
  {
    id: "ftc-engineering-portfolio-blueprint",
    title: "FIRST Tech Challenge Engineering Portfolio Blueprint & Judging Strategy",
    authors: ["Samantha Chen", "ARES Operations & Leadership"],
    publishedYear: 2025,
    category: "Team Operations",
    format: "Guide",
    difficulty: "Intermediate",
    readingTimeMinutes: 16,
    summary: "15-page portfolio architecture, typography guidelines, engineering design cycle storytelling, CAD render callouts, and judges interview presentation rubrics.",
    description: "Deconstructs Think, Innovate, Design, and Control Award rubrics with page-by-page content allocations, data visualization best practices, and judging session scripts.",
    tags: ["Portfolio", "Judging", "Engineering Notebook", "Awards", "Communication"],
    externalUrl: "https://github.com/ARES-23247/ARESLib/tree/master/docs/operations/portfolio-blueprint.pdf",
    downloadUrl: "https://github.com/ARES-23247/ARESLib/raw/master/docs/operations/portfolio-blueprint.pdf",
    citation: {
      ieee: 'S. Chen and ARES Operations & Leadership, "FIRST Tech Challenge Engineering Portfolio Blueprint & Judging Strategy," ARES 23247 Team Operations Series, 2025. Available: https://github.com/ARES-23247/ARESLib/tree/master/docs/operations/portfolio-blueprint.pdf',
      apa: "Chen, S., & ARES Operations & Leadership (2025). FIRST Tech Challenge Engineering Portfolio Blueprint & Judging Strategy. ARES 23247 Team Operations Series. https://github.com/ARES-23247/ARESLib/tree/master/docs/operations/portfolio-blueprint.pdf",
      bibtex: `@manual{chen2025portfolio,\n  author = {Chen, Samantha and {ARES Operations & Leadership}},\n  title = {FIRST Tech Challenge Engineering Portfolio Blueprint & Judging Strategy},\n  organization = {ARES 23247 Robotics},\n  year = {2025},\n  url = {https://github.com/ARES-23247/ARESLib/tree/master/docs/operations/portfolio-blueprint.pdf}\n}`,
    },
    prerequisites: ["None"],
    featured: true,
  },
  {
    id: "corporate-sponsorship-pitch-deck",
    title: "Corporate STEM Sponsorship Pitch Deck & Financial Ledger Framework",
    authors: ["Marcus Sterling", "Samantha Chen", "ARES Business Subteam"],
    publishedYear: 2025,
    category: "Team Operations",
    format: "Guide",
    difficulty: "Novice",
    readingTimeMinutes: 14,
    summary: "Tiered corporate sponsorship proposal decks, 501(c)(3) fiscal sponsorship agreements, student value propositions, and financial audit transparency templates.",
    description: "Includes slide deck templates, cold outreach email scripts, sponsor retention report designs, and budget allocation models for competitive robotics seasons.",
    tags: ["Sponsorship", "Finance", "Fundraising", "Business", "Outreach"],
    externalUrl: "https://github.com/ARES-23247/ARESLib/tree/master/docs/operations/sponsorship-pitch-deck.pdf",
    downloadUrl: "https://github.com/ARES-23247/ARESLib/raw/master/docs/operations/sponsorship-pitch-deck.pdf",
    citation: {
      ieee: 'M. Sterling, S. Chen, and ARES Business Subteam, "Corporate STEM Sponsorship Pitch Deck & Financial Ledger Framework," ARES 23247 Operations Series, 2025. Available: https://github.com/ARES-23247/ARESLib/tree/master/docs/operations/sponsorship-pitch-deck.pdf',
      apa: "Sterling, M., Chen, S., & ARES Business Subteam (2025). Corporate STEM Sponsorship Pitch Deck & Financial Ledger Framework. ARES 23247 Operations Series. https://github.com/ARES-23247/ARESLib/tree/master/docs/operations/sponsorship-pitch-deck.pdf",
      bibtex: `@techreport{sterling2025sponsorship,\n  author = {Sterling, Marcus and Chen, Samantha and {ARES Business Subteam}},\n  title = {Corporate STEM Sponsorship Pitch Deck & Financial Ledger Framework},\n  institution = {ARES 23247 Robotics},\n  year = {2025},\n  url = {https://github.com/ARES-23247/ARESLib/tree/master/docs/operations/sponsorship-pitch-deck.pdf}\n}`,
    },
    prerequisites: ["None"],
    featured: false,
  },
  {
    id: "stem-outreach-curriculum-design",
    title: "Community STEM Outreach Program Design & Impact Measurement",
    authors: ["Elena Rostova", "ARES Outreach Group"],
    publishedYear: 2026,
    category: "Team Operations",
    format: "Guide",
    difficulty: "Novice",
    readingTimeMinutes: 15,
    summary: "K-8 robotics workshop curriculum, hands-on mechanical kits, diversity in STEM metrics, and measurable community engagement tracking.",
    description: "Comprehensive framework for running scalable robotics summer camps, library STEM days, and youth mentorship programs with reproducible activity lesson plans and feedback surveys.",
    tags: ["Outreach", "STEM Education", "Curriculum", "Community", "Workshops"],
    externalUrl: "https://github.com/ARES-23247/ARESLib/tree/master/docs/operations/stem-outreach-framework.pdf",
    downloadUrl: "https://github.com/ARES-23247/ARESLib/raw/master/docs/operations/stem-outreach-framework.pdf",
    citation: {
      ieee: 'E. Rostova and ARES Outreach Group, "Community STEM Outreach Program Design & Impact Measurement," ARES 23247 Outreach Series, 2026. Available: https://github.com/ARES-23247/ARESLib/tree/master/docs/operations/stem-outreach-framework.pdf',
      apa: "Rostova, E., & ARES Outreach Group (2026). Community STEM Outreach Program Design & Impact Measurement. ARES 23247 Outreach Series. https://github.com/ARES-23247/ARESLib/tree/master/docs/operations/stem-outreach-framework.pdf",
      bibtex: `@manual{rostova2026outreach,\n  author = {Rostova, Elena and {ARES Outreach Group}},\n  title = {Community STEM Outreach Program Design & Impact Measurement},\n  organization = {ARES 23247 Robotics},\n  year = {2026},\n  url = {https://github.com/ARES-23247/ARESLib/tree/master/docs/operations/stem-outreach-framework.pdf}\n}`,
    },
    prerequisites: ["None"],
    featured: false,
  },
];

/**
 * Pure function to filter and sort STEM library resources based on user criteria.
 */
export function filterStemResources(options: StemLibraryFilterOptions = {}): StemResource[] {
  const {
    resources = STEM_RESOURCES,
    search = "",
    category = "All",
    format = "All",
    difficulty = "All",
    tag = "",
    sortBy = "featured",
  } = options;

  const normalizedSearch = search.trim().toLowerCase();
  const normalizedTag = tag.trim().toLowerCase();

  const filtered = resources.filter((resource) => {
    // Category match
    if (category !== "All" && resource.category !== category) {
      return false;
    }

    // Format match
    if (format !== "All" && resource.format !== format) {
      return false;
    }

    // Difficulty match
    if (difficulty !== "All" && resource.difficulty !== difficulty) {
      return false;
    }

    // Specific tag match
    if (normalizedTag && !resource.tags.some((t) => t.toLowerCase() === normalizedTag)) {
      return false;
    }

    // Search query match (title, authors, summary, description, tags, reading time, year)
    if (normalizedSearch) {
      const matchesTitle = resource.title.toLowerCase().includes(normalizedSearch);
      const matchesSummary = resource.summary.toLowerCase().includes(normalizedSearch);
      const matchesDescription = resource.description.toLowerCase().includes(normalizedSearch);
      const matchesAuthors = resource.authors.some((a) => a.toLowerCase().includes(normalizedSearch));
      const matchesTags = resource.tags.some((t) => t.toLowerCase().includes(normalizedSearch));
      const matchesCategory = resource.category.toLowerCase().includes(normalizedSearch);
      const matchesFormat = resource.format.toLowerCase().includes(normalizedSearch);
      const matchesYear = resource.publishedYear.toString().includes(normalizedSearch);
      const matchesDuration =
        `${resource.readingTimeMinutes} min`.includes(normalizedSearch) ||
        `${resource.readingTimeMinutes}min`.includes(normalizedSearch) ||
        (normalizedSearch.startsWith("<") &&
          resource.readingTimeMinutes <= parseInt(normalizedSearch.replace(/[^0-9]/g, "") || "999", 10));

      if (
        !matchesTitle &&
        !matchesSummary &&
        !matchesDescription &&
        !matchesAuthors &&
        !matchesTags &&
        !matchesCategory &&
        !matchesFormat &&
        !matchesYear &&
        !matchesDuration
      ) {
        return false;
      }
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "featured":
        if (Boolean(a.featured) !== Boolean(b.featured)) {
          return a.featured ? -1 : 1;
        }
        return b.publishedYear - a.publishedYear;
      case "newest":
        if (a.publishedYear !== b.publishedYear) {
          return b.publishedYear - a.publishedYear;
        }
        return a.title.localeCompare(b.title);
      case "readingTime":
        return a.readingTimeMinutes - b.readingTimeMinutes;
      case "alphabetical":
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });
}

/**
 * Computes frequency counts for categories in the given resource catalog.
 */
export function getCategoryStats(resources: StemResource[] = STEM_RESOURCES): Record<StemCategory, number> {
  const stats: Record<StemCategory, number> = {
    "Controls & Math": 0,
    "Mechanical Design": 0,
    "Software Architecture": 0,
    "Vision & Sensors": 0,
    "Team Operations": 0,
  };
  for (const item of resources) {
    if (stats[item.category] !== undefined) {
      stats[item.category]++;
    }
  }
  return stats;
}

/**
 * Computes frequency counts for formats in the given resource catalog.
 */
export function getFormatStats(resources: StemResource[] = STEM_RESOURCES): Record<StemFormat, number> {
  const stats: Record<StemFormat, number> = {
    Whitepaper: 0,
    Guide: 0,
    "Interactive Tutorial": 0,
    Video: 0,
  };
  for (const item of resources) {
    if (stats[item.format] !== undefined) {
      stats[item.format]++;
    }
  }
  return stats;
}

/**
 * Computes frequency counts for difficulty levels in the given resource catalog.
 */
export function getDifficultyStats(resources: StemResource[] = STEM_RESOURCES): Record<StemDifficulty, number> {
  const stats: Record<StemDifficulty, number> = {
    Novice: 0,
    Intermediate: 0,
    Advanced: 0,
  };
  for (const item of resources) {
    if (stats[item.difficulty] !== undefined) {
      stats[item.difficulty]++;
    }
  }
  return stats;
}
