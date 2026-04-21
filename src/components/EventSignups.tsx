import { useState, useEffect, useCallback } from "react";
import { ClipboardList, Plus, Save, RefreshCw, Trash2, CheckCircle2, Circle, AlertCircle, Users } from "lucide-react";

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
    fetch(`/api/events/${eventId}/signups`, { credentials: "include" })
      .then(r => r.json())
      .then((data) => {
        const typed = data as { 
          signups: SignupEntry[]; 
          authenticated: boolean; 
          role: string | null; 
          can_manage: boolean;
          dietary_summary: Record<string, number> | null;
          team_dietary_summary: Record<string, number> | null;
        };
        setSignups(typed.signups || []);
        setIsAuthenticated(typed.authenticated);
        setUserRole(typed.role);
        setCanManage(typed.can_manage);
        setDietarySummary(typed.dietary_summary);
        setTeamDietarySummary(typed.team_dietary_summary);
        
        const own = (typed.signups || []).find((s: SignupEntry) => s.is_own);
        if (own) setMySignup({ bringing: own.bringing, notes: own.notes, prep_hours: own.prep_hours || 0 });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [eventId]);

  useEffect(() => { fetchSignups(); }, [fetchSignups]);

  const handleSignUp = async () => {
    setIsSaving(true);
    await fetch(`/api/events/${eventId}/signups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(mySignup || { bringing: "", notes: "", prep_hours: 0 }),
    });
    setIsSaving(false);
    fetchSignups();
  };

  const handleRemove = async () => {
    await fetch(`/api/events/${eventId}/signups/me`, { method: "DELETE", credentials: "include" });
    setMySignup(null);
    fetchSignups();
  };

  const toggleAttendance = async (userId: string, currentStatus: boolean) => {
    await fetch(`/api/events/${eventId}/signups/${userId}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ attended: !currentStatus }),
    });
    fetchSignups();
  };

  const selfCheckIn = async () => {
    const isCurrentlyAttended = myEntry?.attended || false;
    await fetch(`/api/events/${eventId}/signups/me/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ attended: !isCurrentlyAttended }),
    });
    fetchSignups();
  };

  if (loading) return null;

  const myEntry = signups.find(s => s.is_own);
  const totalAttending = signups.filter(s => s.attended).length;
  const totalPrep = signups.reduce((sum, s) => sum + (s.prep_hours || 0), 0);

  return (
    <div className="mt-10 border-t border-zinc-800 pt-8 space-y-8">
      {/* Attendance & Provisions Summary (Visible to verified users) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900/40 border border-zinc-800 p-5 ares-cut">
          <h4 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <Users size={14} className="text-ares-gold" /> Attendance Stats
          </h4>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{totalAttending}</span>
            <span className="text-zinc-500 text-sm font-bold">/ {signups.length} present</span>
          </div>
          {isVolunteer && (
            <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between items-center text-sm font-bold">
              <span className="text-zinc-500 uppercase tracking-widest text-[10px]">Volunteer Prep Time</span>
              <span className="text-ares-gold">{totalPrep} hrs</span>
            </div>
          )}
        </div>
        
        {dietarySummary && (
          <div className="bg-zinc-900/40 border border-zinc-800 p-5 ares-cut">
            <h4 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <AlertCircle size={14} className="text-ares-red" /> Dietary Restrictions
            </h4>
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-xs text-white/50 block mb-2 font-bold uppercase tracking-widest">RSVP&apos;d Members</span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dietarySummary).length > 0 ? (
                    Object.entries(dietarySummary).map(([restriction, count]) => (
                      <span key={`rsvp-${restriction}`} className="px-2 py-1 bg-ares-red/10 border border-ares-red/20 ares-cut-sm text-[10px] font-bold text-ares-red">
                        {count} {restriction}
                      </span>
                    ))
                  ) : (
                    <span className="text-zinc-600 text-[10px] font-medium leading-relaxed">No dietary restrictions among RSVPs.</span>
                  )}
                </div>
              </div>
              
              {teamDietarySummary && Object.entries(teamDietarySummary).length > 0 && (
                <div>
                  <span className="text-xs text-white/50 block mb-2 font-bold uppercase tracking-widest">Entire Team Roster</span>
                  <div className="flex flex-wrap gap-2 opacity-70 grayscale">
                    {Object.entries(teamDietarySummary).map(([restriction, count]) => (
                      <span key={`team-${restriction}`} className="px-2 py-1 bg-zinc-800 border border-zinc-700 ares-cut-sm text-[10px] font-bold text-zinc-300">
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
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20" 
                  : "bg-ares-gold hover:bg-yellow-400 text-black shadow-lg shadow-ares-gold/20"
                }`}
              >
                <CheckCircle2 size={14} />
                {myEntry?.attended ? "Checked In (Undo)" : "Check In Now"}
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto mb-6 bg-zinc-900/20 border border-zinc-800/50 ares-cut">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Who</th>
                    {isPotluck && <th className="text-left py-3 px-4">Bringing</th>}
                    {isVolunteer && <th className="text-left py-3 px-4">Prep Hrs</th>}
                    <th className="text-left py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {signups.map(entry => (
                    <tr key={entry.id} className={`border-b border-zinc-800/30 transition-colors ${entry.attended ? "bg-emerald-500/5" : ""}`}>
                      <td className="py-3 px-4">
                        {canManage ? (
                          <button 
                            onClick={() => toggleAttendance(entry.user_id, entry.attended)}
                            className={`transition-colors ${entry.attended ? "text-emerald-500" : "text-zinc-700 hover:text-zinc-500"}`}
                          >
                            {entry.attended ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                          </button>
                        ) : (
                          <div className={entry.attended ? "text-emerald-500" : "text-zinc-800"}>
                            {entry.attended ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <img src={entry.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${entry.user_id}`}
                            alt="" className="w-6 h-6 ares-cut-sm bg-zinc-800" />
                          <span className={`text-sm font-bold ${entry.attended ? "text-white" : "text-zinc-400"}`}>{entry.nickname || "ARES Member"}</span>
                        </div>
                      </td>
                      {isPotluck && <td className="py-3 px-4 text-sm text-zinc-300">{entry.bringing || "—"}</td>}
                      {isVolunteer && <td className="py-3 px-4 text-sm text-zinc-300">{entry.prep_hours || 0}</td>}
                      <td className="py-3 px-4 text-sm text-zinc-400">{entry.notes || "—"}</td>
                    </tr>
                  ))}
                  {signups.length === 0 && (
                    <tr><td colSpan={5} className="py-12 text-center text-zinc-600 text-sm">No RSVPs yet. Be the first!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sign Up Form */}
          <div className="bg-zinc-900/50 border border-zinc-800 ares-cut-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-ares-gold uppercase tracking-[0.2em]">
                {mySignup !== null ? "Update Your RSVP" : "RSVP to this Event"}
              </p>
              <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">ARES Event Protocol v3.0</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isPotluck && (
                <input
                  placeholder="What are you bringing? (e.g. chips & salsa)"
                  value={mySignup?.bringing || ""}
                  onChange={e => setMySignup(prev => ({ bringing: e.target.value, notes: prev?.notes || "", prep_hours: prev?.prep_hours || 0 }))}
                  className="w-full bg-zinc-800/40 border border-zinc-700/50 ares-cut-sm px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-ares-gold focus:ring-1 focus:ring-ares-gold/20 transition-all"
                />
              )}
              <input
                placeholder={isPotluck ? "Notes (dietary info, arrival time...)" : "Notes (arrival time, etc...)"}
                value={mySignup?.notes || ""}
                onChange={e => setMySignup(prev => ({ bringing: prev?.bringing || "", notes: e.target.value, prep_hours: prev?.prep_hours || 0 }))}
                className={`w-full ${isPotluck && isVolunteer ? 'md:col-span-2' : ''} bg-zinc-800/40 border border-zinc-700/50 ares-cut-sm px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-ares-gold focus:ring-1 focus:ring-ares-gold/20 transition-all`}
                style={(!isPotluck && !isVolunteer) ? { gridColumn: 'span 2' } : {}}
              />
              {isVolunteer && (
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 uppercase tracking-widest text-[10px] font-bold shrink-0">Prep Hrs</span>
                  <input
                    type="number" step="0.5" min="0" placeholder="0"
                    value={mySignup?.prep_hours || 0}
                    onChange={e => setMySignup(prev => ({ bringing: prev?.bringing || "", notes: prev?.notes || "", prep_hours: parseFloat(e.target.value) || 0 }))}
                    className="w-full md:w-32 bg-zinc-800/40 border border-zinc-700/50 ares-cut-sm px-4 py-3 text-sm text-white focus:outline-none focus:border-ares-gold focus:ring-1 focus:ring-ares-gold/20 transition-all"
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
                  className="flex flex-1 md:flex-none items-center justify-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 ares-cut-sm text-sm font-black uppercase tracking-widest transition-all"
                >
                  <Trash2 size={16} /> Cancel RSVP
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="my-12 p-8 bg-zinc-900/50 border border-zinc-800 ares-cut-lg text-center">
          <p className="text-sm text-zinc-300 mb-2">
            <span className="text-ares-gold font-bold">Verified Access Required</span>
          </p>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
            Sign-ups and provisions are restricted to verified ARES members to protect privacy.
          </p>
          {!isAuthenticated ? (
            <div>
              <a href="/login" className="px-6 py-3 bg-ares-gold hover:bg-yellow-400 text-black ares-cut-sm font-black text-xs uppercase tracking-widest inline-block transition-all shadow-lg shadow-ares-gold/20">Sign in with ARES ID</a>
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 mt-6 font-bold">
                Don&apos;t have an ARES ID? <a href="/about" className="text-ares-gold hover:underline">Contact us</a>
              </p>
            </div>
          ) : (
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold max-w-sm mx-auto">Your account is pending team administrator verification. If you have any questions, <a href="/about" className="text-ares-gold hover:underline">contact us</a>.</p>
          )}
        </div>
      )}
    </div>
  );
}
