import { Tournament, TournamentMatch } from "@/types/tournament";

export const MOCK_TOURNAMENTS: Record<string, Tournament> = {
  "world-championship-2026": {
    id: "world-championship-2026",
    name: "FIRST® World Championship 2026",
    date: "2026-04-29",
    location: "Houston, TX",
    description: "The global gathering of top-tier *FIRST*® Tech Challenge teams. ARES competed in the Edison division, showcasing our autonomous EKF calibration and high-speed climbing subsystems.",
    status: "past",
    opr: 210.5,
    oprList: [
      { teamNumber: "23247", teamName: "ARES", opr: 210.5 },
      { teamNumber: "11111", teamName: "Texas Titans", opr: 205.2 },
      { teamNumber: "22222", teamName: "Silicon Solvers", opr: 198.7 },
      { teamNumber: "54321", teamName: "RoboRunners", opr: 172.4 },
      { teamNumber: "88888", teamName: "Steel City Tech", opr: 165.1 }
    ],
    scoutingDetails: {
      autoPathNotes: "Synchronized paths with alliance partner. Added adaptive path readjustment via LiDAR scanner.",
      driverFeedback: "Hanging hook engaged in under 1.8 seconds. Drivetrain kS feedforward deadband compensation worked flawlessly.",
      robotSpecs: "Mecanums, carbon-fiber climbing arm, Pinpoint odometry, dual-camera vision."
    },
    photoAlbumId: "houston-2026",
    isDeleted: 0
  },
  "wv-state-championship-2026": {
    id: "wv-state-championship-2026",
    name: "WV State Championship 2026",
    date: "2026-03-14",
    location: "Fairmont, WV",
    description: "The premier FTC state championship tournament in West Virginia. Team ARES competed with our 2025-2026 robot, engineering pathing trajectories with kS feedforward calibration and advanced vision pipelines.",
    status: "past",
    opr: 185.4,
    oprList: [
      { teamNumber: "23247", teamName: "ARES", opr: 185.4 },
      { teamNumber: "12345", teamName: "Morgantown Gears", opr: 142.1 },
      { teamNumber: "99999", teamName: "WV Techs", opr: 120.3 }
    ],
    scoutingDetails: {
      autoPathNotes: "Near-perfect 5-sample auto pathing. Calibrated Pinpoint Odometry error to under 0.2 inches.",
      driverFeedback: "Smooth climbing, slight drag on the hanging hook. Fixed in post-match hardware check.",
      robotSpecs: "Mecanums, 4-stage viper slide, custom active intake, high-accuracy shooter."
    },
    photoAlbumId: "wv-state-2026",
    isDeleted: 0
  },
  "morgantown-regional-2026": {
    id: "morgantown-regional-2026",
    name: "Morgantown Regional Qualifier",
    date: "2026-01-24",
    location: "Morgantown, WV",
    description: "Local regional qualifying event hosting 24 regional teams. ARES served as alliance captains, demonstrating robust autonomous reliability and defensive blockades.",
    status: "past",
    opr: 168.2,
    oprList: [
      { teamNumber: "23247", teamName: "ARES", opr: 168.2 },
      { teamNumber: "54321", teamName: "RoboRunners", opr: 130.5 },
      { teamNumber: "88888", teamName: "Steel City Tech", opr: 110.4 }
    ],
    scoutingDetails: {
      autoPathNotes: "Consistent 4-sample auto. Avoided partner collisions by implementing a selectable delay path.",
      driverFeedback: "Excellent drivetrain response. Intake speed increased by 15% after motor gear adjustments.",
      robotSpecs: "Mecanums, 3-stage slide, active intake."
    },
    photoAlbumId: "morgantown-regional-2026",
    isDeleted: 0
  },
  "wv-warmup-scrimmage-2026": {
    id: "wv-warmup-scrimmage-2026",
    name: "WV Offseason Warmup Scrimmage",
    date: "2026-10-17",
    location: "Charleston, WV",
    description: "An offseason friendly match to test experimental path planners, telemetry suites, and train rookie drivers for the new FTC season tasks.",
    status: "upcoming",
    opr: 0,
    oprList: [],
    scoutingDetails: {
      autoPathNotes: "Testing new path planning models.",
      driverFeedback: "Training rookie drivers on field orientation controls.",
      robotSpecs: "Experimental chassis."
    },
    photoAlbumId: "scrimmage-2026",
    isDeleted: 0
  }
};

