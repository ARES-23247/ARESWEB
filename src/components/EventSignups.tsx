import { useState, useEffect, useCallback } from "react";
import { ClipboardList, Plus, Save, RefreshCw, Trash2 } from "lucide-react";

interface SignupEntry {
  id: number;
  user_id: string;
  nickname: string;
  avatar: string;
  bringing: string;
  notes: string;
  is_own: boolean;
}

interface EventSignupsProps {
  eventId: string;
}

export default function EventSignups({ eventId }: EventSignupsProps) {
  const [signups, setSignups] = useState<SignupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [mySignup, setMySignup] = useState<{ bringing: string; notes: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSignups = useCallback(() => {
    fetch(`/api/events/${eventId}/signups`, { credentials: "include" })
      .then(r => r.json())
      .then((data) => {
        const typed = data as { signups: SignupEntry[]; authenticated: boolean; role: string | null };
        setSignups(typed.signups || []);
        setIsAuthenticated(typed.authenticated);
        setUserRole(typed.role);
        const own = (typed.signups || []).find((s: SignupEntry) => s.is_own);
        if (own) setMySignup({ bringing: own.bringing, notes: own.notes });
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
      body: JSON.stringify(mySignup || { bringing: "", notes: "" }),
    });
    setIsSaving(false);
    fetchSignups();
  };

  const handleRemove = async () => {
    await fetch(`/api/events/${eventId}/signups/me`, { method: "DELETE", credentials: "include" });
    setMySignup(null);
    fetchSignups();
  };

  if (loading) return null;

  return (
    <div className="mt-10 border-t border-zinc-800 pt-8">
      <h3 className="text-lg font-black flex items-center gap-2 mb-6">
        <ClipboardList size={20} className="text-ares-gold" />
        Sign-Up Sheet ({signups.length})
      </h3>

      {/* Table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              <th className="text-left py-2 px-2">Who</th>
              <th className="text-left py-2 px-2">Bringing</th>
              <th className="text-left py-2 px-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {signups.map(entry => (
              <tr key={entry.id} className="border-b border-zinc-800/30">
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <img src={entry.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${entry.user_id}`}
                      alt="" className="w-6 h-6 rounded-lg bg-zinc-800" />
                    <span className="text-sm font-bold text-white">{entry.nickname || "ARES Member"}</span>
                  </div>
                </td>
                <td className="py-3 px-2 text-sm text-zinc-300">{entry.bringing || "—"}</td>
                <td className="py-3 px-2 text-sm text-zinc-400">{entry.notes || "—"}</td>
              </tr>
            ))}
            {signups.length === 0 && (
              <tr><td colSpan={3} className="py-6 text-center text-zinc-600 text-sm">No sign-ups yet. Be the first!</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sign Up Form */}
      {isAuthenticated ? (
        userRole === "unverified" ? (
          <div className="bg-ares-red/5 border border-ares-red/20 rounded-xl p-6 text-center">
            <p className="text-sm text-zinc-300 mb-2">
              <span className="text-ares-red font-bold uppercase tracking-widest text-xs">Verification Required</span>
            </p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              You must be verified by a team administrator before you can sign up for events.
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-ares-gold uppercase tracking-wider">
              {mySignup !== null ? "Update Your Entry" : "Sign Up"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                placeholder="What are you bringing? (e.g. chips & salsa)"
                value={mySignup?.bringing || ""}
                onChange={e => setMySignup(prev => ({ bringing: e.target.value, notes: prev?.notes || "" }))}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-ares-gold"
              />
              <input
                placeholder="Notes (dietary info, arrival time...)"
                value={mySignup?.notes || ""}
                onChange={e => setMySignup(prev => ({ bringing: prev?.bringing || "", notes: e.target.value }))}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-ares-gold"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSignUp} disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-ares-gold/20 hover:bg-ares-gold/30 border border-ares-gold/30 text-ares-gold rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                {isSaving ? <RefreshCw size={14} className="animate-spin" /> : mySignup !== null ? <Save size={14} /> : <Plus size={14} />}
                {mySignup !== null ? "Update" : "Sign Up"}
              </button>
              {mySignup !== null && signups.some(s => s.is_own) && (
                <button onClick={handleRemove}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-sm font-bold transition-colors"
                >
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </div>
          </div>
        )
      ) : (
        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center text-sm text-zinc-500">
          <a href="/login" className="text-ares-gold hover:text-yellow-400 font-bold">Sign in</a> to sign up for this event.
        </div>
      )}
    </div>
  );
}
