import React from "react";
import { Link } from "react-router-dom";
import { Users, AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { EventItem, EventSignup } from "./types";

interface EventRsvpsProps {
  event: EventItem;
  isVerified: boolean;
  isAdmin: boolean;
  signups: EventSignup[];
  mySignup: EventSignup | null;
  userId?: string;
  bringing: string;
  setBringing: (val: string) => void;
  notes: string;
  setNotes: (val: string) => void;
  prepHours: number;
  setPrepHours: (val: number) => void;
  signupError: string | null;
  submittingRsvp: boolean;
  handleRsvpSubmit: (e: React.FormEvent) => void;
  handleRsvpCancel: () => void;
  handleToggleAttendance: (targetUserId: string, currentStatus?: boolean) => void;
}

export default function EventRsvps({
  event,
  isVerified,
  isAdmin,
  signups,
  mySignup,
  userId,
  bringing,
  setBringing,
  notes,
  setNotes,
  prepHours,
  setPrepHours,
  signupError,
  submittingRsvp,
  handleRsvpSubmit,
  handleRsvpCancel,
  handleToggleAttendance
}: EventRsvpsProps) {
  return (
    <div className="glass-card border border-white/10 p-6 rounded-2xl bg-black/20 space-y-6">
      <div>
        <h3 className="text-lg font-black text-white uppercase tracking-tight font-heading flex items-center gap-2">
          <Users size={16} className="text-ares-red" /> Team Sign-Ups
        </h3>
        <p className="text-[10px] text-marble/60 uppercase font-bold mt-1">Roster check-ins and commitments</p>
      </div>

      {isVerified ? (
        <div className="space-y-6">
          {/* RSVP Stats */}
          <div className="grid grid-cols-2 gap-4 border-y border-white/5 py-4">
            <div className="text-left">
              <span className="text-[9px] font-black text-marble/45 uppercase tracking-wider block">Going / RSVP</span>
              <span className="text-2xl font-black text-white mt-1 block">
                {signups.length} <span className="text-xs font-bold text-marble/60">present</span>
              </span>
            </div>
            {event.isVolunteer === 1 && (
              <div className="text-left">
                <span className="text-[9px] font-black text-marble/45 uppercase tracking-wider block">Volunteer Prep</span>
                <span className="text-2xl font-black text-ares-gold mt-1 block">
                  {signups.reduce((acc, s) => acc + (s.prepHours || 0), 0)} <span className="text-xs font-bold text-marble/60">hrs</span>
                </span>
              </div>
            )}
          </div>

          {/* RSVP Status Form */}
          <form onSubmit={handleRsvpSubmit} className="space-y-4 pt-2">
            <h4 className="text-[10px] font-black uppercase text-ares-gold tracking-widest">
              {mySignup ? "✓ Update RSVP details" : "+ Submit your RSVP"}
            </h4>

            {signupError && (
              <div className="p-3 bg-ares-red/10 border border-ares-red/20 text-ares-red text-xs rounded-lg flex items-center gap-1.5">
                <AlertCircle size={14} /> {signupError}
              </div>
            )}

            {event.isPotluck === 1 && (
              <div>
                <label htmlFor="rsvp-bringing" className="block text-[9px] font-black uppercase tracking-wider mb-2 text-marble/55">Bringing Food/Drinks</label>
                <input
                  id="rsvp-bringing"
                  type="text"
                  placeholder="Chips, cookies, sodas..."
                  value={bringing}
                  onChange={(e) => setBringing(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
                />
              </div>
            )}

            {event.isVolunteer === 1 && (
              <div>
                <label htmlFor="rsvp-prep-hours" className="block text-[9px] font-black uppercase tracking-wider mb-2 text-marble/55">Volunteer Prep Hours</label>
                <input
                  id="rsvp-prep-hours"
                  type="number"
                  step="0.5"
                  min="0"
                  max="20"
                  placeholder="Hours contributed"
                  value={prepHours || ""}
                  onChange={(e) => setPrepHours(parseFloat(e.target.value) || 0)}
                  className="w-full bg-black/60 border border-white/10 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
                />
              </div>
            )}

            <div>
              <label htmlFor="rsvp-notes" className="block text-[9px] font-black uppercase tracking-wider mb-2 text-marble/55">Notes / Arrival Time</label>
              <input
                id="rsvp-notes"
                type="text"
                placeholder="e.g. Arriving 30 mins late, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={submittingRsvp}
                className="flex-1 px-4 py-2.5 bg-ares-gold hover:brightness-110 text-black text-[10px] font-black uppercase tracking-widest ares-cut-sm transition-all cursor-pointer shadow-lg disabled:opacity-50"
              >
                {mySignup ? "Save Details" : "RSVP (Going)"}
              </button>
              {mySignup && (
                <button
                  type="button"
                  onClick={handleRsvpCancel}
                  className="px-3 py-2.5 bg-white/5 hover:bg-ares-red/10 border border-white/10 hover:border-ares-red/40 text-marble hover:text-ares-red text-[10px] font-black uppercase tracking-widest ares-cut-sm transition-all cursor-pointer"
                >
                  Cancel RSVP
                </button>
              )}
            </div>
          </form>

          {/* RSVP Attendance Check-in Button */}
          {mySignup && userId && (
            <button
              type="button"
              onClick={() => handleToggleAttendance(userId, mySignup.attended)}
              className={`w-full flex items-center justify-center gap-1.5 py-2 border rounded text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                mySignup.attended
                  ? "bg-ares-red/15 border-ares-red/45 text-white"
                  : "bg-white/5 border-white/10 hover:border-ares-gold hover:text-ares-gold text-marble"
              }`}
            >
              <CheckCircle2 size={12} />
              {mySignup.attended ? "Checked In (Undo)" : "Check In to Event"}
            </button>
          )}

          {/* RSVP List Table */}
          <div className="space-y-3 pt-4 border-t border-white/5">
            <h4 className="text-[10px] font-black uppercase text-marble/55 tracking-wider">RSVP List</h4>
            {signups.length === 0 ? (
              <p className="text-[10px] text-marble/40 font-mono">No sign-ups registered yet.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {signups.map((entry) => (
                  <div key={entry.userId} className="py-2.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleToggleAttendance(entry.userId, entry.attended)}
                          className={`shrink-0 transition-colors ${
                            entry.attended ? "text-ares-gold" : "text-white/10 hover:text-white/30"
                          }`}
                        >
                          {entry.attended ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                        </button>
                      ) : (
                        <div className={`shrink-0 ${entry.attended ? "text-ares-gold" : "text-white/10"}`}>
                          {entry.attended ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <span className="text-xs font-bold text-white block truncate">
                          {entry.nickname?.includes("@") ? "ARES Member" : entry.nickname || "ARES Member"}
                        </span>
                        {entry.bringing && (
                          <span className="text-[9px] text-ares-gold truncate block font-medium">Brings: {entry.bringing}</span>
                        )}
                        {entry.notes && (
                          <span className="text-[8px] text-marble/50 block truncate font-mono">{entry.notes}</span>
                        )}
                      </div>
                    </div>
                    {entry.prepHours && entry.prepHours > 0 ? (
                      <span className="text-[9px] font-bold text-marble/60 shrink-0 font-mono bg-white/5 px-2 py-0.5 rounded">
                        {entry.prepHours}h
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center p-6 border border-white/5 bg-black/30 rounded-xl">
          <ShieldIconContainer />
          <h4 className="text-xs font-extrabold uppercase text-white mt-3">Verified Clearance Required</h4>
          <p className="text-[10px] text-marble/50 leading-relaxed mt-2">
            Access to event rosters and RSVP actions is restricted to authorized team members.
          </p>
          <Link
            to="/calendar"
            className="mt-4 inline-block px-4 py-2 bg-white/5 border border-white/10 text-white hover:text-ares-gold text-[9px] font-black uppercase tracking-widest transition-colors"
          >
            Return to calendar
          </Link>
        </div>
      )}
    </div>
  );
}

function ShieldIconContainer() {
  return (
    <div className="w-10 h-10 rounded-full bg-ares-gold/15 flex items-center justify-center border border-ares-gold/20 mx-auto">
      <Users size={18} className="text-ares-gold" />
    </div>
  );
}