export const getMockMatchesForTournament = (tournamentId: string): TournamentMatch[] => {
  if (tournamentId === "world-championship-2026") {
    return [
      { id: "wc-q1", tournamentId, matchNumber: "QM4", alliance: "red", partner: "14210", opponents: ["11111", "18214"], scoreSelf: 220, scoreOpponent: 195, result: "won", completed: true, isDeleted: 0, notes: "EKF calibrated flawlessly. Perfect 5-sample auto." },
      { id: "wc-q2", tournamentId, matchNumber: "QM18", alliance: "blue", partner: "22222", opponents: ["10341", "12542"], scoreSelf: 215, scoreOpponent: 230, result: "lost", completed: true, isDeleted: 0, notes: "Partner slid into our path during auto, causing path slip. Climb successful." },
      { id: "wc-q3", tournamentId, matchNumber: "QM32", alliance: "red", partner: "16321", opponents: ["15243", "11111"], scoreSelf: 240, scoreOpponent: 180, result: "won", completed: true, isDeleted: 0, notes: "Double hang completed. Opponent defense was heavy but drivetrain overcame kS barriers." },
      { id: "wc-q4", tournamentId, matchNumber: "QM48", alliance: "blue", partner: "19875", opponents: ["14321", "20199"], scoreSelf: 195, scoreOpponent: 195, result: "tie", completed: true, isDeleted: 0, notes: "Both teams double-hung. Tight match." },
      { id: "wc-sf1", tournamentId, matchNumber: "SF1-1", alliance: "red", partner: "22222", opponents: ["11111", "20522"], scoreSelf: 250, scoreOpponent: 240, result: "won", completed: true, isDeleted: 0, notes: "Edison Division Semi-Finals. High tension." },
      { id: "wc-sf2", tournamentId, matchNumber: "SF1-2", alliance: "red", partner: "22222", opponents: ["11111", "20522"], scoreSelf: 265, scoreOpponent: 235, result: "won", completed: true, isDeleted: 0, notes: "Division finals ticket secured!" },
      { id: "wc-f1", tournamentId, matchNumber: "F1", alliance: "blue", partner: "22222", opponents: ["19875", "18214"], scoreSelf: 240, scoreOpponent: 260, result: "lost", completed: true, isDeleted: 0, notes: "Faced world record holders. Exceptional defense." }
    ];
  }
  if (tournamentId === "wv-state-championship-2026") {
    return [
      { id: "wv-q1", tournamentId, matchNumber: "QM2", alliance: "red", partner: "12345", opponents: ["99999", "18111"], scoreSelf: 190, scoreOpponent: 140, result: "won", completed: true, isDeleted: 0, notes: "ARES carried autonomous points. Intake sprocket pivot speed tuned." },
      { id: "wv-q2", tournamentId, matchNumber: "QM12", alliance: "blue", partner: "54321", opponents: ["88888", "16543"], scoreSelf: 185, scoreOpponent: 150, result: "won", completed: true, isDeleted: 0, notes: "Climb was successful. Driver feedback: slide friction low." },
      { id: "wv-sf1", tournamentId, matchNumber: "SF1-1", alliance: "red", partner: "12345", opponents: ["99999", "88888"], scoreSelf: 210, scoreOpponent: 180, result: "won", completed: true, isDeleted: 0, notes: "State Semis match 1." },
      { id: "wv-f1", tournamentId, matchNumber: "F1", alliance: "red", partner: "12345", opponents: ["99999", "88888"], scoreSelf: 225, scoreOpponent: 210, result: "won", completed: true, isDeleted: 0, notes: "State Finals. Secured championship title!" }
    ];
  }
  return [
    { id: "scrim-m1", tournamentId, matchNumber: "QM1", alliance: "red", partner: "TBD", opponents: ["TBD", "TBD"], result: "upcoming", completed: false, isDeleted: 0 },
    { id: "scrim-m2", tournamentId, matchNumber: "QM2", alliance: "blue", partner: "TBD", opponents: ["TBD", "TBD"], result: "upcoming", completed: false, isDeleted: 0 }
  ];
};

export const MOCK_PHOTOS_BY_ALBUM: Record<string, { src: string; caption: string }[]> = {
  "houston-2026": [
    { src: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80", caption: "EKF Calibration adjustments in pits before World Qualifiers." },
    { src: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80", caption: "Lead drivers reviewing match logs on the analytics monitor." },
    { src: "https://images.unsplash.com/photo-1561557944-6e7860d1a7eb?w=800&auto=format&fit=crop&q=80", caption: "Final climbing hook tension tuning at the practice field." },
    { src: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=80", caption: "Scouts mapping rival auto paths from the grandstands." }
  ],
  "wv-state-2026": [
    { src: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&auto=format&fit=crop&q=80", caption: "Drive team queuing up for the Fairmont WV State Finals." },
    { src: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop&q=80", caption: "Re-calibrating slide motor coefficients after match 3." },
    { src: "https://images.unsplash.com/photo-1517420712361-2e6d99c4b7ec?w=800&auto=format&fit=crop&q=80", caption: "Team ARES posing with the WV State Championship Trophy." }
  ],
  "morgantown-regional-2026": [
    { src: "https://images.unsplash.com/photo-1563770660941-20978e870e26?w=800&auto=format&fit=crop&q=80", caption: "Alliance selection briefing inside the MARS facilities." },
    { src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80", caption: "Driver practice runs focusing on fast submersible intakes." }
  ]
};
