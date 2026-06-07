"use client";

import React, { useState } from "react";
import { ShieldCheck, BookOpen, Trophy, Users, ArrowRight, FileText, ChevronRight, Play, Cpu } from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";

interface ThinkAwardDoc {
  title: string;
  slug: string;
  category: "Software" | "Mechanical" | "Outreach" | "Control";
  desc: string;
  isExecutiveSummary: boolean;
}

const MOCK_DOCS: ThinkAwardDoc[] = [
  {
    title: "Drivetrain EKF Odometry Calibration",
    slug: "drivetrain-ekf-calibration",
    category: "Software",
    desc: "Detailed mathematical review of our Extended Kalman Filter state transitions and Mecanum drift correction.",
    isExecutiveSummary: true
  },
  {
    title: "Championship Season Outreach Strategy",
    slug: "outreach-strategy-2026",
    category: "Outreach",
    desc: "Bespoke business plan tracking STEM volunteer hours and local middle school FLL mentorship pipelines.",
    isExecutiveSummary: true
  },
  {
    title: "Flywheel Roller intake CNC Tolerances",
    slug: "flywheel-intake-machining",
    category: "Mechanical",
    desc: "Physical CAD modeling, machining steps, and intake load bind diagnostics.",
    isExecutiveSummary: false
  },
  {
    title: "Autonomous Path PID Control Loops",
    slug: "autonomous-pid-controls",
    category: "Control",
    desc: "Optimising autonomous routes using feed-forward voltage adjustments and high-frequency IMU gyro heading corrections.",
    isExecutiveSummary: false
  }
];

const MOCK_AWARDS = [
  {
    title: "Inspire Award Winner",
    eventName: "WV State Championship (2026)",
    desc: "Recognised as the model FTC team, showcasing technical excellence, robust engineering portfolio, and outstanding community outreach."
  },
  {
    title: "Think Award Winner",
    eventName: "Appalachian Qualifier (2026)",
    desc: "Awarded for the most complete engineering portfolio documenting design iterations, custom mechanics, and software logic."
  },
  {
    title: "Control Award Winner",
    eventName: "SW Pennsylvania Qualifier (2026)",
    desc: "Awarded for the best use of software logic, EKF odometry, and automated mechanisms during autonomous match plays."
  }
];

