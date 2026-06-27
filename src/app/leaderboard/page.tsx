"use client";

import React from "react";
import { Link } from "react-router-dom";
import { Trophy, Award, Medal, Crown, Star, ArrowLeft } from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";
import SEO from "@/components/SEO";

interface LeaderboardUser {
  userId: string;
  nickname: string;
  memberType: "student" | "mentor" | "coach";
  avatar: string;
  badgeCount: number;
}

const MOCK_LEADERS: LeaderboardUser[] = [
  {
    userId: "mem_sina",
    nickname: "Sina",
    memberType: "student",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=sina",
    badgeCount: 14
  },
  {
    userId: "mem_gavin",
    nickname: "Gavin",
    memberType: "student",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=gavin",
    badgeCount: 11
  },
  {
    userId: "mem_elena",
    nickname: "Elena",
    memberType: "student",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=elena",
    badgeCount: 9
  },
  {
    userId: "mem_dave",
    nickname: "Coach Dave",
    memberType: "coach",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=dave",
    badgeCount: 8
  },
  {
    userId: "mem_kelley",
    nickname: "Coach Kelley",
    memberType: "coach",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=kelley",
    badgeCount: 7
  },
  {
    userId: "mem_andrew",
    nickname: "Mentor Andrew",
    memberType: "mentor",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=andrew",
    badgeCount: 5
  }
];

