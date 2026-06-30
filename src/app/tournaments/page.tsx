"use client";

import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where, limit, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import SEO from "@/components/SEO";
import { GreekMeander } from "@/components/GreekMeander";
import { 
  Trophy, 
  Calendar, 
  MapPin, 
  Activity, 
  TrendingUp, 
  Search, 
  Lock,
  ChevronRight,
  ShieldAlert,
  ArrowRight
} from "lucide-react";
import { Tournament } from "@/types/tournament";

// High-fidelity fallback/mock tournaments list matching ARES brand and history
const MOCK_TOURNAMENTS: Tournament[] = [
  {
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
      { teamNumber: "22222", teamName: "Silicon Solvers", opr: 198.7 }
    ],
    scoutingDetails: {
      autoPathNotes: "Synchronized paths with alliance partner. Added adaptive path readjustment via LiDAR scanner.",
      driverFeedback: "Hanging hook engaged in under 1.8 seconds. Drivetrain kS feedforward deadband compensation worked flawlessly.",
      robotSpecs: "Mecanums, carbon-fiber climbing arm, Pinpoint odometry, dual-camera vision."
    },
    photoAlbumId: "houston-2026",
    isDeleted: 0
  },
  {
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
  {
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
  {
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
];

export default function TournamentsFeedPage() {
  const { user, authorizedUser, loading: authLoading, loginWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "past">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const isAuthorized = useMemo(() => {
    return !!(user && authorizedUser && authorizedUser.role !== "unverified");
  }, [user, authorizedUser]);

  // TanStack Query to fetch tournaments from Firestore
  const { data: tournaments = [], isLoading: dataLoading, error } = useQuery<Tournament[]>({
    queryKey: ["tournaments"],
    queryFn: async () => {
      try {
        const q = query(
          collection(db, "tournaments"),
          where("isDeleted", "==", 0),
          orderBy("date", "desc"),
          limit(50)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          return MOCK_TOURNAMENTS;
        }
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as Tournament[];
        
        return list;
      } catch (err) {
        console.warn("Firestore error reading tournaments, falling back to mock data:", err);
        return MOCK_TOURNAMENTS;
      }
    },
    enabled: isAuthorized // Only fetch if authorized
  });

  // Filtered tournaments based on tab and search query
  const filteredTournaments = useMemo(() => {
    const list = isAuthorized ? tournaments : MOCK_TOURNAMENTS;
    return list.filter((t) => {
      const matchesTab = activeTab === "all" || t.status === activeTab;
      const matchesSearch = 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesTab && matchesSearch;
    });
  }, [tournaments, activeTab, searchQuery, isAuthorized]);

  // Summaries Calculations
  const stats = useMemo(() => {
    const list = isAuthorized ? tournaments : MOCK_TOURNAMENTS;
    const upcomingCount = list.filter((t) => t.status === "upcoming").length;
    const pastCount = list.filter((t) => t.status === "past").length;
    const pastWithOpr = list.filter((t) => t.status === "past" && (t.opr || 0) > 0);
    const avgOpr = pastWithOpr.length 
      ? Math.round((pastWithOpr.reduce((acc, t) => acc + (t.opr || 0), 0) / pastWithOpr.length) * 10) / 10
      : 0;
    const peakOpr = pastWithOpr.length 
      ? Math.max(...pastWithOpr.map((t) => t.opr || 0)) 
      : 0;

    return {
      total: list.length,
      upcoming: upcomingCount,
      past: pastCount,
      avgOpr,
      peakOpr
    };
  }, [tournaments, isAuthorized]);

  // Loader if auth state is initializing
  if (authLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] bg-obsidian text-marble">
        <div className="w-10 h-10 border-4 border-ares-red/35 border-t-ares-red rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest text-ares-gold/85 animate-pulse font-heading">
          Authenticating Terminal...
        </p>
      </div>
    );
  }

  // Lockscreen gate if not authenticated or unauthorized
  if (!isAuthorized) {
    return (
      <div className="w-full min-h-screen bg-obsidian text-marble py-8 flex flex-col justify-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full z-10">
          <GreekMeander variant="thin" opacity="opacity-30" className="w-full" />
        </div>
        <div className="w-full max-w-md mx-auto px-6 z-10">
          <div className="glass-card hero-card p-8 border border-white/10 bg-black/60 shadow-2xl flex flex-col items-center text-center">
            <div className="relative w-20 h-20 bg-ares-red/15 border border-ares-red/45 ares-cut flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(192,0,0,0.2)]">
              <Lock className="text-ares-red w-8 h-8 animate-pulse" />
            </div>
            
            <span className="text-ares-gold font-bold uppercase tracking-[0.4em] text-[10px] font-heading mb-3">
              *FIRST*® Tech Challenge #23247
            </span>
            
            <h2 className="text-2xl font-extrabold text-white uppercase font-heading mb-3 tracking-tighter">
              Scouting & Tournaments Vault
            </h2>
            
            <p className="text-marble/70 text-sm leading-relaxed mb-8 max-w-sm">
              Scouting data, match checklists, and detailed team Offensive Power Ratings (OPRs) are restricted to verified ARES engineering members.
            </p>

            <button
              onClick={loginWithGoogle}
              className="w-full clipped-button bg-ares-red hover:bg-ares-red-dark transition-all text-white font-bold text-sm tracking-wider uppercase inline-flex items-center justify-center gap-3 py-3.5 shadow-xl cursor-pointer"
            >
              Sign In with Google
            </button>

            {user && authorizedUser?.role === "unverified" && (
              <div className="mt-6 p-4 bg-ares-red/10 border border-ares-red/30 rounded-lg flex items-start gap-2.5 text-left">
                <ShieldAlert size={16} className="text-ares-red shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white uppercase">Verification Required</p>
                  <p className="text-[11px] text-marble/60 mt-0.5">Your email ({user.email}) is authenticated, but a coach or administrator must approve your role before you can view team scouting vaults.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO 
        title="Tournaments & Scouting Analytics" 
        description="Scouting logs, robot stats, match schedule checklists, and team OPR trackers from regional to world championship levels." 
      />
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-20">
        
        {/* Breadcrumb Header */}
        <header className="mb-12">
          <div className="inline-flex items-center gap-2 bg-ares-red/10 text-ares-gold border border-ares-bronze/30 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-6">
            <Trophy size={12} className="text-ares-red" />
            <span>ARES 23247 Competition Logs</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight font-heading mb-4 text-white">
            Tournament <span className="text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-ares-gold">Scouting Vault</span>
          </h1>
          <p className="text-sm text-marble/60 max-w-2xl leading-relaxed">
            Access tactical match checklists, custom driver feedback loops, and comparative team analytics. Synthesizing robot telemetry to optimize our autonomous paths.
          </p>
        </header>

        {/* Summary Counter Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10" aria-label="Tournaments Summary Analytics">
          <div className="bg-white/5 border border-white/10 ares-cut p-5 relative overflow-hidden backdrop-blur-sm flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-marble/55">Total Logged</span>
            <span className="text-3xl md:text-4xl font-extrabold text-white mt-2 font-heading">{stats.total}</span>
            <div className="absolute right-3 bottom-3 text-ares-red/15">
              <Trophy size={48} />
            </div>
          </div>
          
          <div className="bg-white/5 border border-white/10 ares-cut p-5 relative overflow-hidden backdrop-blur-sm flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-ares-gold">Upcoming Events</span>
            <span className="text-3xl md:text-4xl font-extrabold text-ares-gold mt-2 font-heading">{stats.upcoming}</span>
            <div className="absolute right-3 bottom-3 text-ares-gold/15">
              <Calendar size={48} />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 ares-cut p-5 relative overflow-hidden backdrop-blur-sm flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-ares-red">Past Tournaments</span>
            <span className="text-3xl md:text-4xl font-extrabold text-ares-red mt-2 font-heading">{stats.past}</span>
            <div className="absolute right-3 bottom-3 text-ares-red/10">
              <Activity size={48} />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 ares-cut p-5 relative overflow-hidden backdrop-blur-sm flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-ares-gold">Peak Team OPR</span>
            <span className="text-3xl md:text-4xl font-extrabold text-white mt-2 font-heading">
              {stats.peakOpr > 0 ? stats.peakOpr : "N/A"}
            </span>
            <div className="absolute right-3 bottom-3 text-ares-gold/10">
              <TrendingUp size={48} />
            </div>
          </div>
        </section>

        {/* Filter and Search Bar */}
        <section className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-white/5 pb-6 mb-10">
          {/* Tabs */}
          <div className="flex gap-2 w-full md:w-auto bg-black/40 p-1 ares-cut-sm border border-white/5">
            {(["all", "upcoming", "past"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 md:flex-none px-5 py-2 text-xs font-black uppercase tracking-wider ares-cut-sm transition-all cursor-pointer ${
                  activeTab === tab
                    ? "bg-ares-red text-white shadow-lg"
                    : "text-marble/60 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" size={16} />
            <input
              type="text"
              placeholder="Search by name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-xs text-white placeholder-marble/45 focus:outline-none focus:border-ares-red transition-all"
            />
          </div>
        </section>

        {/* Tournaments Grid */}
        {dataLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-marble/55">
            <div className="w-8 h-8 border-2 border-ares-red/35 border-t-ares-red rounded-full animate-spin mb-4" />
            <span className="text-xs uppercase tracking-widest font-black">Loading Tournament Data...</span>
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-2xl">
            <Trophy className="mx-auto text-marble/25 mb-4" size={48} />
            <h3 className="text-lg font-bold text-white uppercase">No Tournaments Found</h3>
            <p className="text-xs text-marble/55 mt-1">Refine your search parameters or query filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredTournaments.map((t) => (
              <Link 
                to={`/tournaments/${t.id}`} 
                key={t.id} 
                className="hero-card group bg-white/5 border border-white/10 p-6 flex flex-col justify-between hover:border-ares-red/30 transition-all duration-300"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    {/* Location Badge */}
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] font-bold text-marble/80">
                      <MapPin size={10} className="text-ares-red" />
                      <span>{t.location}</span>
                    </div>
                    {/* Status Badge */}
                    <span className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                      t.status === "upcoming" 
                        ? "bg-ares-gold/20 text-ares-gold border border-ares-gold/30" 
                        : "bg-ares-red/20 text-ares-red border border-ares-red/30"
                    }`}>
                      {t.status}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold uppercase tracking-tight text-white mb-2 group-hover:text-ares-gold transition-colors font-heading">
                    {t.name}
                  </h3>

                  <p className="text-xs text-marble/60 leading-relaxed line-clamp-3 mb-6">
                    {t.description || "No description provided for this competition."}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-1 text-marble/50">
                      <Calendar size={12} />
                      {new Date(t.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </span>
                    {t.status === "past" && (t.opr || 0) > 0 && (
                      <span className="flex items-center gap-1 text-ares-gold">
                        <Activity size={12} />
                        OPR: {t.opr}
                      </span>
                    )}
                  </div>
                  
                  <span className="text-[10px] uppercase font-black tracking-widest text-ares-red group-hover:text-white transition-colors flex items-center gap-1">
                    Scouting Board <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
