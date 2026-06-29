"use client";

import React, { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, getDocs, collection, query, where, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import SEO from "@/components/SEO";
import { GreekMeander } from "@/components/GreekMeander";
import { 
  Trophy, 
  Calendar, 
  MapPin, 
  Activity, 
  ArrowLeft,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Camera,
  Info,
  TrendingUp,
  FileText,
  Bookmark,
  AlertCircle
} from "lucide-react";
import { Tournament, TournamentMatch } from "@/types/tournament";

// Mock Fallbacks
const MOCK_TOURNAMENTS: Record<string, Tournament> = {
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

const getMockMatchesForTournament = (tournamentId: string): TournamentMatch[] => {
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

const MOCK_PHOTOS_BY_ALBUM: Record<string, { src: string; caption: string }[]> = {
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

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user, authorizedUser, loading: authLoading } = useAuth();
  
  // Dialog / Edit states
  const [activeLightboxImage, setActiveLightboxImage] = useState<{ src: string; caption: string } | null>(null);
  const [matchSearchQuery, setMatchSearchQuery] = useState("");
  const [showAddMatchForm, setShowAddMatchForm] = useState(false);
  
  // Inline edit state for match
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  // New match fields
  const [newMatchNumber, setNewMatchNumber] = useState("");
  const [newAlliance, setNewAlliance] = useState<"red" | "blue">("red");
  const [newPartner, setNewPartner] = useState("");
  const [newOpponents, setNewOpponents] = useState("");
  const [newScoreSelf, setNewScoreSelf] = useState("");
  const [newScoreOpponent, setNewScoreOpponent] = useState("");
  const [newResult, setNewResult] = useState<"won" | "lost" | "tie" | "upcoming">("upcoming");
  const [newNotes, setNewNotes] = useState("");

  const isAuthorized = useMemo(() => {
    return !!(user && authorizedUser && authorizedUser.role !== "unverified");
  }, [user, authorizedUser]);

  const canEdit = useMemo(() => {
    return !!(user && authorizedUser && ["admin", "coach", "mentor"].includes(authorizedUser.role));
  }, [user, authorizedUser]);

  // Query: Tournament Details
  const { data: tournament, isLoading: isTournamentLoading } = useQuery<Tournament | null>({
    queryKey: ["tournament", id],
    queryFn: async () => {
      if (!id) return null;
      try {
        const docRef = doc(db, "tournaments", id);
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().isDeleted === 0) {
          return { id: snap.id, ...snap.data() } as Tournament;
        }
        if (MOCK_TOURNAMENTS[id]) {
          return MOCK_TOURNAMENTS[id];
        }
        return null;
      } catch (err) {
        console.warn("Firestore error getting tournament detail, falling back to mock:", err);
        return MOCK_TOURNAMENTS[id] || null;
      }
    },
    enabled: isAuthorized
  });

  // Query: Matches List
  const { data: matches = [], isLoading: isMatchesLoading } = useQuery<TournamentMatch[]>({
    queryKey: ["tournament_matches", id],
    queryFn: async () => {
      if (!id) return [];
      try {
        const q = query(
          collection(db, "tournament_matches"),
          where("tournamentId", "==", id),
          where("isDeleted", "==", 0)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          return getMockMatchesForTournament(id);
        }
        const list = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as TournamentMatch[];
        
        // Sort by match number naturally
        return list.sort((a, b) => a.matchNumber.localeCompare(b.matchNumber, undefined, { numeric: true }));
      } catch (err) {
        console.warn("Firestore error reading matches, falling back to mock matches:", err);
        return getMockMatchesForTournament(id);
      }
    },
    enabled: isAuthorized
  });

  // Query: Album Photos
  const { data: photos = [] } = useQuery<{ src: string; caption: string }[]>({
    queryKey: ["tournament_photos", tournament?.photoAlbumId],
    queryFn: async () => {
      if (!tournament?.photoAlbumId) return [];
      try {
        // Query albums subcollection or imported photos
        const q = query(
          collection(db, "imported_photos"),
          where("albumId", "==", tournament.photoAlbumId),
          where("isDeleted", "==", 0)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          return MOCK_PHOTOS_BY_ALBUM[tournament.photoAlbumId] || [];
        }
        return snap.docs.map((d) => {
          const data = d.data();
          return {
            src: data.url || data.imageUrl || "",
            caption: data.caption || data.title || ""
          };
        }).filter((p) => p.src);
      } catch (err) {
        console.warn("Firestore error fetching album photos, using fallback album:", err);
        return MOCK_PHOTOS_BY_ALBUM[tournament.photoAlbumId] || [];
      }
    },
    enabled: !!tournament?.photoAlbumId
  });

  // Mutation: Toggle Match Completion (inline checkoff)
  const toggleMatchMutation = useMutation({
    mutationFn: async ({ matchId, completed }: { matchId: string; completed: boolean }) => {
      const matchRef = doc(db, "tournament_matches", matchId);
      // Check if match doc exists first to write safely
      const snap = await getDoc(matchRef);
      if (!snap.exists()) {
        // Seed first in DB if writing for a mock match
        const mockItem = matches.find((m) => m.id === matchId);
        if (mockItem) {
          await setDoc(matchRef, {
            ...mockItem,
            completed,
            updatedAt: new Date().toISOString()
          });
          return;
        }
      }
      await updateDoc(matchRef, {
        completed,
        updatedAt: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournament_matches", id] });
    }
  });

  // Mutation: Add Match
  const addMatchMutation = useMutation({
    mutationFn: async (newMatch: Partial<TournamentMatch>) => {
      const newId = `match_${Date.now()}`;
      const matchRef = doc(db, "tournament_matches", newId);
      await setDoc(matchRef, {
        id: newId,
        tournamentId: id,
        matchNumber: newMatch.matchNumber,
        alliance: newMatch.alliance,
        partner: newMatch.partner,
        opponents: newMatch.opponents,
        scoreSelf: newMatch.scoreSelf || 0,
        scoreOpponent: newMatch.scoreOpponent || 0,
        result: newMatch.result || "upcoming",
        completed: newMatch.completed || false,
        notes: newMatch.notes || "",
        isDeleted: 0,
        createdAt: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournament_matches", id] });
      setShowAddMatchForm(false);
      resetNewMatchForm();
    }
  });

  // Mutation: Update Match Scoring
  const updateMatchMutation = useMutation({
    mutationFn: async (updated: Partial<TournamentMatch> & { id: string }) => {
      const matchRef = doc(db, "tournament_matches", updated.id);
      const snap = await getDoc(matchRef);
      if (!snap.exists()) {
        const local = matches.find((m) => m.id === updated.id);
        if (local) {
          await setDoc(matchRef, {
            ...local,
            ...updated,
            updatedAt: new Date().toISOString()
          });
          return;
        }
      }
      await updateDoc(matchRef, {
        ...updated,
        updatedAt: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournament_matches", id] });
      setEditingMatchId(null);
    }
  });

  // Mutation: Delete Match
  const deleteMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const matchRef = doc(db, "tournament_matches", matchId);
      const snap = await getDoc(matchRef);
      if (snap.exists()) {
        await updateDoc(matchRef, {
          isDeleted: 1,
          updatedAt: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournament_matches", id] });
    }
  });

  const resetNewMatchForm = () => {
    setNewMatchNumber("");
    setNewAlliance("red");
    setNewPartner("");
    setNewOpponents("");
    setNewScoreSelf("");
    setNewScoreOpponent("");
    setNewResult("upcoming");
    setNewNotes("");
  };

  const handleAddMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatchNumber) return;
    
    addMatchMutation.mutate({
      matchNumber: newMatchNumber,
      alliance: newAlliance,
      partner: newPartner || "TBD",
      opponents: newOpponents ? newOpponents.split(",").map((s) => s.trim()) : ["TBD", "TBD"],
      scoreSelf: newScoreSelf ? parseInt(newScoreSelf) : 0,
      scoreOpponent: newScoreOpponent ? parseInt(newScoreOpponent) : 0,
      result: newResult,
      completed: newResult !== "upcoming",
      notes: newNotes
    });
  };

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      return m.matchNumber.toLowerCase().includes(matchSearchQuery.toLowerCase()) ||
             m.partner.toLowerCase().includes(matchSearchQuery.toLowerCase()) ||
             m.opponents.some((o) => o.toLowerCase().includes(matchSearchQuery.toLowerCase()));
    });
  }, [matches, matchSearchQuery]);

  // Auth gate
  if (authLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] bg-obsidian text-marble">
        <div className="w-10 h-10 border-4 border-ares-red/35 border-t-ares-red rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest text-ares-gold/85 animate-pulse font-heading">
          Connecting Data Nodes...
        </p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="w-full min-h-screen bg-obsidian text-marble py-8 flex flex-col justify-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full z-10">
          <GreekMeander variant="thin" opacity="opacity-30" className="w-full" />
        </div>
        <div className="w-full max-w-md mx-auto px-6 z-10">
          <div className="glass-card hero-card p-8 border border-white/10 bg-black/60 shadow-2xl flex flex-col items-center text-center">
            <AlertCircle className="text-ares-red w-12 h-12 mb-4 animate-bounce" />
            <h2 className="text-xl font-bold uppercase tracking-tight text-white mb-2">Access Gated</h2>
            <p className="text-xs text-marble/60 mb-6">
              You must log in to view tournament matches, scouting reports, and OPR logs.
            </p>
            <Link to="/tournaments" className="clipped-button bg-ares-red text-white uppercase text-xs w-full py-2">
              Back to Tournaments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isTournamentLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] bg-obsidian text-marble">
        <div className="w-8 h-8 border-2 border-ares-red/35 border-t-ares-red rounded-full animate-spin mb-4" />
        <p className="text-xs uppercase tracking-widest font-black text-marble/60">Fetching Tournament Record...</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="w-full min-h-screen bg-obsidian text-marble py-8 flex items-center justify-center">
        <div className="text-center p-8 hero-card bg-white/5 border border-white/10 max-w-md">
          <Trophy size={48} className="mx-auto text-ares-red mb-4" />
          <h2 className="text-xl font-bold text-white uppercase mb-2">Record Not Found</h2>
          <p className="text-xs text-marble/60 mb-6">The tournament record may have been archived or soft-deleted.</p>
          <Link to="/tournaments" className="clipped-button bg-ares-red text-white uppercase text-xs py-2 px-6">
            Back to List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO 
        title={`${tournament.name} | Scouting & Analytics`} 
        description={`Match results, OPR values, and technical scouting logs for ARES at the ${tournament.name}.`} 
      />
      
      <div className="w-full max-w-7xl mx-auto px-6 py-12">
        {/* Back Button */}
        <Link to="/tournaments" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-marble/60 hover:text-ares-gold transition-colors mb-8 group">
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Back to scouting list
        </Link>

        {/* Hero Header */}
        <header className="border border-white/10 bg-black/45 p-8 rounded-2xl mb-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full">
            <GreekMeander variant="thin" opacity="opacity-20" className="w-full" />
          </div>
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                  tournament.status === "upcoming" 
                    ? "bg-ares-gold/20 text-ares-gold border border-ares-gold/30" 
                    : "bg-ares-red/20 text-ares-red border border-ares-red/30"
                }`}>
                  {tournament.status}
                </span>
                <span className="text-xs text-marble/55 flex items-center gap-1 font-semibold">
                  <Calendar size={12} />
                  {new Date(tournament.date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric"
                  })}
                </span>
                <span className="text-xs text-marble/55 flex items-center gap-1 font-semibold">
                  <MapPin size={12} className="text-ares-red" />
                  {tournament.location}
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white font-heading mb-4">
                {tournament.name}
              </h1>
              <p className="text-sm text-marble/70 leading-relaxed max-w-3xl">
                {tournament.description}
              </p>
            </div>

            {tournament.status === "past" && (tournament.opr || 0) > 0 && (
              <div className="bg-white/5 border border-white/10 p-5 rounded-xl flex flex-col items-center justify-center min-w-[150px] shadow-lg shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-marble/55">Team OPR</span>
                <span className="text-4xl font-extrabold text-ares-gold mt-1 font-heading">{tournament.opr}</span>
                <span className="text-[9px] text-marble/40 uppercase mt-1 tracking-wider font-semibold">Offensive Power</span>
              </div>
            )}
          </div>
        </header>

        {/* Content Tabs / Column Division */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT & CENTER COLUMNS: Matches & Scouting */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Match schedule checklist */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl">
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-tight font-heading flex items-center gap-2">
                    <Bookmark className="text-ares-red" size={18} />
                    Match Checklist
                  </h2>
                  <p className="text-[11px] text-marble/55 mt-0.5">Toggle match completion to track strategy checklists.</p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Filter match..."
                    value={matchSearchQuery}
                    onChange={(e) => setMatchSearchQuery(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded px-2.5 py-1 text-[11px] text-white placeholder-marble/45 focus:outline-none focus:border-ares-red"
                  />
                  {canEdit && (
                    <button
                      onClick={() => setShowAddMatchForm(!showAddMatchForm)}
                      className="bg-ares-red/10 border border-ares-red/35 text-white hover:bg-ares-red hover:text-white transition-colors px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} /> Add Match
                    </button>
                  )}
                </div>
              </div>

              {/* Add Match Inline Form */}
              {showAddMatchForm && (
                <form onSubmit={handleAddMatch} className="bg-black/35 border border-white/10 p-4 rounded-xl mb-6 space-y-3">
                  <h3 className="text-xs font-black uppercase text-ares-gold tracking-widest">New Match Log</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Match Number</label>
                      <input
                        type="text"
                        placeholder="e.g. QM3"
                        required
                        value={newMatchNumber}
                        onChange={(e) => setNewMatchNumber(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Alliance</label>
                      <select
                        value={newAlliance}
                        onChange={(e) => setNewAlliance(e.target.value as "red" | "blue")}
                        className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
                      >
                        <option value="red" className="bg-obsidian">Red Alliance</option>
                        <option value="blue" className="bg-obsidian">Blue Alliance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Partner Team</label>
                      <input
                        type="text"
                        placeholder="e.g. 12345"
                        value={newPartner}
                        onChange={(e) => setNewPartner(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Opponents (comma-sep)</label>
                      <input
                        type="text"
                        placeholder="e.g. 99999, 8888"
                        value={newOpponents}
                        onChange={(e) => setNewOpponents(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  {tournament.status === "past" && (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Our Score</label>
                        <input
                          type="number"
                          value={newScoreSelf}
                          onChange={(e) => setNewScoreSelf(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Opponent Score</label>
                        <input
                          type="number"
                          value={newScoreOpponent}
                          onChange={(e) => setNewScoreOpponent(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Result</label>
                        <select
                          value={newResult}
                          onChange={(e) => setNewResult(e.target.value as any)}
                          className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white"
                        >
                          <option value="won" className="bg-obsidian">Won</option>
                          <option value="lost" className="bg-obsidian">Lost</option>
                          <option value="tie" className="bg-obsidian">Tie</option>
                          <option value="upcoming" className="bg-obsidian">Upcoming</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] text-marble/60 uppercase font-bold mb-1">Match Scouting Notes</label>
                    <textarea
                      placeholder="Scouting telemetry, hardware issues, or driver feedback..."
                      rows={2}
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddMatchForm(false)}
                      className="px-4 py-1.5 text-xs text-marble/60 hover:text-white uppercase font-black tracking-wider"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-ares-red border border-ares-bronze/40 text-white px-5 py-1.5 rounded text-xs font-black uppercase tracking-wider cursor-pointer"
                    >
                      Save Match
                    </button>
                  </div>
                </form>
              )}

              {/* Matches List */}
              {isMatchesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-ares-red/35 border-t-ares-red rounded-full animate-spin mr-3" />
                  <span className="text-xs uppercase tracking-wider text-marble/55">Loading matches...</span>
                </div>
              ) : filteredMatches.length === 0 ? (
                <div className="text-center py-10 bg-black/20 border border-dashed border-white/10 rounded-xl">
                  <p className="text-xs text-marble/55">No match records compiled yet.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredMatches.map((m) => {
                    const isRedAlliance = m.alliance === "red";
                    const isUpcoming = m.result === "upcoming";
                    
                    return (
                      <div 
                        key={m.id} 
                        className={`border rounded-xl p-4 transition-all ${
                          m.completed 
                            ? "bg-black/35 border-white/10" 
                            : "bg-white/5 border-ares-bronze/35 shadow-[0_0_10px_rgba(205,127,50,0.05)]"
                        }`}
                      >
                        {editingMatchId === m.id ? (
                          // Edit Score Inline Form
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black uppercase text-ares-gold">Edit Score: {m.matchNumber}</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingMatchId(null)}
                                  className="text-[10px] text-marble/60 uppercase font-black hover:text-white"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-[9px] uppercase font-bold text-marble/50">Our Score</label>
                                <input
                                  type="number"
                                  defaultValue={m.scoreSelf || 0}
                                  id={`edit_self_${m.id}`}
                                  className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] uppercase font-bold text-marble/50">Opponent Score</label>
                                <input
                                  type="number"
                                  defaultValue={m.scoreOpponent || 0}
                                  id={`edit_opp_${m.id}`}
                                  className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] uppercase font-bold text-marble/50">Outcome</label>
                                <select
                                  defaultValue={m.result}
                                  id={`edit_res_${m.id}`}
                                  className="w-full bg-white/5 border border-white/10 rounded p-1 text-xs text-white"
                                >
                                  <option value="won">Won</option>
                                  <option value="lost">Lost</option>
                                  <option value="tie">Tie</option>
                                  <option value="upcoming">Upcoming</option>
                                </select>
                              </div>
                              <div className="flex items-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const selfSc = parseInt((document.getElementById(`edit_self_${m.id}`) as HTMLInputElement)?.value || "0");
                                    const oppSc = parseInt((document.getElementById(`edit_opp_${m.id}`) as HTMLInputElement)?.value || "0");
                                    const resVal = (document.getElementById(`edit_res_${m.id}`) as HTMLSelectElement)?.value as any;
                                    
                                    updateMatchMutation.mutate({
                                      id: m.id,
                                      scoreSelf: selfSc,
                                      scoreOpponent: oppSc,
                                      result: resVal,
                                      completed: resVal !== "upcoming"
                                    });
                                  }}
                                  className="w-full bg-ares-red text-white py-1.5 rounded text-[10px] uppercase font-black tracking-wider cursor-pointer"
                                >
                                  Save Values
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Normal View
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              {/* Checkbox Trigger */}
                              <button
                                onClick={() => toggleMatchMutation.mutate({ matchId: m.id, completed: !m.completed })}
                                className={`w-5 h-5 rounded border flex items-center justify-center transition-all cursor-pointer ${
                                  m.completed 
                                    ? "bg-ares-red border-ares-red text-white" 
                                    : "border-white/20 hover:border-ares-gold bg-black/40 text-transparent"
                                }`}
                                aria-label={`Toggle completion for ${m.matchNumber}`}
                              >
                                <Check size={12} className={m.completed ? "opacity-100" : "opacity-0"} />
                              </button>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-white font-heading">{m.matchNumber}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
                                    isRedAlliance 
                                      ? "bg-ares-red/15 text-ares-red border border-ares-red/35" 
                                      : "bg-blue-500/15 text-blue-400 border border-blue-500/35"
                                  }`}>
                                    {m.alliance} alliance
                                  </span>
                                  {!isUpcoming && (
                                    <span className={`text-[9px] uppercase font-black ${
                                      m.result === "won" ? "text-ares-gold" : m.result === "lost" ? "text-ares-red" : "text-marble/40"
                                    }`}>
                                      {m.result}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-marble/55 mt-1">
                                  Partner: <strong className="text-white">{m.partner}</strong> | Opponents: <strong className="text-white">{m.opponents.join(", ")}</strong>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 border-white/5 pt-2.5 md:pt-0">
                              {/* Score display */}
                              {!isUpcoming && m.scoreSelf !== undefined && (
                                <div className="text-xs font-semibold text-right">
                                  <span className={m.result === "won" ? "text-ares-gold font-bold" : "text-white"}>
                                    {m.scoreSelf}
                                  </span>
                                  <span className="text-marble/30 mx-1">-</span>
                                  <span className="text-marble/50">{m.scoreOpponent}</span>
                                </div>
                              )}

                              {/* Action tools */}
                              {canEdit && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => setEditingMatchId(m.id)}
                                    className="p-1.5 text-marble/50 hover:text-ares-gold hover:bg-white/5 rounded transition-all cursor-pointer"
                                    title="Edit scoring values"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm("Soft-delete this match record?")) {
                                        deleteMatchMutation.mutate(m.id);
                                      }
                                    }}
                                    className="p-1.5 text-marble/50 hover:text-ares-red hover:bg-white/5 rounded transition-all cursor-pointer"
                                    title="Archive match record"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Match notes */}
                        {m.notes && !editingMatchId && (
                          <div className="mt-3.5 pt-2.5 border-t border-white/5 text-[11px] text-marble/60 flex items-start gap-1">
                            <Info size={11} className="text-ares-gold shrink-0 mt-0.5" />
                            <p className="italic leading-relaxed">{m.notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Scouting Details Card */}
            {tournament.scoutingDetails && (
              <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl">
                <h2 className="text-lg font-bold text-white uppercase tracking-tight font-heading flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                  <FileText className="text-ares-gold" size={18} />
                  Robot Scouting Details
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-black/35 p-4 rounded-xl border border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-ares-gold block mb-2">Autonomous Path Notes</span>
                    <p className="text-xs text-marble/70 leading-relaxed">
                      {tournament.scoutingDetails.autoPathNotes || "No autonomous parameters logged."}
                    </p>
                  </div>
                  
                  <div className="bg-black/35 p-4 rounded-xl border border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-ares-red block mb-2">Driver Feedback</span>
                    <p className="text-xs text-marble/70 leading-relaxed">
                      {tournament.scoutingDetails.driverFeedback || "No driver notes logged."}
                    </p>
                  </div>

                  <div className="bg-black/35 p-4 rounded-xl border border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-marble/55 block mb-2">Robot Blueprint Specs</span>
                    <p className="text-xs text-marble/70 leading-relaxed">
                      {tournament.scoutingDetails.robotSpecs || "No hardware details recorded."}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Photo Albums section */}
            {tournament.photoAlbumId && photos.length > 0 && (
              <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl">
                <h2 className="text-lg font-bold text-white uppercase tracking-tight font-heading flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                  <Camera className="text-ares-red" size={18} />
                  Action Photo Album
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {photos.map((p, idx) => (
                    <div 
                      key={idx}
                      onClick={() => setActiveLightboxImage(p)}
                      className="group cursor-pointer aspect-video relative overflow-hidden border border-white/10 rounded-xl bg-black/60"
                    >
                      <img 
                        src={p.src} 
                        alt={p.caption} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex items-end">
                        <p className="text-[9px] text-white uppercase font-black tracking-wider truncate w-full">
                          {p.caption}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* RIGHT COLUMN: OPR Leaderboard and side analytics */}
          <div className="space-y-8">
            
            {/* OPR Leaderboard Card */}
            {tournament.status === "past" && tournament.oprList && tournament.oprList.length > 0 && (
              <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-heading flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                  <TrendingUp className="text-ares-gold" size={16} />
                  OPR Leaderboard
                </h2>

                <div className="overflow-hidden border border-white/5 rounded-xl bg-black/35">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-white/5 text-marble/50 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
                        <th className="px-4 py-3">Team</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3 text-right">OPR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {tournament.oprList
                        .sort((a, b) => b.opr - a.opr)
                        .map((team, idx) => {
                          const isAres = team.teamNumber === "23247";
                          return (
                            <tr 
                              key={team.teamNumber} 
                              className={`transition-colors ${
                                isAres 
                                  ? "bg-ares-red/10 text-white font-bold" 
                                  : "text-marble/70 hover:bg-white/5"
                              }`}
                            >
                              <td className="px-4 py-3 font-mono">#{team.teamNumber}</td>
                              <td className="px-4 py-3 truncate max-w-[120px]">{team.teamName}</td>
                              <td className={`px-4 py-3 text-right font-bold ${isAres ? "text-ares-gold" : "text-white"}`}>
                                {team.opr}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Quick stats / summary guide */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl text-center space-y-4">
              <h3 className="text-xs font-black uppercase text-ares-gold tracking-widest">Analytics Dashboard</h3>
              <p className="text-xs text-marble/60 leading-relaxed">
                OPRs are automatically computed based on match score differentials and team partner variables using standardized ridge regression matrices.
              </p>
              <div className="p-4 bg-black/40 rounded-xl border border-white/5 text-left">
                <span className="text-[9px] font-black uppercase tracking-wider text-marble/55 block mb-1">Division System Status</span>
                <span className="text-[10px] text-ares-gold font-bold uppercase flex items-center gap-1.5">
                  <Activity size={10} className="text-ares-red animate-pulse" />
                  Telemetry Synced
                </span>
              </div>
            </section>

          </div>

        </div>

      </div>

      {/* Lightbox Image Modal */}
      {activeLightboxImage && (
        <div 
          onClick={() => setActiveLightboxImage(null)}
          className="fixed inset-0 bg-black/90 z-50 flex flex-col justify-center items-center p-6 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[80vh] overflow-hidden rounded-xl border border-white/15 bg-black">
            <img 
              src={activeLightboxImage.src} 
              alt={activeLightboxImage.caption} 
              className="max-w-full max-h-[75vh] object-contain" 
            />
            <button 
              onClick={() => setActiveLightboxImage(null)}
              className="absolute top-3 right-3 bg-black/60 border border-white/20 hover:border-white p-2 rounded-full text-white cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-white text-xs uppercase tracking-widest font-black mt-4 bg-black/60 px-4 py-2 rounded-full border border-white/5 max-w-xl text-center">
            {activeLightboxImage.caption}
          </p>
        </div>
      )}
    </div>
  );
}
