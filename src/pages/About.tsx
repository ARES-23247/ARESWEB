import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { GreekMeander } from "../components/GreekMeander";

interface TeamMember {
  user_id: string;
  nickname: string;
  avatar: string;
  pronouns?: string;
  subteams?: string;
  member_type: string;
  bio?: string;
  fun_fact?: string;
  favorite_first_thing?: string;
  colleges?: string;
  employers?: string;
}

const SECTION_ORDER = [
  { type: "coach", title: "Our Coaches", icon: "🏆", desc: "The strategic leaders guiding ARES to championship-grade performance." },
  { type: "mentor", title: "Our Mentors", icon: "🔧", desc: "Technical experts shaping the next generation of West Virginia engineers." },
  { type: "student", title: "Our Students", icon: "📚", desc: "The innovators, builders, and dreamers who bring ARES to life." },
  { type: "alumni", title: "Our Alumni", icon: "🎓", desc: "Where the ARES legacy carries forward — in classrooms, labs, and careers." },
];

function MemberCard({ member }: { member: TeamMember }) {
  const subteams = typeof member.subteams === "string" ? JSON.parse(member.subteams || "[]") : (member.subteams || []);
  const colleges = typeof member.colleges === "string" ? JSON.parse(member.colleges || "[]") : [];

  return (
    <Link to={`/profile/${member.user_id}`} className="group block">
      <div className="hero-card bg-white border border-ares-bronze/10 p-6 text-center transition-all duration-300 group-hover:border-ares-red/30 group-hover:shadow-lg">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-marble border border-ares-bronze/20 overflow-hidden p-2 group-hover:scale-105 transition-transform">
          <img
            src={member.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${member.user_id}`}
            alt=""
            className="w-full h-full object-contain"
          />
        </div>
        <h4 className="text-obsidian font-bold text-base mb-0.5 group-hover:text-ares-red transition-colors">
          {member.nickname || "ARES Member"}
        </h4>
        {member.pronouns && (
          <p className="text-obsidian/40 text-xs mb-2">{member.pronouns}</p>
        )}
        {subteams.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center mb-2">
            {(subteams as string[]).slice(0, 3).map((team: string) => (
              <span key={team} className="px-2 py-0.5 bg-ares-red/5 text-ares-red/70 text-[9px] font-bold rounded-full uppercase tracking-wider">
                {team}
              </span>
            ))}
          </div>
        )}
        {member.member_type === "alumni" && colleges.length > 0 && (
          <div className="flex justify-center gap-1.5 mt-2">
            {(colleges as { domain: string }[]).slice(0, 3).map((col: { domain: string }, i: number) => (
              <BrandLogo key={i} domain={col.domain} fallbackIcon={GraduationCap} className="w-5 h-5" />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function About() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/team-roster")
      .then(r => r.json())
      .then((data) => { setMembers((data as { members: TeamMember[] }).members || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const grouped = SECTION_ORDER.map(section => ({
    ...section,
    items: members.filter(m => m.member_type === section.type),
  })).filter(section => section.items.length > 0);

  return (
    <div className="flex flex-col w-full">
      {/* ─── HERO ─── */}
      <section className="py-32 bg-obsidian text-marble relative overflow-hidden">
        <GreekMeander variant="thin" opacity="opacity-40" className="absolute top-0 left-0" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <p className="text-ares-bronze uppercase tracking-[0.4em] text-xs font-bold mb-6 font-heading">Our Community</p>
          <h1 className="text-5xl md:text-8xl font-bold text-white mb-8 font-heading uppercase">About ARES</h1>
          <p className="text-marble/70 text-xl max-w-2xl mx-auto leading-relaxed border-t border-ares-bronze/20 pt-8 mt-8">
            We are the <span className="text-white font-bold">Appalachian Robotics & Engineering Society</span>. 
            More than a team, we are a training ground for the next generation of West Virginia&apos;s technical elite.
          </p>
        </div>
      </section>

      {/* ─── THE MISSION ─── */}
      <section className="py-24 bg-marble text-obsidian">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 items-start">
            <div className="md:col-span-1">
              <h2 className="text-3xl md:text-4xl font-bold text-obsidian mb-6 font-heading uppercase leading-tight">
                Who Joins <br />
                <span className="bg-ares-red px-4 py-2 mt-2 inline-block rounded-xl" style={{ backgroundColor: '#c00000', color: '#ffffff' }}>Our Community?</span>
              </h2>
              <p className="text-obsidian/70 text-lg">
                We recruit students from 6th–12th grade who possess grit, determination, and a hunger for innovation.
              </p>
            </div>
            <div className="md:col-span-2 space-y-8 text-lg leading-relaxed">
              <p>
                In the <em>FIRST</em>® Tech Challenge, we don&apos;t just build robots; we build systems. Our members compete for awards recognized at the highest levels of global STEM competition, focusing on machine logic, creative engineering, and radical community impact.
              </p>
              <div className="bg-white border-l-4 border-ares-red hero-card p-8 shadow-sm group hover:border-ares-red">
                <h3 className="bg-ares-red py-1 px-3 rounded inline-block font-bold text-xs tracking-widest uppercase mb-6 font-heading" style={{ backgroundColor: '#c00000', color: '#ffffff' }}>What You&apos;ll Learn</h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm font-bold uppercase tracking-wider text-obsidian/60">
                  {[
                    "Mechanical Systems", "Electrical Engineering", "Java Programming", "CAD & 3D Design", 
                    "Technical Writing", "Strategic Game Theory", "Graphic Design", "Project Logistics", 
                    "Community Outreach", "Marketing & Branding", "Video Production", "Rapid Prototyping"
                  ].map((skill) => (
                    <li key={skill} className="flex items-center gap-3">
                      <span className="w-1.5 h-1.5 bg-ares-bronze rotate-45"></span>
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── JOIN CTA ─── */}
      <section className="py-16 bg-ares-red">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 font-heading uppercase">Ready to Join ARES?</h2>
          <p className="text-[#e5e5e5] text-lg mb-8 max-w-2xl mx-auto">
            We welcome students from 6th–12th grade across Monongalia and Harrison counties. No experience needed — just bring your curiosity.
          </p>
          <Link
            to="/join"
            className="clipped-button bg-white text-ares-red hover:scale-105 hover:bg-marble transition-all shadow-[0_0_20px_#cc3333] font-heading text-lg"
            style={{ color: '#c00000' }}
          >
            Apply to Join Our Team
          </Link>
        </div>
      </section>

      {/* ─── DYNAMIC TEAM ROSTER ─── */}
      {grouped.length > 0 && grouped.map(section => (
        <section key={section.type} className={`py-24 ${section.type === "coach" || section.type === "student" ? "bg-white" : section.type === "alumni" ? "bg-obsidian text-marble" : "bg-marble"}`}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <span className="text-4xl mb-4 block">{section.icon}</span>
              <h2 className={`text-4xl md:text-5xl font-bold mb-4 font-heading uppercase ${section.type === "alumni" ? "text-white" : "text-obsidian"}`}>
                {section.title}
              </h2>
              <p className={`text-lg max-w-2xl mx-auto ${section.type === "alumni" ? "text-marble/60" : "text-obsidian/50"}`}>
                {section.desc}
              </p>
              <div className="w-24 h-1 bg-ares-red mx-auto mt-6"></div>
            </div>
            <div className={`grid gap-6 ${section.items.length <= 2 ? "grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto" : section.items.length <= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"}`}>
              {section.items.map(member => (
                <MemberCard key={member.user_id} member={member} />
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Fallback if no profiles exist yet */}
      {loading && (
        <section className="py-24 bg-obsidian text-marble">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-ares-red border-t-transparent rounded-full mx-auto" />
          </div>
        </section>
      )}

      {!loading && grouped.length === 0 && (
        <section className="py-24 bg-obsidian text-marble">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 font-heading uppercase">Our Mentors</h2>
              <div className="w-24 h-1 bg-ares-red mx-auto"></div>
            </div>
            <div className="bg-marble/5 border border-ares-bronze/20 hero-card p-12 text-center group hover:border-ares-red/50">
              <h3 className="text-4xl font-bold text-ares-bronze mb-6 font-heading group-hover:text-white transition-colors">Dave Huss & Kelley Burd-Huss</h3>
              <div className="space-y-6 text-lg text-marble/60 leading-relaxed max-w-2xl mx-auto italic">
                <p>
                  Founding mentors and architects of the ARES community. In 2022, the Huss family integrated into the <em>FIRST</em>® ecosystem, and robotics has since redefined their community impact.
                </p>
                <p>
                  Active across <em>FIRST</em>® LEGO League and <em>FIRST</em>® Robotics Challenge, Dave and Kelley are dedicated to ensuring every student finds their place in the Mountaineer engineering legacy.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── QUICK ANSWERS (FAQS) ─── */}
      <section className="py-24 bg-white border-t border-ares-bronze/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-bold text-obsidian mb-4 font-heading uppercase">Quick Answers</h2>
            <p className="text-ares-red font-bold tracking-widest uppercase text-sm">Frequently Asked Questions</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { q: "Our Mission?", a: "To bridge the untapped talent within West Virginia with the technical opportunities of the global stage." },
              { q: "Prerequisites?", a: "Zero. Many of our roster are FLL veterans, others are dual-rostering with MARS FRC, but most start with just a drive to learn." },
              { q: "School Requirements?", a: "We are community-based. We accept Monongalia and Harrison county public students, homeschoolers, and HOPE scholars." },
              { q: "Cost of Entry?", a: "Zero. Our operations are fully funded by the generous support of our sponsors and the ARES community donors." },
              { q: "The Season?", a: "Rules drop in September. Build season begins in December. High-stakes competition rounds run through May." },
              { q: "Time Commitment?", a: "One major weekend team meeting per week, with optional weekday lab openings for technical iteration." },
              { q: "Technical Barriers?", a: "None. We exist to teach you. From Java coding to Fusion 360 CAD, we provide the curriculum and the tools." },
              { q: "Where We Meet?", a: "ARES HQ is located within the dedicated MARS RoboticS facility at Mountaineer Middle School." },
              { q: "Is it enjoyable?", a: "Radical fun is a core value of the ARES mission." },
            ].map((faq) => (
              <div key={faq.q} className="marble-card hero-card p-8 group">
                <h3 className="text-obsidian font-bold text-lg mb-4 font-heading group-hover:text-ares-bronze transition-colors uppercase italic">{faq.q}</h3>
                <p className="text-obsidian/70 text-base leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
