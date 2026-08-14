export type WorkshopCategory = "cad" | "programming" | "motion-control" | "electrical";
export type WorkshopLevel = "Beginner" | "Intermediate" | "Advanced";
export type WorkshopAudience = "Middle School" | "High School" | "Middle & High School" | "All Grades";

export interface WorkshopSession {
  id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  time: string; // e.g. "10:00 AM - 12:30 PM EST"
  location: string;
  isVirtual: boolean;
  availableSeats: number;
  totalSeats: number;
  mentorSlotsAvailable: number;
  mentorSlotsTotal: number;
}

export interface WorkshopModule {
  id: string;
  slug: string;
  title: string;
  category: WorkshopCategory;
  categoryLabel: string;
  level: WorkshopLevel;
  targetAudience: WorkshopAudience;
  duration: string;
  shortDescription: string;
  learningObjectives: string[];
  prerequisites: string[];
  equipmentNeeded: string[];
  featuredTopics: string[];
  software: string[];
  coachingRatio: string;
  sessions: WorkshopSession[];
}

export interface StudentRegistration {
  studentNickname: string;
  parentGuardianName: string;
  parentGuardianEmail: string;
  parentGuardianPhone: string;
  gradeLevel: string;
  priorExperience: string;
  dietaryOrAccessibilityNeeds?: string;
  workshopId: string;
  sessionId: string;
  yppParentConsent: boolean;
  photoConsent: boolean;
}

export interface MentorShiftSignup {
  name: string;
  email: string;
  phone?: string;
  workshopId: string;
  sessionId: string;
  role: "mentor" | "alumni" | "lead-coach";
  skills: string[];
  availabilityNotes?: string;
}

export interface CurriculumFilter {
  category?: WorkshopCategory | "all";
  level?: WorkshopLevel | "all";
  search?: string;
}

export const WORKSHOP_CATEGORIES: { id: WorkshopCategory; label: string; description: string; iconName: string }[] = [
  {
    id: "cad",
    label: "3D CAD Modeling (Onshape)",
    description: "Cloud-native parametric modeling, drivetrain assemblies, and DFM for 3D printing & CNC.",
    iconName: "Box",
  },
  {
    id: "programming",
    label: "FTC Robot Programming (Java/Kotlin)",
    description: "Finite state machines, Road Runner pathing, OpenCV vision, and clean subsystem design.",
    iconName: "Code2",
  },
  {
    id: "motion-control",
    label: "Motion Control (PID/Feedforward)",
    description: "Control theory, velocity/acceleration feedforward, odometry dead-wheels, and live telemetry tuning.",
    iconName: "Activity",
  },
  {
    id: "electrical",
    label: "Electrical Prototyping",
    description: "Anderson Powerpole crimping, CAN bus daisy chaining, REV Power Distribution Hub, and ESD grounding.",
    iconName: "Zap",
  },
];

export const GRADE_LEVELS: string[] = [
  "6th Grade",
  "7th Grade",
  "8th Grade",
  "9th Grade (Freshman)",
  "10th Grade (Sophomore)",
  "11th Grade (Junior)",
  "12th Grade (Senior)",
  "College / Post-Secondary",
];

export const EXPERIENCE_LEVELS: { id: string; label: string; description: string }[] = [
  {
    id: "none",
    label: "Beginner / Curious Explorer",
    description: "No prior robotics, programming, or CAD experience required.",
  },
  {
    id: "fll_or_classes",
    label: "Novice (FLL / Middle School STEM)",
    description: "1+ years in LEGO robotics, Scratch, block coding, or basic 3D design.",
  },
  {
    id: "ftc_experienced",
    label: "Intermediate (1-2 Years FTC/FRC)",
    description: "Hands-on experience with FTC Java, Onshape CAD, or robot electronics.",
  },
  {
    id: "advanced_competition",
    label: "Advanced (2+ Years FTC Driver / Lead)",
    description: "Comfortable with advanced control algorithms, Git workflows, and mechanism fabrication.",
  },
];

export const MENTOR_SKILL_TAGS: string[] = [
  "Onshape 3D CAD",
  "FTC Java / Kotlin",
  "Road Runner / Pedro Pathing",
  "PID & Feedforward Tuning",
  "CAN Bus & Electrical Wiring",
  "Anderson Powerpole / JST Crimping",
  "OpenCV / AprilTag Vision",
  "Autonomous State Machines",
  "Mechanism Prototyping",
  "Drive Coaching & Match Strategy",
];

