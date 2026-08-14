export type IndustryCategory =
  | "Aerospace"
  | "Software Engineering"
  | "Autonomous Robotics"
  | "Mechanical/Mechatronics"
  | "Biomedical";

export const INDUSTRY_CATEGORIES: readonly IndustryCategory[] = [
  "Aerospace",
  "Software Engineering",
  "Autonomous Robotics",
  "Mechanical/Mechatronics",
  "Biomedical",
] as const;

export type MentorshipTopic = "College Prep" | "Robotics Engineering" | "CAD Mentoring";

export const MENTORSHIP_TOPICS: readonly MentorshipTopic[] = [
  "College Prep",
  "Robotics Engineering",
  "CAD Mentoring",
] as const;

export interface CareerLinks {
  readonly linkedin?: string;
  readonly github?: string;
  readonly portfolio?: string;
}

export interface AlumniProfile {
  readonly id: string;
  readonly name: string;
  readonly gradYear: number;
  readonly university: string;
  readonly collegeOrSchool?: string;
  readonly major: string;
  readonly degreeLevel?: string;
  readonly industry: IndustryCategory;
  readonly company: string;
  readonly title: string;
  readonly heritageRole: string;
  readonly bio: string;
  readonly quote?: string;
  readonly avatar?: string;
  readonly isAdultAlum: true;
  readonly careerLinks?: CareerLinks;
  readonly availableTopics: readonly MentorshipTopic[];
  readonly location?: string;
  readonly featured?: boolean;
}

export interface AlumniFilterCriteria {
  readonly searchQuery?: string;
  readonly industry?: IndustryCategory | "all";
  readonly university?: string | "all";
  readonly topic?: MentorshipTopic | "all";
}

