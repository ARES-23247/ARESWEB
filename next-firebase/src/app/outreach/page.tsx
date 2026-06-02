"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Target, Clock, Heart, MapPin, Activity, ArrowRight, X, Check } from "lucide-react";

interface OutreachLog {
  id: number;
  title: string;
  date: string;
  location: string;
  hours: number;
  peopleReached: number;
  impactSummary: string;
}

const MOCK_OUTREACH_LOGS: OutreachLog[] = [
  {
    id: 1,
    title: "Morgantown Public Library STEM Day",
    date: "2026-04-12",
    location: "Morgantown, WV",
    hours: 24,
    peopleReached: 120,
    impactSummary: "Demonstrated claw intakes and mecanum chassis maneuvers to over a hundred elementary school children, encouraging sign-ups for local middle-school FLL teams."
  },
  {
    id: 2,
    title: "Spark! WV Bridge Building Workshop",
    date: "2026-03-20",
    location: "Morgantown, WV",
    hours: 32,
    peopleReached: 85,
    impactSummary: "Developed and executed our custom WV Bridge Design Exhibit, teaching children about structural engineering, load symmetry, and technical prototyping."
  },
  {
    id: 3,
    title: "Monongalia County Science Fair Support",
    date: "2026-02-15",
    location: "Westover, WV",
    hours: 18,
    peopleReached: 250,
    impactSummary: "ARES students served as assistant safety wands and technical coordinators, demonstrating robot mechanisms and scoring rules during science fair break periods."
  }
];