export const WORKSHOP_MODULES: WorkshopModule[] = [
  {
    id: "cad-onshape",
    slug: "3d-cad-onshape-modeling",
    title: "3D CAD Modeling & Parametric Mechanism Design",
    category: "cad",
    categoryLabel: "3D CAD Modeling (Onshape)",
    level: "Intermediate",
    targetAudience: "All Grades",
    duration: "2.5 Hours",
    shortDescription: "Master cloud-native parametric modeling in Onshape. Build FTC-compliant drivetrains, intake mechanisms, multi-stage linear slides, and 3D-printable custom brackets with precise tolerance fits.",
    learningObjectives: [
      "Parametric sketching, dimensioning, and constraint management in Onshape Part Studios",
      "FTC COTS parts library integration (REV, goBILDA, Actobotics)",
      "Subassembly modeling with revolute, cylindrical, and slider mates",
      "Finite Element Analysis (FEA) fundamentals & weight-reduction pocketing",
      "DFM (Design for Manufacturing) guidelines for FDM 3D printing and CNC laser/router cutting",
    ],
    prerequisites: [
      "Basic geometry knowledge (angles, distances, cartesian coordinates)",
      "Free Onshape Education or Standard account created prior to session",
      "Laptop with 3-button mouse (scroll wheel required for CAD orbit)",
    ],
    equipmentNeeded: [
      "Personal Laptop (Windows, macOS, or Chromebook with Chrome browser)",
      "3-Button Scroll Wheel Mouse",
      "Pre-configured Onshape FTC Parts Library",
    ],
    featuredTopics: [
      "Onshape Part Studios",
      "Mate Connectors",
      "Fasteners & Hardware Tolerances",
      "Parametric Variables",
      "3D Printing Slicing (CAM)",
    ],
    software: ["Onshape CAD", "PrusaSlicer / Bambu Studio", "Kiri:Moto"],
    coachingRatio: "1:4 Mentor to Student",
    sessions: [
      {
        id: "cad-sess-1",
        date: "2026-09-12",
        time: "10:00 AM - 12:30 PM EST",
        location: "ARES Robotics Lab (Morgantown, WV)",
        isVirtual: false,
        availableSeats: 8,
        totalSeats: 16,
        mentorSlotsAvailable: 2,
        mentorSlotsTotal: 4,
      },
      {
        id: "cad-sess-2",
        date: "2026-09-26",
        time: "2:00 PM - 4:30 PM EST",
        location: "Virtual Coaching (Discord + Screen Share)",
        isVirtual: true,
        availableSeats: 12,
        totalSeats: 20,
        mentorSlotsAvailable: 3,
        mentorSlotsTotal: 5,
      },
    ],
  },
  {
    id: "prog-ftc-java",
    slug: "ftc-robot-programming-java-kotlin",
    title: "FTC Robot Programming with Java & Kotlin",
    category: "programming",
    categoryLabel: "FTC Robot Programming (Java/Kotlin)",
    level: "Intermediate",
    targetAudience: "Middle & High School",
    duration: "3.0 Hours",
    shortDescription: "Deep dive into production-grade FTC robot software. Architecture design using finite state machines, HardwareMap abstraction, Road Runner motion profiling, and Kotlin coroutines.",
    learningObjectives: [
      "Structuring robust OpModes using LinearOpMode and finite state machines",
      "HardwareMap configuration for REV Control Hub and Expansion Hub",
      "Autonomous trajectory generation with Road Runner and Pedro Pathing",
      "Computer vision pipeline integration using OpenCV and AprilTag localization",
      "Unit testing robot control logic with Mockito and headless FTC simulator",
    ],
    prerequisites: [
      "Fundamental Java or Kotlin knowledge (variables, loops, methods, OOP)",
      "Git version control basics (clone, branch, commit)",
    ],
    equipmentNeeded: [
      "Laptop with Android Studio Hedgehog/Iguana installed",
      "USB-C to USB-A programming data cable",
      "REV Control Hub (provided in-lab for physical participants)",
    ],
    featuredTopics: [
      "Finite State Machines (FSM)",
      "Road Runner 1.0",
      "AprilTag Vision Localization",
      "Subsystem Action Architecture",
      "Kotlin Extensions & Coroutines",
    ],
    software: ["Android Studio", "FTC Robot Controller SDK", "Git / GitHub", "OpenCV"],
    coachingRatio: "1:3 Mentor to Student",
    sessions: [
      {
        id: "prog-sess-1",
        date: "2026-09-19",
        time: "1:00 PM - 4:00 PM EST",
        location: "ARES Robotics Lab (Morgantown, WV)",
        isVirtual: false,
        availableSeats: 6,
        totalSeats: 14,
        mentorSlotsAvailable: 1,
        mentorSlotsTotal: 4,
      },
      {
        id: "prog-sess-2",
        date: "2026-10-03",
        time: "10:00 AM - 1:00 PM EST",
        location: "Virtual Coaching (Discord + Live Share)",
        isVirtual: true,
        availableSeats: 10,
        totalSeats: 18,
        mentorSlotsAvailable: 2,
        mentorSlotsTotal: 4,
      },
    ],
  },
  {
    id: "motion-control-pid",
    slug: "motion-control-pid-feedforward",
    title: "Motion Control & Feedback Loops: PID, Feedforward, & Odometry",
    category: "motion-control",
    categoryLabel: "Motion Control (PID/Feedforward)",
    level: "Advanced",
    targetAudience: "High School",
    duration: "2.5 Hours",
    shortDescription: "Master control theory applied to competition robots. Tune proportional, integral, and derivative gains, implement kV/kA/kS feedforward, and stabilize elevator gravity compensation and precision drivetrain tracking.",
    learningObjectives: [
      "Mathematical foundation of Proportional-Integral-Derivative (PID) controllers",
      "Feedforward velocity and acceleration modeling (kS, kV, kA)",
      "Arm and elevator gravity feedforward (kG) compensation",
      "Three-wheel dead-wheel odometry and IMU sensor fusion",
      "Live telemetry analysis and dashboard tuning using FTC Dashboard",
    ],
    prerequisites: [
      "Algebra II / Trigonometry fundamentals",
      "Familiarity with FTC Java or ARESLib control structures",
    ],
    equipmentNeeded: [
      "Laptop with modern web browser for FTC Dashboard telemetry",
      "Graphing calculator or Desmos access for response curve inspection",
    ],
    featuredTopics: [
      "PID Controller Tuning",
      "Feedforward Physics (kS, kV, kA)",
      "Three-Wheel Odometry",
      "FTC Dashboard Telemetry",
      "Kalman Filter Sensor Fusion",
    ],
    software: ["FTC Dashboard", "ARESLib", "Desmos / Python Simulation"],
    coachingRatio: "1:4 Mentor to Student",
    sessions: [
      {
        id: "motion-sess-1",
        date: "2026-10-10",
        time: "10:00 AM - 12:30 PM EST",
        location: "ARES Robotics Lab (Morgantown, WV)",
        isVirtual: false,
        availableSeats: 5,
        totalSeats: 12,
        mentorSlotsAvailable: 2,
        mentorSlotsTotal: 3,
      },
      {
        id: "motion-sess-2",
        date: "2026-10-24",
        time: "2:00 PM - 4:30 PM EST",
        location: "Virtual Coaching (Discord + Interactive Web Sim)",
        isVirtual: true,
        availableSeats: 14,
        totalSeats: 20,
        mentorSlotsAvailable: 3,
        mentorSlotsTotal: 5,
      },
    ],
  },
  {
    id: "elec-prototyping",
    slug: "electrical-prototyping-power-distribution",
    title: "Electrical Prototyping, Power Distribution, & CAN Bus Architecture",
    category: "electrical",
    categoryLabel: "Electrical Prototyping",
    level: "Beginner",
    targetAudience: "All Grades",
    duration: "2.0 Hours",
    shortDescription: "Learn mission-critical robot electrical assembly. Master Anderson Powerpole and JST crimping, clean wiring harnesses, CAN bus star vs daisy-chain topologies, and ESD mitigation.",
    learningObjectives: [
      "Proper gauge selection (14-18 AWG power, 22-26 AWG signal/sensors)",
      "High-reliability crimping: Anderson Powerpole, Dupont, JST-VH, and XT30",
      "REV Power Distribution Hub fusing and circuit breaker selection",
      "CAN bus termination resistor verification and signal integrity testing",
      "Electrostatic Discharge (ESD) grounding and ferrite ring protection techniques",
    ],
    prerequisites: ["None! Open to all interested students, coaches, and mentors."],
    equipmentNeeded: [
      "Safety glasses (provided on-site for lab sessions)",
      "All crimpers, strippers, and wire provided in-lab",
    ],
    featuredTopics: [
      "Crimping & Soldering Standards",
      "Power Distribution & Fuses",
      "CAN Bus Wiring",
      "ESD Mitigation",
      "Troubleshooting with Multimeters",
    ],
    software: ["REV Hardware Client", "Digital Multimeter diagnostics"],
    coachingRatio: "1:3 Mentor to Student",
    sessions: [
      {
        id: "elec-sess-1",
        date: "2026-09-05",
        time: "11:00 AM - 1:00 PM EST",
        location: "ARES Robotics Lab (Morgantown, WV)",
        isVirtual: false,
        availableSeats: 4,
        totalSeats: 12,
        mentorSlotsAvailable: 1,
        mentorSlotsTotal: 4,
      },
      {
        id: "elec-sess-2",
        date: "2026-10-17",
        time: "11:00 AM - 1:00 PM EST",
        location: "ARES Robotics Lab (Morgantown, WV)",
        isVirtual: false,
        availableSeats: 9,
        totalSeats: 12,
        mentorSlotsAvailable: 2,
        mentorSlotsTotal: 4,
      },
    ],
  },
];