export const ALUMNI_DIRECTORY: readonly AlumniProfile[] = [
  {
    id: "alum-elena-vance",
    name: "Elena Vance",
    gradYear: 2021,
    university: "Massachusetts Institute of Technology (MIT)",
    collegeOrSchool: "School of Engineering",
    major: "Mechanical Engineering & Robotics",
    degreeLevel: "B.S. '25",
    industry: "Autonomous Robotics",
    company: "Tesla",
    title: "Autopilot Hardware & Motion Planning Intern",
    heritageRole: "Lead Autonomous Programmer & Drive Strategist",
    bio: "Elena led ARES autonomy architectures and odometry integration for two state championship runs. At MIT, she researches dynamic trajectory optimization for multi-agent robotic systems.",
    quote: "The rigorous debugging mindset we forged in FTC pits became my greatest asset in collegiate robotics labs.",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=elena-vance-ares",
    isAdultAlum: true,
    careerLinks: {
      linkedin: "https://www.linkedin.com/in/ares-elena-vance",
      github: "https://github.com/elena-vance-robotics",
    },
    availableTopics: ["College Prep", "Robotics Engineering"],
    location: "Cambridge, MA / Austin, TX",
    featured: true,
  },
  {
    id: "alum-marcus-chen",
    name: "Marcus Chen",
    gradYear: 2020,
    university: "Carnegie Mellon University (CMU)",
    collegeOrSchool: "Robotics Institute",
    major: "Robotics & Computer Science",
    degreeLevel: "M.S. Robotics '25",
    industry: "Autonomous Robotics",
    company: "Carnegie Mellon Robotics Institute",
    title: "Autonomous Navigation Research Engineer",
    heritageRole: "Lead Systems Architect & Drive Coach",
    bio: "Marcus built custom SLAM and particle filter localization engines for ARES. At CMU, his research focuses on off-road autonomous navigation and perception in degraded visual conditions.",
    quote: "FIRST teaches you to treat failure as pure data. Never fear tearing down an intake if the kinematics demand it.",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=marcus-chen-ares",
    isAdultAlum: true,
    careerLinks: {
      linkedin: "https://www.linkedin.com/in/ares-marcus-chen",
      github: "https://github.com/marcus-cmu-robotics",
    },
    availableTopics: ["Robotics Engineering", "CAD Mentoring"],
    location: "Pittsburgh, PA",
    featured: true,
  },
  {
    id: "alum-sarah-jenkins",
    name: "Sarah Jenkins",
    gradYear: 2022,
    university: "Purdue University",
    collegeOrSchool: "College of Engineering",
    major: "Aerospace & Astronautical Engineering",
    degreeLevel: "B.S. '26",
    industry: "Aerospace",
    company: "NASA Goddard Space Flight Center",
    title: "Thermal & Structural Systems Co-op",
    heritageRole: "Lead CAD Designer & Structural Fabricator",
    bio: "Sarah engineered the lightweight CNC aluminum chassis and virtual four-bar linkage elevators for ARES. At Purdue, she develops finite element models for orbital deployment mechanisms.",
    quote: "Mastering parametric CAD as a high schooler gave me immediate credibility in aerospace design teams.",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=sarah-jenkins-ares",
    isAdultAlum: true,
    careerLinks: {
      linkedin: "https://www.linkedin.com/in/ares-sarah-jenkins",
    },
    availableTopics: ["College Prep", "CAD Mentoring"],
    location: "West Lafayette, IN / Greenbelt, MD",
    featured: true,
  },
  {
    id: "alum-devon-brooks",
    name: "Devon Brooks",
    gradYear: 2020,
    university: "West Virginia University (WVU)",
    collegeOrSchool: "Lane Department of Computer Science & Electrical Engineering",
    major: "Computer Science & Cybersecurity",
    degreeLevel: "B.S. '24",
    industry: "Software Engineering",
    company: "Lockheed Martin Space",
    title: "Flight Software & Telemetry Engineer",
    heritageRole: "Telemetry & Control Loops Lead",
    bio: "Devon spearheaded the real-time dashboard telemetry and state machine architectures on FTC #23247. Now at Lockheed Martin, he works on secure satellite communications and embedded avionics.",
    quote: "Building reliable real-time software under competition time pressure prepares you for mission-critical engineering.",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=devon-brooks-ares",
    isAdultAlum: true,
    careerLinks: {
      linkedin: "https://www.linkedin.com/in/ares-devon-brooks",
      github: "https://github.com/devon-lm-space",
    },
    availableTopics: ["College Prep", "Robotics Engineering"],
    location: "Morgantown, WV / Littleton, CO",
  },
  {
    id: "alum-priya-patel",
    name: "Priya Patel",
    gradYear: 2021,
    university: "Johns Hopkins University",
    collegeOrSchool: "Whiting School of Engineering",
    major: "Biomedical Engineering & Mechatronics",
    degreeLevel: "B.S. '25",
    industry: "Biomedical",
    company: "Stryker Medical Robotics",
    title: "Surgical Robotics Kinematics Intern",
    heritageRole: "Lead Mechanical Designer & Hardware Lead",
    bio: "Priya applied FTC gearing principles to surgical micro-manipulators at Johns Hopkins. Her focus centers on compliant robotic end-effectors with multi-axis force feedback for minimally invasive procedures.",
    quote: "The precision and reliability you practice in competitive robotics maps directly to life-saving surgical robotics.",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=priya-patel-ares",
    isAdultAlum: true,
    careerLinks: {
      linkedin: "https://www.linkedin.com/in/ares-priya-patel",
    },
    availableTopics: ["College Prep", "Robotics Engineering", "CAD Mentoring"],
    location: "Baltimore, MD / Kalamazoo, MI",
    featured: true,
  },
  {
    id: "alum-alexander-wright",
    name: "Alexander Wright",
    gradYear: 2022,
    university: "Georgia Institute of Technology",
    collegeOrSchool: "George W. Woodruff School of Mechanical Engineering",
    major: "Mechatronics & Mechanical Engineering",
    degreeLevel: "B.S. '26",
    industry: "Mechanical/Mechatronics",
    company: "SpaceX",
    title: "Starship Mechanical Actuation Intern",
    heritageRole: "Chassis & Drivetrain Subsystem Lead",
    bio: "Alexander specialized in high-torque planetary gearbox calculations and custom sheet-metal manufacturing for ARES. At Georgia Tech, he leads hybrid rocket testing actuators.",
    quote: "Don't just assemble parts; calculate your gear reductions, thermal limits, and factor of safety.",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=alexander-wright-ares",
    isAdultAlum: true,
    careerLinks: {
      linkedin: "https://www.linkedin.com/in/ares-alex-wright",
      github: "https://github.com/alex-wright-mechatronics",
    },
    availableTopics: ["CAD Mentoring", "Robotics Engineering"],
    location: "Atlanta, GA / Brownsville, TX",
  },
  {
    id: "alum-maya-lin",
    name: "Maya Lin",
    gradYear: 2023,
    university: "Stanford University",
    collegeOrSchool: "School of Engineering",
    major: "Computer Science (Artificial Intelligence)",
    degreeLevel: "B.S. '27",
    industry: "Software Engineering",
    company: "Apple",
    title: "CoreML & Computer Vision Software Intern",
    heritageRole: "Computer Vision & AprilTag Pipeline Lead",
    bio: "Maya built neural color thresholding and AprilTag pipeline detectors on FTC camera streams. At Stanford, she works on real-time neural radiance fields (NeRF) and edge ML inference.",
    quote: "FTC gave me my first experience training machine vision models on real noisy sensor inputs in high-stakes environments.",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=maya-lin-ares",
    isAdultAlum: true,
    careerLinks: {
      linkedin: "https://www.linkedin.com/in/ares-maya-lin",
      github: "https://github.com/maya-lin-ai",
    },
    availableTopics: ["College Prep", "Robotics Engineering"],
    location: "Stanford, CA / Cupertino, CA",
  },
  {
    id: "alum-caleb-rossi",
    name: "Caleb Rossi",
    gradYear: 2021,
    university: "West Virginia University (WVU)",
    collegeOrSchool: "Statler College of Engineering and Mineral Resources",
    major: "Mechanical Engineering",
    degreeLevel: "B.S. '25",
    industry: "Mechanical/Mechatronics",
    company: "Pratt & Whitney",
    title: "Gas Turbine Manufacturing Engineer Co-op",
    heritageRole: "Machining, Tolerance Analysis & Manufacturing Lead",
    bio: "Caleb brought CNC milling, lathe work, and precision 3D printing tolerances into ARES team standard operating procedures. At WVU, he runs the formula SAE chassis fabrication subteam.",
    quote: "Design for manufacturing is not an afterthought; it is what separates rendered concepts from championship robots.",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=caleb-rossi-ares",
    isAdultAlum: true,
    careerLinks: {
      linkedin: "https://www.linkedin.com/in/ares-caleb-rossi",
    },
    availableTopics: ["CAD Mentoring"],
    location: "Morgantown, WV / East Hartford, CT",
  },
];

