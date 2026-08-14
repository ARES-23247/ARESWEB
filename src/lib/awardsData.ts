/**
 * ARES 23247 Team Awards and Honors Data Model
 * 
 * Strict Zero-PII Policy:
 * Only verified team achievements, official public judge citations,
 * championship banners, and approved student leadership citations are included.
 * Absolutely no private personal contact data, minors' private information,
 * phone numbers, personal email addresses, or unapproved identifiers are permitted.
 */

export type AwardCategory = "Technical" | "Community" | "Championship";

export type SeasonFilter = "All" | "2025-2026" | "2024-2025" | "2023-2024" | "Legacy Archive";

export type BannerTheme = "gold" | "red" | "cyan" | "purple" | "emerald" | "bronze";

export interface PortfolioSectionRef {
  title: string;
  sectionNumber: string;
  pageRange: string;
  summary: string;
  cadLink?: string;
}

export interface AwardHonor {
  id: string;
  title: string;
  subtitle: string;
  season: "2025-2026" | "2024-2025" | "2023-2024" | "Legacy Archive";
  seasonYearDisplay: string;
  eventName: string;
  eventLocation: string;
  date: string;
  category: AwardCategory;
  bannerTheme: BannerTheme;
  isChampionshipBanner?: boolean;
  placement?: string;
  iconName: "Trophy" | "Award" | "Cpu" | "Sparkles" | "Flame" | "GraduationCap" | "Compass" | "Star";
  judgeCitation: string;
  subsystemHighlights: string[];
  portfolioRef: PortfolioSectionRef;
  leadershipCitation?: string;
  summary: string;
}

