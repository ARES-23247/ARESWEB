import { motion } from "framer-motion";
import { Trophy, Activity, Clock, Zap, ExternalLink } from "lucide-react";
import { api } from "../api/client";

interface CompetitionBannerProps {
  eventKey: string;
  teamKey?: string;
}

interface TBARanking {
  team_key: string;
  rank: number;
}

interface TBAMatch {
  comp_level: string;
  match_number: number;
  alliances: {
    red: { team_keys: string[] };
    blue: { team_keys: string[] };
  };
}

export default function CompetitionBanner({ eventKey, teamKey = "frc23247" }: CompetitionBannerProps) {
  // Fetch Rankings
  const { data: rankingsRes } = api.tba.getRankings.useQuery({
    params: { eventKey }
  }, {
    queryKey: ["tba-rankings", eventKey],
  });

  // Fetch Matches
  const { data: matchesRes } = api.tba.getMatches.useQuery({
    params: { eventKey }
  }, {
    queryKey: ["tba-matches", eventKey],
  });

  const rankingsData = rankingsRes?.status === 200 ? rankingsRes.body : null;
  const matchesData = matchesRes?.status === 200 ? matchesRes.body : null;

  const myRanking = rankingsData?.rankings?.find((r: TBARanking) => r.team_key === teamKey);
  const nextMatch = matchesData?.matches?.find((m: TBAMatch) => 
    m.alliances.red.team_keys.includes(teamKey) || 
    m.alliances.blue.team_keys.includes(teamKey)
  );

  if (!rankingsData && !matchesData) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl z-50"
    >
      <div className="glass-card bg-black/80 backdrop-blur-2xl border border-ares-cyan/30 rounded-[2.5rem] p-4 md:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_20px_rgba(0,183,235,0.2)] flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
        {/* Animated Background Element */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-ares-cyan to-transparent animate-pulse" />
        
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 ares-cut-lg bg-ares-cyan/20 border border-ares-cyan/30 flex items-center justify-center relative shadow-[0_0_15px_rgba(0,183,235,0.3)]">
            <Activity className="text-ares-cyan animate-pulse" size={32} />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-ares-red rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
            </div>
          </div>
          
          <div>
            <h3 className="text-xl font-black text-white italic tracking-tighter flex items-center gap-2">
              LIVE COMPETITION INTEL
              <span className="text-xs not-italic font-bold bg-ares-red text-white px-2 py-0.5 rounded-full uppercase tracking-widest ml-2 shadow-lg shadow-ares-red/20">Active</span>
            </h3>
            <p className="text-marble/40 text-sm font-medium flex items-center gap-4 mt-1">
              {myRanking ? (
                <span className="flex items-center gap-1.5 text-ares-gold">
                  <Trophy size={14} /> Rank #{myRanking.rank}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-marble/50 italic">Initializing Rank...</span>
              )}
              <span className="w-1 h-1 bg-white/20 rounded-full" />
              {nextMatch ? (
                <span className="flex items-center gap-1.5 text-marble">
                  <Clock size={14} /> Next Match: {nextMatch.comp_level.toUpperCase()}{nextMatch.match_number}
                </span>
              ) : (
                <span className="text-marble/50">Awaiting Match...</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <a 
            href={`https://www.thebluealliance.com/event/${eventKey}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white/5 border border-white/10 ares-cut text-sm font-bold text-marble hover:bg-white/10 transition-all"
          >
            Full Stats <ExternalLink size={14} />
          </a>
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-ares-cyan text-black font-black ares-cut text-sm hover:shadow-[0_0_20px_rgba(0,183,235,0.4)] transition-all">
            Match Predictions <Zap size={14} className="fill-current" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