export default function JudgesHubPage() {
  const [activeTab, setActiveTab] = useState<"docs" | "specs" | "awards">("docs");

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      {/* Hero Header */}
      <section className="py-28 bg-obsidian relative overflow-hidden flex items-center min-h-[50vh]">
        <GreekMeander variant="thin" opacity="opacity-25" className="absolute top-0 left-0" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <p className="text-ares-bronze uppercase tracking-[0.4em] text-[10px] font-black font-heading mb-4 animate-pulse">
            Judges Evaluation Hub
          </p>
          <h1 className="text-4xl md:text-7xl font-black text-white mb-6 uppercase tracking-tight font-heading">
            Judges <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-xl text-white">Hub</span>
          </h1>
          <p className="text-marble/85 text-base md:text-lg max-w-2xl mx-auto leading-relaxed border-t border-white/10 pt-6 mt-6">
            Secure rapid-review portal for FTC competition judges. Access our complete **Think Award** engineering archives, CAD reveals, and community impact summaries in one unified dashboard.
          </p>
        </div>
      </section>

      {/* Main Judges Control Dashboard */}
      <section className="py-16 bg-black/10 border-y border-white/5 min-h-[60vh]">
        <div className="max-w-7xl mx-auto px-6">
          
          {/* Header Action panel */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12 border-b border-white/5 pb-6">
            <div className="flex bg-black/45 border border-white/5 p-1 rounded-xl gap-1">
              {[
                { id: "docs", label: "Think Portfolios", icon: <BookOpen size={10} /> },
                { id: "specs", label: "3D CAD Model", icon: <Cpu size={10} /> },
                { id: "awards", label: "Judged Awards", icon: <Trophy size={10} /> }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-ares-red text-white"
                      : "text-marble/45 hover:text-white"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <a
              href="/docs/ares_engineering_portfolio_2026.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-ares-gold hover:bg-ares-gold-soft text-black text-[9px] font-black uppercase tracking-widest ares-cut-sm flex items-center gap-2 transition-all shadow-md"
            >
              <FileText size={12} /> Download Think Portfolio PDF
            </a>
          </div>

          {/* Tab contents */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-stretch">
            
            {/* Left 2 columns - Dynamic Tabs */}
            <div className="lg:col-span-2 space-y-12">
              {activeTab === "docs" && (
                <div className="space-y-12">
                  {/* Executive Summaries */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-ares-gold flex items-center gap-2">
                      <ShieldCheck size={12} /> Curated Executive Summaries (Think Award Specs)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {MOCK_DOCS.filter(d => d.isExecutiveSummary).map(doc => (
                        <div
                          key={doc.slug}
                          className="bg-white/5 border border-ares-gold/25 p-6 rounded-2xl hero-card hover:border-ares-gold flex flex-col justify-between group transition-colors"
                        >
                          <div className="space-y-4">
                            <span className="px-2 py-0.5 bg-ares-gold/10 text-ares-gold border border-ares-gold/20 text-[8px] font-black uppercase tracking-widest rounded-md">
                              Priority Review
                            </span>
                            <h4 className="text-lg font-black text-white font-heading uppercase leading-tight group-hover:text-ares-gold transition-colors">
                              {doc.title}
                            </h4>
                            <p className="text-xs text-marble/75 leading-relaxed">
                              {doc.desc}
                            </p>
                          </div>
                          <div className="mt-8 flex justify-between items-center border-t border-white/5 pt-4">
                            <span className="text-[9px] font-mono text-marble/45 uppercase font-bold tracking-wider">
                              Category: {doc.category}
                            </span>
                            <ChevronRight size={14} className="text-marble/55 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Standard Technical Portfolios */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-marble/45 flex items-center gap-2">
                      <BookOpen size={12} /> Curated Technical Specifications
                    </h3>
                    <div className="space-y-4">
                      {MOCK_DOCS.filter(d => !d.isExecutiveSummary).map(doc => (
                        <div
                          key={doc.slug}
                          className="bg-white/5 border border-white/5 p-5 rounded-2xl hero-card hover:border-white/10 flex items-center justify-between group transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-black/45 border border-white/10 rounded-xl flex items-center justify-center text-marble group-hover:text-ares-gold transition-colors">
                              <FileText size={18} />
                            </div>
                            <div>
                              <h4 className="font-bold text-white uppercase text-sm leading-tight group-hover:text-ares-gold transition-colors">
                                {doc.title}
                              </h4>
                              <p className="text-[10px] text-marble/60 mt-1">
                                {doc.desc}
                              </p>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-marble/45 group-hover:translate-x-1 transition-transform" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "specs" && (
                <div className="space-y-6 h-full flex flex-col justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-ares-gold flex items-center gap-2">
                    <Cpu size={12} /> Interactive 3D Onshape CAD reveal
                  </h3>
                  
                  {/* Procedural CAD Viewer box */}
                  <div className="flex-1 aspect-video bg-black rounded-2xl border border-white/5 relative overflow-hidden flex flex-col items-center justify-center p-8 shadow-inner min-h-[300px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-ares-bronze/10 via-black to-black opacity-60 z-0"></div>
                    <div className="relative z-10 text-center space-y-4">
                      <Cpu className="text-ares-gold animate-bounce mx-auto" size={48} />
                      <h4 className="text-xl font-bold text-white uppercase tracking-tight font-heading">
                        Interactive Assembly Embed
                      </h4>
                      <p className="text-xs text-marble/70 max-w-sm mx-auto leading-relaxed">
                        Interactive WebGL specs loading directly from Team Onshape Workspace. Draco-compresses active meshes locally.
                      </p>
                      <button className="px-5 py-2.5 bg-ares-red hover:bg-ares-red-dark text-white text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer shadow-md inline-flex items-center gap-2">
                        <Play size={12} /> Load Onshape Assembly
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "awards" && (
                <div className="space-y-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-ares-gold flex items-center gap-2">
                    <Trophy size={12} /> Strategic Judged Recognition
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {MOCK_AWARDS.map((award, i) => (
                      <div
                        key={i}
                        className="bg-white/5 border border-white/10 p-6 rounded-2xl hero-card hover:border-ares-red/20 transition-all group relative overflow-hidden flex flex-col justify-between"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-ares-gold/5 blur-2xl rounded-full"></div>
                        <div className="space-y-3">
                          <span className="text-[8px] font-black text-ares-gold uppercase tracking-widest">
                            {award.eventName}
                          </span>
                          <h4 className="text-base font-bold text-white font-heading uppercase group-hover:text-ares-gold transition-colors">
                            {award.title}
                          </h4>
                          <p className="text-xs text-marble/70 leading-relaxed italic">
                            {award.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column - Snapshot Specs & Outreach Brief */}
            <div className="space-y-8 lg:col-span-1">
              {/* Snapshot Stats */}
              <div className="bg-white/5 border border-white/5 p-8 rounded-2xl hero-card flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black text-ares-cyan uppercase tracking-widest mb-6">
                    Audit Performance
                  </h3>
                  <div className="space-y-4 text-xs font-medium">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <span className="text-marble/75">Total Impact Events:</span>
                      <span className="font-bold text-white">14 Completed</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <span className="text-marble/75">Direct Community Reach:</span>
                      <span className="font-bold text-white">680+ Engaged</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <span className="text-marble/75">Software Test Coverage:</span>
                      <span className="font-bold text-ares-success">100% Function</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-6 mt-8">
                  <span className="text-[10px] uppercase font-bold text-marble/45 tracking-widest block">Total Service Hours</span>
                  <span className="text-4xl font-black text-ares-cyan font-heading mt-1 block">145 hrs</span>
                </div>
              </div>

              {/* Outreach Brief Card */}
              <div className="bg-white/5 border border-white/5 p-8 rounded-2xl hero-card relative overflow-hidden group hover:border-ares-gold/20 transition-colors">
                <div className="absolute top-0 right-0 w-24 h-24 bg-ares-gold/5 blur-2xl rounded-full"></div>
                <div className="space-y-4">
                  <Users className="text-ares-gold" size={24} />
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider font-heading group-hover:text-ares-gold transition-colors">
                    FLL Mentorship Pipeline
                  </h4>
                  <p className="text-xs text-marble/70 leading-relaxed">
                    We actively mentor three local middle-school FLL teams, providing safety wands, structural CAD templates, and autonomous drive help in our Morgantown laboratory workspace.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
