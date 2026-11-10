"use client";

import { logger } from "@/utils/logger";
import React, { useState, useEffect, useMemo } from "react";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseFirestore";
import { authenticatedFetch } from "@/lib/api";
import { CheckCircle2, Circle, KeyRound, Trash2, Users } from "lucide-react";
import { cleanUndefined } from "@/lib/utils";
import { EventSignup } from "./EventEditorDrawer";
import type { User } from "firebase/auth";

interface EventFormRosterProps {
  editId: string;
  signups: EventSignup[];
  isAdmin: boolean;
  canManageAttendance?: boolean;
  formIsPotluck: number;
  formIsVolunteer: number;
  user: User | null;
  userNickname: string;
  teamMembers: { uid: string; nickname: string; avatar: string }[];
  displayedMembers: { uid: string; nickname: string; avatar: string }[];
  setRevertAlert: (msg: string | null) => void;
}

export default function EventFormRoster({
  editId,
  signups,
  isAdmin,
  canManageAttendance = isAdmin,
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
  const [pendingRemoval, setPendingRemoval] = useState<{
    userId: string;
    label: string;
    self: boolean;
  } | null>(null);

  // Fast Lab PIN & Roll Call states
  const [activeLabPin, setActiveLabPin] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  const [generatingPin, setGeneratingPin] = useState(false);
  const [studentPinInput, setStudentPinInput] = useState("");
  const [submittingPin, setSubmittingPin] = useState(false);
  const [rollingUid, setRollingUid] = useState<string | null>(null);

  // Find if current user is signed up for active event
  const mySignup = useMemo(() => {
    if (!user) return null;
    return signups.find((s) => s.userId === user.uid) || null;
  }, [signups, user]);

  const signupMap = useMemo(() => {
    const map = new Map<string, EventSignup>();
    for (const s of signups) map.set(s.userId, s);
    return map;
  }, [signups]);

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

  // Action: Submit self-RSVP (preserves existing attended without self-promoting)
  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editId) return;
    setSubmittingRsvp(true);
    setSignupError(null);
    try {
      const signupData: EventSignup = {
        userId: user.uid,
        nickname: userNickname || "ARES Member",
        bringing: formIsPotluck === 1 ? bringing.trim() : undefined,
        prepHours: formIsVolunteer === 1 ? prepHours : undefined,
        notes: notes.trim() || undefined,
        attended: mySignup?.attended === true ? true : false,
      };
      await setDoc(
        doc(db, "events", editId, "signups", user.uid),
        cleanUndefined(signupData),
      );
      setRevertAlert("RSVP updated successfully!");
    } catch (err: unknown) {
      setSignupError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingRsvp(false);
    }
  };

  // Action: Cancel self-RSVP
  const handleRsvpCancel = () => {
    if (!user || !editId) return;
    setPendingRemoval({ userId: user.uid, label: "your RSVP", self: true });
  };

  const executeRsvpRemoval = async () => {
    if (!pendingRemoval || !editId) return;
    setSubmittingRsvp(true);
    setSignupError(null);
    try {
      await deleteDoc(doc(db, "events", editId, "signups", pendingRemoval.userId));
      if (pendingRemoval.self) {
        setBringing("");
        setNotes("");
        setPrepHours(0);
        setRevertAlert("Your RSVP was cancelled.");
      } else {
        setRevertAlert("RSVP removed by staff.");
      }
      setPendingRemoval(null);
    } catch (err: unknown) {
      setSignupError(
        `RSVP removal failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSubmittingRsvp(false);
    }
  };

  // Action: Generate 4-Digit Lab PIN (Mentor/Coach/Admin)
  const handleGeneratePin = async () => {
    if (!editId || !canManageAttendance) return;
    setGeneratingPin(true);
    setSignupError(null);
    try {
      const res = await authenticatedFetch(
        `/api/calendar/manage/${encodeURIComponent(editId)}/checkin-code`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        code?: string;
        expiresAt?: string;
        error?: string;
      };
      if (!res.ok || !body.code) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setActiveLabPin({ code: body.code, expiresAt: body.expiresAt ?? "" });
      setRevertAlert("4-digit Lab Practice PIN generated (valid for 2 hours).");
    } catch (err: unknown) {
      setSignupError(
        `PIN generation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setGeneratingPin(false);
    }
  };

  // Action: Student Self Check-In via 4-Digit Lab PIN
  const handlePinSelfCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !/^\d{4}$/u.test(studentPinInput.trim())) return;
    setSubmittingPin(true);
    setSignupError(null);
    try {
      const res = await authenticatedFetch(
        `/api/calendar/manage/${encodeURIComponent(editId)}/self-checkin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: studentPinInput.trim() }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setStudentPinInput("");
      setRevertAlert("Checked in to lab session!");
    } catch (err: unknown) {
      setSignupError(
        `Lab PIN check-in failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSubmittingPin(false);
    }
  };

  // Action: 1-Tap Roll Call Toggle (Mentor/Coach/Admin)
  const handleRollCallMember = async (
    targetUid: string,
    nickname: string,
    nextAttended: boolean,
  ) => {
    if (!editId || !canManageAttendance) return;
    setRollingUid(targetUid);
    setSignupError(null);
    try {
      const res = await authenticatedFetch(
        `/api/calendar/manage/${encodeURIComponent(editId)}/roll-call`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: targetUid,
            nickname: nickname || "ARES Member",
            attended: nextAttended,
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setRevertAlert(
        nextAttended
          ? `Marked ${nickname} present.`
          : `Cleared check-in for ${nickname}.`,
      );
    } catch (err: unknown) {
      logger.error("Roll-call update failed:", err);
      setSignupError(
        `Roll-call update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setRollingUid(null);
    }
  };

  // Action: Quick Check-in dropdown
  const handleQuickCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !selectedMemberIdToCheckin || !canManageAttendance) return;
    const member = teamMembers.find((m) => m.uid === selectedMemberIdToCheckin);
    if (!member) return;
    await handleRollCallMember(member.uid, member.nickname, true);
    setSelectedMemberIdToCheckin("");
  };

  // Action: Toggle Attendance check-in status on existing RSVP row
  const handleToggleAttendance = async (
    signupId: string,
    currentAttendedStatus: boolean,
  ) => {
    if (!editId || !canManageAttendance) return;
    try {
      await setDoc(
        doc(db, "events", editId, "signups", signupId),
        { attended: !currentAttendedStatus },
        { merge: true },
      );
    } catch (err: unknown) {
      logger.error("Failed to toggle attendance:", err);
      setSignupError(
        `Attendance update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  // Action: Delete RSVP
  const handleDeleteRsvp = async (targetUserId: string) => {
    if (!editId || !canManageAttendance) return;
    const signup = signups.find((candidate) => candidate.userId === targetUserId);
    setPendingRemoval({
      userId: targetUserId,
      label: `${signup?.nickname || "this member"}'s RSVP`,
      self: false,
    });
  };

  const rollCallRoster = displayedMembers.length > 0 ? displayedMembers : teamMembers;

  return (
    <div className="flex-grow flex flex-col md:flex-row gap-6 overflow-hidden min-h-0">
      {/* Roster & Fast Roll Call column */}
      <div className="flex-1 bg-black/20 border border-white/5 rounded-xl p-5 overflow-y-auto flex flex-col justify-between scrollbar-thin scrollbar-thumb-white/5 text-left space-y-6">
        <div className="space-y-5">
          {/* Lab Practice 4-Digit PIN Projector (Mentor / Coach / Admin) */}
          {canManageAttendance && (
            <div className="rounded-xl border border-ares-gold/30 bg-ares-gold/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-ares-gold flex items-center gap-1.5">
                    <KeyRound size={12} aria-hidden="true" /> Fast Lab Check-In Code
                  </span>
                  <p className="text-[11px] text-marble/70 mt-0.5">
                    Project a 2-hour 4-digit PIN on the lab screen so students check in from Command Center.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={generatingPin}
                  onClick={() => void handleGeneratePin()}
                  className="px-3.5 py-2 bg-ares-gold text-obsidian hover:bg-ares-bronze rounded text-[10px] font-black uppercase tracking-wider cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  {generatingPin
                    ? "Generating..."
                    : activeLabPin
                      ? "Rotate 4-Digit Code"
                      : "Generate 4-Digit Lab Code"}
                </button>
              </div>
              {activeLabPin && (
                <div className="flex items-center justify-between rounded-lg border border-ares-gold/40 bg-black/60 px-4 py-3">
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-marble/60 block">
                      Active Lab PIN
                    </span>
                    <span className="font-heading text-3xl font-black tracking-[0.35em] text-ares-gold">
                      {activeLabPin.code}
                    </span>
                  </div>
                  {activeLabPin.expiresAt && (
                    <span className="text-[10px] font-mono text-marble/60">
                      Expires {new Date(activeLabPin.expiresAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 1-Tap Roll Call Grid (Mentor / Coach / Admin) */}
          {canManageAttendance && rollCallRoster.length > 0 && (
            <div className="space-y-2.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-ares-cyan flex items-center gap-1.5">
                <Users size={12} aria-hidden="true" /> 1-Tap Roll Call ({signups.filter((s) => s.attended).length} Present)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {rollCallRoster.map((member) => {
                  const existing = signupMap.get(member.uid);
                  const isPresent = existing?.attended === true;
                  return (
                    <button
                      key={member.uid}
                      type="button"
                      disabled={rollingUid === member.uid}
                      aria-pressed={isPresent}
                      aria-label={
                        isPresent
                          ? `Clear check-in for ${member.nickname}`
                          : `Mark ${member.nickname} present`
                      }
                      onClick={() =>
                        void handleRollCallMember(
                          member.uid,
                          member.nickname,
                          !isPresent,
                        )
                      }
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                        isPresent
                          ? "border-ares-gold/50 bg-ares-gold/15 text-white"
                          : "border-white/10 bg-white/5 text-marble/80 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      <span className="truncate">{member.nickname}</span>
                      {isPresent ? (
                        <CheckCircle2
                          size={14}
                          className="shrink-0 text-ares-gold"
                          aria-hidden="true"
                        />
                      ) : (
                        <Circle
                          size={14}
                          className="shrink-0 text-marble/40"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <h4 className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
            Operation Attendance Roster ({signups.length})
          </h4>

          {signups.length === 0 ? (
            <div className="py-8 text-center text-marble/35 font-mono text-[10px] uppercase tracking-wider">
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
                    <button
                      type="button"
                      onClick={() => {
                        if (canManageAttendance) {
                          void handleToggleAttendance(su.userId, !!su.attended);
                        }
                      }}
                      className={`cursor-pointer transition-colors p-1 rounded-full disabled:cursor-default ${
                        su.attended
                          ? "text-ares-gold hover:text-white"
                          : "text-marble/35 hover:text-white"
                      }`}
                      title={
                        canManageAttendance
                          ? "Toggle Attendance status"
                          : "RSVP Status"
                      }
                      aria-label={
                        canManageAttendance
                          ? `Toggle attendance for ${su.nickname}`
                          : `${su.nickname} RSVP status`
                      }
                      disabled={!canManageAttendance}
                    >
                      {su.attended ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <Circle size={16} />
                      )}
                    </button>
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
                          <span className="text-ares-gold">
                            Bringing: {su.bringing}
                          </span>
                        )}
                        {su.prepHours !== undefined && (
                          <span className="text-ares-gold">
                            Prep: {su.prepHours} hrs
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {canManageAttendance && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteRsvp(su.userId)}
                      className="p-1.5 bg-white/5 hover:bg-ares-red/25 border border-white/10 text-marble/55 hover:text-white rounded transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
                      title="Remove RSVP"
                      aria-label={`Remove RSVP for ${su.nickname}`}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Check-in Form for Staff */}
        {canManageAttendance && (
          <form
            onSubmit={handleQuickCheckin}
            className="border-t border-white/5 pt-4 mt-4 space-y-3 text-left"
          >
            <span
              id="quick-checkin-title"
              className="text-[9px] uppercase font-black tracking-widest text-ares-gold block"
            >
              Quick Staff Check-in
            </span>
            <div className="flex gap-2">
              <label htmlFor="quick-checkin-member" className="sr-only">
                Select Team Member to Check In
              </label>
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
                className="px-4 py-2 bg-ares-gold text-black hover:bg-ares-bronze rounded text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
              >
                Check In
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Self RSVP & Lab PIN Check-In Card */}
      {user && (
        <div className="w-full md:w-80 p-5 bg-white/5 border border-white/10 rounded-xl flex flex-col justify-between shrink-0 space-y-4 text-left">
          <div className="space-y-4">
            {/* Student 4-Digit PIN Check-In */}
            {mySignup?.attended ? (
              <div className="rounded-lg border border-ares-gold/40 bg-ares-gold/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-ares-gold flex items-center gap-2">
                <CheckCircle2 size={14} aria-hidden="true" /> Checked In Present
              </div>
            ) : (
              <form
                onSubmit={handlePinSelfCheckin}
                className="rounded-lg border border-white/10 bg-black/40 p-3 space-y-2"
              >
                <label
                  htmlFor="roster-lab-pin"
                  className="block text-[9px] font-black uppercase tracking-widest text-ares-cyan"
                >
                  In Lab? Enter 4-Digit PIN
                </label>
                <div className="flex gap-2">
                  <input
                    id="roster-lab-pin"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="0000"
                    value={studentPinInput}
                    onChange={(e) =>
                      setStudentPinInput(e.target.value.replace(/\D/gu, "").slice(0, 4))
                    }
                    className="w-24 rounded border border-white/15 bg-obsidian px-2.5 py-1.5 font-mono text-xs font-bold tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-ares-cyan"
                  />
                  <button
                    type="submit"
                    disabled={submittingPin || studentPinInput.length !== 4}
                    className="flex-1 rounded bg-ares-red px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-ares-bronze disabled:opacity-40 cursor-pointer"
                  >
                    {submittingPin ? "..." : "Check In"}
                  </button>
                </div>
              </form>
            )}

            <form onSubmit={handleRsvpSubmit} className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
                Submit Your Operation RSVP
              </h4>

              {signupError && (
                <p
                  role="alert"
                  className="text-[9px] font-mono text-white bg-ares-red/15 p-2 rounded border border-ares-red/40"
                >
                  {signupError}
                </p>
              )}

              {formIsPotluck === 1 && (
                <div>
                  <label
                    htmlFor="rsvp-bringing"
                    className="block text-[8px] uppercase font-black tracking-widest text-marble/45 mb-1"
                  >
                    What will you bring? (Optional)
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
                    Anticipated Prep Work Hours
                  </label>
                  <input
                    id="rsvp-prep-hours"
                    type="number"
                    min="0"
                    max="24"
                    value={prepHours}
                    onChange={(e) =>
                      setPrepHours(parseInt(e.target.value, 10) || 0)
                    }
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-cyan focus:ring-2 focus:ring-ares-cyan"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="rsvp-notes"
                  className="block text-[8px] uppercase font-black tracking-widest text-marble/45 mb-1"
                >
                  RSVP Notes (Optional)
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
                className="w-full py-2 bg-ares-gold text-black hover:bg-ares-bronze font-black uppercase text-[10px] tracking-widest rounded-lg transition-all disabled:opacity-40 cursor-pointer shadow-md focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
              >
                {submittingRsvp
                  ? "Updating..."
                  : mySignup
                    ? "Update RSVP"
                    : "Confirm RSVP (Will Attend)"}
              </button>
            </form>
          </div>

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

      {pendingRemoval && (
        <div
          role="alertdialog"
          aria-label="Confirm RSVP removal"
          className="fixed inset-x-4 bottom-4 z-[170] mx-auto max-w-md rounded-lg border border-ares-red/40 bg-obsidian p-4 text-left text-white shadow-2xl"
        >
          <p className="text-sm font-bold">Remove {pendingRemoval.label}?</p>
          <p className="mt-1 text-xs text-marble/70">
            This removes the attendance record. The member can RSVP again later.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setPendingRemoval(null)}
              disabled={submittingRsvp}
              className="rounded border border-white/15 px-3 py-2 text-xs font-bold focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Keep RSVP
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => void executeRsvpRemoval()}
              disabled={submittingRsvp}
              className="rounded bg-ares-red px-3 py-2 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
            >
              {submittingRsvp ? "Removing…" : "Remove RSVP"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
