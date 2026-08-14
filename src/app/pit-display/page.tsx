"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useQuery } from "@tanstack/react-query";
import SEO from "@/components/SEO";
import { fetchTournaments } from "@/lib/tournamentApi";
import { logger } from "@/utils/logger";
import {
  CheckCircle2,
  Circle,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Printer,
  RefreshCw,
  Wifi,
  WifiOff,
  Radio,
  Target,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  Edit3,
  X,
  BatteryCharging,
  Award,
  RotateCcw,
} from "lucide-react";

// ==========================================
// TYPES & DATA CONTRACTS
// ==========================================

export type AnnouncementPriority = "urgent" | "warning" | "info" | "success";

export interface PitAnnouncement {
  id: string;
  message: string;
  priority: AnnouncementPriority;
  timestamp: string;
}

export interface PreMatchCheckItem {
  id: string;
  label: string;
  category: "power" | "mechanical" | "software" | "inspection";
  description: string;
  checked: boolean;
}

export interface KioskTeamInfo {
  number: string;
  name: string;
  opr: number;
  role: string;
  strengths?: string[];
}

export interface KioskMatchItem {
  id: string;
  matchNumber: string;
  scheduledTime: string;
  estimatedMinutesAway: number;
  field: string;
  alliance: "red" | "blue";
  partner: KioskTeamInfo;
  opponents: [KioskTeamInfo, KioskTeamInfo];
  status: "upcoming" | "on_deck" | "in_queue" | "live" | "completed";
  completed?: boolean;
  result?: "won" | "lost" | "tie";
  scoreSelf?: number;
  scoreOpponent?: number;
  predictedScoreSelf?: number;
  predictedScoreOpponent?: number;
  winProbability?: number;
  strategyNotes?: string;
}

export interface SponsorItem {
  name: string;
  tier: "Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind";
  tagline: string;
  logoText: string;
  accentColor: string;
}

// ==========================================
// DEFAULT FALLBACK DATA (Offline Resilience)
// ==========================================

const DEFAULT_ANNOUNCEMENTS: PitAnnouncement[] = [
  {
    id: "ann-1",
    message: "MATCH QUEUE ALERT: QM7 calling to Queuing Area Field Alpha in 10 minutes. Check battery & intake!",
    priority: "urgent",
    timestamp: "14:20 EST",
  },
  {
    id: "ann-2",
    message: "JUDGING UPDATE: Design & Innovate Award judges visiting pit booth at 15:15 EST.",
    priority: "warning",
    timestamp: "13:45 EST",
  },
  {
    id: "ann-3",
    message: "BATTERY STATUS: Battery Bank #3 fully charged (13.4V). Battery #2 cooling on rack.",
    priority: "info",
    timestamp: "14:05 EST",
  },
];

const INITIAL_CHECKLIST: PreMatchCheckItem[] = [
  {
    id: "chk-bat",
    label: "Battery Voltage >= 13.0V & Locked",
    category: "power",
    description: "Verify main 12V Slim Battery reads >=13.0V under load, strapped securely with velcro lock.",
    checked: true,
  },
  {
    id: "chk-intake",
    label: "Intake Rollers & Slide Belts Clean",
    category: "mechanical",
    description: "Inspect compliant wheels, clear field debris, verify timing belts and surgical tubing tension.",
    checked: true,
  },
  {
    id: "chk-auto",
    label: "Autonomous Routine Configured",
    category: "software",
    description: "Driver Station OpMode set to Auto_5Sample_HighBasket and robot aligned to right tape tile marker.",
    checked: true,
  },
  {
    id: "chk-vision",
    label: "Vision Pipeline & AprilTags Verified",
    category: "software",
    description: "Limelight / Webcam AprilTag 3D camera pose calibrated, 60fps stream confirmed without dropped frames.",
    checked: true,
  },
  {
    id: "chk-pads",
    label: "Gamepads 1 & 2 Latency Tested",
    category: "software",
    description: "Start+A (Driver 1) and Start+B (Driver 2) verified. DS Wi-Fi ping <15ms with 0% packet loss.",
    checked: false,
  },
  {
    id: "chk-alliance",
    label: "Alliance Markers & Bumpers Verified",
    category: "inspection",
    description: "Confirm correct Red/Blue alliance marker attached and locked to robot chassis.",
    checked: false,
  },
  {
    id: "chk-power",
    label: "Main Power Switch On & Solid LED",
    category: "power",
    description: "REV Control Hub & Expansion Hub showing solid green/blue status LEDs without blink error codes.",
    checked: false,
  },
];

