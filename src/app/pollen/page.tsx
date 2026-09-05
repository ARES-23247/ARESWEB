"use client";

import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  LogIn,
  KeyRound,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react";
import SEO from "@/components/SEO";
import { useAuth } from "@/context/AuthContext";
import {
  GameFullscreenButton,
  useGameFullscreen,
} from "@/components/games/GameFullscreen";

// Active team roles permitted to access Pollenator Pile-Up
const ALLOWED_ROLES = new Set([
  "admin",
  "coach",
  "mentor",
  "member",
  "student",
  "lead",
  "parent",
]);

export default function PollenPage() {
  const {
    user,
    authorizedUser,
    loading,
    loginWithGoogle,
    loginWithMockUser,
    logout,
  } = useAuth();
  const { isFullscreen, targetRef, toggleFullscreen } = useGameFullscreen();
  const mockAuthEnabled = import.meta.env.DEV || import.meta.env.MODE === "e2e";

  const isAuthorized = useMemo(() => {
    if (!authorizedUser?.role) return false;
    return ALLOWED_ROLES.has(authorizedUser.role.toLowerCase());
  }, [authorizedUser]);

  // 1. Loading State
  if (loading) {
    return (
      <main
        id="main-content"
        className="min-h-screen bg-obsidian flex flex-col items-center justify-center relative overflow-hidden"
      >
        <SEO title="Authenticating... | ARES 23247" noindex={true} />
        <div className="z-10 flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            <div className="w-14 h-14 border-4 border-ares-gold/20 border-t-ares-gold rounded-full animate-spin"></div>
            <div
              className="absolute w-8 h-8 border-4 border-ares-red/35 border-b-ares-red rounded-full animate-spin rotate-180"
              style={{ animationDuration: "1s" }}
            ></div>
          </div>
          <div className="text-center">
            <p className="text-ares-gold font-bold uppercase tracking-[0.3em] text-[10px] font-heading mb-1.5">
              ARES Security Gate
            </p>
            <p className="text-marble/70 text-xs font-semibold uppercase tracking-widest animate-pulse">
              Verifying Team Credentials...
            </p>
          </div>
        </div>
      </main>
    );
  }

  // 2. Unauthenticated Gate (Not logged in)
  if (!user) {
    return (
      <main
        id="main-content"
        className="min-h-screen bg-obsidian flex flex-col items-center justify-center p-6 relative overflow-hidden text-marble"
      >
        <SEO
          title="Team Member Access Required | Pollenator Pile-Up"
          description="Pollenator Pile-Up is an exclusive team activity for ARES Team 23247 members, coaches, and administrators."
          noindex={true}
        />

        {/* Ambient background styling */}
        <div
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20"
          aria-hidden="true"
        >
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-[140px]"></div>
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="glass-card hero-card p-8 border border-white/10 bg-black/60 shadow-2xl flex flex-col items-center text-center ares-cut">
            {/* Flower / Key Icon */}
            <div className="relative w-16 h-16 bg-amber-500/15 border border-amber-500/40 ares-cut flex items-center justify-center mb-5 shadow-[0_0_25px_rgba(255,179,0,0.2)]">
              <KeyRound className="text-amber-400 w-8 h-8 animate-bounce" />
            </div>

            <span className="text-ares-gold font-bold uppercase tracking-[0.4em] text-[10px] font-heading mb-2">
              <em>FIRST</em>® Tech Challenge #23247
            </span>

            <h1 className="text-2xl md:text-3xl font-extrabold text-white uppercase font-heading mb-3 tracking-tighter">
              Pollenator Pile-Up
            </h1>

            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/10 border border-amber-400/30 rounded-full text-amber-300 text-xs font-bold uppercase tracking-wider mb-5">
              <Sparkles size={13} /> Team Members &amp; Coaches Only
            </div>

            <p className="text-marble/75 text-sm leading-relaxed mb-6">
              This Appalachian blossom balance game is restricted to authenticated
              ARES 23247 team students, mentors, coaches, and administrators.
            </p>

            <button
              type="button"
              onClick={loginWithGoogle}
              className="w-full clipped-button bg-ares-red hover:bg-ares-bronze transition-all text-white font-bold text-sm tracking-wider uppercase inline-flex items-center justify-center gap-3 py-3.5 shadow-xl hover:shadow-[0_0_20px_rgba(192,0,0,0.3)] active:scale-95 cursor-pointer"
            >
              <LogIn size={16} /> Sign In with Team Account
            </button>

            {/* Developer mock buttons in dev/e2e environment */}
            {mockAuthEnabled && (
              <div className="w-full mt-5 pt-5 border-t border-white/10 space-y-2">
                <p className="text-[9px] font-black text-ares-gold uppercase tracking-widest text-center animate-pulse">
                  ⚡ Dev Environment Bypass
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      loginWithMockUser(
                        "admin@aresfirst.org",
                        "admin",
                        "Lead Administrator",
                      )
                    }
                    className="py-2 bg-ares-gold/15 hover:bg-ares-gold/25 border border-ares-gold/30 text-white font-bold text-[10px] uppercase rounded"
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      loginWithMockUser(
                        "coach@aresfirst.org",
                        "coach",
                        "Head Coach",
                      )
                    }
                    className="py-2 bg-ares-red/15 hover:bg-ares-red/25 border border-ares-red/30 text-white font-bold text-[10px] uppercase rounded"
                  >
                    Coach
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      loginWithMockUser(
                        "member@aresfirst.org",
                        "member",
                        "Team Student",
                      )
                    }
                    className="py-2 bg-ares-cyan/15 hover:bg-ares-cyan/25 border border-ares-cyan/30 text-white font-bold text-[10px] uppercase rounded"
                  >
                    Member
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-white/5 w-full flex items-center justify-between text-[11px] text-marble/50">
              <Link to="/" className="hover:text-white transition-colors">
                ← Return to Home
              </Link>
              <span>ARES Auth Gate</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // 3. Authenticated but Unauthorized Role Gate
  if (!isAuthorized) {
    return (
      <main
        id="main-content"
        className="min-h-screen bg-obsidian flex flex-col items-center justify-center p-6 relative overflow-hidden text-marble"
      >
        <SEO title="Access Restricted | Pollenator Pile-Up" noindex={true} />
        <div className="relative z-10 w-full max-w-md border border-ares-red/45 bg-black/75 p-8 text-center shadow-2xl ares-cut">
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-ares-red" />
          <h1 className="font-heading text-2xl font-black uppercase tracking-tight text-white mb-2">
            Team Authorization Required
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-marble/75 mb-6">
            Signed in as <strong className="text-white">{user.email}</strong>.
            This account does not have an active ARES team member, coach, or
            administrator role assigned.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => void logout()}
              className="clipped-button bg-ares-red px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white"
            >
              Sign Out
            </button>
            <Link
              to="/dashboard"
              className="border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 transition-colors inline-flex items-center justify-center"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 4. Authorized Team Member / Coach / Admin View
  return (
    <main
      id="main-content"
      ref={targetRef}
      className={`min-h-screen bg-obsidian text-marble flex flex-col ${
        isFullscreen ? "game-fullscreen-active fixed inset-0 z-50 p-0" : "p-4 md:p-8"
      }`}
    >
      <SEO
        title="Pollenator Pile-Up | ARES 23247"
        description="Exclusive Appalachian blossom physics balance game for ARES Team 23247 members."
        noindex={true}
      />

      {/* Top Bar with ARES Breadcrumb & User Info */}
      {!isFullscreen && (
        <div className="max-w-5xl w-full mx-auto mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-marble/60 hover:text-white transition-colors"
            >
              <ArrowLeft size={14} /> Back to Dashboard
            </Link>
            <span className="text-white/20">•</span>
            <span className="text-xs font-bold uppercase tracking-wider text-ares-gold">
              Team Games
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* User status badge */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-xs">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span className="text-marble/80">
                {user.displayName || user.email}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-ares-red/30 text-ares-gold border border-ares-red/40">
                {authorizedUser?.role || "Team"}
              </span>
            </div>

            {/* Fullscreen Button */}
            <GameFullscreenButton
              isFullscreen={isFullscreen}
              onToggle={toggleFullscreen}
              className="text-xs"
            />
          </div>
        </div>
      )}

      {/* Game Frame Container */}
      <div
        className={`w-full mx-auto flex flex-col items-center justify-center flex-1 ${
          isFullscreen ? "h-full max-w-none" : "max-w-4xl"
        }`}
      >
        <div
          className={`w-full relative overflow-hidden rounded-2xl border border-white/15 bg-black/90 shadow-2xl ${
            isFullscreen ? "h-full rounded-none border-none" : "aspect-[3/4] max-h-[85vh]"
          }`}
        >
          <iframe
            src="/games/pollen/index.html"
            title="Pollenator Pile-Up — Appalachian Blossom Balance"
            className="w-full h-full border-0"
            allow="fullscreen"
          />
        </div>
      </div>
    </main>
  );
}
