"use client";

import React, { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, getDocs, collection, query, where, updateDoc, setDoc } from "firebase/firestore";
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
  X,
  Camera,
  FileText,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { Tournament, TournamentMatch } from "@/types/tournament";
import { MOCK_TOURNAMENTS, getMockMatchesForTournament, MOCK_PHOTOS_BY_ALBUM } from "./mockData";
import TournamentMatchesList from "./TournamentMatchesList";

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user, authorizedUser, loading: authLoading } = useAuth();
  
  // Dialog / Edit states
  const [activeLightboxImage, setActiveLightboxImage] = useState<{ src: string; caption: string } | null>(null);

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
            <TournamentMatchesList
              tournamentId={id || ""}
              isPast={tournament.status === "past"}
              matches={matches}
              canEdit={canEdit}
              isMatchesLoading={isMatchesLoading}
              onToggleMatch={(matchId, completed) => toggleMatchMutation.mutate({ matchId, completed })}
              onAddMatch={(newMatch) => addMatchMutation.mutate(newMatch)}
              onUpdateMatch={(updated) => updateMatchMutation.mutate(updated)}
              onDeleteMatch={(matchId) => deleteMatchMutation.mutate(matchId)}
            />

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
