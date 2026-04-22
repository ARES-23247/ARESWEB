import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Award, Medal, Crown, Star, ArrowLeft } from "lucide-react";
import SEO from "../components/SEO";
import { publicApi } from "../api/publicApi";

interface LeaderboardUser {
  user_id: string;
  first_name: string;
  last_name: string;
  nickname: string;
  member_type: string;
  badge_count: number;
}

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    publicApi.get<{ leaderboard: LeaderboardUser[] }>("/api/leaderboard")
      .then(d => {
        if (!cancelled && d.leaderboard) {
          setLeaders(d.leaderboard);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-ares-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  // Define top 3 and the rest
  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  // Helper to reorder top3 for a podium display: [2nd, 1st, 3rd]
  const podium = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;

  return (
    <div className="min-h-screen bg-obsidian text-marble py-24 relative overflow-hidden">
      <SEO title="Team Leaderboard — ARES 23247" description="The most engaged students and mentors on Team ARES 23247." />
      
      {/* Ambient Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-ares-gold/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-ares-offwhite hover:text-white text-xs font-bold uppercase tracking-widest mb-12 transition-colors">
          <ArrowLeft size={16} /> Back to Portal
        </Link>
        <header className="mb-20 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-20 h-20 mx-auto bg-ares-gold/10 border border-ares-gold/20 flex items-center justify-center rounded-2xl mb-6 backdrop-blur-sm"
          >
            <Trophy size={40} className="text-ares-gold drop-shadow-[0_0_15px_rgba(255,191,0,0.5)]" />
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-4"
          >
            Team <span aria-hidden="true" className="text-transparent bg-clip-text bg-gradient-to-r from-ares-gold to-yellow-300 before:content-['Leaderboard']"></span>
            <span className="sr-only">Leaderboard</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-ares-offwhite max-w-xl mx-auto text-lg"
          >
            Recognizing the students and mentors who go above and beyond in engineering, outreach, and leadership.
          </motion.p>
        </header>

        {/* Top 3 Podium */}
        {podium.length > 0 && (
          <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-8 mb-24 h-auto md:h-80">
            {podium.map((user, idx) => {
              // Determine actual rank. For [2nd, 1st, 3rd] array, idx 0 is Rank 2, idx 1 is Rank 1, idx 2 is Rank 3.
              let rank = 1;
              let height = "h-64";
              let color = "text-ares-gold";
              let border = "border-ares-gold";
              let bg = "bg-ares-gold/10";
              let Icon = Crown;

              if (podium.length === 3) {
                if (idx === 0) { rank = 2; height = "h-56"; color = "text-ares-offwhite"; border = "border-ares-gray/40"; bg = "bg-white/5"; Icon = Medal; }
                if (idx === 1) { rank = 1; height = "h-72"; color = "text-ares-gold"; border = "border-ares-gold"; bg = "bg-ares-gold/10"; Icon = Crown; }
                if (idx === 2) { rank = 3; height = "h-48"; color = "text-ares-bronze"; border = "border-ares-bronze"; bg = "bg-ares-bronze/10"; Icon = Award; }
              }

              return (
                <motion.div
                  key={user.user_id}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + (idx * 0.1), type: "spring", stiffness: 100 }}
                  className="flex flex-col items-center w-full md:w-64"
                >
                  <Link to={`/roster/${user.user_id}`} className="group relative z-10 flex flex-col items-center mb-4 transition-transform hover:-translate-y-2">
                    <div className={`w-20 h-20 rounded-full border-4 ${border} bg-obsidian overflow-hidden mb-3 relative`}>
                      <img src={`https://api.dicebear.com/9.x/bottts/svg?seed=${user.user_id}`} alt="Avatar" className="w-full h-full object-cover" />
                      <div className={`absolute -bottom-2 -right-2 bg-obsidian rounded-full p-1 border-2 ${border}`}>
                         <Icon size={14} className={color} />
                      </div>
                    </div>
                    <p className="text-white font-black text-lg text-center leading-tight">
                      {user.nickname || user.first_name}
                    </p>
                    <p className="text-ares-gray text-[10px] font-bold uppercase tracking-widest">{user.member_type}</p>
                  </Link>

                  <div className={`w-full ${height} ${bg} border-t border-x ${border}/30 rounded-t-3xl flex flex-col items-center justify-start pt-6 relative overflow-hidden backdrop-blur-sm group`}>
                     <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                     <p className={`text-4xl font-black ${color}`}>{rank}</p>
                     <div className="mt-auto pb-6 flex items-center gap-2">
                       <Star size={16} className={color} />
                       <span className="text-white font-bold">{user.badge_count} Badges</span>
                     </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* The Rest of the Roster */}
        {rest.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <div className="bg-obsidian/40 border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-md">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 uppercase tracking-widest text-[10px] text-ares-gray">
                    <th className="py-4 font-bold w-16 text-center">Rank</th>
                    <th className="py-4 font-bold">Member</th>
                    <th className="py-4 font-bold text-right">Badges Earned</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {rest.map((user, idx) => (
                    <tr key={user.user_id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                      <td className="py-4 text-center font-bold text-ares-gray">{(idx + 4).toString().padStart(2, '0')}</td>
                      <td className="py-4">
                        <Link to={`/roster/${user.user_id}`} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-ares-gray-dark shrink-0 overflow-hidden border border-white/10 group-hover:border-white/60 transition-colors">
                            <img src={`https://api.dicebear.com/9.x/bottts/svg?seed=${user.user_id}`} alt="Avatar" className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="text-ares-offwhite font-bold group-hover:text-white transition-colors">
                              {user.first_name} {user.last_name || `"${user.nickname}"`}
                            </p>
                            <p className="text-[10px] uppercase tracking-widest text-ares-gray">{user.member_type}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="py-4 text-right">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-ares-offwhite font-bold text-xs">
                          <Award size={14} className="text-ares-red" />
                          {user.badge_count}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
