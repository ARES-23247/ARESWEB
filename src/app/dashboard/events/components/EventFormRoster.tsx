"use client";

import React, { useState, useEffect, useMemo } from "react";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CheckCircle2, Circle, Trash2 } from "lucide-react";
import { cleanUndefined } from "@/lib/utils";
import { EventSignup } from "./EventEditorDrawer";

interface EventFormRosterProps {
  editId: string;
  signups: EventSignup[];
  isAdmin: boolean;
  formIsPotluck: number;
  formIsVolunteer: number;
  user: any;
  userNickname: string;
  teamMembers: { uid: string; nickname: string; avatar: string; }[];
  displayedMembers: { uid: string; nickname: string; avatar: string; }[];
  setRevertAlert: (msg: string | null) => void;
}

export default function EventFormRoster({
  editId,
  signups,
  isAdmin,
  formIsPotluck,
  formIsVolunteer,
  user,
  userNickname,
  teamMembers,
  displayedMembers,
  setRevertAlert,
}: EventFormRosterProps) {
  // RSVP Form states
  const [bringing, setBringing] = useState("");
  const [notes, setNotes] = useState("");
  const [prepHours, setPrepHours] = useState(0);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [submittingRsvp, setSubmittingRsvp] = useState(false);
  const [selectedMemberIdToCheckin, setSelectedMemberIdToCheckin] = useState("");

  // Find if current user is signed up for active event
  const mySignup = useMemo(() => {
    if (!user) return null;
    return signups.find((s) => s.userId === user.uid) || null;
  }, [signups, user]);

  // Prefill active RSVP details
  useEffect(() => {
    if (mySignup) {
      setBringing(mySignup.bringing || "");
      setNotes(mySignup.notes || "");
      setPrepHours(mySignup.prepHours || 0);
    } else {
      setBringing("");
      setNotes("");
      setPrepHours(0);
    }
  }, [mySignup]);

  // Action: Submit self-RSVP
  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editId) return;
    setSubmittingRsvp(true);
    setSignupError(null);
    try {
      const signupData: EventSignup = {
        userId: user.uid,
        nickname: userNickname || user.displayName || "Anonymous Member",
        bringing: formIsPotluck === 1 ? bringing.trim() : undefined,
        prepHours: formIsVolunteer === 1 ? prepHours : undefined,
        notes: notes.trim() || undefined,
        attended: mySignup?.attended || false,
      };
      await setDoc(doc(db, "events", editId, "signups", user.uid), cleanUndefined(signupData));
      setRevertAlert("RSVP updated successfully!");
    } catch (err: any) {
      setSignupError(err.message || "Failed to save RSVP.");
    } finally {
      setSubmittingRsvp(false);
    }
  };

  // Action: Cancel self-RSVP
  const handleRsvpCancel = async () => {
    if (!user || !editId) return;
    setSubmittingRsvp(true);
    setSignupError(null);
    try {
      await deleteDoc(doc(db, "events", editId, "signups", user.uid));
      setBringing("");
      setNotes("");
      setPrepHours(0);
      setRevertAlert("RSVP cancelled.");
    } catch (err: any) {
      setSignupError(err.message || "Failed to cancel RSVP.");
    } finally {
      setSubmittingRsvp(false);
    }
  };

  // Action: Quick Admin Check-in of another member
  const handleQuickCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !selectedMemberIdToCheckin || !isAdmin) return;
    try {
      const member = teamMembers.find((m) => m.uid === selectedMemberIdToCheckin);
      if (!member) return;

      const checkinData: EventSignup = {
        userId: member.uid,
        nickname: member.nickname,
        notes: "Admin Checked In",
        attended: true,
      };
      await setDoc(doc(db, "events", editId, "signups", member.uid), checkinData, { merge: true });
      setSelectedMemberIdToCheckin("");
      setRevertAlert(`Successfully checked in ${member.nickname}`);
    } catch (err: any) {
      console.error("Failed admin check-in:", err);
    }
  };

  // Action: Toggle Attendance check-in status (Admin only)
  const handleToggleAttendance = async (signupId: string, currentAttendedStatus: boolean) => {
    if (!editId || !isAdmin) return;
    try {
      await setDoc(
        doc(db, "events", editId, "signups", signupId),
        { attended: !currentAttendedStatus },
        { merge: true }
      );
    } catch (err: any) {
      console.error("Failed to toggle attendance:", err);
    }
  };

  // Action: Delete RSVP (Admin only)
  const handleDeleteRsvp = async (targetUserId: string) => {
    if (!editId || !isAdmin) return;
    if (!confirm("Are you sure you want to remove this RSVP?")) return;
    try {
      await deleteDoc(doc(db, "events", editId, "signups", targetUserId));
      setRevertAlert("RSVP removed by admin.");
    } catch (err: any) {
      console.error("Failed to remove RSVP:", err);
    }
  };

  return (
    <div className="flex-grow flex flex-col md:flex-row gap-6 overflow-hidden min-h-0">
      {/* Roster list */}
      <div className="flex-1 bg-black/20 border border-white/5 rounded-xl p-5 overflow-y-auto flex flex-col justify-between scrollbar-thin scrollbar-thumb-white/5 text-left">
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
            Operation Attendance Roster ({signups.length})
          </h4>

          {signups.length === 0 ? (
            <div className="py-12 text-center text-marble/35 font-mono text-[10px] uppercase tracking-wider">
              Roster is currently empty.
            </div>
          ) : (
            <div className="space-y-2 text-left">
              {signups.map((su) => (
                <div
                  key={su.userId}
                  className="p-3 bg-white/5 border border-white/5 rounded-lg flex items-center justify-between gap-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div
                      onClick={() => {
                        if (isAdmin) handleToggleAttendance(su.userId, !!su.attended);
                      }}
                      className={`cursor-pointer transition-colors p-1 rounded-full ${
                        su.attended
                          ? "text-ares-success hover:text-ares-success/75"
                          : "text-marble/35 hover:text-white"
                      }`}
                      title={isAdmin ? "Toggle Attendance status" : "RSVP Status"}
                    >
                      {su.attended ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-white uppercase tracking-tight">
                        {su.nickname}
                      </p>
                      {su.notes && (
                        <p className="text-[9px] text-marble/45 italic leading-normal">
                          Notes: {su.notes}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[8.5px] font-mono text-marble/40 uppercase">
                        {su.bringing && (
                          <span className="text-ares-gold">🥪 Bringing: {su.bringing}</span>
                        )}
                        {su.prepHours !== undefined && (
                          <span className="text-ares-cyan">⚙️ Prep: {su.prepHours} hrs</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteRsvp(su.userId)}
                      className="p-1.5 bg-white/5 hover:bg-ares-red/25 border border-white/10 text-marble/55 hover:text-white rounded transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
                      title="Remove RSVP"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Check-in Form for Admin */}
        {isAdmin && (
          <form onSubmit={handleQuickCheckin} className="border-t border-white/5 pt-4 mt-6 space-y-3 text-left">
            <span id="quick-checkin-title" className="text-[9px] uppercase font-black tracking-widest text-ares-gold block">
              Quick Admin Check-in
            </span>
            <div className="flex gap-2">
              <label htmlFor="quick-checkin-member" className="sr-only">Select Team Member to Check In</label>
              <select
                id="quick-checkin-member"
                value={selectedMemberIdToCheckin}
                onChange={(e) => setSelectedMemberIdToCheckin(e.target.value)}
                className="flex-grow bg-black/60 border border-white/10 text-xs text-white rounded px-3 py-2 focus:outline-none cursor-pointer focus:ring-2 focus:ring-ares-cyan"
              >
                <option value="">Select Team Member...</option>
                {displayedMembers.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.nickname}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-ares-gold text-black hover:bg-ares-gold-soft rounded text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
              >
                Check In
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Self RSVP Card */}
      {user && (
        <div className="w-full md:w-80 p-5 bg-white/5 border border-white/10 rounded-xl flex flex-col justify-between shrink-0 space-y-4 text-left">
          <form onSubmit={handleRsvpSubmit} className="space-y-4">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
              Submit Your Operation RSVP
            </h4>

            {signupError && (
              <p className="text-[9px] font-mono text-ares-red bg-ares-red/10 p-2 rounded border border-ares-red/20">
                {signupError}
              </p>
            )}

            {formIsPotluck === 1 && (
              <div>
                <label
                  htmlFor="rsvp-bringing"
                  className="block text-[8px] uppercase font-black tracking-widest text-marble/45 mb-1"
                >
                  🥪 What will you bring? (Optional)
                </label>
                <input
                  id="rsvp-bringing"
                  type="text"
                  placeholder="e.g. Case of soda, cookies..."
                  value={bringing}
                  onChange={(e) => setBringing(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-gold focus:ring-2 focus:ring-ares-cyan"
                />
              </div>
            )}

            {formIsVolunteer === 1 && (
              <div>
                <label
                  htmlFor="rsvp-prep-hours"
                  className="block text-[8px] uppercase font-black tracking-widest text-marble/45 mb-1"
                >
                  ⚙️ Anticipated Prep Work Hours
                </label>
                <input
                  id="rsvp-prep-hours"
                  type="number"
                  min="0"
                  max="24"
                  value={prepHours}
                  onChange={(e) => setPrepHours(parseInt(e.target.value) || 0)}
                  className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-cyan focus:ring-2 focus:ring-ares-cyan"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="rsvp-notes"
                className="block text-[8px] uppercase font-black tracking-widest text-marble/45 mb-1"
              >
                📝 RSVP Notes (Optional)
              </label>
              <textarea
                id="rsvp-notes"
                placeholder="e.g. Arriving 15 mins late. Running odometry code checks."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-16 bg-black/60 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-ares-cyan resize-none focus:ring-2 focus:ring-ares-cyan"
              />
            </div>

            <button
              type="submit"
              disabled={submittingRsvp}
              className="w-full py-2 bg-ares-cyan text-black hover:brightness-105 font-black uppercase text-[10px] tracking-widest rounded-lg transition-all disabled:opacity-40 cursor-pointer shadow-md focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
            >
              {submittingRsvp ? "Updating..." : mySignup ? "Update RSVP" : "Confirm RSVP (Will Attend)"}
            </button>
          </form>

          {mySignup && (
            <button
              type="button"
              onClick={handleRsvpCancel}
              disabled={submittingRsvp}
              className="w-full py-2 bg-white/5 border border-white/5 hover:bg-ares-red/15 text-marble/55 hover:text-white text-[9px] uppercase font-black tracking-widest rounded-lg transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
            >
              Cancel Attendance
            </button>
          )}
        </div>
      )}
    </div>
  );
}
