import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Clock, Zap, Circle, UserMinus } from "lucide-react";
import { adminApi } from "../api/adminApi";

interface PresenceData {
  status: "active" | "idle" | "offline";
  timestamp: number;
}

interface ZulipPresences {
  [email: string]: {
    website?: PresenceData;
    ZulipMobile?: PresenceData;
    ZulipDesktop?: PresenceData;
    aggregated?: PresenceData;
  };
}

export default function TeamAvailability() {
  const [presences, setPresences] = useState<ZulipPresences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPresence = async () => {
    try {
      const data = await adminApi.get<{ success: boolean; presence: ZulipPresences; error?: string }>("/api/zulip/presence");
      if (data && data.success) {
        setPresences(data.presence);
        setError(null);
      } else {
        setError(data?.error || "Failed to fetch presence data");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPresence();
    const interval = setInterval(fetchPresence, 120000); // 2 minute polling
    return () => clearInterval(interval);
  }, []);

  // Compute highest priority status for a user across clients
  const getAggregatedStatus = (userObj: Record<string, PresenceData>): "active" | "idle" | "offline" => {
    if (userObj.aggregated?.status) return userObj.aggregated.status;
    const values = Object.values(userObj);
    if (values.some(v => v?.status === "active")) return "active";
    if (values.some(v => v?.status === "idle")) return "idle";
    return "offline";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-ares-cyan shadow-[0_0_10px_rgba(0,229,255,0.4)]";
      case "idle": return "bg-ares-gold shadow-[0_0_10px_rgba(255,184,28,0.4)]";
      default: return "bg-marble/20";
    }
  };

  const getBorderColor = (status: string) => {
    switch (status) {
      case "active": return "border-ares-cyan/30";
      case "idle": return "border-ares-gold/30";
      default: return "border-white/5";
    }
  };

  const getIcon = (status: string) => {
    switch (status) {
      case "active": return <Zap size={14} className="text-ares-cyan" />;
      case "idle": return <Clock size={14} className="text-ares-gold" />;
      default: return <UserMinus size={14} className="text-marble/40" />;
    }
  };

  // Convert map to array and sort: Active > Idle > Offline
  const sortedMembers = presences ? Object.entries(presences).map(([email, clients]) => {
    const status = getAggregatedStatus(clients as Record<string, PresenceData>);
    return { email, status };
  }).sort((a, b) => {
    const order = { active: 1, idle: 2, offline: 3 };
    return order[a.status] - order[b.status];
  }) : [];

  return (
    <div className="bg-obsidian/50 border border-white/5 ares-cut p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
          <Users size={16} className="text-ares-cyan" />
          Team Availability
        </h3>
        {presences && (
          <span className="text-[10px] font-bold text-marble/40 uppercase tracking-wider">
            {sortedMembers.filter(m => m.status === "active").length} Online
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-[250px] scrollbar-thin scrollbar-thumb-white/5 pr-2">
        {loading && !presences ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-50">
            <Circle className="text-marble/20 animate-pulse" size={24} />
            <span className="text-xs font-bold uppercase tracking-widest text-marble/40">Syncing Radar...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <span className="text-xs font-bold text-ares-danger-soft">{error}</span>
          </div>
        ) : sortedMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-50">
            <Users className="text-marble/20" size={24} />
            <span className="text-xs font-bold uppercase tracking-widest text-marble/40">No telemetry data</span>
          </div>
        ) : (
          <AnimatePresence>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {sortedMembers.map((member) => (
                <motion.div
                  key={member.email}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-3 ares-cut-sm bg-white/5 border transition-all flex items-center gap-3 ${getBorderColor(member.status)}`}
                >
                  <div className="relative">
                    <img 
                      src={`https://api.dicebear.com/9.x/bottts/svg?seed=${member.email}`} 
                      alt="Avatar" 
                      className="w-8 h-8 rounded-full border border-white/10 bg-obsidian"
                    />
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-obsidian ${getStatusColor(member.status)}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{member.email.split("@")[0]}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {getIcon(member.status)}
                      <span className="text-[9px] uppercase tracking-wider font-bold text-marble/40">
                        {member.status}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
