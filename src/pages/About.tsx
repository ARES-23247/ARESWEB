import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Settings, Trophy } from "lucide-react";
import SEO from "../components/SEO";
import FAQSchema, { LOCAL_ROBOTICS_FAQS } from "../components/FAQSchema";
import EducationalCredentialSchema, { ARES_CREDENTIALS } from "../components/EducationalCredentialSchema";
import { GreekMeander } from "../components/GreekMeander";
import { MemberSection } from "../components/MemberSection";
import { useGetTeamRoster } from "../api";
import { type TeamMember } from "../components/MemberCard";

const SECTION_ORDER = [
  { type: "student", title: "Our Students", icon: "📚", desc: "The innovators, builders, and dreamers who bring ARES to life." },
  { type: "alumni", title: "Our Alumni", icon: "🎓", desc: "Where the ARES legacy carries forward — in classrooms, labs, and careers." },
  { type: "mentor", title: "Our Mentors", icon: "🔧", desc: "Technical experts shaping the next generation of West Virginia engineers." },
  { type: "coach", title: "Our Coaches", icon: "🏆", desc: "The strategic leaders guiding ARES to championship-grade performance." },
];


export default function About() {
  const { data: rosterRes, isLoading } = useGetTeamRoster();

  const members: TeamMember[] = useMemo(() => {
    const rawMembers = rosterRes?.members || [];
    
    return rawMembers.map((m): TeamMember => ({
      userId: m.userId,
      nickname: m.nickname || m.name || "ARES Member",
      name: m.name,
      avatar: m.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${m.userId}`,
      pronouns: m.pronouns,
      subteams: m.subteams,
      memberType: m.memberType || "student",
      bio: m.bio,
      funFact: m.funFact,
      favoriteFirstThing: m.favoriteFirstThing,
      colleges: m.colleges,
      employers: m.employers
    }));
  }, [rosterRes]);

  const grouped = useMemo(() => SECTION_ORDER.map(section => ({
    ...section,
    items: members.filter((m: TeamMember) => 
      String(m.memberType || "").toLowerCase() === section.type.toLowerCase()
    ),
  })).filter(section => section.items.length > 0), [members]);

  return (
    <div className="flex flex-col w-full bg-obsidian">
      <SEO title="About Us" description="Learn about ARES 23247, our mission, and the students driving FIRST Robotics forward in Morgantown, West Virginia." />
      <FAQSchema faqs={LOCAL_ROBOTICS_FAQS} />
      <EducationalCredentialSchema credentials={ARES_CREDENTIALS} />
      {/* ─── HERO ─── */}
      <section className="py-40 bg-obsidian text-marble relative overflow-hidden">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none isolate" aria-hidden="true">
           <div className="absolute left-[10%] top-[20%] w-[40%] h-[40%] opacity-[0.03] bg-contain bg-no-repeat bg-[url('/favicon.png')]"></div>
        </div>
        <GreekMeander variant="thin" opacity="opacity-10" className="absolute top-0 left-0" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col items-center text-center">
            <div className="bg-ares-gold/10 text-ares-gold px-6 py-2 ares-cut-sm font-black uppercase tracking-[0.4em] text-[10px] mb-10 border border-ares-gold/20 shadow-[0_0_20px_rgba(212,175,55,0.1)]">
               Project Genesis // Since 2023
            </div>
            <h1 className="text-7xl md:text-[10rem] font-black text-white mb-10 uppercase tracking-tighter leading-[0.8]">
              About <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-marble/20">ARES</span>
            </h1>
            <p className="text-marble/40 text-xl max-w-3xl mx-auto leading-relaxed font-medium">
              We are the <span className="text-white font-black uppercase">Appalachian Robotics & Engineering Society</span>. 
              More than a team, we are a training ground for the next generation of West Virginia&apos;s technical elite.
            </p>
          </div>
        </div>
      </section>

      {/* ─── THE MISSION ─── */}
      <section className="py-32 bg-obsidian text-marble border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-20 items-start">
            <div className="lg:col-span-5">
              <div className="inline-block bg-ares-red/10 text-ares-red px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-8 border border-ares-red/20">
                Core Directives
              </div>
              <h2 className="text-5xl md:text-7xl font-black text-white mb-8 uppercase tracking-tighter leading-none">
                Who Joins <br />
                <span className="text-ares-red italic">The Ranks?</span>
              </h2>
              <p className="text-marble/40 text-xl font-medium leading-relaxed mb-10">
                We recruit students from 6th–12th grade who possess grit, determination, and a hunger for innovation.
              </p>
              <div className="h-1 w-24 bg-ares-red ares-cut-sm"></div>
            </div>
            <div className="lg:col-span-7 space-y-10">
              <p className="text-lg leading-relaxed text-marble/60 font-medium">
                In the <a href="https://www.firstinspires.org/robotics/ftc" target="_blank" rel="noopener noreferrer" className="text-white hover:text-ares-red transition-all font-black uppercase tracking-widest text-sm border-b border-white/10 pb-1">FIRST® Tech Challenge</a>, we don&apos;t just build robots; we build systems. Our members compete for awards recognized at the highest levels of global STEM competition, focusing on machine logic, creative engineering, and radical community impact.
              </p>
              <div className="bg-black/40 border border-white/5 ares-cut-lg p-10 backdrop-blur-sm relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                   <Settings className="w-40 h-40 text-white animate-spin-slow" />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-ares-red mb-10 flex items-center gap-4">
                  <span className="w-10 h-px bg-ares-red"></span> Neural Interface // Skill Acquisition
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">
                  {[
                    "Mechanical Systems", "Electrical Engineering", "Java Programming", 
                    { name: "CAD & 3D Design", link: "https://www.printables.com/@ARESFTC_3784306" }, 
                    "Technical Writing", "Strategic Game Theory", "Graphic Design", "Project Logistics", 
                    "Community Outreach", "Marketing & Branding", "Video Production", 
                    { name: "Rapid Prototyping", link: "https://www.printables.com/@ARESFTC_3784306" }
                  ].map((skill) => {
                    const isObj = typeof skill === "object";
                    const name = isObj ? skill.name : skill;
                    return (
                      <li key={name} className="flex items-center gap-4">
                        <div className="w-2 h-2 bg-ares-red ares-cut-sm shrink-0"></div>
                        {isObj ? (
                          <a href={skill.link} target="_blank" rel="noopener noreferrer" className="text-xs font-black uppercase tracking-widest text-white hover:text-ares-red transition-colors">
                            {name}
                          </a>
                        ) : (
                          <span className="text-xs font-black uppercase tracking-widest text-marble/40">{skill}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── JOIN CTA ─── */}
      <section className="py-40 bg-black border-y border-white/5 relative overflow-hidden group">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-ares-red/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="bg-ares-red/10 text-ares-red px-6 py-2 ares-cut-sm font-black uppercase tracking-[0.4em] text-[10px] mb-12 border border-ares-red/20 inline-block shadow-[0_0_20px_rgba(192,0,0,0.1)]">
            Active Recruitment
          </div>
          <h2 className="text-6xl md:text-[10rem] font-black text-white mb-12 uppercase tracking-tighter leading-none">
            Ready to <span className="text-ares-red">Deploy?</span>
          </h2>
          <p className="text-marble/40 text-2xl mb-16 max-w-3xl mx-auto font-medium leading-relaxed">
            We welcome students from 6th–12th grade across the tri-state area. No experience needed — we provide the hardware, the logic, and the legacy.
          </p>
          <Link
            to="/join"
            className="clipped-button bg-ares-red text-white hover:bg-white hover:text-ares-red transition-all shadow-[0_0_40px_rgba(192,0,0,0.3)] px-16 py-6 text-xs font-black uppercase tracking-[0.3em] group"
          >
            Initiate Application <ArrowRight size={18} className="inline ml-4 group-hover:translate-x-2 transition-transform" />
          </Link>
        </div>
      </section>

      {/* ─── DYNAMIC TEAM ROSTER ─── */}
      {grouped.length > 0 && grouped.map(section => (
        <MemberSection key={section.type} section={section} />
      ))}

      {/* Fallback if no profiles exist yet or loading */}
      {isLoading && (
        <section className="py-24 bg-obsidian text-marble">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-ares-red border-t-transparent rounded-full mx-auto" />
          </div>
        </section>
      )}

      {!isLoading && grouped.length === 0 && (
        <section className="py-32 bg-obsidian text-marble">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex flex-col items-center text-center mb-24">
              <div className="bg-ares-red/10 text-ares-red px-6 py-2 ares-cut-sm font-black uppercase tracking-[0.4em] text-[10px] mb-8 border border-ares-red/20">
                System Architects // Founding
              </div>
              <h2 className="text-5xl md:text-8xl font-black text-white mb-6 uppercase tracking-tighter">Command <span className="text-ares-red italic">Structure</span></h2>
            </div>
            <div className="bg-black/40 border border-white/5 ares-cut-lg p-16 text-center group hover:border-white/20 transition-all duration-700 shadow-2xl backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-[0.01] group-hover:opacity-[0.03] transition-opacity">
                <Trophy className="w-64 h-64 text-white" />
              </div>
              <h3 className="text-4xl font-black text-white mb-10 uppercase tracking-tighter group-hover:text-ares-gold transition-colors leading-none">Dave Huss & Kelley Burd-Huss</h3>
              <div className="space-y-8 text-xl text-marble/40 leading-relaxed max-w-3xl mx-auto italic font-medium">
                <p>
                  Founding mentors and architects of the ARES community. In 2022, the Huss family integrated into the <a href="https://www.firstinspires.org/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-ares-red transition-colors font-black uppercase tracking-widest text-xs border-b border-white/10 pb-1">FIRST® ecosystem</a>, and robotics has since redefined their community impact.
                </p>
                <p>
                  Active across <span className="text-white font-black uppercase tracking-widest text-xs">FIRST® LEGO League</span> and <span className="text-white font-black uppercase tracking-widest text-xs">FIRST® Robotics Competition</span>, Dave and Kelley are dedicated to ensuring every student finds their place in the Mountaineer engineering legacy.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── QUICK ANSWERS (FAQS) ─── */}
      <section className="py-32 bg-obsidian border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center text-center mb-24">
             <div className="bg-white/5 text-marble/40 px-6 py-2 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-8 border border-white/10">
               Direct Support // FAQ
            </div>
            <h2 className="text-5xl md:text-7xl font-black text-white mb-6 uppercase tracking-tight">System <span className="text-ares-gold">Briefing</span></h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { q: "Our Mission?", a: "To connect West Virginia students with the world's best technical opportunities." },
              { q: "Prerequisites?", a: "Zero. Many members come from other teams, but most start with just a drive to learn." },
              { q: "School Requirements?", a: "We accept all local students, including those in public school or homeschool, who can drive to Morgantown." },
              { q: "Cost of Entry?", a: "Zero. Our sponsors and donors pay for everything so any student can join." },
              { q: "The Season?", a: "We get the rules in September. We build the robot in December. Competitions run through May." },
              { q: "Time Commitment?", a: "We have one big meeting each weekend. You can also come to the lab during the week to work on projects." },
              { q: "Technical Barriers?", a: "None. We teach you everything. You will learn to code in Java and design parts in 3D." },
              { q: "Where We Meet?", a: "Our main office is at Mountaineer Middle School in Morgantown." },
              { q: "Is it enjoyable?", a: "Having fun while working hard is a core part of being on ARES." },
            ].map((faq) => (
              <div key={faq.q} className="bg-black/40 border border-white/5 ares-cut-lg p-12 group backdrop-blur-sm hover:border-white/20 transition-all duration-500 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-0 bg-ares-gold group-hover:h-full transition-all duration-700"></div>
                <h3 className="text-white font-black text-[10px] mb-6 group-hover:text-ares-gold transition-colors uppercase tracking-[0.3em]">{faq.q}</h3>
                <p className="text-marble/40 text-base leading-relaxed font-medium">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
