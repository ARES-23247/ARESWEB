
import { useState, useEffect, useCallback } from "react";
import { ClipboardList, Plus, Save, RefreshCw, Trash2, CheckCircle2, Circle, AlertCircle, Users } from "lucide-react";
import { api } from "../api/client";

interface SignupEntry {
  id: number;
  user_id: string;
  nickname: string;
  avatar: string;
  bringing: string;
  notes: string;
  is_own: boolean;
  attended: boolean;
  prep_hours?: number;
}

interface EventSignupsProps {
  eventId: string;
  isPotluck: boolean;
  isVolunteer?: boolean;
}

export default function EventSignups({ eventId, isPotluck, isVolunteer }: EventSignupsProps) {
  const [signups, setSignups] = useState<SignupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [dietarySummary, setDietarySummary] = useState<Record<string, number> | null>(null);
  const [teamDietarySummary, setTeamDietarySummary] = useState<Record<string, number> | null>(null);
  const [mySignup, setMySignup] = useState<{ bringing: string; notes: string; prep_hours?: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSignups = useCallback(() => {
    api.events.getSignups.query({ params: { id: eventId } })
      .then((res: { status: number; body: { signups?: SignupEntry[]; authenticated: boolean; role: string; can_manage: boolean; dietary_summary?: Record<string, number>; team_dietary_summary?: Record<string, number> } | unknown }) => {
        if (res.status === 200) {
          const typed = res.body as { signups?: SignupEntry[]; authenticated: boolean; role: string; can_manage: boolean; dietary_summary?: Record<string, number>; team_dietary_summary?: Record<string, number> };
          setSignups(typed.signups || []);
          setIsAuthenticated(typed.authenticated);
          setUserRole(typed.role);
          setCanManage(typed.can_manage);
          setDietarySummary(typed.dietary_summary || null);
          setTeamDietarySummary(typed.team_dietary_summary || null);
          
          const own = (typed.signups || []).find((s: SignupEntry) => s.is_own);
          if (own) setMySignup({ bringing: own.bringing, notes: own.notes, prep_hours: own.prep_hours || 0 });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [eventId]);

  useEffect(() => { fetchSignups(); }, [fetchSignups]);

  const handleSignUp = async () => {
    setIsSaving(true);
    try {
      await api.events.submitSignup.mutation({ 
        params: { id: eventId },
        body: mySignup || { bringing: "", notes: "", prep_hours: 0 }
      });
    } catch (e) {
      console.error(e);
    }
    setIsSaving(false);
    fetchSignups();
  };

  const handleRemove = async () => {
    await api.events.deleteMySignup.mutation({ params: { id: eventId } });
    setMySignup(null);
    fetchSignups();
  };

  const toggleAttendance = async (userId: string, currentStatus: boolean) => {
    await api.events.updateUserAttendance.mutation({ 
      params: { id: eventId, userId },
      body: { attended: !currentStatus }
    });
    fetchSignups();
  };

  const selfCheckIn = async () => {
    const isCurrentlyAttended = myEntry?.attended || false;
    await api.events.updateMyAttendance.mutation({ 
      params: { id: eventId },
      body: { attended: !isCurrentlyAttended }
    });
    fetchSignups();
  };

  if (loading) return null;

  const myEntry = signups.find(s => s.is_own);
  const totalAttending = signups.filter(s => s.attended).length;
  const totalPrep = signups.reduce((sum, s) => sum + (s.prep_hours || 0), 0);

  return (
    <div className="mt-10 border-t border-white/10 pt-8 space-y-8">
      {/* Attendance & Provisions Summary (Visible to verified users) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-obsidian/40 border border-white/10 p-5 ares-cut">
          <h4 className="text-marble/40 text-xs font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <Users size={14} className="text-ares-gold" /> Attendance Stats
          </h4>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{totalAttending}</span>
            <span className="text-marble/40 text-sm font-bold">/ {signups.length} present</span>
          </div>
          {isVolunteer && (
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-sm font-bold">
              <span className="text-marble/40 uppercase tracking-widest text-xs">Volunteer Prep Time</span>
              <span className="text-ares-gold">{totalPrep} hrs</span>
            </div>
          )}
        </div>
        
        {dietarySummary && (
          <div className="bg-obsidian/40 border border-white/10 p-5 ares-cut">
            <h4 className="text-marble/40 text-xs font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <AlertCircle size={14} className="text-ares-red" /> Dietary Restrictions
            </h4>
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-xs text-white/50 block mb-2 font-bold uppercase tracking-widest">RSVP&apos;d Members</span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dietarySummary).length > 0 ? (
                    Object.entries(dietarySummary).map(([restriction, count]) => (
                      <span key={`rsvp-${restriction}`} className="px-2 py-1 bg-ares-red/10 border border-ares-red/20 ares-cut-sm text-xs font-bold text-ares-red">
                        {count} {restriction}
                      </span>
                    ))
                  ) : (
                    <span className="text-marble/30 text-xs font-medium leading-relaxed">No dietary restrictions among RSVPs.</span>
                  )}
                </div>
              </div>
              
              {teamDietarySummary && Object.entries(teamDietarySummary).length > 0 && (
                <div>
                  <span className="text-xs text-white/50 block mb-2 font-bold uppercase tracking-widest">Entire Team Roster</span>
                  <div className="flex flex-wrap gap-2 opacity-70 grayscale">
                    {Object.entries(teamDietarySummary).map(([restriction, count]) => (
                      <span key={`team-${restriction}`} className="px-2 py-1 bg-white/10 border border-white/20 ares-cut-sm text-xs font-bold text-marble">
                        {count} {restriction}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isAuthenticated && userRole !== "unverified" ? (
        <>
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black flex items-center gap-2">
                <ClipboardList size={20} className="text-ares-gold" />
                RSVPs & Sign-Ups ({signups.length})
              </h3>
              
              {/* Self Check-in Button */}
              <button 
                onClick={selfCheckIn}
                className={`flex items-center gap-2 px-4 py-2 ares-cut-sm text-xs font-black uppercase tracking-widest transition-all ${
                  myEntry?.attended 
                  ? "bg-ares-gold/10 border border-ares-gold/20 text-ares-gold hover:bg-ares-gold/20" 
                  : "bg-ares-gold hover:brightness-110 text-black shadow-lg shadow-ares-gold/20"
                }`}
              >
                <CheckCircle2 size={14} />
                {myEntry?.attended ? "Checked In (Undo)" : "Check In Now"}
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto mb-6 bg-obsidian/20 border border-white/10 ares-cut">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-bold text-marble/40 uppercase tracking-wider">
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Who</th>
                    {isPotluck && <th className="text-left py-3 px-4">Bringing</th>}
                    {isVolunteer && <th className="text-left py-3 px-4">Prep Hrs</th>}
                    <th className="text-left py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {signups.map(entry => (
                    <tr key={entry.id} className={`border-b border-white/10 transition-colors ${entry.attended ? "bg-ares-gold/5" : ""}`}>
                      <td className="py-3 px-4">
                        {canManage ? (
                          <button 
                            onClick={() => toggleAttendance(entry.user_id, entry.attended)}
                            className={`transition-colors ${entry.attended ? "text-ares-gold" : "text-marble/10 hover:text-marble/30"}`}
                          >
                            {entry.attended ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                          </button>
                        ) : (
                          <div className={entry.attended ? "text-ares-gold" : "text-marble/5"}>
                            {entry.attended ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <img src={entry.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${entry.user_id}`}
                            alt={`${entry.nickname || "ARES Member"}'s avatar`} className="w-6 h-6 ares-cut-sm bg-white/10" />
                          <span className={`text-sm font-bold ${entry.attended ? "text-white" : "text-marble/40"}`}>{entry.nickname || "ARES Member"}</span>
                        </div>
                      </td>
                      {isPotluck && <td className="py-3 px-4 text-sm text-marble">{entry.bringing || "—"}</td>}
                      {isVolunteer && <td className="py-3 px-4 text-sm text-marble">{entry.prep_hours || 0}</td>}
                      <td className="py-3 px-4 text-sm text-marble/40">{entry.notes || "—"}</td>
                    </tr>
                  ))}
                  {signups.length === 0 && (
                    <tr><td colSpan={5} className="py-12 text-center text-marble/30 text-sm">No RSVPs yet. Be the first!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sign Up Form */}
          <div className="bg-obsidian/50 border border-white/10 ares-cut-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-ares-gold uppercase tracking-[0.2em]">
                {mySignup !== null ? "Update Your RSVP" : "RSVP to this Event"}
              </p>
              <span className="text-xs text-marble/20 font-bold uppercase tracking-widest">ARES Event Protocol v3.0</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isPotluck && (
                <input
                  placeholder="What are you bringing? (e.g. chips & salsa)"
                  value={mySignup?.bringing || ""}
                  onChange={e => setMySignup(prev => ({ bringing: e.target.value, notes: prev?.notes || "", prep_hours: prev?.prep_hours || 0 }))}
                  className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-sm text-white placeholder-marble/40 focus:outline-none focus:border-ares-gold focus:ring-1 focus:ring-ares-gold/20 transition-all"
                />
              )}
              <input
                placeholder={isPotluck ? "Notes (dietary info, arrival time...)" : "Notes (arrival time, etc...)"}
                value={mySignup?.notes || ""}
                onChange={e => setMySignup(prev => ({ bringing: prev?.bringing || "", notes: e.target.value, prep_hours: prev?.prep_hours || 0 }))}
                className={`w-full ${isPotluck && isVolunteer ? 'md:col-span-2' : ''} ${(!isPotluck && !isVolunteer) ? 'col-span-2' : ''} bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-sm text-white placeholder-marble/40 focus:outline-none focus:border-ares-gold focus:ring-1 focus:ring-ares-gold/20 transition-all`}
              />
              {isVolunteer && (
                <div className="flex items-center gap-3">
                  <span className="text-marble/40 uppercase tracking-widest text-xs font-bold shrink-0">Prep Hrs</span>
                  <input
                    type="number" step="0.5" min="0" placeholder="0"
                    value={mySignup?.prep_hours || 0}
                    onChange={e => setMySignup(prev => ({ bringing: prev?.bringing || "", notes: prev?.notes || "", prep_hours: parseFloat(e.target.value) || 0 }))}
                    className="w-full md:w-32 bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-sm text-white focus:outline-none focus:border-ares-gold focus:ring-1 focus:ring-ares-gold/20 transition-all"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={handleSignUp} disabled={isSaving}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-ares-gold/10 hover:bg-ares-gold/20 border border-ares-gold/30 text-ares-gold ares-cut-sm text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {isSaving ? <RefreshCw size={16} className="animate-spin" /> : mySignup !== null ? <Save size={16} /> : <Plus size={16} />}
                {mySignup !== null ? "Update RSVP" : "RSVP Here"}
              </button>
              {mySignup !== null && signups.some(s => s.is_own) && (
                <button onClick={handleRemove}
                  className="flex flex-1 md:flex-none items-center justify-center gap-2 px-6 py-3 bg-ares-danger/10 hover:bg-ares-danger/20 border border-ares-danger/20 text-ares-danger ares-cut-sm text-sm font-black uppercase tracking-widest transition-all"
                >
                  <Trash2 size={16} /> Cancel RSVP
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="my-12 p-8 bg-obsidian/50 border border-white/10 ares-cut-lg text-center">
          <p className="text-sm text-marble mb-2">
            <span className="text-ares-gold font-bold">Verified Access Required</span>
          </p>
          <p className="text-sm text-marble/40 max-w-md mx-auto mb-6">
            Sign-ups and provisions are restricted to verified ARES members to protect privacy.
          </p>
          {!isAuthenticated ? (
            <div>
              <a href="/login" className="px-6 py-3 bg-ares-gold hover:brightness-110 text-black ares-cut-sm font-black text-xs uppercase tracking-widest inline-block transition-all shadow-lg shadow-ares-gold/20">Sign in with ARES ID</a>
              <p className="text-xs uppercase tracking-widest text-marble/20 mt-6 font-bold">
                Don&apos;t have an ARES ID? <a href="/about" className="text-ares-gold hover:underline">Contact us</a>
              </p>
            </div>
          ) : (
            <p className="text-xs uppercase tracking-widest text-marble/40 font-bold max-w-sm mx-auto">Your account is pending team administrator verification. If you have any questions, <a href="/about" className="text-ares-gold hover:underline">contact us</a>.</p>
          )}
        </div>
      )}
    </div>
  );
}
