import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import SEO from "../components/SEO";
import MetaTags from "../components/MetaTags";
import FAQSchema, { LOCAL_ROBOTICS_FAQS } from "../components/FAQSchema";
import ReviewSchema, { ARES_REVIEWS } from "../components/ReviewSchema";
import SpeakableSchema from "../components/SpeakableSchema";
import { GreekMeander } from "../components/GreekMeander";
import { sanitizeHtml } from "../utils/security";

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      <SEO title="Home" description="Building the future of robotics in Morgantown, West Virginia with the Mountaineer Mindset. ARES 23247." />
      <MetaTags />
      <FAQSchema faqs={LOCAL_ROBOTICS_FAQS} />
      <ReviewSchema reviews={ARES_REVIEWS} />
      <SpeakableSchema />
      
      {/* ─── HERO ─── */}
      <section className="relative w-full min-h-screen flex items-center overflow-hidden bg-obsidian">
        {/* Motif Background Isolated Layer */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none isolate" aria-hidden="true">
          <div
            className="absolute right-[-10%] top-[10%] w-[80%] h-[80%] opacity-[0.03] bg-contain bg-center bg-no-repeat rotate-12 bg-[url('/favicon.png')]"
          ></div>
          <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/90 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full pt-32 pb-24 flex flex-col items-start text-left">
          <div className="flex flex-col lg:flex-row lg:items-end gap-12 mb-12">
            <img
              src="/favicon.svg"
              alt="ARES 23247 Logo"
              fetchPriority="high"
              decoding="sync"
              className="w-40 md:w-56 lg:w-72 h-40 md:h-56 lg:h-72 object-contain drop-shadow-[0_0_50px_rgba(192,0,0,0.4)] shrink-0"
            />
            <div className="bg-transparent">
              <p className="text-ares-gold font-black uppercase tracking-[0.4em] text-[10px] md:text-xs mb-6 border-l-2 border-ares-gold pl-4">
                Appalachian Robotics & Engineering Society
              </p>
              <h1 className="text-[4rem] md:text-[8rem] lg:text-[12rem] font-black text-white leading-[0.8] uppercase tracking-tighter relative z-10 w-full xl:w-2/3">
                <span className="block mb-4 text-white">Engineered</span>
                <span className="bg-ares-red px-6 py-4 mt-4 inline-block ares-cut-sm shadow-2xl text-white">To Inspire</span>
              </h1>
            </div>
          </div>

          <div className="max-w-2xl mb-12 border-l border-white/10 pl-8">
            <div id="hero-mountaineer-mindset" className="text-xl md:text-2xl font-medium leading-relaxed text-marble/60">
              Building the future of West Virginia robotics with the <strong className="text-white font-black uppercase tracking-tight">Mountaineer Mindset</strong>. Proudly competing as <a href="https://www.firstinspires.org/robotics/ftc" target="_blank" rel="noopener noreferrer" className="text-white hover:text-ares-red transition-all font-black italic tracking-tighter">FIRST® Tech Challenge</a> Team #23247.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-8">
            <Link to="/about" className="clipped-button bg-ares-red hover:bg-white hover:text-ares-red transition-all shadow-[0_0_30px_rgba(192,0,0,0.3)] text-white px-12 py-5 text-xs font-black uppercase tracking-[0.2em] group">
              Meet the Team <ArrowRight size={18} className="inline ml-3 group-hover:translate-x-2 transition-transform" />
            </Link>
            <Link to="/sponsors" className="clipped-button bg-transparent border border-white/10 text-marble/40 hover:text-white hover:bg-white/5 hover:border-white/30 transition-all px-12 py-5 text-xs font-black uppercase tracking-[0.2em]">
              Support Mission
            </Link>
          </div>
        </div>
      </section>

      {/* ─── TECHNICAL SPECS (DARK CARDS) ─── */}
      <section className="py-40 bg-obsidian border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-12">
            <div className="max-w-2xl">
               <div className="inline-block bg-ares-cyan/10 text-ares-cyan px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-8 border border-ares-cyan/20">
                System Objectives
              </div>
              <h2 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tight text-white leading-none">Engineering <span className="text-ares-cyan">Precision</span></h2>
              <p className="text-marble/40 text-xl font-medium leading-relaxed">Precision meets community impact in our quest for the 2026 season.</p>
            </div>
            <div className="h-px flex-grow bg-white/5 mx-12 mb-6 hidden lg:block"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                title: "Engineering Excellence",
                body: "We build advanced, reliable software and custom hardware. Our robot is a model of West Virginia engineering and speed.",
                link: "/about",
                linkText: "Subsystem Specs",
                externalLink: "https://www.printables.com/@ARESFTC_3784306",
                externalLinkText: "View 3D Models",
                accent: "ares-red"
              },
              {
                title: "Outreach & Impact",
                body: "We share our mission with everyone. From the Spark! Center to local labs, we bring <a href='https://www.firstinspires.org/' target='_blank' rel='noopener noreferrer' class='hover:text-ares-cyan transition-colors font-black uppercase'><em>FIRST</em>®</a> to all of West Virginia.",
                link: "/outreach",
                linkText: "Our Impact",
                accent: "ares-cyan"
              },
              {
                title: "Mentorship Pipeline",
                body: "Our team learns from the best. With help from MARS mentors and local experts, we are training the leaders of tomorrow.",
                link: "/join",
                linkText: "Join the Mission",
                accent: "ares-gold"
              },
            ].map((card) => (
              <div key={card.title} className="bg-black/40 border border-white/5 p-12 ares-cut-lg flex flex-col h-full group backdrop-blur-sm hover:border-white/20 transition-all duration-500 relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-32 h-32 opacity-[0.02] -mr-8 -mt-8 bg-${card.accent} blur-3xl group-hover:opacity-10 transition-opacity`}></div>
                <h3 className="text-white text-3xl font-black mb-8 uppercase tracking-tighter group-hover:text-ares-gold transition-colors">{card.title}</h3>
                <p className="text-marble/40 text-lg leading-relaxed mb-10 flex-grow font-medium" dangerouslySetInnerHTML={{ __html: sanitizeHtml(card.body) }} />
                <div className="flex flex-col gap-6 items-start">
                  <Link to={card.link} className="text-white font-black text-xs tracking-widest uppercase hover:translate-x-3 transition-transform inline-flex items-center gap-3">
                    {card.linkText} <ArrowRight size={16} className={`text-${card.accent}`} />
                  </Link>
                  {card.externalLink && (
                    <a href={card.externalLink} target="_blank" rel="noopener noreferrer" className="text-marble/40 font-black text-xs tracking-widest uppercase hover:translate-x-3 transition-transform inline-flex items-center gap-3">
                      {card.externalLinkText} <ArrowRight size={16} className="text-ares-gold" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CALL TO ACTION SECTION ─── */}
      <GreekMeander variant="thin" opacity="opacity-10" className="relative -bottom-[1px] z-10" />
      <section className="py-40 obsidian-section relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-6xl md:text-[10rem] font-black mb-12 uppercase tracking-tighter leading-none">
            Join <span className="bg-ares-red px-6 py-2 ares-cut-sm text-white font-black">ARES</span>
          </h2>
          <p className="text-marble/40 text-2xl mb-16 leading-relaxed font-medium max-w-3xl mx-auto">
            Whether you&apos;re a student looking to build monsters of engineering or a sponsor looking to invest in the future, there is a place for you at the table.
          </p>
          <div className="flex flex-wrap justify-center gap-8">
            <Link to="/sponsors" className="clipped-button bg-ares-gold text-black hover:bg-white transition-all px-12 py-5 text-xl font-black">
              Become a Sponsor
            </Link>
            <Link to="/join" className="clipped-button bg-transparent border-2 border-white text-white hover:bg-white hover:text-obsidian transition-all px-12 py-5 text-xl font-black">
              Team Application
            </Link>
          </div>
        </div>
      </section>

      {/* ─── OUTREACH CALENDAR BANNER ─── */}
      <section className="py-24 bg-black border-y border-white/5 relative overflow-hidden">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5"></div>
         <div className="absolute right-0 top-0 w-1/3 h-full bg-ares-red/10 skew-x-[-20deg] translate-x-24"></div>
        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-12 relative z-10">
          <div className="text-center lg:text-left">
            <div className="bg-ares-red/20 text-ares-red px-4 py-1 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-4 border border-ares-red/30 inline-block">
              Operational Roadmap
            </div>
            <h3 className="text-4xl md:text-7xl font-black mb-4 uppercase tracking-tighter text-white">Event Calendar</h3>
            <p className="text-marble/40 text-xl font-medium max-w-xl">Tracks our upcoming demos, qualifiers, and community workshops.</p>
          </div>
          <Link
            to="/events"
            className="clipped-button bg-ares-red text-white hover:bg-white hover:text-ares-red transition-all shadow-[0_0_30px_rgba(192,0,0,0.3)] px-12 py-6 text-xs font-black uppercase tracking-[0.2em] group"
          >
            Launch Calendar <ArrowRight size={18} className="inline ml-3 group-hover:translate-x-2 transition-transform" />
          </Link>
        </div>
      </section>
    </div>
  );
}