export default function LeaderboardPage() {
  const top3 = MOCK_LEADERS.slice(0, 3);
  const rest = MOCK_LEADERS.slice(3);

  // Podium arrangement: [2nd, 1st, 3rd]
  const podium = [top3[1], top3[0], top3[2]];

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      <SEO title="Leaderboard" description="Recognising the student innovators, mentors, and coaches who go above and beyond in engineering excellence and technical leadership." />
      {/* Hero Header */}
      <section className="py-28 bg-obsidian relative overflow-hidden flex items-center min-h-[50vh]">
        <GreekMeander variant="thin" opacity="opacity-25" className="absolute top-0 left-0" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          
          <div className="w-16 h-16 mx-auto bg-ares-gold/10 border border-ares-gold/20 rounded-2xl flex items-center justify-center ares-cut mb-6 backdrop-blur-sm">
            <Trophy size={32} className="text-ares-gold drop-shadow-[0_0_15px_rgba(255,191,0,0.5)] animate-bounce" />
          </div>

          <p className="text-ares-bronze uppercase tracking-[0.4em] text-[10px] font-black font-heading mb-4 animate-pulse">
            Championship standings
          </p>
          <h1 className="text-4xl md:text-7xl font-black text-white mb-6 uppercase tracking-tight font-heading">
            Team <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-xl text-white">Leaderboard</span>
          </h1>
          <p className="text-marble/85 text-base md:text-lg max-w-2xl mx-auto leading-relaxed border-t border-white/10 pt-6 mt-6">
            Recognising the student innovators, mentors, and coaches who go above and beyond in engineering excellence, community outreach impact, and technical leadership.
          </p>
        </div>
      </section>

      {/* Podium & Standings Section */}
      <section className="py-20 bg-black/10 border-y border-white/5 min-h-[60vh]">
        <div className="max-w-6xl mx-auto px-6">
          
          {/* Top 3 Podiums */}
          <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-8 mb-24">
            
            {/* 2nd Place */}
            <div className="flex flex-col items-center w-full md:w-56 order-2 md:order-1">
              <div className="text-center mb-4 space-y-1">
                <div className="w-16 h-16 rounded-full border-4 border-white/20 bg-black/45 overflow-hidden mx-auto shadow-md">
                  <img src={podium[0].avatar} alt="" className="w-full h-full object-cover" />
                </div>
                <h4 className="font-bold text-white uppercase text-sm leading-none">{podium[0].nickname}</h4>
                <span className="text-[8px] text-marble/40 uppercase tracking-widest">{podium[0].memberType}</span>
              </div>
              <div className="w-full h-44 bg-white/5 border border-white/5 rounded-t-2xl flex flex-col items-center justify-center p-4 relative overflow-hidden backdrop-blur-sm shadow-inner group hover:border-white/10 transition-colors">
                <Medal size={24} className="text-white/60 mb-2" />
                <span className="text-3xl font-black text-white/70 font-heading">2</span>
                <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-marble/60">
                  <Star size={12} className="text-white/60" /> {podium[0].badgeCount} badges
                </div>
              </div>
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center w-full md:w-60 order-1 md:order-2">
              <div className="text-center mb-4 space-y-1">
                <div className="w-20 h-20 rounded-full border-4 border-ares-gold bg-black/45 overflow-hidden mx-auto shadow-lg shadow-ares-gold/10">
                  <img src={podium[1].avatar} alt="" className="w-full h-full object-cover" />
                </div>
                <h4 className="font-bold text-white uppercase text-base leading-none">{podium[1].nickname}</h4>
                <span className="text-[8px] text-ares-gold uppercase tracking-widest">{podium[1].memberType}</span>
              </div>
              <div className="w-full h-56 bg-ares-gold/5 border border-ares-gold/20 rounded-t-2xl flex flex-col items-center justify-center p-4 relative overflow-hidden backdrop-blur-sm shadow-inner group hover:border-ares-gold/40 transition-colors">
                <Crown size={28} className="text-ares-gold mb-2" />
                <span className="text-4xl font-black text-ares-gold font-heading">1</span>
                <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-ares-gold">
                  <Star size={12} className="text-ares-gold" /> {podium[1].badgeCount} badges
                </div>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center w-full md:w-52 order-3">
              <div className="text-center mb-4 space-y-1">
                <div className="w-14 h-14 rounded-full border-4 border-ares-bronze bg-black/45 overflow-hidden mx-auto shadow-md">
                  <img src={podium[2].avatar} alt="" className="w-full h-full object-cover" />
                </div>
                <h4 className="font-bold text-white uppercase text-xs leading-none">{podium[2].nickname}</h4>
                <span className="text-[8px] text-marble/40 uppercase tracking-widest">{podium[2].memberType}</span>
              </div>
              <div className="w-full h-36 bg-ares-bronze/5 border border-ares-bronze/10 rounded-t-2xl flex flex-col items-center justify-center p-4 relative overflow-hidden backdrop-blur-sm shadow-inner group hover:border-ares-bronze/30 transition-colors">
                <Award size={22} className="text-ares-bronze mb-2" />
                <span className="text-2xl font-black text-ares-bronze/80 font-heading">3</span>
                <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-ares-bronze">
                  <Star size={12} className="text-ares-bronze" /> {podium[2].badgeCount} badges
                </div>
              </div>
            </div>

          </div>

          {/* Roster scroll tables */}
          <div className="max-w-3xl mx-auto bg-white/5 border border-white/5 rounded-2xl p-6 md:p-8 backdrop-blur-md shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 uppercase tracking-widest text-[9px] text-marble/45 font-bold">
                  <th className="py-4 font-black w-16 text-center">Rank</th>
                  <th className="py-4 font-black">Member</th>
                  <th className="py-4 font-black text-right">Badges</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {rest.map((user, idx) => (
                  <tr 
                    key={user.userId} 
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="py-4 text-center font-bold text-marble/35 font-mono">
                      {(idx + 4).toString().padStart(2, "0")}
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-black/45 border border-white/10 overflow-hidden shrink-0 shadow-inner">
                          <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-bold text-white uppercase group-hover:text-ares-gold transition-colors font-heading leading-none">
                            {user.nickname}
                          </p>
                          <span className="text-[8px] uppercase tracking-wider text-marble/40 mt-1 font-semibold block">
                            {user.memberType}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-white font-bold font-mono">
                        <Star size={12} className="text-ares-cyan" />
                        {user.badgeCount}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </section>
    </div>
  );
}
