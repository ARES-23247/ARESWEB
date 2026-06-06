"use client";

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap, Cpu, Users, Award, BookOpen } from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface TeamMember {
  userId: string;
  nickname: string;
  pronouns?: string;
  subteams: string[];
  memberType: "student" | "alumni" | "mentor" | "coach" | "parent";
  avatar: string;
  bio?: string;
  funFact?: string;
  colleges?: string[];
}

const FILTER_SECTIONS = [
  { type: "all", label: "All Members", icon: <Users size={12} /> },
  { type: "student", label: "Students", icon: <Cpu size={12} /> },
  { type: "mentor", label: "Mentors", icon: <BookOpen size={12} /> },
  { type: "coach", label: "Coaches", icon: <Award size={12} /> },
  { type: "alumni", label: "Alumni", icon: <GraduationCap size={12} /> }
];

const MEMBER_TYPE_ORDER: Record<string, number> = {
  coach: 0,
  mentor: 1,
  student: 2,
  alumni: 3
};

export default function AboutPage() {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [roster, setRoster] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRoster = async () => {
      try {
        const querySnapshot = await getDocs(
          query(collection(db, "user_profiles"), where("showOnAbout", "==", true))
        );
        const membersList = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            userId: doc.id,
            nickname: data.nickname || "ARES Member",
            pronouns: data.pronouns || "",
            subteams: data.subteams || [],
            memberType: data.memberType || "student",
            avatar: data.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${doc.id}`,
            bio: data.bio || "",
            colleges: data.colleges || []
          } as TeamMember;
        });

        // Filter out parents
        const visibleMembers = membersList.filter(m => m.memberType !== "parent");

        // Sort by role order, then nickname
        visibleMembers.sort((a, b) => {
          const orderA = MEMBER_TYPE_ORDER[a.memberType] ?? 99;
          const orderB = MEMBER_TYPE_ORDER[b.memberType] ?? 99;
          if (orderA !== orderB) return orderA - orderB;
          return a.nickname.localeCompare(b.nickname);
        });

        setRoster(visibleMembers);
      } catch (err) {
        console.error("Error fetching roster:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRoster();
  }, []);

  const filteredMembers = activeFilter === "all" 
    ? roster 
    : roster.filter(m => m.memberType === activeFilter);

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      {/* ─── HERO ─── */}
      <section className="py-28 bg-obsidian relative overflow-hidden flex items-center min-h-[50vh]">
        <GreekMeander variant="thin" opacity="opacity-25" className="absolute top-0 left-0" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <p className="text-ares-bronze uppercase tracking-[0.4em] text-[10px] font-black font-heading mb-4 animate-pulse">
            Our Community & Heritage
          </p>
          <h1 className="text-4xl md:text-7xl font-black text-white mb-6 uppercase tracking-tight font-heading">
            About <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-xl text-white">ARES</span>
          </h1>
          <p className="text-marble/80 text-base md:text-lg max-w-2xl mx-auto leading-relaxed border-t border-white/10 pt-6 mt-6">
            We are the <strong className="text-white font-bold">Appalachian Robotics & Engineering Society</strong> (FTC #23247). More than a team, we serve as an incubator for West Virginia&apos;s next generation of technical leaders.
          </p>
        </div>
      </section>

      {/* ─── INSTITUTIONAL LEGACY & STRATEGY ─── */}
      <section className="py-20 bg-black/30 border-y border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Philosophy & Mindset */}
            <div className="space-y-6">
              <h2 className="text-3xl font-black uppercase text-white font-heading tracking-tight leading-none">
                The Mountaineer <br />
                <span className="text-ares-gold">Mindset Ethos</span>
              </h2>
              <div className="border-l-4 border-ares-bronze pl-5 italic text-marble/85 leading-relaxed text-sm space-y-4">
                <p>
                  &ldquo;Robotics is hard. Code breaks, gears slip, and systems bind. But with Grit, Determination, and relentless Innovation, we conquer technical boundaries.&rdquo;
                </p>
                <p className="text-xs font-bold uppercase text-ares-bronze not-italic tracking-widest font-heading mt-2">
                  — Supported by FRC 2614 MARS
                </p>
              </div>
              <p className="text-xs text-marble/65 leading-relaxed">
                Competing in the <em>FIRST</em>® Tech Challenge, we don&apos;t just assemble kits; we engineer complex, high-frequency, telemetry-driven systems from scratch. Our students learn industry-grade CAD modeling, software versioning, and mathematical control theory.
              </p>
            </div>

            {/* Right: Core Vehicle Philosophy Callout Card */}
            <div className="bg-white/5 border border-white/10 p-8 rounded-2xl relative overflow-hidden ares-cut group hover:border-ares-red/30 transition-colors">
              <div className="absolute top-0 right-0 w-32 h-32 bg-ares-red/5 rounded-full blur-2xl group-hover:bg-ares-red/10 transition-all"></div>
              <span className="px-3 py-1 bg-ares-red text-white text-[9px] font-black uppercase tracking-wider rounded-md font-heading">
                Our Primary Principle
              </span>
              <h3 className="text-xl font-bold text-white mt-4 font-heading uppercase group-hover:text-ares-gold transition-colors">
                &ldquo;The robots are the vehicle; the students are the cargo.&rdquo;
              </h3>
              <p className="text-xs text-marble/70 mt-3 leading-relaxed">
                Winning awards and qualifying for championships represents our dedication, but our ultimate product is the long-term professional development, technical confidence, and leadership progression of West Virginia&apos;s youth.
              </p>
              <div className="mt-6">
                <Link
                  to="/join"
                  className="text-white font-bold text-xs uppercase tracking-widest inline-flex items-center gap-2 hover:translate-x-1.5 transition-transform"
                >
                  Apply to Join the Roster <ArrowRight size={12} className="text-ares-red" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DYNAMIC ROSTER GRID ─── */}
      <section className="py-24 bg-obsidian">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white font-heading">
              Our Championship Roster
            </h2>
            <p className="text-xs text-marble/60 uppercase tracking-widest mt-2 font-semibold">
              Meet the Innovators, Mentors, and Alumni of ARES
            </p>

            {/* Filter Tabs */}
            <div className="flex flex-wrap justify-center gap-2 mt-8">
              {FILTER_SECTIONS.map(tab => (
                <button
                  key={tab.type}
                  onClick={() => setActiveFilter(tab.type)}
                  className={`px-4 py-2 rounded-xl text-[10px] uppercase font-bold tracking-wider transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                    activeFilter === tab.type
                      ? "bg-ares-red text-white shadow-lg shadow-ares-red/20"
                      : "bg-white/5 text-marble/50 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Members Card Grid */}
          {isLoading ? (
            <div className="col-span-full py-20 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-ares-red border-t-transparent rounded-full mx-auto" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="col-span-full text-center text-marble/35 p-20 glass-card ares-cut border border-white/10">
              No team members found for this filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 items-stretch">
              {filteredMembers.map(member => (
                <div
                  key={member.userId}
                  className="bg-white/5 border border-white/10 hero-card p-6 flex flex-col justify-between hover:border-ares-red/30 transition-all duration-300 group backdrop-blur-sm shadow-md"
                >
                  <div className="flex flex-col items-center text-center">
                  {/* PII Nickname compliance & avatar stack */}
                  <div className="w-16 h-16 rounded-2xl bg-black/45 border border-white/10 overflow-hidden p-2 group-hover:scale-105 transition-transform flex items-center justify-center relative shrink-0 shadow-inner">
                    <img
                      src={member.avatar}
                      alt={member.nickname}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <h3 className="text-base font-bold text-white mt-4 group-hover:text-ares-gold transition-colors font-heading leading-tight">
                    {member.nickname}
                  </h3>
                  {member.pronouns && (
                    <span className="text-[10px] text-marble/40 mt-1 font-mono font-medium block">
                      ({member.pronouns})
                    </span>
                  )}
                  <p className="text-xs text-marble/70 mt-3 leading-relaxed font-medium">
                    {member.bio}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5">
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {member.subteams.map(subteam => (
                      <span
                        key={subteam}
                        className="px-2 py-0.5 bg-ares-red/10 text-ares-red border border-ares-red/10 text-[8px] font-black uppercase tracking-widest rounded-md"
                      >
                        {subteam}
                      </span>
                    ))}
                  </div>

                  {member.memberType === "alumni" && member.colleges && (
                    <div className="flex items-center justify-center gap-1.5 mt-3 text-[9px] font-mono text-ares-gold uppercase font-bold">
                      <GraduationCap size={12} /> {member.colleges[0].split(".")[0]}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>

      {/* ─── QUICK FAQS SECTION ─── */}
      <section className="py-24 bg-black/10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white font-heading">
              Quick Answers
            </h2>
            <p className="text-xs text-marble/60 uppercase tracking-widest mt-2 font-semibold">
              Frequently Asked Questions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { q: "Our Core Mission?", a: "To establish a premium robotics pipeline for West Virginia students, driving technical curiosity and engineering excellence." },
              { q: "Technical Prerequisites?", a: "Zero. Most members start with no programming or manufacturing experience. We train students from safety basics to Java OOP." },
              { q: "Geographic Limits?", a: "We accept FLL and FTC students from Monongalia, Harrison, and SW Pennsylvania who can drive to our Morgantown labs." },
              { q: "Costs to Participate?", a: "None. All parts, entry fees, hotel travel, and tools are funded by our amazing corporate sponsors and partners." },
              { q: "The Build Season?", a: "Games reveal in September. We construct prototypes in fall, build code in winter, and compete from January through May." },
              { q: "Time Commitments?", a: "One major unified laboratory session each weekend, with optional weekday build slots for hardware developers." }
            ].map(faq => (
              <div
                key={faq.q}
                className="bg-white/5 border border-white/10 p-8 rounded-2xl hero-card hover:border-ares-red/20 transition-colors group"
              >
                <h3 className="text-white font-bold text-base font-heading uppercase group-hover:text-ares-bronze transition-colors">
                  {faq.q}
                </h3>
                <p className="text-xs text-marble/70 mt-3 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