export const AWARDS_DATA: AwardHonor[] = [
  {
    id: "wv-state-inspire-2026",
    title: "Inspire Award Winner",
    subtitle: "The Premier FIRST® Tech Challenge Honor",
    season: "2025-2026",
    seasonYearDisplay: "2025 - 2026 INTO THE DEEP",
    eventName: "West Virginia State Championship",
    eventLocation: "Fairmont, WV",
    date: "2026-03-07",
    category: "Championship",
    bannerTheme: "gold",
    isChampionshipBanner: true,
    placement: "1st Place (Winner)",
    iconName: "Trophy",
    judgeCitation:
      "This team embodies the spirit of the FIRST® Tech Challenge in every dimension. Their engineering notebook was praised by judges as an exemplar of iterative mechanical calculation, their modular submersible robot dominated the scoring arena, and their community outreach ignited STEM excitement across twelve rural Appalachian counties.",
    subsystemHighlights: [
      "Dual-linkage submersible specimen acquisition end-effector with continuous servo torque compensation",
      "Kalman-filter state estimator integrating three-wheel optical odometry with dual AprilTag cameras",
      "Comprehensive regional outreach framework impacting over 2,800 youth in underserved communities",
    ],
    portfolioRef: {
      title: "Comprehensive Engineering Journey & Mission Impact",
      sectionNumber: "Section 1",
      pageRange: "pp. 1-15",
      summary: "Documents 18 build sprints, CAD finite element analysis, team culture, and Appalachia STEM initiatives.",
      cadLink: "https://cad.onshape.com/ares23247-intothedeep",
    },
    leadershipCitation: "Team Captains & Engineering Leads",
    summary: "Recognized as the top all-around team embodying engineering rigor, community enablement, and competitive excellence.",
  },
  {
    id: "wv-state-champions-2026",
    title: "Regional Championship Winning Alliance",
    subtitle: "Alliance Captain Tournament Victory",
    season: "2025-2026",
    seasonYearDisplay: "2025 - 2026 INTO THE DEEP",
    eventName: "West Virginia State Championship",
    eventLocation: "Fairmont, WV",
    date: "2026-03-07",
    category: "Championship",
    bannerTheme: "gold",
    isChampionshipBanner: true,
    placement: "Alliance Captain (Winner)",
    iconName: "Flame",
    judgeCitation:
      "In a high-intensity playoff series, the Winning Alliance Captain demonstrated unmatched cycle velocity, strategic alliance coordination, and a fault-tolerant endgame ascent that brought the crowd to its feet.",
    subsystemHighlights: [
      "Rapid-transfer specimen delivery chute achieving sub-1.1 second cycle times",
      "High-torque planetary winch with mechanical ratcheting lock for level 3 submersible ascent",
      "Dynamic driver-assist telemetry visualizer streaming 60fps field telemetry to coach displays",
    ],
    portfolioRef: {
      title: "Game Strategy, Alliance Playbooks, and Telemetry",
      sectionNumber: "Section 3",
      pageRange: "pp. 16-22",
      summary: "Detailed match simulations, autonomous path branching logic, and endgame reliability protocols.",
    },
    leadershipCitation: "Drive Team & Match Strategy Council",
    summary: "Captain of the Winning Alliance securing the regional championship title and World Championship berth.",
  },
  {
    id: "north-central-control-2026",
    title: "Control Award (1st Place)",
    subtitle: "Mastery of Algorithms, Sensors, and Autonomous Logic",
    season: "2025-2026",
    seasonYearDisplay: "2025 - 2026 INTO THE DEEP",
    eventName: "North Central WV Qualifier",
    eventLocation: "Morgantown, WV",
    date: "2026-01-24",
    category: "Technical",
    bannerTheme: "cyan",
    placement: "1st Place",
    iconName: "Cpu",
    judgeCitation:
      "The judges were captivated by this team's sensor fusion architecture. Using custom computer-vision AprilTag triangulation and real-time feedforward PID velocity loops, their autonomous routine moved with robotic grace and repeatable millimeter accuracy.",
    subsystemHighlights: [
      "ARESLib custom adaptive pure pursuit controller with feedforward acceleration profiles",
      "Multi-camera OpenCV pipeline executing on onboard coprocessor with latency under 12ms",
      "Driver automated sample snap-to-grid macro cutting operator cognitive fatigue in eliminations",
    ],
    portfolioRef: {
      title: "Autonomous Architecture & Software Control Theory",
      sectionNumber: "Section 4",
      pageRange: "pp. 23-30",
      summary: "Open-source control algorithms, state machine flowcharts, and empirical closed-loop tuning logs.",
    },
    leadershipCitation: "Software Subsystem Team",
    summary: "Awarded for outstanding programming, innovative sensor integration, and reliable autonomous operation.",
  },
  {
    id: "mountain-state-innovate-2025",
    title: "Innovate Award",
    subtitle: "Celebrates Ingenuity and Creative Engineering Solutions",
    season: "2024-2025",
    seasonYearDisplay: "2024 - 2025 CENTERSTAGE",
    eventName: "Mountain State Championship",
    eventLocation: "Morgantown, WV",
    date: "2025-02-22",
    category: "Technical",
    bannerTheme: "bronze",
    placement: "Winner",
    iconName: "Sparkles",
    judgeCitation:
      "Thinking far outside the box, this team engineered a custom compliant carbon-fiber roller intake that ingested game elements from any orientation without jamming, paired with an elegant modular clip-in mechanism for rapid pit replacement.",
    subsystemHighlights: [
      "Custom topology-optimized compliant intake rollers cast from 40A polyurethane",
      "Modular quick-swap power distribution bracket with magnetic mechanical keying",
      "Dual active airbrake system for instantaneous autonomous braking",
    ],
    portfolioRef: {
      title: "Mechanical Innovation & Rapid Prototyping",
      sectionNumber: "Section 2",
      pageRange: "pp. 10-18",
      summary: "Chronicles 7 intake prototypes, materials testing data, and stress analysis under shock load.",
    },
    leadershipCitation: "Mechanical Design & Fabrication Squad",
    summary: "Recognized for novel mechanical design concepts and elegant problem-solving on the robot chassis.",
  },
  {
    id: "appalachian-design-2025",
    title: "Design Award",
    subtitle: "Industrial Design Elegance and Functional Aesthetics",
    season: "2024-2025",
    seasonYearDisplay: "2024 - 2025 CENTERSTAGE",
    eventName: "Appalachian Regional Qualifier",
    eventLocation: "Bridgeport, WV",
    date: "2025-01-18",
    category: "Technical",
    bannerTheme: "red",
    placement: "Winner",
    iconName: "Compass",
    judgeCitation:
      "From sleek wire-routing channels to precision CNC-machined 6061 billet aluminum sideplates, this robot exemplifies industrial design excellence. Every component served both structural and aerodynamic purposes while remaining exceptionally serviceable.",
    subsystemHighlights: [
      "Monocoque pocketed aluminum chassis plates engineered in Onshape CAD",
      "Integrated internal wire ducting isolating signal CAN bus lines from high-current motor leads",
      "Ultra-low center of mass geometry with inverted battery tray and titanium fastener optimization",
    ],
    portfolioRef: {
      title: "Industrial Design & CAD Methodology",
      sectionNumber: "Section 2.4",
      pageRange: "pp. 19-24",
      summary: "Full CAD bill of materials, engineering tolerance specifications, and serviceability checklists.",
    },
    leadershipCitation: "CAD & Structural Systems Division",
    summary: "Awarded for exceptional aesthetic and functional industrial design, packaging, and maintainability.",
  },
  {
    id: "wv-state-deans-list-2026",
    title: "Dean's List Finalist",
    subtitle: "Prestigious Individual Leadership & Community Exemplar",
    season: "2025-2026",
    seasonYearDisplay: "2025 - 2026 INTO THE DEEP",
    eventName: "West Virginia State Championship",
    eventLocation: "Fairmont, WV",
    date: "2026-03-07",
    category: "Community",
    bannerTheme: "purple",
    placement: "State Finalist (Nominated to World Championship)",
    iconName: "GraduationCap",
    judgeCitation:
      "Recognized for extraordinary student leadership, passion for spreading STEM education to underprivileged youth, and outstanding technical contribution to open-source robotics libraries that elevate teams across the entire state.",
    subsystemHighlights: [
      "Author of ARESLib open-source motion profiling guides adopted by 14 regional FTC teams",
      "Organized free Saturday robotics workshops for rural middle schools in Monongalia and Preston counties",
      "Mentored FIRST® LEGO League Junior teams to state championship qualifying tournaments",
    ],
    portfolioRef: {
      title: "Student Leadership & Mentorship Initiatives",
      sectionNumber: "Section 6",
      pageRange: "pp. 35-40",
      summary: "Impact metrics, student mentorship curriculum, and regional STEM advocacy logs.",
    },
    leadershipCitation: "Lead Student Software Architect & Outreach Coordinator",
    summary: "Prestigious FIRST® recognition honoring student leaders whose technical passion and values inspire the broader community.",
  },
  {
    id: "mountaineer-motivate-2024",
    title: "Motivate Award",
    subtitle: "Spreading the Culture of FIRST and Inspiring Others",
    season: "2023-2024",
    seasonYearDisplay: "2023 - 2024 CENTERSTAGE",
    eventName: "Mountaineer Invitational",
    eventLocation: "Morgantown, WV",
    date: "2024-02-10",
    category: "Community",
    bannerTheme: "emerald",
    placement: "Winner",
    iconName: "Star",
    judgeCitation:
      "This team's spirit was unstoppable! From hosting peer scouting sessions in the pits to sharing spare parts with every competitor in need, they proved that gracious professionalism is the heartbeat of competitive robotics.",
    subsystemHighlights: [
      "Open-pit assistance station providing loaner REV expansion hubs and sensors to rookie teams",
      "Public QR-code interactive robot diagnostics display mounted on pit banner",
      "Student-produced 'How Robotics Works' interactive activity books for young tournament spectators",
    ],
    portfolioRef: {
      title: "Culture, Spirit, and Peer Mentorship",
      sectionNumber: "Section 5",
      pageRange: "pp. 28-34",
      summary: "Peer assistance metrics, public outreach booths, and team community spirit documentation.",
    },
    leadershipCitation: "Outreach & Community Engagement Team",
    summary: "Celebrates the team that represents the essence of the FIRST culture through team building and community advocacy.",
  },
  {
    id: "legacy-connect-2024",
    title: "Connect Award",
    subtitle: "Connecting the Team with Local STEM and Engineering Professionals",
    season: "Legacy Archive",
    seasonYearDisplay: "2023 - 2024 CENTERSTAGE",
    eventName: "Allegheny Regional Showcase",
    eventLocation: "Cumberland, MD",
    date: "2024-01-13",
    category: "Community",
    bannerTheme: "bronze",
    placement: "Winner",
    iconName: "Award",
    judgeCitation:
      "Judges commended this team's proactive outreach to professional engineering firms and university labs. They actively incorporated industry FEA review processes into their robot build lifecycle.",
    subsystemHighlights: [
      "Direct design review panels with West Virginia University robotics research faculty",
      "Industry sponsorship partnerships providing CNC machining access and structural anodizing",
      "Professional engineering career night organized for high school robotics students",
    ],
    portfolioRef: {
      title: "Industry Connection & Professional Engineering Network",
      sectionNumber: "Section 5.2",
      pageRange: "pp. 31-34",
      summary: "Mentorship minutes, industry engineering review feedback, and corporate STEM partnerships.",
    },
    leadershipCitation: "Corporate Relations & Sponsor Relations Squad",
    summary: "Recognizes the team that actively engages the local engineering community and builds professional STEM bridges.",
  },
  {
    id: "legacy-finalist-alliance-2024",
    title: "Championship Finalist Alliance Banner",
    subtitle: "Tournament Finalist Alliance Captain",
    season: "Legacy Archive",
    seasonYearDisplay: "2023 - 2024 CENTERSTAGE",
    eventName: "West Virginia State Championship",
    eventLocation: "Fairmont, WV",
    date: "2024-03-02",
    category: "Championship",
    bannerTheme: "red",
    isChampionshipBanner: true,
    placement: "Finalist Alliance Captain",
    iconName: "Flame",
    judgeCitation:
      "Battling through three intense tie-breaker matches in the semi-finals, this team led their alliance to the Championship Finals with unwavering composure and pinpoint autonomous scoring.",
    subsystemHighlights: [
      "High-speed 2-stage linear slide assembly with constant force spring counterbalancing",
      "Precision tape-measure launcher for endgame drone launch bonus points",
      "Real-time battery voltage compensation algorithm preventing motor brownouts in tie-breakers",
    ],
    portfolioRef: {
      title: "Playoff Match Logs & Technical Post-Mortems",
      sectionNumber: "Section 3.2",
      pageRange: "pp. 20-25",
      summary: "Playoff data telemetry, alliance strategy, and mechanical duty cycle endurance analysis.",
    },
    leadershipCitation: "Drive Team & Tactical Operations",
    summary: "Finalist Alliance Captain at the State Championship, exemplifying championship grit and tactical teamwork.",
  },
];

