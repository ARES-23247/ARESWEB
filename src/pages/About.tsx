export default function About() {
  return (
    <div className="flex flex-col w-full">
      {/* ─── HERO ─── */}
      <section className="py-32 bg-obsidian text-marble relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 meander-border opacity-20"></div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <p className="text-ares-bronze uppercase tracking-[0.4em] text-xs font-bold mb-6 font-heading">The Society</p>
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
              <h2 className="text-3xl md:text-4xl font-bold text-ares-red mb-6 font-heading uppercase leading-tight">
                Who Joins <br />
                <span className="text-ares-bronze">The Society?</span>
              </h2>
              <p className="text-obsidian/70 text-lg">
                We recruit students from 6th–12th grade who possess grit, determination, and a hunger for innovation.
              </p>
            </div>
            <div className="md:col-span-2 space-y-8 text-lg leading-relaxed">
              <p>
                In the <em>FIRST</em> Tech Challenge, we don&apos;t just build robots; we build systems. Our members compete for awards recognized at the highest levels of global STEM competition, focusing on machine logic, creative engineering, and radical community impact.
              </p>
              <div className="bg-white border-l-4 border-ares-red hero-card p-8 shadow-sm group hover:border-ares-red">
                <h3 className="text-ares-red font-bold text-xs tracking-widest uppercase mb-6 font-heading">Disciplinary Units</h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm font-bold uppercase tracking-wider text-obsidian/60">
                  {[
                    "Mechanical Systems", "Electrical Engineering", "Java Programming", "CAD & 3D Design", 
                    "Technical Writing", "Strategic Game Theory", "Graphic Intelligence", "Project Logistics", 
                    "Community Outreach", "Marketing Intelligence", "Video Production", "Rapid Prototyping"
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

      {/* ─── INTELLIGENCE BRIEF (FAQS) ─── */}
      <section className="py-24 bg-white border-t border-ares-bronze/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-bold text-obsidian mb-4 font-heading uppercase">Intelligence Brief</h2>
            <p className="text-ares-bronze font-bold tracking-widest uppercase text-sm">Frequently Asked Questions</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { q: "Our Mission?", a: "To bridge the untapped talent within West Virginia with the technical opportunities of the global stage." },
              { q: "Prerequisites?", a: "Zero. Many of our roster are FLL veterans, others are dual-rostering with MARS FRC, but most start with just a drive to learn." },
              { q: "School Requirements?", a: "We are community-based. We accept Monongalia and Harrison county public students, homeschoolers, and HOPE scholars." },
              { q: "Cost of Entry?", a: "Zero. Our operations are fully funded by the generous support of our sponsors and the ARES society donors." },
              { q: "The Season?", a: "Rules drop in September. Deployment begins in December. High-stakes competition rounds run through May." },
              { q: "Time Commitment?", a: "One major weekend deployment per week, with optional weekday lab openings for technical iteration." },
              { q: "Technical Barriers?", a: "None. We exist to teach you. From Java coding to Fusion 360 CAD, we provide the curriculum and the tools." },
              { q: "Deployment Site?", a: "ARES HQ is located within the dedicated MARS RoboticS facility at Mountaineer Middle School." },
              { q: "Is it enjoyable?", a: "Radical fun is a core directive of the ARES mission." },
            ].map((faq) => (
              <div key={faq.q} className="marble-card hero-card p-8 group">
                <h3 className="text-ares-red font-bold text-lg mb-4 font-heading group-hover:text-ares-bronze transition-colors uppercase italic">{faq.q}</h3>
                <p className="text-obsidian/70 text-base leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── THE LEADERSHIP ─── */}
      <section className="py-24 bg-obsidian text-marble">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 font-heading uppercase">The Command</h2>
            <div className="w-24 h-1 bg-ares-red mx-auto"></div>
          </div>
          <div className="bg-marble/5 border border-ares-bronze/20 hero-card p-12 text-center group hover:border-ares-red/50">
            <h3 className="text-4xl font-bold text-ares-bronze mb-6 font-heading group-hover:text-white transition-colors">Dave Huss & Kelley Burd-Huss</h3>
            <div className="space-y-6 text-lg text-marble/60 leading-relaxed max-w-2xl mx-auto italic">
              <p>
                Founding mentors and architects of the ARES society. In 2022, the Huss family integrated into the <em>FIRST</em> ecosystem, and robotics has since redefined their community impact.
              </p>
              <p>
                Active across <em>FIRST</em> LEGO League and <em>FIRST</em> Robotics Challenge, Dave and Kelley are dedicated to ensuring every student finds their place in the Mountaineer engineering legacy.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
