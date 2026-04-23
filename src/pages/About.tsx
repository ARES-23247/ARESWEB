import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { GreekMeander } from "../components/GreekMeander";
import { MemberSection } from "../components/MemberSection";
import { publicApi } from "../api/publicApi";

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
  { type: "student", title: "Our Students", icon: "📚", desc: "The innovators, builders, and dreamers who bring ARES to life." },
  { type: "alumni", title: "Our Alumni", icon: "🎓", desc: "Where the ARES legacy carries forward — in classrooms, labs, and careers." },
  { type: "mentor", title: "Our Mentors", icon: "🔧", desc: "Technical experts shaping the next generation of West Virginia engineers." },
  { type: "coach", title: "Our Coaches", icon: "🏆", desc: "The strategic leaders guiding ARES to championship-grade performance." },
];


export default function About() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicApi.get<{ members: TeamMember[] }>("/api/profile/team-roster")
      .then((data) => { setMembers(data.members || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const grouped = SECTION_ORDER.map(section => ({
    ...section,
    items: members.filter(m => m.member_type === section.type),
  })).filter(section => section.items.length > 0);

  return (
    <div className="flex flex-col w-full">
      <SEO title="About Us" description="Learn about ARES 23247, our mission, and the students driving FIRST Robotics forward in West Virginia." />
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
                <span className="bg-ares-red px-4 py-2 mt-2 inline-block ares-cut text-white">Our Community?</span>
              </h2>
              <p className="text-obsidian/70 text-lg">
                We recruit students from 6th–12th grade who possess grit, determination, and a hunger for innovation.
              </p>
            </div>
            <div className="md:col-span-2 space-y-8 text-lg leading-relaxed">
              <p>
                In the <a href="https://www.firstinspires.org/robotics/ftc" target="_blank" rel="noopener noreferrer" className="hover:text-ares-red transition-colors underline decoration-ares-red/30 underline-offset-4"><em>FIRST</em>® Tech Challenge</a>, we don&apos;t just build robots; we build systems. Our members compete for awards recognized at the highest levels of global STEM competition, focusing on machine logic, creative engineering, and radical community impact.
              </p>
              <div className="bg-white border-l-4 border-ares-red hero-card p-8 shadow-sm group hover:border-ares-red">
                <h3 className="bg-ares-red py-1 px-3 rounded inline-block font-bold text-xs tracking-widest uppercase mb-6 font-heading text-white">What You&apos;ll Learn</h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm font-bold uppercase tracking-wider text-obsidian/60">
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
                      <li key={name} className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 bg-ares-bronze rotate-45"></span>
                        {isObj ? (
                          <a href={skill.link} target="_blank" rel="noopener noreferrer" className="hover:text-ares-red transition-colors underline decoration-ares-red/30 underline-offset-4">
                            {name}
                          </a>
                        ) : skill}
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
      <section className="py-16 bg-ares-red">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 font-heading uppercase">Ready to Join ARES?</h2>
          <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
            We welcome students from 6th–12th grade across Monongalia, Harrison, and Preston counties, SW PA, and anyone within driving distance of Morgantown. No experience needed — just bring your curiosity.
          </p>
          <Link
            to="/join"
            className="clipped-button bg-white text-ares-red hover:scale-105 hover:bg-marble transition-all shadow-[0_0_20px_rgba(192,0,0,0.4)] font-heading text-lg"
          >
            Apply to Join Our Team
          </Link>
        </div>
      </section>

      {/* ─── DYNAMIC TEAM ROSTER ─── */}
      {grouped.length > 0 && grouped.map(section => (
        <MemberSection key={section.type} section={section} />
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
                  Founding mentors and architects of the ARES community. In 2022, the Huss family integrated into the <a href="https://www.firstinspires.org/" target="_blank" rel="noopener noreferrer" className="hover:text-ares-red transition-colors underline decoration-ares-red/30 underline-offset-4"><em>FIRST</em>®</a> ecosystem, and robotics has since redefined their community impact.
                </p>
                <p>
                  Active across <a href="https://www.firstinspires.org/robotics/fll" target="_blank" rel="noopener noreferrer" className="hover:text-ares-red transition-colors underline decoration-ares-red/30 underline-offset-4"><em>FIRST</em>® LEGO League</a> and <a href="https://www.firstinspires.org/robotics/frc" target="_blank" rel="noopener noreferrer" className="hover:text-ares-red transition-colors underline decoration-ares-red/30 underline-offset-4"><em>FIRST</em>® Robotics Competition</a>, Dave and Kelley are dedicated to ensuring every student finds their place in the Mountaineer engineering legacy.
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
              { q: "School Requirements?", a: "We are community-based. We accept public students, homeschoolers, and HOPE scholars from Monongalia, Harrison, and Preston counties, SW PA, and anywhere within driving distance of Morgantown." },
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