export function filterAwards(
  awards: AwardHonor[],
  seasonFilter: SeasonFilter,
  categoryFilter: "All" | AwardCategory,
  searchQuery = ""
): AwardHonor[] {
  const query = searchQuery.trim().toLowerCase();

  return awards.filter((award) => {
    if (seasonFilter !== "All" && award.season !== seasonFilter) {
      return false;
    }

    if (categoryFilter !== "All" && award.category !== categoryFilter) {
      return false;
    }

    if (query) {
      const matchTitle = award.title.toLowerCase().includes(query);
      const matchEvent = award.eventName.toLowerCase().includes(query);
      const matchCitation = award.judgeCitation.toLowerCase().includes(query);
      const matchSubsystems = award.subsystemHighlights.some((sub) =>
        sub.toLowerCase().includes(query)
      );
      const matchPlacement = award.placement?.toLowerCase().includes(query);
      const matchSummary = award.summary.toLowerCase().includes(query);
      const matchPortfolio = award.portfolioRef.title.toLowerCase().includes(query);

      if (
        !matchTitle &&
        !matchEvent &&
        !matchCitation &&
        !matchSubsystems &&
        !matchPlacement &&
        !matchSummary &&
        !matchPortfolio
      ) {
        return false;
      }
    }

    return true;
  });
}

export interface TrophyCaseStats {
  totalAwards: number;
  championshipBanners: number;
  technicalAwards: number;
  communityHonors: number;
}

export function getTrophyCaseStats(awards: AwardHonor[]): TrophyCaseStats {
  return {
    totalAwards: awards.length,
    championshipBanners: awards.filter((a) => a.isChampionshipBanner || a.category === "Championship").length,
    technicalAwards: awards.filter((a) => a.category === "Technical").length,
    communityHonors: awards.filter((a) => a.category === "Community").length,
  };
}

export function validateZeroPiiCompliance(awards: AwardHonor[]): boolean {
  const emailRegex = /[a-zA-Z0-9._%+-]+@(?!aresfirst\.org)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;

  for (const award of awards) {
    const combinedText = [
      award.title,
      award.subtitle,
      award.judgeCitation,
      award.leadershipCitation || '',
      award.summary,
      ...award.subsystemHighlights,
      award.portfolioRef.summary,
    ].join(' ');

    if (emailRegex.test(combinedText) || phoneRegex.test(combinedText)) {
      return false;
    }
  }

  return true;
}