export function filterWorkshops(
  modules: WorkshopModule[],
  filter: CurriculumFilter
): WorkshopModule[] {
  const { category, level, search } = filter;
  const query = search ? search.trim().toLowerCase() : "";

  return modules.filter((m) => {
    if (category && category !== "all" && m.category !== category) {
      return false;
    }
    if (level && level !== "all" && m.level !== level) {
      return false;
    }
    if (!query) {
      return true;
    }

    return (
      m.title.toLowerCase().includes(query) ||
      m.shortDescription.toLowerCase().includes(query) ||
      m.categoryLabel.toLowerCase().includes(query) ||
      m.featuredTopics.some((topic) => topic.toLowerCase().includes(query)) ||
      m.learningObjectives.some((obj) => obj.toLowerCase().includes(query)) ||
      m.software.some((sw) => sw.toLowerCase().includes(query)) ||
      m.prerequisites.some((pre) => pre.toLowerCase().includes(query))
    );
  });
}

export function getWorkshopById(id: string): WorkshopModule | undefined {
  return WORKSHOP_MODULES.find((m) => m.id === id || m.slug === id);
}

export function getWorkshopSession(
  workshopId: string,
  sessionId: string
): { workshop: WorkshopModule; session: WorkshopSession } | undefined {
  const workshop = getWorkshopById(workshopId);
  if (!workshop) return undefined;

  const session = workshop.sessions.find((s) => s.id === sessionId);
  if (!session) return undefined;

  return { workshop, session };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validateStudentRegistration(data: Partial<StudentRegistration>): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!data.studentNickname || !data.studentNickname.trim()) {
    errors.studentNickname = "Student nickname or callsign is required.";
  } else if (data.studentNickname.trim().length > 50) {
    errors.studentNickname = "Student nickname must be 50 characters or fewer.";
  }

  if (!data.parentGuardianName || !data.parentGuardianName.trim()) {
    errors.parentGuardianName = "Parent or guardian name is required.";
  }

  if (!data.parentGuardianEmail || !data.parentGuardianEmail.trim()) {
    errors.parentGuardianEmail = "Parent or guardian email is required.";
  } else if (!isValidEmail(data.parentGuardianEmail)) {
    errors.parentGuardianEmail = "Please enter a valid email address.";
  }

  if (!data.parentGuardianPhone || !data.parentGuardianPhone.trim()) {
    errors.parentGuardianPhone = "Parent or guardian contact phone is required.";
  }

  if (!data.gradeLevel || !data.gradeLevel.trim()) {
    errors.gradeLevel = "Please select the student's grade level.";
  }

  if (!data.priorExperience || !data.priorExperience.trim()) {
    errors.priorExperience = "Please select prior robotics or programming experience.";
  }

  if (!data.workshopId || !data.workshopId.trim()) {
    errors.workshopId = "Please select a workshop module.";
  }

  if (!data.sessionId || !data.sessionId.trim()) {
    errors.sessionId = "Please select a coaching session date and time.";
  }

  if (!data.yppParentConsent) {
    errors.yppParentConsent = "Parent/Guardian consent under FIRST® Youth Protection Program (YPP) is required.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateMentorSignup(data: Partial<MentorShiftSignup>): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!data.name || !data.name.trim()) {
    errors.name = "Full name is required.";
  }

  if (!data.email || !data.email.trim()) {
    errors.email = "Email address is required.";
  } else if (!isValidEmail(data.email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!data.workshopId || !data.workshopId.trim()) {
    errors.workshopId = "Please select a workshop module.";
  }

  if (!data.sessionId || !data.sessionId.trim()) {
    errors.sessionId = "Please select a coaching shift.";
  }

  if (!data.role) {
    errors.role = "Please select your volunteer role.";
  }

  if (!data.skills || data.skills.length === 0) {
    errors.skills = "Please select at least one skill or coaching area.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