const FALLBACK_MATCHES: KioskMatchItem[] = [
  {
    id: "m-qm1",
    matchNumber: "QM 1",
    scheduledTime: "10:30 EST",
    estimatedMinutesAway: -210,
    field: "Field Alpha",
    alliance: "red",
    partner: {
      number: "18225",
      name: "High Voltage Robotics",
      opr: 41.5,
      role: "Submersible Sweeper",
      strengths: ["Fast intake", "High hang"],
    },
    opponents: [
      { number: "8645", name: "RoboDragons", opr: 38.0, role: "Specimen Scorer" },
      { number: "12480", name: "Gears of War", opr: 32.2, role: "Basket Cycling" },
    ],
    status: "completed",
    completed: true,
    result: "won",
    scoreSelf: 168,
    scoreOpponent: 122,
    predictedScoreSelf: 160,
    predictedScoreOpponent: 125,
    winProbability: 74,
    strategyNotes: "Executed 4-Sample Auto cleanly; partner controlled submersible zone during endgame.",
  },
  {
    id: "m-qm4",
    matchNumber: "QM 4",
    scheduledTime: "12:15 EST",
    estimatedMinutesAway: -105,
    field: "Field Beta",
    alliance: "blue",
    partner: {
      number: "11051",
      name: "Apex Cybernetics",
      opr: 44.0,
      role: "High Basket Specialist",
      strengths: ["Precise arm", "Reliable auto"],
    },
    opponents: [
      { number: "5400", name: "Steel City Tech", opr: 40.1, role: "Specimen Cycling" },
      { number: "9120", name: "Vortex Engineers", opr: 36.8, role: "Defense / Submersible" },
    ],
    status: "completed",
    completed: true,
    result: "won",
    scoreSelf: 184,
    scoreOpponent: 145,
    predictedScoreSelf: 175,
    predictedScoreOpponent: 140,
    winProbability: 78,
    strategyNotes: "Match high score 184 pts. Perfect 5-sample auto + level 3 ascent hang.",
  },
  {
    id: "m-qm7",
    matchNumber: "QM 7",
    scheduledTime: "14:30 EST",
    estimatedMinutesAway: 10,
    field: "Field Alpha",
    alliance: "red",
    partner: {
      number: "14220",
      name: "CyberKnights",
      opr: 45.2,
      role: "Submersible Specimen Scorer",
      strengths: ["Rapid clip score", "Level 2 hang"],
    },
    opponents: [
      {
        number: "9921",
        name: "TechnoTitans",
        opr: 48.0,
        role: "High Basket Specialist",
        strengths: ["Fast 5-sample auto", "High cycle rate"],
      },
      {
        number: "16723",
        name: "RoboPulse",
        opr: 39.5,
        role: "Sample Cycler",
        strengths: ["Defensive wall", "Level 1 hang"],
      },
    ],
    status: "on_deck",
    completed: false,
    predictedScoreSelf: 176,
    predictedScoreOpponent: 154,
    winProbability: 68,
    strategyNotes: "ARES runs Right Auto (High Basket); 14220 starts Left (Specimens). Coordinate intake handover at Submersible at 0:45.",
  },
  {
    id: "m-qm9",
    matchNumber: "QM 9",
    scheduledTime: "15:45 EST",
    estimatedMinutesAway: 85,
    field: "Field Beta",
    alliance: "blue",
    partner: {
      number: "20114",
      name: "OmniDrive Alpha",
      opr: 41.0,
      role: "Basket & Sample Runner",
      strengths: ["Omni mobility", "Clean intake"],
    },
    opponents: [
      { number: "15302", name: "Delta Force", opr: 43.5, role: "Specimen / Hang" },
      { number: "18900", name: "Kinetic Velocity", opr: 35.0, role: "Submersible Support" },
    ],
    status: "upcoming",
    completed: false,
    predictedScoreSelf: 165,
    predictedScoreOpponent: 142,
    winProbability: 71,
    strategyNotes: "Focus on dual basket scoring; establish 20pt auto lead before teleop cycle exchange.",
  },
  {
    id: "m-qm12",
    matchNumber: "QM 12",
    scheduledTime: "17:00 EST",
    estimatedMinutesAway: 160,
    field: "Field Alpha",
    alliance: "red",
    partner: {
      number: "19800",
      name: "Quantum Dynamics",
      opr: 46.8,
      role: "High Basket & Ascent Master",
      strengths: ["Fast Level 3 hang", "Precise wrist"],
    },
    opponents: [
      { number: "7120", name: "Titan Robotics", opr: 42.0, role: "Specimen Runner" },
      { number: "13400", name: "Circuit Breakers", opr: 38.4, role: "Basket Cycler" },
    ],
    status: "upcoming",
    completed: false,
    predictedScoreSelf: 182,
    predictedScoreOpponent: 150,
    winProbability: 82,
    strategyNotes: "Closing qualification match. Target maximum ranking points (RP) with simultaneous Level 3 ascent.",
  },
];

const DEFAULT_SPONSORS: SponsorItem[] = [
  {
    name: "NASA WV Space Grant Consortium",
    tier: "Titanium",
    tagline: "Inspiring youth aerospace and STEM robotics engineering in West Virginia",
    logoText: "NASA WVSGC",
    accentColor: "border-ares-cyan text-ares-cyan bg-ares-cyan/10",
  },
  {
    name: "Morgantown Area Robotics Foundation",
    tier: "Titanium",
    tagline: "Empowering next-generation roboticists and community STEM education",
    logoText: "MARF STEM",
    accentColor: "border-ares-cyan text-ares-cyan bg-ares-cyan/10",
  },
  {
    name: "West Virginia University Robotics",
    tier: "Gold",
    tagline: "World-class engineering mentorship and advanced laboratory facilities",
    logoText: "WVU STATLER",
    accentColor: "border-ares-gold text-ares-gold bg-ares-gold/10",
  },
  {
    name: "PTC & Onshape CAD",
    tier: "Gold",
    tagline: "Cloud-native 3D CAD modeling and digital engineering infrastructure",
    logoText: "ONSHAPE CAD",
    accentColor: "border-ares-gold text-ares-gold bg-ares-gold/10",
  },
  {
    name: "REV Robotics",
    tier: "Silver",
    tagline: "High-performance FTC control hubs, ultra-planetary motors, and sensors",
    logoText: "REV ROBOTICS",
    accentColor: "border-marble text-marble bg-white/10",
  },
  {
    name: "SendCutSend Laser Fabrications",
    tier: "In-Kind",
    tagline: "Precision CNC aluminum custom plates, brackets, and laser-cut chassis",
    logoText: "SENDCUTSEND",
    accentColor: "border-ares-bronze text-ares-bronze bg-ares-bronze/10",
  },
];

const PRESET_ANNOUNCEMENTS = [
  { label: "Queuing in 10 min", text: "MATCH QUEUE CALL: Queuing Area Field Alpha in 10 minutes. Final checks!", priority: "urgent" as const },
  { label: "Battery Swap", text: "BATTERY SWAP: Install fresh Battery #1 (>=13.2V) and lock clamp before queue.", priority: "warning" as const },
  { label: "Judges Arriving", text: "JUDGES VISIT: Judges approaching pit booth for engineering portfolio review.", priority: "warning" as const },
  { label: "Auto Routine Check", text: "STRATEGY CONFIRMATION: Verify Driver Station autonomous routine: 5-Sample High Basket.", priority: "info" as const },
  { label: "Win Celebration", text: "MATCH RESULT: Victory recorded! Reset checklist and log telemetry for next match.", priority: "success" as const },
];

