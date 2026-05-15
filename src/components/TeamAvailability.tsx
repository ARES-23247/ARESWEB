import { useState, useEffect, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Clock, Zap, UserMinus } from "lucide-react";
import { useGetPresence } from "../api/zulip";
import ZulipQuickChat from "./zulip/ZulipQuickChat";

interface PresenceData {
  status: "active" | "idle" | "offline";
  timestamp: number;
}

export default function TeamAvailability() {
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [_isPending, startTransition] = useTransition();

  const { data, isLoading, isError, error: queryError } = useGetPresence({
    refetchInterval: 120000, // 2 minute polling
  });

  useEffect(() => {
    startTransition(() => {
      if (isError && queryError) setError(queryError.message);
    });
  }, [isError, queryError]);

  const presences = data?.presence || null;

  useEffect(() => {
    startTransition(() => {
      if (data?.userNames) {
        setUserNames(data.userNames);
      }
      if (data?.userAvatars) {
        setUserAvatars(data.userAvatars);
      }
    });
  }, [data]);

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
      default: return <UserMinus size={14} className="text-marble/60" />;
    }
  };

  // PII-N01: Hash email to prevent discovery in Dicebear seed
  const getAvatarSeed = (email: string) => {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      const char = email.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  };

  // Convert map to array and sort: Active > Idle > Offline
  const sortedMembers = presences ? Object.entries(presences).map(([email, clients]) => {
    const status = getAggregatedStatus(clients as Record<string, PresenceData>);
    return { email, status, seed: getAvatarSeed(email) };
  }).sort((a, b) => {
    const order = { active: 1, idle: 2, offline: 3 };
    return order[a.status] - order[b.status];
  }) : [];

  return (
    <div className="bg-black/40 border border-white/5 ares-cut-lg p-10 h-full flex flex-col shadow-2xl backdrop-blur-sm relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-0 bg-ares-cyan group-hover:h-full transition-all duration-700"></div>
      <div className="flex items-center justify-between mb-10 relative z-10">
        <div>
          <h3 className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-3">
            <Users size={16} className="text-ares-cyan" />
            Team Activity Radar
          </h3>
          <div className="mt-2 text-marble/60 text-[8px] font-bold uppercase tracking-widest italic">Live Status Synchronization Active</div>
        </div>
        {presences && (
          <div className="flex items-center gap-4">
            <span className="text-[9px] font-bold text-ares-cyan uppercase tracking-widest px-3 py-1 bg-ares-cyan/10 border border-ares-cyan/20 ares-cut-sm">
              {sortedMembers.filter(m => m.status === "active").length} Active Members
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-[300px] scrollbar-thin scrollbar-thumb-white/10 pr-4 relative z-10">
        {isLoading && !presences ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
            <div className="w-12 h-12 border-2 border-ares-cyan/20 border-t-ares-cyan rounded-full animate-spin"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-marble/60">Fetching Activity...</span>
          </div>
        ) : isError || error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="px-4 py-2 bg-ares-red/10 border border-ares-red/30 text-ares-red text-[9px] font-bold uppercase tracking-widest ares-cut-sm">
              Connection Issue: {error}
            </div>
          </div>
        ) : sortedMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
            <Users className="text-marble/20" size={32} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-marble/60">No Active Activity Found</span>
          </div>
        ) : (
          <AnimatePresence>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedMembers.map((member) => (
                <motion.div
                  key={member.email}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02, x: 5 }}
                  className={`p-4 ares-cut-sm bg-white/5 border transition-all flex items-center gap-4 group/member ${getBorderColor(member.status)} hover:bg-white/10`}
                >
                  <div className="relative">
                    <img
                      src={userAvatars[member.email] || `https://api.dicebear.com/9.x/bottts/svg?seed=${member.seed}`}
                      alt={`${userNames[member.email] || member.email.split("@")[0]}'s avatar`}
                      className="w-10 h-10 rounded-full border border-white/10 bg-obsidian object-cover group-hover/member:border-white/30 transition-all"
                    />
                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-obsidian ${getStatusColor(member.status)}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white uppercase tracking-tight truncate group-hover/member:text-ares-cyan transition-colors">
                      {userNames[member.email] || member.email.split("@")[0]}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {getIcon(member.status)}
                      <span className="text-[8px] uppercase tracking-widest font-bold text-marble/60 group-hover/member:text-marble/80 transition-colors">
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

      <div className="mt-8 pt-8 border-t border-white/5 relative z-10">
        <ZulipQuickChat />
      </div>
    </div>
  );
}
