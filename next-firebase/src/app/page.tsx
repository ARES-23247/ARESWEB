"use client";

import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, LogIn, LogOut, ShieldCheck, Cpu, Calendar as CalendarIcon, ClipboardList } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { GreekMeander } from "@/components/GreekMeander";

export default function Home() {
  const { user, authorizedUser, loading, loginWithGoogle, logout } = useAuth();

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      {/* ─── HERO ─── */}
      <section className="relative w-full min-h-[85vh] flex items-center overflow-hidden bg-obsidian">
        {/* Motif Background Isolated Layer */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none isolate" aria-hidden="true">
          <div
            className="absolute right-[-10%] top-[10%] w-[85%] h-[85%] opacity-[0.05] bg-contain bg-center bg-no-repeat rotate-12"
            style={{ backgroundImage: "url('/favicon.ico')" }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/90 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full pt-12 pb-16 flex flex-col items-start text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-8 md:gap-12 lg:gap-16 mb-6">
            <img
              src="/favicon.ico"
              alt="ARES 23247 Logo"
              className="w-32 md:w-48 lg:w-56 h-32 md:h-48 lg:h-56 object-contain drop-shadow-[0_0_25px_rgba(192,0,0,0.6)] shrink-0"
            />
            <div>
              <p className="text-ares-gold font-bold uppercase tracking-[0.4em] text-xs md:text-sm font-heading mb-4">
                Appalachian Robotics & Engineering Society
              </p>
              <h1 className="text-[3.5rem] md:text-[6rem] lg:text-[7.5rem] font-bold text-white leading-[0.85] uppercase font-heading relative z-10 w-full xl:w-2/3">
                <span className="block mb-2 text-white">Engineered</span>
                <span className="bg-ares-red px-4 sm:px-6 py-2 pb-3 mt-2 inline-block ares-cut-sm shadow-[0_20px_25px_-5px_rgba(0,0,0,0.4)] text-white font-bold">To Inspire</span>
              </h1>
            </div>
          </div>

          <div className="max-w-2xl mb-10 border-l-4 border-ares-bronze pl-6">
            <div id="hero-mountaineer-mindset" className="text-lg md:text-xl font-medium leading-relaxed text-marble/90 px-4 py-3 bg-white/5 border border-white/5 ares-cut">
              Building the future of West Virginia robotics with the <strong className="text-white">Mountaineer Mindset</strong>. Proudly competing as <a href="https://www.firstinspires.org/robotics/ftc" target="_blank" rel="noopener noreferrer" className="text-white hover:text-ares-red transition-all underline decoration-ares-red decoration-2 underline-offset-8 font-black italic tracking-tight">FIRST® Tech Challenge</a> Team #23247.
            </div>
          </div>

          {/* CTAs / Login Panel */}
          <div className="flex flex-wrap gap-4 items-center w-full max-w-4xl">
            {loading ? (
              <span className="text-sm text-marble/60">Verifying session...</span>
            ) : user ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                <div className="bg-white/5 border border-ares-bronze/30 ares-cut px-6 py-3 flex items-center gap-4">
                  <img
                    src={user.photoURL || `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`}
                    alt=""
                    className="w-10 h-10 rounded-full border border-ares-bronze/40"
                  />
                  <div>
                    <p className="text-xs text-marble/60">Active Session</p>
                    <p className="text-sm font-bold text-white truncate max-w-[200px]">{user.displayName || user.email}</p>
                    <span className="text-[10px] text-ares-gold uppercase tracking-wider font-semibold">
                      Role: {authorizedUser?.role || "Pending Verification"}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <Link to="/dashboard" className="clipped-button bg-ares-red hover:bg-ares-red-dark transition-all text-white font-bold text-xs uppercase tracking-wider">
                    Go to Portal
                  </Link>
                  <button
                    onClick={logout}
                    className="clipped-button bg-transparent border-2 border-ares-danger-soft text-ares-danger-soft hover:bg-ares-danger hover:text-white transition-all text-xs"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-6 w-full sm:w-auto">
                <button
                  onClick={loginWithGoogle}
                  className="clipped-button bg-ares-red hover:bg-ares-red-dark transition-all shadow-xl text-white font-bold inline-flex items-center gap-2"
                >
                  <LogIn size={16} /> Team Member Sign In
                </button>
                <Link
                  href="/calendar"
                  className="clipped-button bg-transparent border-2 border-ares-bronze text-ares-bronze hover:bg-ares-bronze hover:text-white transition-all"
                >
                  View Schedule
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── PORTAL CORE FEATURES (GEOMETRIC HERO CARDS) ─── */}
      <section className="py-24 bg-obsidian border-t border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 font-heading text-white">Portal Dashboard</h2>
              <p className="text-marble/70 text-lg">Integrated engineering precision, telemetry diagnostics, and real-time coordination.</p>
            </div>
            <div className="h-px flex-grow bg-white/5 mx-8 mb-4 hidden md:block"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Card A: Blog */}
            <Link to="/blog" className="group flex flex-col h-full">
              <div className="bg-white/5 border border-white/10 hero-card p-10 flex flex-col h-full backdrop-blur-sm hover:border-ares-red/30 transition-colors">
                <div>
                  <div className="w-12 h-12 bg-ares-red/10 rounded-lg flex items-center justify-center mb-6 border border-ares-red/30 group-hover:scale-110 transition-transform">
                    <Cpu className="text-ares-red w-6 h-6" />
                  </div>
                  <h3 className="text-white text-2xl font-bold mb-6 font-heading group-hover:text-ares-gold transition-colors">
                    Team Blog & Specs
                  </h3>
                  <p className="text-marble/70 text-base leading-relaxed mb-8">
                    Explore tournament recaps, open-source software updates, and technical calibration logs. Built with <strong>Incremental Static Regeneration (ISR)</strong> for sub-50ms loads.
                  </p>
                </div>
                <div className="mt-auto">
                  <span className="text-white font-bold text-sm tracking-widest uppercase hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                    Open Blog <ArrowRight size={16} className="text-ares-red" />
                  </span>
                </div>
              </div>
            </Link>

            {/* Card B: Schedule */}
            <Link to="/calendar" className="group flex flex-col h-full">
              <div className="bg-white/5 border border-white/10 hero-card p-10 flex flex-col h-full backdrop-blur-sm hover:border-ares-red/30 transition-colors">
                <div>
                  <div className="w-12 h-12 bg-ares-bronze/10 rounded-lg flex items-center justify-center mb-6 border border-ares-bronze/30 group-hover:scale-110 transition-transform">
                    <CalendarIcon className="text-ares-bronze w-6 h-6" />
                  </div>
                  <h3 className="text-white text-2xl font-bold mb-6 font-heading group-hover:text-ares-gold transition-colors">
                    Interactive Schedule
                  </h3>
                  <p className="text-marble/70 text-base leading-relaxed mb-8">
                    Check division practices and outreach workshops. Subscribed to Firestore <strong>real-time collection listeners</strong> for instant synchronization across displays.
                  </p>
                </div>
                <div className="mt-auto">
                  <span className="text-white font-bold text-sm tracking-widest uppercase hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                    Open Calendar <ArrowRight size={16} className="text-ares-bronze" />
                  </span>
                </div>
              </div>
            </Link>

            {/* Card C: Kanban Tasks */}
            <Link to="/dashboard/tasks" className="group flex flex-col h-full">
              <div className="bg-white/5 border border-white/10 hero-card p-10 flex flex-col h-full backdrop-blur-sm hover:border-ares-red/30 transition-colors">
                <div>
                  <div className="w-12 h-12 bg-ares-cyan/10 rounded-lg flex items-center justify-center mb-6 border border-ares-cyan/30 group-hover:scale-110 transition-transform">
                    <ClipboardList className="text-ares-cyan w-6 h-6" />
                  </div>
                  <h3 className="text-white text-2xl font-bold mb-6 font-heading group-hover:text-ares-gold transition-colors">
                    Kanban Task Board
                  </h3>
                  <p className="text-marble/70 text-base leading-relaxed mb-8">
                    Collaborative project management. Real-time drag-and-drop card sync, mobile status updates, and priority metrics powered by Firestore NoSQL.
                  </p>
                </div>
                <div className="mt-auto">
                  <span className="text-white font-bold text-sm tracking-widest uppercase hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                    Open Task Board <ArrowRight size={16} className="text-ares-cyan" />
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── CALL TO ACTION SECTION ─── */}
      <GreekMeander variant="thin" opacity="opacity-60" className="relative -bottom-[1px] z-10" />
      <section className="py-24 bg-white/5 border-t border-white/5 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold mb-8 font-heading">
            Join <span className="bg-ares-red px-3 py-1 pb-2 ares-cut-sm text-white font-bold">ARES</span>
          </h2>
          <p className="text-marble/90 text-xl mb-12 leading-relaxed">
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

      {/* ─── TELEMETRY INGESTION NOTICE ─── */}
      <section className="py-12 bg-obsidian text-marble border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-marble/5 border border-white/5 p-6 ares-cut">
          <div className="flex items-center gap-3">
            <ShieldCheck size={28} className="text-ares-gold shrink-0 animate-pulse" />
            <div>
              <p className="text-sm font-bold text-white uppercase tracking-wider">Hardware Telemetry Ingestion</p>
              <p className="text-xs text-marble/65 mt-1">Drivetrain telemetry logs upload directly to <code className="text-ares-cyan">/api/upload</code> for BigQuery & Vertex AI diagnostics.</p>
            </div>
          </div>
          <span className="text-[10px] font-mono border border-white/20 text-marble/60 px-2.5 py-1 rounded uppercase bg-black/30">
            Secure Endpoint Active
          </span>
        </div>
      </section>
    </div>
  );
}