/**
 * Filter alumni directory entries based on search terms, industry, university, and topic.
 */
export function filterAlumni(
  profiles: readonly AlumniProfile[],
  criteria: AlumniFilterCriteria
): AlumniProfile[] {
  const { searchQuery, industry, university, topic } = criteria;
  const normalizedQuery = searchQuery?.trim().toLowerCase() ?? "";

  return profiles.filter((profile) => {
    // 1. Adult alum verification (Strict Zero Youth PII compliance)
    if (!profile.isAdultAlum) {
      return false;
    }

    // 2. Industry category filter
    if (industry && industry !== "all" && profile.industry !== industry) {
      return false;
    }

    // 3. University filter
    if (university && university !== "all" && !profile.university.toLowerCase().includes(university.toLowerCase())) {
      return false;
    }

    // 4. Mentorship topic filter
    if (topic && topic !== "all" && !profile.availableTopics.includes(topic)) {
      return false;
    }

    // 5. Text search query
    if (normalizedQuery) {
      const matchSearch =
        profile.name.toLowerCase().includes(normalizedQuery) ||
        profile.university.toLowerCase().includes(normalizedQuery) ||
        profile.major.toLowerCase().includes(normalizedQuery) ||
        profile.company.toLowerCase().includes(normalizedQuery) ||
        profile.title.toLowerCase().includes(normalizedQuery) ||
        profile.heritageRole.toLowerCase().includes(normalizedQuery) ||
        profile.industry.toLowerCase().includes(normalizedQuery) ||
        profile.bio.toLowerCase().includes(normalizedQuery);

      if (!matchSearch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Extracts a deduplicated, sorted list of universities from profiles.
 */
export function getUniqueUniversities(profiles: readonly AlumniProfile[]): string[] {
  const unis = new Set<string>();
  for (const p of profiles) {
    if (p.university) {
      unis.add(p.university);
    }
  }
  return Array.from(unis).sort();
}

/**
 * Computes profile count per industry category.
 */
export function getIndustryCounts(profiles: readonly AlumniProfile[]): Record<string, number> {
  const counts: Record<string, number> = {
    all: profiles.length,
  };
  for (const cat of INDUSTRY_CATEGORIES) {
    counts[cat] = 0;
  }
  for (const p of profiles) {
    if (counts[p.industry] !== undefined) {
      counts[p.industry] = (counts[p.industry] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Strict Zero Youth PII validator: Verifies that public directory profiles
 * strictly contain adult alumni with safe attributes and no youth contact PII.
 */
export function validateZeroYouthPii(profiles: readonly AlumniProfile[]): boolean {
  for (const p of profiles) {
    if (p.isAdultAlum !== true) return false;
    // Strip avatar URL which may legitimately contain safe api hostnames
    const { avatar: _avatar, ...rest } = p;
    const rawString = JSON.stringify(rest);
    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(rawString)) {
      return false;
    }
    if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(rawString)) {
      return false;
    }
  }
  return true;
}