export default function PitKioskDisplayPage() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ambientMode, setAmbientMode] = useState<"standard" | "high-contrast">("standard");
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => new Date().toLocaleTimeString());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pollingInterval] = useState<number>(30); // seconds
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  // Time & Countdown state
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [countdownSeconds, setCountdownSeconds] = useState<number>(600); // 10 minutes default (QM 7)
  const [isCountdownRunning, setIsCountdownRunning] = useState<boolean>(true);

  // Selected Match & Matches List
  const [matches] = useState<KioskMatchItem[]>(FALLBACK_MATCHES);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("m-qm7");

  // Announcements & Checklist state (with local persistence)
  const [announcements, setAnnouncements] = useState<PitAnnouncement[]>(() => {
    try {
      const saved = localStorage.getItem("ares_pit_announcements_v1");
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return DEFAULT_ANNOUNCEMENTS;
  });
  const [activeAnnouncementIdx, setActiveAnnouncementIdx] = useState<number>(0);
  const [customAnnouncementText, setCustomAnnouncementText] = useState("");
  const [customPriority, setCustomPriority] = useState<AnnouncementPriority>("urgent");

  const [checklist, setChecklist] = useState<PreMatchCheckItem[]>(() => {
    try {
      const saved = localStorage.getItem("ares_pit_checklist_v1");
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return INITIAL_CHECKLIST;
  });

  // Rotating Sponsors Showcase state
  const [sponsorIndex, setSponsorIndex] = useState<number>(0);
  const [isSponsorPaused, setIsSponsorPaused] = useState<boolean>(false);
  const [sponsorSpeed] = useState<number>(6); // seconds per slide
  const [sponsorTimerProgress, setSponsorTimerProgress] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // ==========================================
  // REAL-TIME CLOCK & NETWORK LISTENERS
  // ==========================================
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    return () => {
      clearInterval(clockInterval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ==========================================
  // MATCH QUEUE COUNTDOWN TIMER
  // ==========================================
  useEffect(() => {
    if (!isCountdownRunning) return;

    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isCountdownRunning]);

  // ==========================================
  // SPONSOR SHOWCASE AUTO-ROTATION
  // ==========================================
  useEffect(() => {
    if (isSponsorPaused) return;

    const intervalStep = 100; // ms
    const totalSteps = (sponsorSpeed * 1000) / intervalStep;

    const timer = setInterval(() => {
      setSponsorTimerProgress((prev) => {
        const next = prev + 100 / totalSteps;
        if (next >= 100) {
          setSponsorIndex((cur) => (cur + 1) % DEFAULT_SPONSORS.length);
          return 0;
        }
        return next;
      });
    }, intervalStep);

    return () => clearInterval(timer);
  }, [isSponsorPaused, sponsorSpeed]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      logger.error("Fullscreen toggle failed:", err);
      setIsFullscreen((prev) => !prev);
    }
  }, []);

  // ==========================================
  // FULLSCREEN EVENT LISTENER & KEY SHORTCUTS
  // ==========================================
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "f" || e.key === "F") &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        toggleFullscreen();
      }
      if (
        (e.key === "c" || e.key === "C") &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        setAmbientMode((prev) => (prev === "standard" ? "high-contrast" : "standard"));
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleFullscreen]);

  // ==========================================
  // PERSISTENCE EFFECT
  // ==========================================
  useEffect(() => {
    try {
      localStorage.setItem("ares_pit_checklist_v1", JSON.stringify(checklist));
    } catch {
      // Ignore storage errors
    }
  }, [checklist]);

  useEffect(() => {
    try {
      localStorage.setItem("ares_pit_announcements_v1", JSON.stringify(announcements));
    } catch {
      // Ignore storage errors
    }
  }, [announcements]);

  // ==========================================
  // DATA FETCHING & SYNC
  // ==========================================
  const { refetch: refetchTournaments } = useQuery({
    queryKey: ["pitKioskTournaments"],
    queryFn: async () => {
      try {
        const res = await fetchTournaments(10);
        return res ?? [];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
    retry: 1,
  });

  const handleManualSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await refetchTournaments();
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      logger.error("Sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [refetchTournaments]);

  // Polling effect
  useEffect(() => {
    if (pollingInterval <= 0 || !isOnline) return;

    const intervalId = setInterval(() => {
      handleManualSync();
    }, pollingInterval * 1000);

    return () => clearInterval(intervalId);
  }, [pollingInterval, isOnline, handleManualSync]);

  // Selected Match object
  const activeMatch = useMemo(() => {
    return matches.find((m) => m.id === selectedMatchId) || matches[0];
  }, [matches, selectedMatchId]);

  // Checklist Calculations
  const completedChecklistCount = useMemo(() => {
    return checklist.filter((item) => item.checked).length;
  }, [checklist]);

  const checklistPercentage = useMemo(() => {
    return Math.round((completedChecklistCount / checklist.length) * 100);
  }, [completedChecklistCount, checklist.length]);

  const isChecklistComplete = completedChecklistCount === checklist.length;

  const handleToggleCheckItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleCheckAll = () => {
    setChecklist((prev) => prev.map((item) => ({ ...item, checked: true })));
  };

  const handleResetChecklist = () => {
    setChecklist((prev) => prev.map((item) => ({ ...item, checked: false })));
  };

  // Add / Post Announcement
  const handlePostAnnouncement = (msg: string, prio: AnnouncementPriority) => {
    if (!msg.trim()) return;
    const newAnn: PitAnnouncement = {
      id: "ann-" + Date.now(),
      message: msg.trim(),
      priority: prio,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setAnnouncements((prev) => [newAnn, ...prev.slice(0, 4)]);
    setActiveAnnouncementIdx(0);
    setCustomAnnouncementText("");
    setShowAnnouncementModal(false);
  };

  // Print Pit Sheet Trigger
  const handlePrintPitSheet = () => {
    window.print();
  };

  // Format MM:SS
  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  };

  const currentAnnouncement = announcements[activeAnnouncementIdx] || announcements[0];

  // Theme styling helpers
  const isHighContrast = ambientMode === "high-contrast";

  return (
    <div
      ref={containerRef}
      data-testid="pit-kiosk-container"
      className={"min-h-screen transition-colors duration-300 font-sans " + (
        isHighContrast
          ? "bg-black text-white selection:bg-ares-gold selection:text-black border-4 border-ares-gold/80"
          : "bg-obsidian text-marble selection:bg-ares-red selection:text-white"
      ) + (isFullscreen ? " p-4 md:p-6" : " p-3 sm:p-6")}
    >
      <SEO
        title="Competition Pit Kiosk Display"
        description="Interactive competition Pit Kiosk Display for ARES 23247 featuring live match queues, alliance strategy cards, robot pre-match readiness checklist, and team announcements."
      />

      {/* ========================================== */}
      {/* PRINTABLE PIT SHEET VIEW (@media print)    */}
      {/* ========================================== */}
      <div className="hidden print:block text-black bg-white p-6 font-sans">
        <div className="border-b-2 border-black pb-4 mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-wider font-heading">
              ARES 23247 - TOURNAMENT PIT SHEET
            </h1>
            <p className="text-sm font-semibold">
              Event: West Virginia FTC Championship | Morgantown, WV | Date: {new Date().toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase font-bold tracking-widest px-2 py-1 border border-black">
              LIVE PIT DISPATCH
            </span>
            <p className="text-xs mt-1">Printed: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>

        {/* Current Standing & Robot Readiness */}
        <div className="grid grid-cols-3 gap-4 mb-6 border border-black p-3">
          <div>
            <span className="text-xs uppercase font-bold">Team Record</span>
            <p className="text-lg font-black">4 - 1 - 0 (Rank #2)</p>
          </div>
          <div>
            <span className="text-xs uppercase font-bold">Average Match OPR</span>
            <p className="text-lg font-black">68.4 pts (Peak: 184 pts)</p>
          </div>
          <div>
            <span className="text-xs uppercase font-bold">Pre-Flight Readiness</span>
            <p className="text-lg font-black">
              {completedChecklistCount} / {checklist.length} ({checklistPercentage}%)
            </p>
          </div>
        </div>

        {/* Match Schedule Table */}
        <h2 className="text-lg font-black uppercase border-b border-black pb-1 mb-2">
          Match Schedule & Strategic Alliance Brief
        </h2>
        <table className="w-full text-left text-xs border border-black mb-6">
          <thead>
            <tr className="bg-gray-100 border-b border-black">
              <th className="p-2 border-r border-black">Match</th>
              <th className="p-2 border-r border-black">Time</th>
              <th className="p-2 border-r border-black">Field</th>
              <th className="p-2 border-r border-black">Alliance</th>
              <th className="p-2 border-r border-black">Partner</th>
              <th className="p-2 border-r border-black">Opponents</th>
              <th className="p-2 border-r border-black">Win %</th>
              <th className="p-2">Result / Score</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.id} className="border-b border-gray-300">
                <td className="p-2 font-bold border-r border-black">{m.matchNumber}</td>
                <td className="p-2 border-r border-black">{m.scheduledTime}</td>
                <td className="p-2 border-r border-black">{m.field}</td>
                <td className="p-2 font-bold uppercase border-r border-black">
                  {m.alliance === "red" ? "RED" : "BLUE"}
                </td>
                <td className="p-2 border-r border-black font-semibold">
                  {m.partner.number} ({m.partner.name})
                </td>
                <td className="p-2 border-r border-black">
                  {m.opponents.map((o) => o.number + " (" + o.name + ")").join(", ")}
                </td>
                <td className="p-2 border-r border-black font-bold">{m.winProbability || 70}%</td>
                <td className="p-2 font-bold">
                  {m.status === "completed"
                    ? (m.result?.toUpperCase() || "WON") + " (" + m.scoreSelf + " - " + m.scoreOpponent + ")"
                    : "UPCOMING"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pre-Match Robot Inspection Checklist */}
        <h2 className="text-lg font-black uppercase border-b border-black pb-1 mb-2">
          Pre-Match Robot Inspection Verification
        </h2>
        <div className="grid grid-cols-2 gap-2 text-xs mb-6">
          {checklist.map((item) => (
            <div key={item.id} className="border border-black p-2 flex items-start space-x-2">
              <div className="w-4 h-4 border border-black flex items-center justify-center font-bold">
                {item.checked ? "X" : ""}
              </div>
              <div>
                <p className="font-bold">{item.label}</p>
                <p className="text-[10px] text-gray-700">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Emergency Contacts & Battery Management Table */}
        <div className="grid grid-cols-2 gap-4 text-xs border-t border-black pt-4">
          <div>
            <h3 className="font-bold uppercase mb-1">Battery Station Log</h3>
            <p>* Bank #1: 13.4V (In Robot QM7)</p>
            <p>* Bank #2: 13.2V (Charged - Queue Spare)</p>
            <p>* Bank #3: 12.6V (Charging Slot A)</p>
            <p>* Bank #4: 12.3V (Charging Slot B)</p>
          </div>
          <div>
            <h3 className="font-bold uppercase mb-1">Key Pit Roles & Safety</h3>
            <p>* Drive Coach: David (Lead Strategist)</p>
            <p>* Driver 1 (Chassis): Marcus | Driver 2 (Arm): Elena</p>
            <p>* Pit Captain: Jackson | Safety Glasses Mandatory in Pits</p>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* KIOSK INTERACTIVE HEADER / CONTROL BAR     */}
      {/* ========================================== */}
      <header
        role="banner"
        className="print:hidden mb-4 pb-3 border-b border-ares-bronze/30 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded bg-ares-red/20 border border-ares-red flex items-center justify-center text-ares-red font-black text-xl shadow-lg">
            ⚡
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider font-heading text-white">
                ARES 23247 PIT DISPLAY
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded bg-ares-red/20 text-ares-red border border-ares-red/40 animate-pulse">
                LIVE KIOSK
              </span>
            </div>
            <p className="text-xs text-marble/60">
              West Virginia Championship 2026 • Morgantown Field Terminal
            </p>
          </div>
        </div>

        {/* Center Clock & Connection Status */}
        <div className="flex items-center space-x-3 bg-obsidian-surface/60 px-3 py-1.5 rounded-lg border border-ares-bronze/20">
          <div className="text-right">
            <div className="text-sm sm:text-base font-black tracking-widest font-heading text-ares-gold">
              {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
            <div className="text-[10px] text-marble/50 flex items-center justify-end space-x-1">
              <span>Synced {lastSyncTime}</span>
              {isOnline ? (
                <span className="flex items-center text-green-400 font-bold ml-1">
                  <Wifi size={10} className="mr-0.5" /> Online
                </span>
              ) : (
                <span className="flex items-center text-red-400 font-bold ml-1 animate-pulse">
                  <WifiOff size={10} className="mr-0.5" /> Offline
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            title="Refresh Tournament & Match Data"
            aria-label="Refresh tournament data"
            className="p-2 rounded bg-white/5 hover:bg-white/10 text-marble transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={isSyncing ? "animate-spin text-ares-cyan" : ""} />
          </button>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Ambient Mode Toggle */}
          <button
            onClick={() => setAmbientMode((prev) => (prev === "standard" ? "high-contrast" : "standard"))}
            title={"Toggle " + (isHighContrast ? "Standard Dark" : "High-Contrast Pit") + " Mode (Press C)"}
            aria-label={"Toggle " + (isHighContrast ? "Standard Dark" : "High-Contrast Pit") + " Mode"}
            className={"px-2.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all " + (
              isHighContrast
                ? "bg-ares-gold text-black border border-ares-gold shadow-[0_0_12px_rgba(255,215,0,0.5)]"
                : "bg-white/5 hover:bg-white/10 text-marble border border-ares-bronze/30"
            )}
          >
            {isHighContrast ? <Sun size={14} /> : <Moon size={14} />}
            <span className="hidden md:inline">{isHighContrast ? "High Contrast" : "Pit Ambient"}</span>
          </button>

          {/* Print Pit Sheet */}
          <button
            onClick={handlePrintPitSheet}
            title="Print 8.5x11 Competition Pit Reference Sheet"
            aria-label="Print pit sheet"
            className="px-2.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-marble border border-ares-bronze/30 flex items-center space-x-1.5 transition-all"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Print Sheet</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen Kiosk Mode (Press F)"
            aria-label="Toggle Fullscreen"
            className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider bg-ares-red hover:bg-ares-red/80 text-white border border-ares-bronze/40 flex items-center space-x-1.5 transition-all shadow-md active:scale-95"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Fullscreen"}</span>
          </button>
        </div>
      </header>

      {/* ========================================== */}
      {/* OFFLINE / STALE DATA WARNING BANNER        */}
      {/* ========================================== */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="print:hidden mb-4 p-2.5 rounded-lg bg-red-950/80 border-2 border-red-500 text-white text-xs flex items-center justify-between animate-pulse"
        >
          <div className="flex items-center space-x-2">
            <WifiOff size={16} className="text-red-400 shrink-0" />
            <span className="font-bold">
              OFFLINE FALLBACK ACTIVE — Pit display running on cached tournament telemetry & local persistence.
            </span>
          </div>
          <span className="text-[10px] text-red-200 uppercase tracking-widest font-mono">
            Zero-Loss Pit Mode
          </span>
        </div>
      )}

      {/* ========================================== */}
      {/* LIVE PIT BROADCAST ANNOUNCEMENT BANNER     */}
      {/* ========================================== */}
      <section
        aria-label="Pit Announcements"
        className="print:hidden mb-4 p-3 rounded-xl border relative overflow-hidden transition-all bg-gradient-to-r from-obsidian-surface/90 to-obsidian/95 shadow-xl border-ares-bronze/40"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-3 flex-1 min-w-[280px]">
            {/* Priority Indicator Badge */}
            <div
              className={"px-2.5 py-1 rounded text-xs font-black uppercase tracking-wider flex items-center space-x-1 shrink-0 " + (
                currentAnnouncement.priority === "urgent"
                  ? "bg-red-600 text-white animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.7)]"
                  : currentAnnouncement.priority === "warning"
                  ? "bg-ares-gold text-black shadow-[0_0_10px_rgba(255,215,0,0.5)]"
                  : currentAnnouncement.priority === "success"
                  ? "bg-green-600 text-white"
                  : "bg-ares-cyan text-black"
              )}
            >
              <Radio size={12} className="animate-spin" />
              <span>{currentAnnouncement.priority.toUpperCase()}</span>
            </div>

            {/* Announcement Message */}
            <div className="flex-1 overflow-hidden">
              <p
                role="status"
                aria-live="polite"
                className="text-xs sm:text-sm font-semibold tracking-wide text-white truncate"
                title={currentAnnouncement.message}
              >
                {currentAnnouncement.message}
              </p>
              <span className="text-[10px] text-marble/50">
                Broadcasted at {currentAnnouncement.timestamp}
              </span>
            </div>
          </div>

          {/* Announcement Controls */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {announcements.length > 1 && (
              <div className="flex items-center space-x-1 mr-2 text-xs">
                <button
                  onClick={() =>
                    setActiveAnnouncementIdx((prev) =>
                      prev === 0 ? announcements.length - 1 : prev - 1
                    )
                  }
                  title="Previous Announcement"
                  aria-label="Previous announcement"
                  className="p-1 rounded hover:bg-white/10 text-marble/70 hover:text-white"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] font-mono text-marble/60">
                  {activeAnnouncementIdx + 1}/{announcements.length}
                </span>
                <button
                  onClick={() =>
                    setActiveAnnouncementIdx((prev) => (prev + 1) % announcements.length)
                  }
                  title="Next Announcement"
                  aria-label="Next announcement"
                  className="p-1 rounded hover:bg-white/10 text-marble/70 hover:text-white"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            <button
              onClick={() => setShowAnnouncementModal(true)}
              title="Post New Pit Announcement"
              aria-label="Post Announcement"
              className="px-2.5 py-1 rounded bg-ares-red/20 hover:bg-ares-red/40 text-ares-red border border-ares-red/50 text-xs font-bold uppercase tracking-wider flex items-center space-x-1 transition-all"
            >
              <Edit3 size={12} />
              <span>Broadcast</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* MAIN KIOSK GRID (2 Columns Dashboard)      */}
      {/* ========================================== */}
      <main className="print:hidden grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-6">
        {/* ==================================================== */}
        {/* LEFT COLUMN: COUNTDOWN & HERO MATCH STRATEGY (7 Cols) */}
        {/* ==================================================== */}
        <section
          aria-label="Live Match Queue & Alliance Strategy"
          className="lg:col-span-7 space-y-4"
        >
          {/* LIVE COUNTDOWN & QUEUE CARD */}
          <div
            className={"p-5 rounded-2xl border transition-all " + (
              isHighContrast
                ? "bg-black border-2 border-ares-gold shadow-[0_0_20px_rgba(255,215,0,0.3)]"
                : "bg-obsidian-surface/80 border-ares-bronze/30 shadow-2xl backdrop-blur-md"
            )}
          >
            {/* Countdown Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <h2 className="text-xs uppercase font-black tracking-widest font-heading text-ares-gold">
                  NEXT MATCH QUEUE COUNTDOWN
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider bg-ares-red/20 text-ares-red border border-ares-red/40">
                  {activeMatch.matchNumber} • {activeMatch.field}
                </span>
                <span
                  className={"text-xs px-2 py-0.5 rounded font-black uppercase tracking-wider " + (
                    activeMatch.alliance === "red"
                      ? "bg-red-600/30 text-red-400 border border-red-500/50"
                      : "bg-blue-600/30 text-blue-400 border border-blue-500/50"
                  )}
                >
                  {activeMatch.alliance.toUpperCase()} ALLIANCE
                </span>
              </div>
            </div>

            {/* Big Countdown Timer Display */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-black/40 p-4 rounded-xl border border-ares-bronze/20">
              <div className="sm:col-span-6 flex flex-col items-center justify-center text-center">
                <div
                  role="timer"
                  aria-live="polite"
                  aria-label={"Countdown to match queue: " + formatCountdown(countdownSeconds)}
                  className={"text-5xl sm:text-6xl font-black font-mono tracking-tighter " + (
                    countdownSeconds <= 300
                      ? "text-red-500 animate-pulse"
                      : countdownSeconds <= 600
                      ? "text-ares-gold"
                      : "text-white"
                  )}
                >
                  {formatCountdown(countdownSeconds)}
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-marble/60 mt-1">
                  {countdownSeconds <= 300
                    ? "🚨 RUSH TO QUEUE — ROBOT ON CART"
                    : countdownSeconds <= 600
                    ? "⚠️ PRE-MATCH CHECKS IN PROGRESS"
                    : "⏱️ IN PIT — SYSTEM SERVICING"}
                </p>
              </div>

              <div className="sm:col-span-6 space-y-2 border-t sm:border-t-0 sm:border-l border-ares-bronze/20 pt-3 sm:pt-0 sm:pl-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-marble/60">Estimated Queue Call:</span>
                  <span className="font-bold text-white">{activeMatch.scheduledTime}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-marble/60">Queue Area Status:</span>
                  <span className="font-bold text-ares-gold uppercase tracking-wider">
                    {activeMatch.status.replace("_", " ")}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-marble/60">Readiness Status:</span>
                  <span
                    className={"font-bold " + (
                      isChecklistComplete ? "text-green-400" : "text-ares-red"
                    )}
                  >
                    {isChecklistComplete ? "✓ 100% READY" : "⚠ CHECKS PENDING"}
                  </span>
                </div>

                {/* Quick Timer Controls */}
                <div className="flex items-center space-x-1.5 pt-2">
                  <button
                    onClick={() => setIsCountdownRunning((prev) => !prev)}
                    title={isCountdownRunning ? "Pause Countdown" : "Resume Countdown"}
                    aria-label={isCountdownRunning ? "Pause Countdown" : "Resume Countdown"}
                    className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-xs text-marble border border-ares-bronze/30"
                  >
                    {isCountdownRunning ? <Pause size={12} /> : <Play size={12} />}
                  </button>
                  <button
                    onClick={() => setCountdownSeconds(600)}
                    title="Reset to 10 Minutes"
                    aria-label="Reset Timer to 10 Minutes"
                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] font-bold text-marble border border-ares-bronze/30"
                  >
                    10m
                  </button>
                  <button
                    onClick={() => setCountdownSeconds(300)}
                    title="Reset to 5 Minutes"
                    aria-label="Reset Timer to 5 Minutes"
                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] font-bold text-marble border border-ares-bronze/30"
                  >
                    5m
                  </button>
                  <button
                    onClick={() => setCountdownSeconds((prev) => prev + 60)}
                    title="Add 1 Minute"
                    aria-label="Add 1 Minute"
                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] font-bold text-marble border border-ares-bronze/30"
                  >
                    +1m
                  </button>
                  <button
                    onClick={() => setCountdownSeconds((prev) => Math.max(0, prev - 60))}
                    title="Subtract 1 Minute"
                    aria-label="Subtract 1 Minute"
                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] font-bold text-marble border border-ares-bronze/30"
                  >
                    -1m
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ALLIANCE STRATEGY & SCOUTING HERO CARD */}
          <div
            className={"p-5 rounded-2xl border transition-all " + (
              isHighContrast
                ? "bg-black border-2 border-ares-gold"
                : "bg-obsidian-surface/80 border-ares-bronze/30 shadow-2xl"
            )}
          >
            {/* Match Tab Selector */}
            <div className="flex items-center justify-between border-b border-ares-bronze/20 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider font-heading text-white flex items-center space-x-2">
                  <Target size={16} className="text-ares-red" />
                  <span>ALLIANCE SCOUTING & STRATEGY DECK</span>
                </h3>
                <p className="text-xs text-marble/60">
                  Real-time predicted scoring & tactical assignments
                </p>
              </div>

              {/* Match Schedule Switcher */}
              <div className="flex items-center space-x-1 overflow-x-auto max-w-[240px] sm:max-w-none">
                {matches.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedMatchId(m.id);
                      if (m.estimatedMinutesAway > 0) {
                        setCountdownSeconds(m.estimatedMinutesAway * 60);
                      }
                    }}
                    className={"px-2 py-1 text-[11px] font-black uppercase rounded transition-all shrink-0 " + (
                      selectedMatchId === m.id
                        ? "bg-ares-red text-white shadow-md"
                        : "bg-white/5 hover:bg-white/10 text-marble/60 hover:text-white"
                    )}
                  >
                    {m.matchNumber}
                  </button>
                ))}
              </div>
            </div>

            {/* Match Head-to-Head Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Partner Alliance Box */}
              <div
                className={"p-4 rounded-xl border relative overflow-hidden " + (
                  activeMatch.alliance === "red"
                    ? "bg-red-950/20 border-red-500/40"
                    : "bg-blue-950/20 border-blue-500/40"
                )}
              >
                <div className="flex justify-between items-center mb-2">
                  <span
                    className={"text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded " + (
                      activeMatch.alliance === "red"
                        ? "bg-red-600 text-white"
                        : "bg-blue-600 text-white"
                    )}
                  >
                    OUR ALLIANCE ({activeMatch.alliance.toUpperCase()})
                  </span>
                  <span className="text-xs font-mono font-bold text-ares-gold">
                    Est: {activeMatch.predictedScoreSelf} pts
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Our Team */}
                  <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 flex justify-between items-center">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-sm text-white">23247</span>
                        <span className="text-xs font-bold text-ares-red">ARES</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-ares-gold/20 text-ares-gold font-bold">
                          US
                        </span>
                      </div>
                      <p className="text-[11px] text-marble/70">
                        High Basket Cycle (42.5 OPR) • 100% Autonomous
                      </p>
                    </div>
                    <span className="text-xs font-mono font-black text-green-400">42.5 OPR</span>
                  </div>

                  {/* Alliance Partner */}
                  <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 flex justify-between items-center">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-sm text-white">
                          {activeMatch.partner.number}
                        </span>
                        <span className="text-xs font-bold text-marble">
                          {activeMatch.partner.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-marble/70">
                        {activeMatch.partner.role} • {activeMatch.partner.strengths?.join(", ")}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-black text-ares-cyan">
                      {activeMatch.partner.opr} OPR
                    </span>
                  </div>
                </div>
              </div>

              {/* Opponents Alliance Box */}
              <div
                className={"p-4 rounded-xl border relative overflow-hidden " + (
                  activeMatch.alliance === "red"
                    ? "bg-blue-950/20 border-blue-500/40"
                    : "bg-red-950/20 border-red-500/40"
                )}
              >
                <div className="flex justify-between items-center mb-2">
                  <span
                    className={"text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded " + (
                      activeMatch.alliance === "red"
                        ? "bg-blue-600 text-white"
                        : "bg-red-600 text-white"
                    )}
                  >
                    OPPONENTS ({activeMatch.alliance === "red" ? "BLUE" : "RED"})
                  </span>
                  <span className="text-xs font-mono font-bold text-marble/80">
                    Est: {activeMatch.predictedScoreOpponent} pts
                  </span>
                </div>

                <div className="space-y-3">
                  {activeMatch.opponents.map((opp) => (
                    <div
                      key={opp.number}
                      className="bg-black/40 p-2.5 rounded-lg border border-white/5 flex justify-between items-center"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-sm text-white">{opp.number}</span>
                          <span className="text-xs font-bold text-marble/90">{opp.name}</span>
                        </div>
                        <p className="text-[11px] text-marble/70">
                          {opp.role} • Threat: {opp.opr >= 45 ? "High" : "Moderate"}
                        </p>
                      </div>
                      <span className="text-xs font-mono font-black text-marble/70">
                        {opp.opr} OPR
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Win Probability & Strategic Directive */}
            <div className="bg-black/40 p-3.5 rounded-xl border border-ares-bronze/20 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold uppercase tracking-wider text-marble/70">
                  Predicted Win Probability:
                </span>
                <span className="font-mono font-black text-ares-gold text-sm">
                  {activeMatch.winProbability || 72}% ARES ALLIANCE
                </span>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden flex">
                <div
                  className="bg-gradient-to-r from-ares-red to-ares-gold h-full transition-all duration-500"
                  style={{ width: (activeMatch.winProbability || 72) + "%" }}
                />
                <div
                  className="bg-blue-600 h-full transition-all duration-500"
                  style={{ width: (100 - (activeMatch.winProbability || 72)) + "%" }}
                />
              </div>

              <div className="pt-2 border-t border-white/5">
                <span className="text-[10px] uppercase font-bold text-ares-cyan tracking-wider">
                  TACTICAL PIT DIRECTIVE:
                </span>
                <p className="text-xs text-white/90 italic mt-0.5">
                  "{activeMatch.strategyNotes || "Focus on autonomous consistency and seamless endgame ascent."}"
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* RIGHT COLUMN: PRE-MATCH CHECKLIST & TELEMETRY (5 Cols)*/}
        {/* ==================================================== */}
        <section
          aria-label="Pre-Match Robot Readiness Checklist"
          className="lg:col-span-5 space-y-4"
        >
          {/* ROBOT PRE-MATCH READINESS CHECKLIST */}
          <div
            className={"p-5 rounded-2xl border transition-all " + (
              isHighContrast
                ? "bg-black border-2 border-ares-gold shadow-[0_0_20px_rgba(255,215,0,0.3)]"
                : "bg-obsidian-surface/80 border-ares-bronze/30 shadow-2xl backdrop-blur-md"
            )}
          >
            <div className="flex items-center justify-between border-b border-ares-bronze/20 pb-3 mb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider font-heading text-white flex items-center space-x-2">
                  <CheckCircle2
                    size={16}
                    className={isChecklistComplete ? "text-green-400" : "text-ares-red"}
                  />
                  <span>PRE-MATCH READINESS</span>
                </h3>
                <p className="text-xs text-marble/60">
                  Critical pre-queue inspection protocol
                </p>
              </div>

              {/* Percentage Badge */}
              <div
                className={"px-2.5 py-1 rounded-full text-xs font-black tracking-wider " + (
                  isChecklistComplete
                    ? "bg-green-500/20 text-green-400 border border-green-500/40 animate-pulse"
                    : "bg-ares-gold/20 text-ares-gold border border-ares-gold/40"
                )}
              >
                {completedChecklistCount}/{checklist.length} ({checklistPercentage}%)
              </div>
            </div>

            {/* Checklist Progress Bar */}
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mb-4">
              <div
                className={"h-full transition-all duration-300 " + (
                  isChecklistComplete ? "bg-green-400" : "bg-ares-red"
                )}
                style={{ width: checklistPercentage + "%" }}
              />
            </div>

            {/* Checklist Items */}
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleCheckItem(item.id)}
                  role="checkbox"
                  aria-checked={item.checked}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      handleToggleCheckItem(item.id);
                    }
                  }}
                  className={"p-2.5 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 select-none " + (
                    item.checked
                      ? "bg-green-950/20 border-green-500/40 text-white"
                      : "bg-black/40 hover:bg-black/60 border-white/5 text-marble/80"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {item.checked ? (
                      <CheckCircle2 size={16} className="text-green-400" />
                    ) : (
                      <Circle size={16} className="text-marble/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className={"text-xs font-bold " + (
                          item.checked ? "text-green-300 line-through" : "text-white"
                        )}
                      >
                        {item.label}
                      </span>
                      <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.2 rounded bg-white/5 text-marble/50">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-marble/60 mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Checklist Action Buttons */}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-ares-bronze/20">
              <button
                onClick={handleCheckAll}
                className="px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 text-xs font-bold text-marble border border-ares-bronze/30 transition-all"
              >
                Check All
              </button>
              <button
                onClick={handleResetChecklist}
                className="px-3 py-1.5 rounded bg-ares-red/10 hover:bg-ares-red/20 text-xs font-bold text-ares-red border border-ares-red/30 flex items-center space-x-1 transition-all"
              >
                <RotateCcw size={12} />
                <span>Reset for Next Match</span>
              </button>
            </div>
          </div>

          {/* PIT TELEMETRY & BATTERY BANK HUD */}
          <div
            className={"p-4 rounded-2xl border transition-all " + (
              isHighContrast
                ? "bg-black border-2 border-ares-gold"
                : "bg-obsidian-surface/80 border-ares-bronze/30 shadow-2xl"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-black tracking-wider font-heading text-ares-gold flex items-center space-x-1.5">
                <BatteryCharging size={14} className="text-ares-cyan" />
                <span>BATTERY BANK TELEMETRY</span>
              </span>
              <span className="text-[10px] text-marble/60">4 Slots Active</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-black/40 border border-green-500/30">
                <div className="flex justify-between text-[11px]">
                  <span className="font-bold text-white">Bank #1 (In Robot)</span>
                  <span className="text-green-400 font-mono font-bold">13.4V</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div className="bg-green-400 h-full w-[95%]" />
                </div>
              </div>

              <div className="p-2 rounded-lg bg-black/40 border border-ares-cyan/30">
                <div className="flex justify-between text-[11px]">
                  <span className="font-bold text-white">Bank #2 (Queue Ready)</span>
                  <span className="text-ares-cyan font-mono font-bold">13.2V</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div className="bg-ares-cyan h-full w-[90%]" />
                </div>
              </div>

              <div className="p-2 rounded-lg bg-black/40 border border-ares-gold/30">
                <div className="flex justify-between text-[11px]">
                  <span className="font-bold text-white">Bank #3 (Charging)</span>
                  <span className="text-ares-gold font-mono font-bold">12.6V</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div className="bg-ares-gold h-full w-[65%] animate-pulse" />
                </div>
              </div>

              <div className="p-2 rounded-lg bg-black/40 border border-ares-red/30">
                <div className="flex justify-between text-[11px]">
                  <span className="font-bold text-white">Bank #4 (Cooling)</span>
                  <span className="text-ares-red font-mono font-bold">12.3V</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div className="bg-ares-red h-full w-[45%]" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================== */}
      {/* ROTATING SPONSOR SHOWCASE TICKER           */}
      {/* ========================================== */}
      <footer
        role="contentinfo"
        aria-label="Sponsors Showcase"
        className="print:hidden rounded-2xl border transition-all overflow-hidden bg-obsidian-surface/90 border-ares-bronze/30 shadow-2xl"
        onMouseEnter={() => setIsSponsorPaused(true)}
        onMouseLeave={() => setIsSponsorPaused(false)}
      >
        {/* Ticker Progress Bar */}
        <div className="w-full bg-white/5 h-1">
          <div
            className="bg-ares-red h-full transition-all duration-100 ease-linear"
            style={{ width: sponsorTimerProgress + "%" }}
          />
        </div>

        <div className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-xs uppercase font-black tracking-widest font-heading text-ares-gold flex items-center space-x-1.5">
              <Award size={16} className="text-ares-gold" />
              <span>COMMUNITY PARTNERS & SPONSORS</span>
            </span>
            <span className="text-[10px] text-marble/50 hidden sm:inline">
              Powering ARES 23247 Youth Robotics
            </span>
          </div>

          {/* Active Sponsor Card */}
          <div className="flex-1 flex items-center justify-center min-w-[280px]">
            <div
              key={sponsorIndex}
              role="region"
              aria-live="polite"
              aria-label={"Featured Sponsor: " + DEFAULT_SPONSORS[sponsorIndex].name}
              className="flex items-center space-x-3 animate-fadeIn"
            >
              <div
                className={"px-3 py-1.5 rounded-lg border font-black text-xs uppercase tracking-wider " + DEFAULT_SPONSORS[sponsorIndex].accentColor}
              >
                {DEFAULT_SPONSORS[sponsorIndex].logoText}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-bold text-white">
                    {DEFAULT_SPONSORS[sponsorIndex].name}
                  </h4>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white/10 text-ares-gold">
                    {DEFAULT_SPONSORS[sponsorIndex].tier}
                  </span>
                </div>
                <p className="text-xs text-marble/70">
                  {DEFAULT_SPONSORS[sponsorIndex].tagline}
                </p>
              </div>
            </div>
          </div>

          {/* Carousel Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsSponsorPaused((prev) => !prev)}
              title={isSponsorPaused ? "Resume Sponsor Carousel" : "Pause Sponsor Carousel"}
              aria-label={isSponsorPaused ? "Resume Sponsor Carousel" : "Pause Sponsor Carousel"}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-marble/70 hover:text-white transition-all"
            >
              {isSponsorPaused ? <Play size={14} /> : <Pause size={14} />}
            </button>

            <button
              onClick={() => {
                setSponsorIndex((prev) =>
                  prev === 0 ? DEFAULT_SPONSORS.length - 1 : prev - 1
                );
                setSponsorTimerProgress(0);
              }}
              title="Previous Sponsor"
              aria-label="Previous sponsor"
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-marble/70 hover:text-white transition-all"
            >
              <ChevronLeft size={14} />
            </button>

            {/* Slide Dots */}
            <div className="flex items-center space-x-1">
              {DEFAULT_SPONSORS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSponsorIndex(idx);
                    setSponsorTimerProgress(0);
                  }}
                  aria-label={"Go to sponsor slide " + (idx + 1)}
                  className={"w-2 h-2 rounded-full transition-all " + (
                    sponsorIndex === idx ? "bg-ares-red w-4" : "bg-white/20 hover:bg-white/40"
                  )}
                />
              ))}
            </div>

            <button
              onClick={() => {
                setSponsorIndex((prev) => (prev + 1) % DEFAULT_SPONSORS.length);
                setSponsorTimerProgress(0);
              }}
              title="Next Sponsor"
              aria-label="Next sponsor"
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-marble/70 hover:text-white transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </footer>

      {/* ========================================== */}
      {/* MODAL: BROADCAST ANNOUNCEMENT POSTER       */}
      {/* ========================================== */}
      {showAnnouncementModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Post Pit Announcement"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="bg-obsidian-surface border-2 border-ares-bronze/50 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-marble relative">
            <button
              onClick={() => setShowAnnouncementModal(false)}
              className="absolute top-4 right-4 text-marble/60 hover:text-white"
              aria-label="Close Announcement Dialog"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-black uppercase tracking-wider font-heading text-white flex items-center space-x-2 mb-1">
              <Radio size={18} className="text-ares-red" />
              <span>BROADCAST PIT ANNOUNCEMENT</span>
            </h3>
            <p className="text-xs text-marble/60 mb-4">
              Push real-time alert to kiosk display and team pit monitors.
            </p>

            {/* Quick Presets */}
            <div className="mb-4">
              <label className="text-xs font-bold uppercase text-marble/70 block mb-1.5">
                Quick Presets
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_ANNOUNCEMENTS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCustomAnnouncementText(preset.text);
                      setCustomPriority(preset.priority);
                    }}
                    className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-marble transition-all"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="mb-4">
              <label htmlFor="announcement-input" className="text-xs font-bold uppercase text-marble/70 block mb-1.5">
                Announcement Text
              </label>
              <textarea
                id="announcement-input"
                rows={3}
                value={customAnnouncementText}
                onChange={(e) => setCustomAnnouncementText(e.target.value)}
                placeholder="Enter alert message (e.g., Match queue call in 10 minutes...)"
                className="w-full bg-black/50 border border-ares-bronze/40 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-ares-red"
              />
            </div>

            {/* Priority Selector */}
            <div className="mb-6">
              <label className="text-xs font-bold uppercase text-marble/70 block mb-1.5">
                Priority Level
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(["urgent", "warning", "info", "success"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCustomPriority(p)}
                    className={"py-1.5 text-xs font-black uppercase rounded-lg border transition-all " + (
                      customPriority === p
                        ? p === "urgent"
                          ? "bg-red-600 text-white border-red-500"
                          : p === "warning"
                          ? "bg-ares-gold text-black border-ares-gold"
                          : p === "success"
                          ? "bg-green-600 text-white border-green-500"
                          : "bg-ares-cyan text-black border-ares-cyan"
                        : "bg-white/5 text-marble/60 border-white/10 hover:text-white"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAnnouncementModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-marble"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handlePostAnnouncement(customAnnouncementText, customPriority)}
                disabled={!customAnnouncementText.trim()}
                className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-ares-red hover:bg-ares-red/80 text-white transition-all disabled:opacity-50"
              >
                Broadcast Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