export default function OutreachPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !description) return;
    setIsSubmitted(true);
    setTimeout(() => {
      setName("");
      setEmail("");
      setPhone("");
      setOrganization("");
      setDescription("");
    }, 1500);
  };

  const totals = MOCK_OUTREACH_LOGS.reduce((acc, log) => ({
    hours: acc.hours + log.hours,
    reach: acc.reach + log.peopleReached,
    events: acc.events + 1
  }), { hours: 145, reach: 680, events: 14 }); // including historical starting values

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      
      {/* Hero */}
      <section className="py-28 bg-obsidian relative overflow-hidden flex items-center min-h-[50vh]">
        <div 
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-[0.03] bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/favicon.ico')" }}
        ></div>
        
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 ares-cut-sm bg-ares-red/10 border border-ares-red/20 text-ares-red text-[10px] font-black uppercase tracking-widest mb-6">
            <Activity size={10} className="animate-pulse" />
            Active Impact Reporting
          </div>
          <h1 className="text-4xl md:text-7xl font-black text-white mb-6 uppercase tracking-tight font-heading">
            Engineering <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-xl text-white inline-block mt-1">Impact</span>
          </h1>
          <p className="text-marble/85 text-base md:text-lg max-w-2xl mx-auto leading-relaxed border-t border-white/10 pt-6 mt-6">
            ARES #23247 is committed to expanding STEM accessibility across West Virginia. We believe technology is most powerful when shared to inspire future generations of innovators.
          </p>
        </div>
      </section>

      {/* Live Impact Stats Grid */}
      <section className="py-12 bg-black/20 border-y border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                label: "Community Reach",
                value: `${totals.reach}+`,
                desc: "Estimated students and families touched by ARES live robotics demonstrations.",
                color: "bg-ares-red",
                icon: <Target className="text-white" size={24} />
              },
              {
                label: "Service Hours",
                value: `${totals.hours} hrs`,
                desc: "Student leadership hours spent teaching, mentoring FLL teams, and volunteering.",
                color: "bg-ares-gold",
                icon: <Clock className="text-black" size={24} />
              },
              {
                label: "Completed Events",
                value: totals.events.toString(),
                desc: "Unique workshops, STEM demonstrations, and county science fair support runs completed.",
                color: "bg-ares-bronze",
                icon: <Heart className="text-white" size={24} />
              }
            ].map(stat => (
              <div
                key={stat.label}
                className="bg-white/5 border border-white/10 p-8 rounded-2xl hero-card hover:border-white/20 transition-all shadow-xl"
              >
                <div className={`w-12 h-12 ${stat.color} ares-cut flex items-center justify-center shadow-md mb-6`}>
                  {stat.icon}
                </div>
                <div className="text-4xl font-black text-white font-heading tracking-tight mb-2">
                  {stat.value}
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-ares-gold mb-3">
                  {stat.label}
                </div>
                <p className="text-xs text-marble/75 italic leading-relaxed">
                  {stat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Spark! Initiative Spotlight */}
      <section className="py-24 bg-obsidian">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-black text-white uppercase tracking-tight font-heading">
              Sparking Curiosity <br />
              <span className="text-ares-red">In West Virginia</span>
            </h2>
            <p className="text-sm text-marble/80 leading-relaxed">
              ARES is a proud technical partner of the <strong>Spark! Imagination and Science Center</strong> in Morgantown. We design and construct interactive exhibits that bring civil and mechanical engineering principles directly to elementary school children.
            </p>
            <p className="text-sm text-marble/80 leading-relaxed">
              Our centerpiece project—the <strong>WV Bridge Exhibit</strong>—teaches early physics, load distribution, and truss design, letting kids build bridge models and test their strengths.
            </p>
            <div className="pt-4 flex gap-4">
              <a 
                href="https://sparkwv.org" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="px-5 py-2.5 bg-ares-red text-white text-xs uppercase font-black tracking-wider ares-cut-sm hover:scale-105 transition-all shadow-md"
              >
                Support Spark!
              </a>
              <Link
                href="/join"
                className="px-5 py-2.5 bg-white/5 border border-white/10 text-marble text-xs uppercase font-black tracking-wider ares-cut-sm hover:bg-white/10 transition-all"
              >
                Join Outreach
              </Link>
            </div>
          </div>

          {/* Graphical Leaf Cut Stack */}
          <div className="relative justify-self-center lg:justify-self-end w-full max-w-[320px] aspect-square">
            <div className="absolute inset-0 bg-ares-red ares-cut-lg rotate-3 shadow-2xl border-4 border-obsidian flex items-center justify-center">
              <Target size={96} className="text-white/20 animate-pulse" />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-ares-gold text-black p-6 ares-cut font-black -rotate-3 shadow-xl text-center text-xs tracking-wider uppercase font-heading">
              Empowering <br /> Future Pioneers
            </div>
          </div>
        </div>
      </section>

      {/* Chronological Impact Feed */}
      <section className="py-24 bg-black/10 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 mb-16">
            <div>
              <h2 className="text-3xl font-black uppercase text-white font-heading tracking-tight">
                Championship Impact Log
              </h2>
              <p className="text-xs text-marble/65 uppercase tracking-widest mt-1 font-semibold">
                Timeline of STEM Service Demos
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-ares-gold font-bold uppercase tracking-widest text-[10px] flex items-center gap-1.5 hover:translate-x-1.5 transition-transform cursor-pointer"
            >
              Request a STEM Demo <ArrowRight size={12} />
            </button>
          </div>

          <div className="space-y-6">
            {MOCK_OUTREACH_LOGS.map(log => (
              <div
                key={log.id}
                className="bg-white/5 border border-white/5 p-8 rounded-2xl ares-cut-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-white/10 transition-all duration-300"
              >
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 text-marble/50 text-[10px] font-mono uppercase font-bold">
                    <MapPin size={10} className="text-ares-red" />
                    <span>{log.location}</span>
                    <span>&middot;</span>
                    <span>{log.date}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white group-hover:text-ares-gold transition-colors font-heading leading-tight uppercase">
                    {log.title}
                  </h3>
                  <p className="text-xs text-marble/75 leading-relaxed max-w-2xl">
                    {log.impactSummary}
                  </p>
                </div>

                <div className="bg-ares-red text-white py-3 px-5 rounded-2xl ares-cut text-center shadow-md shrink-0">
                  <span className="text-[8px] uppercase tracking-wider block opacity-70">Impact Reach</span>
                  <span className="text-2xl font-black font-heading mt-0.5 block">{log.peopleReached}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Volunteer CTA */}
      <section className="py-24 bg-obsidian border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6 uppercase tracking-tight font-heading">
            Need a Team Demo?
          </h2>
          <p className="text-sm text-marble/80 mb-10 max-w-xl mx-auto leading-relaxed">
            Whether you are hosting a local elementary school fair, a library STEM project, or a local corporate technology event—ARES student leaders are happy to volunteer!
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-8 py-4 bg-ares-red hover:bg-ares-red-dark text-white font-black text-xs uppercase tracking-widest ares-cut-sm cursor-pointer shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2 mx-auto"
          >
            Get in Touch <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* Demo Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative w-full max-w-xl bg-obsidian border border-white/10 p-8 md:p-12 ares-cut-lg shadow-2xl max-h-[90vh] overflow-y-auto z-50">
            <button 
              aria-label="Close modal"
              onClick={() => { setIsModalOpen(false); setIsSubmitted(false); }} 
              className="absolute top-6 right-6 text-marble/55 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-2xl font-black text-white tracking-tight mb-2">
              Request a <span className="text-ares-red font-bold font-heading">STEM Demo</span>
            </h3>
            <p className="text-xs text-marble/70 mb-8 leading-relaxed">
              Provide event details below, and our student logistics leads will verify schedule availability and reach out.
            </p>

            {isSubmitted ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-6 rounded-xl text-center space-y-3">
                <Check size={24} className="mx-auto" />
                <div className="font-bold">STEM Request Received!</div>
                <p className="text-xs opacity-85 leading-relaxed">
                  Our student outreach team will check lab schedule gaps and verify details via email shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-marble/45 mb-1.5">Your Name *</label>
                    <input 
                      type="text" 
                      required 
                      value={name} 
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-marble/45 mb-1.5">Email Address *</label>
                    <input 
                      type="email" 
                      required 
                      value={email} 
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-marble/45 mb-1.5">Organization</label>
                    <input 
                      type="text" 
                      value={organization} 
                      onChange={e => setOrganization(e.target.value)}
                      placeholder="e.g. Mountaineer School"
                      className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder-marble/20" 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-marble/45 mb-1.5">Phone (Optional)</label>
                    <input 
                      type="tel" 
                      value={phone} 
                      onChange={e => setPhone(e.target.value)}
                      placeholder="(304) 555-0199"
                      className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder-marble/20" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-marble/45 mb-1.5">Details & Dates *</label>
                  <textarea 
                    required 
                    rows={4}
                    value={description} 
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Tell us what you are hosting and potential schedule time slots..."
                    className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder-marble/20 resize-none" 
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-2.5 bg-ares-red hover:bg-ares-red-dark text-white text-[10px] font-black uppercase tracking-widest ares-cut-sm cursor-pointer shadow-md transition-all mt-4"
                >
                  Submit STEM Request
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
