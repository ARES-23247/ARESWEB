"use client";

import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  LogIn,
  Cpu,
  Calendar as CalendarIcon,
  ClipboardList,
  Hexagon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { GreekMeander } from "@/components/GreekMeander";
import { maskEmail } from "@/lib/utils";
import SEO from "@/components/SEO";
import AuthErrorNotice from "@/components/navigation/AuthErrorNotice";

export default function Home() {
  const { user, authorizedUser, loading, loginWithGoogle, logout } = useAuth();

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      <SEO
        exactTitle
        title="ARES 23247 | West Virginia Robotics Team (Morgantown, WV)"
        description="ARES 23247 is a West Virginia robotics team in Morgantown — the Appalachian Robotics & Engineering Society, a FIRST® Tech Challenge team building robots, technical leaders, and STEM opportunities across West Virginia."
      />
      {/* ─── HERO ─── */}
      <section className="relative w-full min-h-[85vh] flex items-center overflow-hidden bg-obsidian">
        {/* Motif Background Isolated Layer */}
        <div
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none isolate"
          aria-hidden="true"
        >
          <div
            data-testid="hero-watermark"
            className="absolute -right-[12%] top-[4%] h-[92%] w-[88%] rotate-12 bg-contain bg-center bg-no-repeat opacity-[0.05]"
            style={{
              backgroundImage: "url('/favicon.svg')",
              WebkitMaskImage:
                "radial-gradient(ellipse 72% 68% at 58% 50%, black 0%, rgba(0, 0, 0, 0.85) 48%, transparent 82%)",
              maskImage:
                "radial-gradient(ellipse 72% 68% at 58% 50%, black 0%, rgba(0, 0, 0, 0.85) 48%, transparent 82%)",
            }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/95 to-obsidian/35"></div>
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-start px-4 pb-12 pt-8 text-left sm:px-6 sm:pb-16 sm:pt-12">
          <div className="mb-6 flex min-w-0 flex-col gap-5 sm:gap-8 md:flex-row md:items-center md:gap-12 lg:gap-16">
            <img
              src="/favicon.svg"
              alt="ARES 23247 Logo"
              className="h-24 w-24 shrink-0 object-contain drop-shadow-[0_0_25px_rgba(192,0,0,0.6)] sm:h-32 sm:w-32 md:h-48 md:w-48 lg:h-56 lg:w-56"
            />
            <div className="min-w-0 max-w-full">
              <p className="mb-4 max-w-full text-xs font-bold uppercase tracking-[0.22em] text-ares-gold sm:tracking-[0.4em] md:text-sm font-heading">
                Appalachian Robotics & Engineering Society
              </p>
              <h1 className="relative z-10 w-full max-w-full text-[clamp(2.25rem,12vw,3.5rem)] font-bold uppercase leading-[0.9] text-white font-heading md:text-[6rem] md:leading-[0.85] lg:text-[7.5rem]">
                <span className="sr-only">ARES 23247 — </span>
                <span className="block mb-2 text-white">Engineered</span>
                <span className="mt-2 inline-block max-w-full whitespace-nowrap bg-ares-red px-3 py-2 pb-3 text-white shadow-[0_20px_25px_-5px_rgba(0,0,0,0.4)] ares-cut-sm sm:px-6">
                  To Inspire
                </span>
              </h1>
            </div>
          </div>

          <div className="mb-8 max-w-2xl border-l-4 border-ares-bronze pl-3 sm:mb-10 sm:pl-6">
            <div
              id="hero-mountaineer-mindset"
              className="border border-white/5 bg-white/5 px-3 py-3 text-base font-medium leading-relaxed text-marble/90 ares-cut sm:px-4 sm:text-lg md:text-xl"
            >
              Building the future of West Virginia robotics with the{" "}
              <strong className="text-white">Mountaineer Mindset</strong>.
              Proudly competing as{" "}
              <a
                href="https://www.firstinspires.org/robotics/ftc"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-ares-red-light transition-all underline decoration-ares-red decoration-2 underline-offset-8 font-black tracking-tight"
              >
                <em className="italic">FIRST</em>® Tech Challenge
              </a>{" "}
              Team #23247.
            </div>
          </div>

          {/* CTAs / Login Panel */}
          <div className="flex flex-wrap gap-4 items-center w-full max-w-4xl">
            {loading ? (
              <span className="text-sm text-marble/60">
                Verifying session...
              </span>
            ) : user ? (
              <div className="flex w-full flex-col items-stretch gap-4 sm:w-auto sm:flex-row sm:items-center">
                <div className="bg-white/5 border border-ares-bronze/30 ares-cut px-6 py-3 flex items-center gap-4">
                  <img
                    src={
                      user.photoURL ||
                      `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`
                    }
                    alt=""
                    className="w-10 h-10 rounded-full border border-ares-bronze/40"
                  />
                  <div>
                    <p className="text-xs text-marble/60">Active Session</p>
                    <p className="text-sm font-bold text-white truncate max-w-[200px]">
                      {user.displayName || maskEmail(user.email)}
                    </p>
                    <span className="text-[10px] text-ares-gold uppercase tracking-wider font-semibold">
                      Role: {authorizedUser?.role || "Pending Verification"}
                    </span>
                  </div>
                </div>

                <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2 sm:gap-4">
                  <Link
                    to="/dashboard"
                    className="clipped-button inline-flex min-h-11 items-center justify-center bg-ares-red text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-ares-bronze"
                  >
                    Go to Portal
                  </Link>
                  <button
                    onClick={logout}
                    className="clipped-button min-h-11 bg-transparent border-2 border-ares-danger-soft text-ares-danger-soft hover:bg-ares-danger hover:text-white transition-all text-xs"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:gap-6">
                <div className="w-full sm:w-auto">
                  <button
                    onClick={loginWithGoogle}
                    className="clipped-button inline-flex min-h-11 items-center justify-center gap-2 bg-ares-red font-bold text-white shadow-xl transition-all hover:bg-ares-bronze"
                  >
                    <LogIn size={16} /> Team Member Sign In
                  </button>
                  <AuthErrorNotice />
                </div>
                <Link
                  to="/calendar"
                  className="clipped-button inline-flex min-h-11 items-center justify-center bg-transparent border-2 border-ares-bronze text-ares-bronze hover:bg-ares-bronze hover:text-white transition-all"
                >
                  View Schedule
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── ARES ROBOTICS STUDIO PUBLIC PRODUCT IDENTITY ─── */}
      <section
        aria-labelledby="ares-robotics-studio-heading"
        aria-label="ARES Robotics Studio"
        className="py-20 bg-white/5 border-y border-white/10"
      >
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10 items-start">
          <div>
            <p className="text-ares-gold font-bold uppercase tracking-[0.25em] text-xs font-heading mb-3">
              Open-source robotics software
            </p>
            <h2
              id="ares-robotics-studio-heading"
              className="text-4xl md:text-5xl font-bold font-heading text-white mb-6"
            >
              ARES Robotics Studio
            </h2>
            <p className="text-marble/90 text-lg leading-relaxed mb-5">
              ARES Robotics Studio is our local-first desktop mission-control
              application for robot projects, simulation, telemetry, match-log
              analysis, and evidence-based tuning. FTC and FRC teams can use its
              local tools without a Google account or internet access.
            </p>
            <p className="text-marble/75 leading-relaxed">
              Optional Google Drive sync uses one-click Google sign-in. The
              public ARES OAuth client identifies the application; each user
              keeps ownership of files in the personal, team, or Shared Drive
              folder they choose. ARES does not receive access to unrelated
              Drive files.
            </p>
          </div>
          <div className="bg-obsidian border border-white/10 hero-card p-8">
            <h3 className="text-xl font-bold font-heading text-white mb-4">
              Product information
            </h3>
            <ul className="space-y-3 text-marble/85">
              <li>
                <strong className="text-white">Local-first:</strong> authoring,
                simulation, imports, and analysis remain available offline.
              </li>
              <li>
                <strong className="text-white">Optional cloud:</strong> Google
                permissions and the selected workspace folder remain
                authoritative.
              </li>
              <li>
                <strong className="text-white">No desktop secret:</strong>{" "}
                sign-in uses Authorization Code with PKCE and a loopback
                callback.
              </li>
            </ul>
            <div className="flex flex-wrap gap-3 mt-7">
              <a
                href="https://github.com/ARES-23247/ARES-Robotics/tree/main/ARES-Analytics"
                target="_blank"
                rel="noopener noreferrer"
                className="clipped-button bg-ares-red text-white text-xs uppercase tracking-wider"
              >
                View source
              </a>
              <Link
                to="/privacy"
                className="clipped-button bg-transparent border-2 border-ares-bronze text-white text-xs uppercase tracking-wider"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="clipped-button bg-transparent border-2 border-white/40 text-white text-xs uppercase tracking-wider"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ARES GAMES ─── */}
      <section
        aria-labelledby="ares-games-heading"
        className="relative overflow-hidden border-b border-white/10 bg-obsidian py-20"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-1/2 h-72 w-72 -translate-y-1/2 rotate-12 rounded-[4rem] border border-ares-gold/10"
        />
        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <div className="mb-10 max-w-3xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-ares-gold font-heading">
              Play, learn, and compete
            </p>
            <h2
              id="ares-games-heading"
              className="mb-5 text-4xl font-bold text-white font-heading md:text-5xl"
            >
              ARES Games
            </h2>
            <p className="text-lg leading-relaxed text-marble/80">
              Word games, hexagonal strategy, and a balancing challenge. Explore
              the arcade on your phone, tablet, or desktop.
            </p>
            <Link to="/arcade" className="mt-4 inline-flex min-h-11 items-center font-bold text-ares-gold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">Explore the arcade</Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Link
              to="/buzzello"
              aria-label="Play BUZZELLO"
              className="group block rounded-2xl border border-ares-gold/30 bg-white/5 p-6 transition-colors hover:border-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:ring-offset-4 focus-visible:ring-offset-obsidian sm:p-8"
            >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-5">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-ares-gold/40 bg-ares-gold/10 text-ares-gold transition-transform group-hover:scale-105">
                  <Hexagon aria-hidden="true" size={30} />
                </span>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-ares-gold">
                    Available now
                  </p>
                  <h3 className="mb-3 text-2xl font-bold text-white font-heading sm:text-3xl">
                    BUZZELLO™
                  </h3>
                  <p className="max-w-2xl leading-relaxed text-marble/75">
                    Six-axis hexagonal strategy for two players. Play locally,
                    challenge the AI, find a guest or team match, or invite a
                    friend with a private link or code.
                  </p>
                  <p className="mt-3 text-sm text-marble/60">
                    No chat, public lobby, player profile, or spectator mode.
                  </p>
                </div>
              </div>
              <span className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start font-bold uppercase tracking-widest text-white transition-colors group-hover:text-ares-gold sm:self-center">
                Play now <ArrowRight aria-hidden="true" size={18} />
              </span>
            </div>
            </Link>
            <Link
              to="/buzzle"
              aria-label="Play BUZZLE"
              className="group block rounded-2xl border border-ares-gold/30 bg-white/5 p-6 transition-colors hover:border-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:ring-offset-4 focus-visible:ring-offset-obsidian sm:p-8"
            >
              <div className="flex h-full flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-5">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-ares-gold/40 bg-ares-gold/10 text-ares-gold transition-transform group-hover:scale-105">
                    <Hexagon aria-hidden="true" size={30} />
                  </span>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-ares-gold">
                      New in ARES Games
                    </p>
                    <h3 className="mb-3 text-2xl font-bold text-white font-heading sm:text-3xl">
                      BUZZLE™
                    </h3>
                    <p className="max-w-2xl leading-relaxed text-marble/75">
                      Three-axis hexagonal word strategy for local, computer,
                      friend-code, and bounded matchmaking play, with crossing
                      words, multiplier hubs, blanks, and keyboard controls.
                    </p>
                    <p className="mt-3 text-sm text-marble/60">
                      Online rooms use the same no-chat, no-profile safety boundary.
                    </p>
                  </div>
                </div>
                <span className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start font-bold uppercase tracking-widest text-white transition-colors group-hover:text-ares-gold sm:self-center">
                  Play now <ArrowRight aria-hidden="true" size={18} />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── PORTAL CORE FEATURES (GEOMETRIC HERO CARDS) ─── */}
      <section className="py-24 bg-obsidian border-t border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 font-heading text-white">
                Portal Dashboard
              </h2>
              <p className="text-marble/70 text-lg">
                Integrated engineering documentation, interactive learning, and
                real-time coordination.
              </p>
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
                    Explore tournament recaps, open-source software updates, and
                    technical calibration logs in the team&apos;s searchable
                    knowledge library.
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
                    Check division practices and outreach workshops through a
                    bounded calendar feed with clear refresh and subscription
                    options.
                  </p>
                </div>
                <div className="mt-auto">
                  <span className="text-white font-bold text-sm tracking-widest uppercase hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                    Open Calendar{" "}
                    <ArrowRight size={16} className="text-ares-bronze" />
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
                    Collaborative project management. Real-time drag-and-drop
                    card sync, mobile status updates, and priority metrics
                    powered by Firestore NoSQL.
                  </p>
                </div>
                <div className="mt-auto">
                  <span className="text-white font-bold text-sm tracking-widest uppercase hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                    Open Task Board{" "}
                    <ArrowRight size={16} className="text-ares-cyan" />
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── CALL TO ACTION SECTION ─── */}
      <GreekMeander
        variant="thin"
        opacity="opacity-60"
        className="relative -bottom-[1px] z-10"
      />
      <section className="py-24 bg-white/5 border-t border-white/5 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold mb-8 font-heading">
            Join{" "}
            <span className="bg-ares-red px-3 py-1 pb-2 ares-cut-sm text-white font-bold">
              ARES
            </span>
          </h2>
          <p className="text-marble/90 text-xl mb-12 leading-relaxed">
            Whether you&apos;re a student looking to build monsters of
            engineering or a sponsor looking to invest in the future of WV
            technology, there is a place for you at the table.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link
              to="/sponsors"
              className="clipped-button bg-ares-bronze text-obsidian hover:bg-white hover:text-ares-red transition-all"
            >
              Become a Sponsor
            </Link>
            <Link
              to="/join"
              className="clipped-button bg-transparent border-2 border-white text-white hover:bg-white hover:text-obsidian transition-all"
            >
              Team Application
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
