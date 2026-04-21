import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SEO from "../components/SEO";
import { GreekMeander } from "../components/GreekMeander";

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      <SEO title="Home" description="Building the future of West Virginia robotics with the Mountaineer Mindset. ARES 23247." />
      {/* ─── HERO ─── */}
      <section className="relative w-full min-h-[95vh] flex items-center overflow-hidden bg-obsidian">
        {/* Motif Background Isolated Layer */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ isolation: 'isolate' }}>
          <div
            className="absolute right-[-10%] top-[10%] w-[80%] h-[80%] opacity-[0.05] bg-contain bg-center bg-no-repeat rotate-12"
            style={{ backgroundImage: "url('/favicon.png')" }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/90 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full pt-20 pb-16 flex flex-col items-start text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-8 md:gap-12 lg:gap-16 mb-6">
            <img 
              src="/favicon.svg" 
              alt="ARES 23247 Logo" 
              className="w-32 md:w-56 lg:w-[22rem] h-32 md:h-56 lg:h-[22rem] object-contain drop-shadow-[0_0_25px_rgba(192,0,0,0.6)] shrink-0" 
            />
            <div>
              <div className="inline-block bg-[#111111] px-2 py-1 mb-3 rounded shadow-lg">
                <p className="text-ares-bronze font-bold uppercase tracking-[0.4em] text-sm md:text-base font-heading m-0">
                  Appalachian Robotics & Engineering Society
                </p>
              </div>
              <h1 className="text-6xl md:text-[7rem] lg:text-[10rem] font-bold text-white leading-[0.85] uppercase font-heading relative z-10 w-full xl:w-2/3">
                <span className="bg-[#111111] px-4 py-2 rounded-xl inline-block mb-2 shadow-2xl">Engineered</span> <br />
                <span className="bg-ares-red px-6 py-2 pb-3 mt-4 inline-block rounded-2xl shadow-[0_20px_25px_-5px_#080808]" style={{ backgroundColor: '#c00000', color: '#ffffff' }}>To Inspire</span>
              </h1>
            </div>
          </div>

          <div className="max-w-2xl mb-10 border-l-4 border-ares-bronze pl-6">
            <div id="hero-mountaineer-mindset" className="text-xl md:text-2xl font-medium leading-relaxed p-3 rounded-lg inline-block" style={{ backgroundColor: '#111111', color: '#cccccc' }}>
              Building the future of West Virginia robotics with the <strong style={{ backgroundColor: '#111111', color: '#ffffff' }}>Mountaineer Mindset</strong>. <em style={{ backgroundColor: '#111111', color: '#ffffff' }}>FIRST</em>® Tech Challenge Team #23247.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 mt-4">
            <Link to="/about" className="clipped-button bg-ares-red hover:bg-ares-bronze transition-all shadow-xl" style={{ backgroundColor: '#c00000', color: '#ffffff' }}>
              Meet the Team
            </Link>
            <Link to="/sponsors" className="clipped-button bg-[#111111] border-2 border-ares-bronze text-ares-bronze hover:bg-ares-bronze hover:text-white transition-all">
              Support Our Mission
            </Link>
          </div>
        </div>
      </section>

      {/* ─── TECHNICAL SPECS (MARBLE CARDS) ─── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 font-heading">Our Objectives</h2>
              <p className="text-ares-gray text-lg">Engineering precision meets community impact in our quest for the 2026 season.</p>
            </div>
            <div className="h-1 flex-grow bg-ares-bronze/10 mx-8 mb-4 hidden md:block"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                title: "Engineering Excellence",
                body: "We build advanced, reliable software and custom hardware. Our robot is a model of West Virginia engineering and speed.",
                link: "/about",
                linkText: "Subsystem Specs",
              },
              {
                title: "Outreach & Impact",
                body: "We share our mission with everyone. From the Spark! Center to local labs, we bring <em>FIRST</em>® to all of West Virginia.",
                link: "/outreach",
                linkText: "Our Impact",
              },
              {
                title: "Mentorship Pipeline",
                body: "Our team learns from the best. With help from MARS mentors and local experts, we are training the leaders of tomorrow.",
                link: "/join",
                linkText: "Join the Mission",
              },
            ].map((card) => (
              <div key={card.title} className="marble-card hero-card p-10 flex flex-col h-full group">
                <h3 className="text-ares-red text-2xl font-bold mb-6 font-heading group-hover:text-ares-bronze transition-colors">{card.title}</h3>
                <p className="text-obsidian/70 text-base leading-relaxed mb-8 flex-grow">{card.body}</p>
                <Link to={card.link} className="text-ares-red font-bold text-sm tracking-widest uppercase hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                  <span style={{ backgroundColor: '#e8e8e8', color: '#c00000' }}>{card.linkText}</span> <ArrowRight size={16} className="text-ares-red" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CALL TO ACTION SECTION ─── */}
      <GreekMeander variant="thick" opacity="opacity-60" className="relative -bottom-[1px] z-10" />
      <section className="py-24 obsidian-section relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold mb-8 font-heading">
            Join <span className="bg-ares-red px-3 py-1 pb-2 rounded-xl" style={{ backgroundColor: '#c00000', color: '#ffffff' }}>ARES</span>
          </h2>
          <p className="text-marble/80 text-xl mb-12 leading-relaxed">
            Whether you&apos;re a student looking to build monsters of engineering or a sponsor looking to invest in the future of WV technology, there is a place for you at the table.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/sponsors" className="clipped-button bg-ares-bronze text-obsidian hover:bg-white hover:text-ares-red transition-all">
              Become a Sponsor
            </Link>
            <Link to="/join" className="clipped-button bg-transparent border-2 border-white text-white hover:bg-white hover:text-obsidian transition-all">
              Team Application
            </Link>
          </div>
        </div>
      </section>

      {/* ─── OUTREACH CALENDAR BANNER ─── */}
      <section className="py-20 bg-ares-red text-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="text-center md:text-left">
            <h3 className="text-3xl md:text-4xl font-bold mb-2 font-heading">Event Calendar</h3>
            <p className="text-white text-lg opacity-90 font-medium">Tracks our upcoming demos, qualifiers, and community workshops.</p>
          </div>
          <Link
            to="/events"
            className="clipped-button bg-obsidian text-marble hover:bg-ares-bronze transition-all shadow-2xl"
          >
            Open Event Calendar
          </Link>
        </div>
      </section>
    </div>
  );
}
