"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap, Cpu, Users, Award, BookOpen, RefreshCw } from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";
import SEO from "@/components/SEO";
import { logger } from "@/utils/logger";
import { PublicDataState } from "@/components/PublicDataState";

interface TeamMember {
  key: string;
  nickname: string;
  pronouns?: string;
  subteams: string[];
  memberType: "student" | "alumni" | "mentor" | "coach";
  avatar?: string;
  bio?: string;
  colleges?: string[];
}

const FILTER_SECTIONS = [
  { type: "all", label: "All Members", icon: <Users size={12} /> },
  { type: "student", label: "Students", icon: <Cpu size={12} /> },
  { type: "mentor", label: "Mentors", icon: <BookOpen size={12} /> },
  { type: "coach", label: "Coaches", icon: <Award size={12} /> },
  { type: "alumni", label: "Alumni", icon: <GraduationCap size={12} /> },
];

const MEMBER_TYPE_ORDER: Record<string, number> = {
  coach: 0,
  mentor: 1,
  student: 2,
  alumni: 3,
};

const PUBLIC_MEMBER_TYPES = ["student", "alumni", "mentor", "coach"] as const;
type PublicMemberType = (typeof PUBLIC_MEMBER_TYPES)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readTextArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function safeAvatarUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function parseTeamMember(value: unknown, index: number): TeamMember | null {
  if (!isRecord(value) || typeof value.memberType !== "string") return null;
  if (!PUBLIC_MEMBER_TYPES.includes(value.memberType as PublicMemberType)) return null;

  const memberType = value.memberType as PublicMemberType;
  const isStudent = memberType === "student";
  const colleges = isStudent ? [] : readTextArray(value, "colleges");
  return {
    key: `${memberType}-${readText(value, "nickname") ?? "ARES Member"}-${index}`,
    nickname: readText(value, "nickname") ?? "ARES Member",
    pronouns: isStudent ? undefined : readText(value, "pronouns"),
    subteams: isStudent ? [] : readTextArray(value, "subteams"),
    memberType,
    avatar: safeAvatarUrl(value.avatar),
    bio: isStudent ? undefined : readText(value, "bio"),
    colleges,
  };
}

export default function AboutPage() {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [roster, setRoster] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchRoster = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const response = await fetch("/api/profiles/about-roster");
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const data: unknown = await response.json();
      if (!isRecord(data) || !Array.isArray(data.members)) {
        throw new Error("HTTP 502: Invalid roster response");
      }
      const visibleMembers = data.members
        .map(parseTeamMember)
        .filter((member): member is TeamMember => member !== null);

      // Sort by role order, then nickname
      visibleMembers.sort((a, b) => {
        const orderA = MEMBER_TYPE_ORDER[a.memberType] ?? 99;
        const orderB = MEMBER_TYPE_ORDER[b.memberType] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.nickname.localeCompare(b.nickname);
      });

      setRoster(visibleMembers);
      setLoadError(null);
    } catch (err) {
      logger.error("Error fetching roster:", err);
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchRoster();
  }, [fetchRoster]);

  const filteredMembers = activeFilter === "all"
    ? roster
    : roster.filter((m) => m.memberType === activeFilter);

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      <SEO title="About Us" description="Meet the students, coaches, mentors, and alumni of ARES 23247. Learn about our mission to bring robotics and STEM education to Morgantown and West Virginia." />
      
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
                  Apply to Join the Roster <ArrowRight aria-hidden="true" size={12} className="text-ares-gold" />
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

            <fieldset className="mt-8">
              <legend className="sr-only">Filter the public team roster</legend>
              <div className="flex flex-wrap justify-center gap-2">
                {FILTER_SECTIONS.map((tab) => (
                  <button
                    key={tab.type}
                    type="button"
                    aria-pressed={activeFilter === tab.type}
                    onClick={() => setActiveFilter(tab.type)}
                    className={`px-4 py-2 rounded-xl text-[10px] uppercase font-bold tracking-wider transition-all duration-300 flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                      activeFilter === tab.type
                        ? "bg-ares-red text-white shadow-lg shadow-ares-red/20"
                        : "bg-white/5 text-marble/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span aria-hidden="true">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void fetchRoster(true)}
                  disabled={isLoading || isRefreshing}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-marble/80 hover:bg-white/10 hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <RefreshCw aria-hidden="true" size={12} />
                  Refresh roster
                </button>
              </div>
            </fieldset>
          </div>

          {/* Members Card Grid */}
          {loadError && (
            <div className="mb-8">
              <PublicDataState
                title={roster.length > 0 ? "The roster could not refresh" : "Unable to load the public roster"}
                message={roster.length > 0 ? "The last published roster remains visible below." : "The public roster service could not be reached."}
                diagnostic={loadError}
                onRetry={() => void fetchRoster(roster.length > 0)}
              />
            </div>
          )}
          {isRefreshing && <p role="status" className="mb-6 text-center text-sm text-ares-gold">Refreshing the public roster…</p>}
          {isLoading ? (
            <div role="status" className="col-span-full py-20 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-ares-red border-t-transparent rounded-full mx-auto" />
              <span className="sr-only">Loading the public roster…</span>
            </div>
          ) : loadError && roster.length === 0 ? null : filteredMembers.length === 0 ? (
            <div className="col-span-full text-center text-marble/75 p-20 glass-card ares-cut border border-white/10">
              No published team members match this filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 items-stretch">
              {filteredMembers.map((member) => (
                <div
                  key={member.key}
                  className="bg-white/5 border border-white/10 hero-card p-6 flex flex-col justify-between hover:border-ares-red/30 transition-all duration-300 group backdrop-blur-sm shadow-md"
                >
                  <div className="flex flex-col items-center text-center">
                    {/* PII Nickname compliance & avatar stack */}
                    <div className="w-16 h-16 rounded-2xl bg-black/45 border border-white/10 overflow-hidden p-2 group-hover:scale-105 transition-transform flex items-center justify-center relative shrink-0 shadow-inner">
                      {member.avatar ? (
                        <img src={member.avatar} alt={`${member.nickname}'s approved avatar`} loading="lazy" decoding="async" className="w-full h-full object-contain" />
                      ) : (
                        <Users aria-label="Approved avatar not provided" role="img" className="h-8 w-8 text-marble/75" />
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white mt-4 group-hover:text-ares-gold transition-colors font-heading leading-tight">
                      {member.nickname}
                    </h3>
                    <span className="mt-1.5 inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-ares-gold border border-white/5">
                      {member.memberType}
                    </span>
                    {member.pronouns && (
                      <span className="text-[10px] text-marble/70 mt-1 font-mono font-medium block">
                        ({member.pronouns})
                      </span>
                    )}
                    <p className="text-xs text-marble/70 mt-3 leading-relaxed font-medium">
                      {member.bio ?? "Bio not provided"}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/5">
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {member.subteams.map((subteam) => (
                        <span
                          key={subteam}
                          className="px-2 py-0.5 bg-ares-red text-white border border-ares-red text-[8px] font-black uppercase tracking-widest rounded-md"
                        >
                          {subteam}
                        </span>
                      ))}
                    </div>

                    {member.memberType === "alumni" && member.colleges && member.colleges.length > 0 && (
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
              { q: "Time Commitments?", a: "One major unified laboratory session each weekend, with optional weekday build slots for hardware developers." },
            ].map((faq) => (
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
