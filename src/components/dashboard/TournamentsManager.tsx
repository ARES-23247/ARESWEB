"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { collection, getDocs, doc, setDoc, updateDoc, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  Trophy, 
  Plus, 
  Pencil, 
  Trash2, 
  Calendar, 
  MapPin, 
  Activity, 
  X, 
  PlusCircle, 
  MinusCircle, 
  CheckCircle,
  Clock,
  ExternalLink,
  ShieldAlert
} from "lucide-react";
import { Tournament } from "@/types/tournament";

export default function TournamentsManager() {
  const queryClient = useQueryClient();
  const { user, authorizedUser, loading: authLoading } = useAuth();
  
  // UI Control states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"upcoming" | "past">("upcoming");
  const [opr, setOpr] = useState("");
  const [photoAlbumId, setPhotoAlbumId] = useState("");
  
  // Scouting details form fields
  const [autoPathNotes, setAutoPathNotes] = useState("");
  const [driverFeedback, setDriverFeedback] = useState("");
  const [robotSpecs, setRobotSpecs] = useState("");

  // OPR List subform state
  const [oprList, setOprList] = useState<{ teamNumber: string; teamName: string; opr: number }[]>([]);
  const [subteamNumber, setSubteamNumber] = useState("");
  const [subteamName, setSubteamName] = useState("");
  const [subteamOpr, setSubteamOpr] = useState("");

  const isAuthorized = useMemo(() => {
    return !!(user && authorizedUser && ["admin", "coach", "mentor"].includes(authorizedUser.role));
  }, [user, authorizedUser]);

  // Query: Fetch all tournaments (excluding deleted)
  const { data: tournaments = [], isLoading: isListLoading } = useQuery<Tournament[]>({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const q = query(
        collection(db, "tournaments"),
        where("isDeleted", "==", 0),
        limit(50)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Tournament[];
      
      // Sort by date descending
      return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    enabled: isAuthorized
  });

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (tournamentData: Partial<Tournament> & { id?: string }) => {
      const isNew = !tournamentData.id;
      const tournamentId = tournamentData.id || `tournament_${Date.now()}`;
      const docRef = doc(db, "tournaments", tournamentId);

      const finalData: Partial<Tournament> = {
        name: tournamentData.name,
        date: tournamentData.date,
        location: tournamentData.location,
        description: tournamentData.description,
        status: tournamentData.status,
        opr: tournamentData.opr || 0,
        photoAlbumId: tournamentData.photoAlbumId || "",
        scoutingDetails: tournamentData.scoutingDetails || {},
        oprList: tournamentData.oprList || [],
        isDeleted: 0,
        updatedAt: new Date().toISOString()
      };

      if (isNew) {
        finalData.createdAt = new Date().toISOString();
        finalData.id = tournamentId;
      }

      await setDoc(docRef, finalData, { merge: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["tournament"] });
      closeForm();
    }
  });

  const softDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const docRef = doc(db, "tournaments", id);
      await updateDoc(docRef, {
        isDeleted: 1,
        updatedAt: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    }
  });

  const handleOpenCreate = () => {
    setEditingTournament(null);
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (t: Tournament) => {
    setEditingTournament(t);
    setName(t.name);
    setDate(t.date);
    setLocation(t.location);
    setDescription(t.description || "");
    setStatus(t.status);
    setOpr(t.opr?.toString() || "");
    setPhotoAlbumId(t.photoAlbumId || "");
    setAutoPathNotes(t.scoutingDetails?.autoPathNotes || "");
    setDriverFeedback(t.scoutingDetails?.driverFeedback || "");
    setRobotSpecs(t.scoutingDetails?.robotSpecs || "");
    setOprList(t.oprList || []);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setDate("");
    setLocation("");
    setDescription("");
    setStatus("upcoming");
    setOpr("");
    setPhotoAlbumId("");
    setAutoPathNotes("");
    setDriverFeedback("");
    setRobotSpecs("");
    setOprList([]);
    setSubteamNumber("");
    setSubteamName("");
    setSubteamOpr("");
  };

  const handleAddOprEntry = () => {
    if (!subteamNumber || !subteamOpr) return;
    const newEntry = {
      teamNumber: subteamNumber,
      teamName: subteamName || `Team ${subteamNumber}`,
      opr: parseFloat(subteamOpr) || 0
    };
    setOprList((prev) => [...prev, newEntry]);
    setSubteamNumber("");
    setSubteamName("");
    setSubteamOpr("");
  };

  const handleRemoveOprEntry = (idx: number) => {
    setOprList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !date || !location) return;

    saveMutation.mutate({
      id: editingTournament?.id,
      name,
      date,
      location,
      description,
      status,
      opr: opr ? parseFloat(opr) : 0,
      photoAlbumId,
      scoutingDetails: {
        autoPathNotes,
        driverFeedback,
        robotSpecs
      },
      oprList
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to soft-delete this tournament? It can still be queried in archiving scopes but will be removed from the main active pages.")) {
      softDeleteMutation.mutate(id);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col justify-center items-center py-20 text-marble/55">
        <div className="w-8 h-8 border-2 border-ares-red/35 border-t-ares-red rounded-full animate-spin mb-4" />
        <span className="text-xs uppercase tracking-widest font-black">Loading administrative states...</span>
      </div>
    );
  }

  // Admin access gate
  if (!isAuthorized) {
    return (
      <div className="p-8 bg-ares-red/5 border border-ares-red/20 rounded-2xl flex flex-col items-center justify-center text-center max-w-md mx-auto my-12">
        <ShieldAlert className="text-ares-red w-12 h-12 mb-4 animate-pulse" />
        <h2 className="text-lg font-bold text-white uppercase mb-2">Unauthorized Terminal Access</h2>
        <p className="text-xs text-marble/60 leading-relaxed">
          Access to write commands on tournament schedules, OPR matrices, and team rosters requires admin, coach, or mentor elevation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-xl font-black uppercase text-white tracking-tight font-heading flex items-center gap-2">
            <Trophy className="text-ares-gold" size={22} />
            Tournaments Log Manager
          </h2>
          <p className="text-xs text-marble/60 mt-1">Add, update, or soft-delete active tournaments and OPR leaderboards.</p>
        </div>

        {!isFormOpen && (
          <button
            onClick={handleOpenCreate}
            className="clipped-button bg-ares-red border border-ares-bronze/40 text-white font-black text-xs tracking-wider uppercase inline-flex items-center gap-2 py-2.5 px-6 self-start cursor-pointer"
          >
            <Plus size={14} /> Add Tournament
          </button>
        )}
      </div>

      {/* Drawer / Edit Form */}
      {isFormOpen && (
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl relative backdrop-blur-sm shadow-2xl">
          <button 
            onClick={closeForm}
            className="absolute top-4 right-4 text-marble/55 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          <h3 className="text-lg font-extrabold uppercase text-ares-gold font-heading mb-6 border-b border-white/5 pb-2">
            {editingTournament ? `Edit Tournament: ${editingTournament.name}` : "Create New Tournament Record"}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Primary Fields */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <label htmlFor="tourney-name" className="block text-xs uppercase font-bold text-marble/70 mb-1.5">Tournament Name *</label>
                  <input
                    id="tourney-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. WV State Championship 2026"
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white placeholder-marble/35 focus:outline-none focus:border-ares-red"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="tourney-date" className="block text-xs uppercase font-bold text-marble/70 mb-1.5">Tournament Date *</label>
                    <input
                      id="tourney-date"
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red"
                    />
                  </div>
                  <div>
                    <label htmlFor="tourney-location" className="block text-xs uppercase font-bold text-marble/70 mb-1.5">Location *</label>
                    <input
                      id="tourney-location"
                      type="text"
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Fairmont, WV"
                      className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white placeholder-marble/35 focus:outline-none focus:border-ares-red"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="tourney-description" className="block text-xs uppercase font-bold text-marble/70 mb-1.5">Description / Overview</label>
                  <textarea
                    id="tourney-description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Summary of ARES participation, robot performance overview, and major achievements..."
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white placeholder-marble/35 focus:outline-none focus:border-ares-red resize-none"
                  />
                </div>
              </div>

              {/* Status and OPR Accents */}
              <div className="space-y-4 bg-black/35 p-4 rounded-xl border border-white/5">
                <div>
                  <label htmlFor="tourney-status" className="block text-xs uppercase font-bold text-marble/70 mb-1.5">Tournament Status</label>
                  <select
                    id="tourney-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "upcoming" | "past")}
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red"
                  >
                    <option value="upcoming" className="bg-obsidian">Upcoming Event</option>
                    <option value="past" className="bg-obsidian">Past Tournament</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="tourney-opr" className="block text-xs uppercase font-bold text-marble/70 mb-1.5">Team OPR (At Event)</label>
                  <input
                    id="tourney-opr"
                    type="number"
                    step="0.1"
                    value={opr}
                    onChange={(e) => setOpr(e.target.value)}
                    placeholder="e.g. 185.4"
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white placeholder-marble/35 focus:outline-none focus:border-ares-red"
                  />
                </div>

                <div>
                  <label htmlFor="tourney-album-id" className="block text-xs uppercase font-bold text-marble/70 mb-1.5">Photo Album ID</label>
                  <input
                    id="tourney-album-id"
                    type="text"
                    value={photoAlbumId}
                    onChange={(e) => setPhotoAlbumId(e.target.value)}
                    placeholder="e.g. wv-state-2026"
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-xs text-white placeholder-marble/35 focus:outline-none focus:border-ares-red"
                  />
                </div>
              </div>

            </div>

            {/* Scouting Details Panel */}
            <div className="bg-black/20 border border-white/5 p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-black uppercase text-ares-gold tracking-widest border-b border-white/5 pb-1">
                Technical Scouting Logs
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="tourney-auto-notes" className="block text-[10px] uppercase font-bold text-marble/60 mb-1">Autonomous Trajectory Notes</label>
                  <textarea
                    id="tourney-auto-notes"
                    rows={3}
                    value={autoPathNotes}
                    onChange={(e) => setAutoPathNotes(e.target.value)}
                    placeholder="Path configurations, sample counters, or error slips..."
                    className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs text-white resize-none focus:outline-none focus:border-ares-red"
                  />
                </div>
                <div>
                  <label htmlFor="tourney-driver-feedback" className="block text-[10px] uppercase font-bold text-marble/60 mb-1">Driver Feedback Logs</label>
                  <textarea
                    id="tourney-driver-feedback"
                    rows={3}
                    value={driverFeedback}
                    onChange={(e) => setDriverFeedback(e.target.value)}
                    placeholder="Subsystem controls, glide responsiveness, or climb timing..."
                    className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs text-white resize-none focus:outline-none focus:border-ares-red"
                  />
                </div>
                <div>
                  <label htmlFor="tourney-robot-specs" className="block text-[10px] uppercase font-bold text-marble/60 mb-1">Robot Subsystem Blueprints</label>
                  <textarea
                    id="tourney-robot-specs"
                    rows={3}
                    value={robotSpecs}
                    onChange={(e) => setRobotSpecs(e.target.value)}
                    placeholder="Chassis specs, slide levels, or active intake configurations..."
                    className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs text-white resize-none focus:outline-none focus:border-ares-red"
                  />
                </div>
              </div>
            </div>

            {/* OPR Leaderboard Editor */}
            <div className="bg-black/20 border border-white/5 p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-black uppercase text-ares-gold tracking-widest border-b border-white/5 pb-1">
                OPR Leaderboard Rankings
              </h4>

              {/* Input row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label htmlFor="tourney-subteam-number" className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Team #</label>
                  <input
                    id="tourney-subteam-number"
                    type="text"
                    value={subteamNumber}
                    onChange={(e) => setSubteamNumber(e.target.value)}
                    placeholder="e.g. 23247"
                    className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label htmlFor="tourney-subteam-name" className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Team Name</label>
                  <input
                    id="tourney-subteam-name"
                    type="text"
                    value={subteamName}
                    onChange={(e) => setSubteamName(e.target.value)}
                    placeholder="e.g. ARES"
                    className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label htmlFor="tourney-subteam-opr" className="block text-[9px] uppercase font-bold text-marble/60 mb-1">OPR Score</label>
                  <input
                    id="tourney-subteam-opr"
                    type="number"
                    step="0.1"
                    value={subteamOpr}
                    onChange={(e) => setSubteamOpr(e.target.value)}
                    placeholder="e.g. 185.4"
                    className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddOprEntry}
                  className="bg-ares-red/10 border border-ares-red/35 text-white hover:bg-ares-red transition-all py-1.5 rounded text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                >
                  <PlusCircle size={14} /> Add Leaderboard Entry
                </button>
              </div>

              {/* Table of current list */}
              {oprList.length > 0 ? (
                <div className="overflow-hidden border border-white/5 rounded-lg bg-black/40">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-white/5 text-marble/50 text-[9px] uppercase tracking-wider font-bold border-b border-white/5">
                        <th className="px-3 py-2">Team Number</th>
                        <th className="px-3 py-2">Team Name</th>
                        <th className="px-3 py-2 text-right">OPR Value</th>
                        <th className="px-3 py-2 text-center w-16">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {oprList.map((entry, idx) => (
                        <tr key={idx} className="text-marble/70">
                          <td className="px-3 py-2 font-mono">#{entry.teamNumber}</td>
                          <td className="px-3 py-2">{entry.teamName}</td>
                          <td className="px-3 py-2 text-right font-bold text-ares-gold">{entry.opr}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveOprEntry(idx)}
                              className="text-marble/40 hover:text-ares-red transition-colors cursor-pointer"
                            >
                              <MinusCircle size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[10px] text-marble/40 italic">No teams registered in the OPR board.</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3 border-t border-white/5 pt-4">
              <button
                type="button"
                onClick={closeForm}
                className="px-5 py-2 text-xs text-marble/60 hover:text-white uppercase font-black tracking-wider cursor-pointer"
              >
                Cancel Changes
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-ares-red hover:bg-ares-red-dark border border-ares-bronze/45 text-white font-black text-xs tracking-wider uppercase px-6 py-2 rounded shadow-lg cursor-pointer"
              >
                {saveMutation.isPending ? "Syncing..." : "Publish Record"}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Active list grid */}
      {isListLoading ? (
        <div className="flex justify-center items-center py-20 text-marble/55">
          <div className="w-6 h-6 border-2 border-ares-red/35 border-t-ares-red rounded-full animate-spin mr-3" />
          <span className="text-xs uppercase tracking-wider">Retrieving Tournaments...</span>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/5">
          <Trophy size={48} className="mx-auto text-marble/25 mb-4 animate-pulse" />
          <h3 className="text-sm font-bold text-white uppercase">No Active Tournaments</h3>
          <p className="text-xs text-marble/50 mt-1">Add your first tournament log using the action button above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tournaments.map((t) => (
            <div 
              key={t.id} 
              className="bg-white/5 border border-white/10 p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-ares-red/30 transition-all duration-300"
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-bold text-white font-heading">{t.name}</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                    t.status === "upcoming" 
                      ? "bg-ares-gold/15 text-ares-gold border border-ares-gold/35" 
                      : "bg-ares-red/15 text-ares-red border border-ares-red/35"
                  }`}>
                    {t.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-marble/55 font-semibold">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={11} />
                    {t.location}
                  </span>
                  {t.opr !== undefined && t.opr > 0 && (
                    <span className="flex items-center gap-1 text-ares-gold font-bold">
                      <Activity size={11} />
                      OPR: {t.opr}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 self-start md:self-auto border-t md:border-t-0 border-white/5 pt-2.5 md:pt-0">
                <Link
                  to={`/tournaments/${t.id}`}
                  target="_blank"
                  className="bg-white/5 border border-white/10 text-marble/70 hover:text-white p-2 rounded transition-colors flex items-center justify-center cursor-pointer"
                  title="View scouting board in new window"
                >
                  <ExternalLink size={14} />
                </Link>
                <button
                  onClick={() => handleOpenEdit(t)}
                  className="bg-white/5 border border-white/10 text-marble/70 hover:text-ares-gold p-2 rounded transition-colors flex items-center justify-center cursor-pointer"
                  title="Edit details"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="bg-white/5 border border-white/10 text-marble/70 hover:text-ares-red p-2 rounded transition-colors flex items-center justify-center cursor-pointer"
                  title="Archive record"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
