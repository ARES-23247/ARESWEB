"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuth } from "@/context/AuthContext";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { LogIn, Menu, X, KeyRound } from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";
import SEO from "@/components/SEO";
import AuthErrorNotice from "@/components/navigation/AuthErrorNotice";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    user,
    authorizedUser,
    loading,
    loginWithGoogle,
    loginWithMockUser,
    logout,
  } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mockAuthEnabled = import.meta.env.DEV || import.meta.env.MODE === "e2e";

  // 1. Loading State
  if (loading) {
    return (
      <main
        id="main-content"
        className="min-h-screen bg-obsidian flex flex-col items-center justify-center relative overflow-hidden"
      >
        {/* Animated Background Gradients */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-ares-red/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-ares-gold/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="z-10 flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            {/* Spinning Gold Gear */}
            <div className="w-16 h-16 border-4 border-ares-gold/20 border-t-ares-gold rounded-full animate-spin"></div>
            {/* Inner Red Pulsing Ring */}
            <div
              className="absolute w-10 h-10 border-4 border-ares-red/35 border-b-ares-red rounded-full animate-spin rotate-180"
              style={{ animationDuration: "1s" }}
            ></div>
          </div>

          <div className="text-center">
            <p className="text-ares-gold font-bold uppercase tracking-[0.3em] text-[10px] font-heading mb-1.5">
              ARES Neural Link
            </p>
            <p className="text-marble/70 text-xs font-semibold uppercase tracking-widest animate-pulse">
              Authenticating Terminal...
            </p>
          </div>
        </div>
      </main>
    );
  }

  // 2. Lockscreen / Sign In Required
  if (!user) {
    return (
      <main
        id="main-content"
        className="min-h-screen bg-obsidian flex flex-col items-center justify-center p-6 relative overflow-hidden"
      >
        <SEO title="Administrative Gate" noindex={true} />
        {/* Beautiful background patterns */}
        <div
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20"
          aria-hidden="true"
        >
          <div
            className="absolute right-[-10%] top-[10%] w-[70%] h-[70%] opacity-[0.05] bg-contain bg-center bg-no-repeat rotate-12"
            style={{ backgroundImage: "url('/favicon.svg')" }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-obsidian via-obsidian/95 to-ares-red/10"></div>
        </div>

        <div className="absolute top-0 left-0 w-full z-10">
          <GreekMeander
            variant="thin"
            opacity="opacity-30"
            className="w-full"
          />
        </div>

        <div className="relative z-10 w-full max-w-md">
          {/* Lockscreen Card */}
          <div className="glass-card hero-card p-8 border border-white/10 bg-black/60 shadow-2xl flex flex-col items-center text-center">
            {/* Icon Group */}
            <div className="relative w-20 h-20 bg-ares-red/15 border border-ares-red/45 ares-cut flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(192,0,0,0.2)]">
              <KeyRound className="text-ares-red w-8 h-8 animate-bounce" />
            </div>

            <span className="text-ares-gold font-bold uppercase tracking-[0.4em] text-[10px] font-heading mb-3">
              <em>FIRST</em>® Tech Challenge #23247
            </span>

            <h2 className="text-2xl md:text-3xl font-extrabold text-white uppercase font-heading mb-3 tracking-tighter">
              Administrative Gate
            </h2>

            <p className="text-marble/70 text-sm leading-relaxed mb-8 max-w-sm">
              Access to team operations, task boards, and workspace analytics is
              restricted to authenticated ARES team members.
            </p>

            <button
              onClick={loginWithGoogle}
              className="w-full clipped-button bg-ares-red hover:bg-ares-bronze transition-all text-white font-bold text-sm tracking-wider uppercase inline-flex items-center justify-center gap-3 py-3.5 shadow-xl hover:shadow-[0_0_20px_rgba(192,0,0,0.3)] active:scale-95 cursor-pointer"
            >
              <LogIn size={16} /> Sign In with Google
            </button>
            <AuthErrorNotice />

            {mockAuthEnabled && (
              <div className="w-full mt-4 pt-4 border-t border-white/5 space-y-2.5">
                <p className="text-[9px] font-black text-ares-gold uppercase tracking-widest text-center animate-pulse">
                  ⚡ Developer Bypass Active
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      loginWithMockUser(
                        "local.admin@example.test",
                        "admin",
                        "Local Administrator",
                      )
                    }
                    className="w-full py-2 bg-ares-gold/15 hover:bg-ares-gold/25 border border-ares-gold/30 text-white font-black text-[9px] uppercase tracking-wider ares-cut-sm cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] text-center truncate"
                    title="Local administrator"
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      loginWithMockUser(
                        "ares23247wv@gmail.com",
                        "admin",
                        "ARES Team",
                      )
                    }
                    className="w-full py-2 bg-ares-red/15 hover:bg-ares-red/25 border border-ares-red/30 text-white font-black text-[9px] uppercase tracking-wider ares-cut-sm cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] text-center truncate"
                    title="ARES Team Gmail"
                  >
                    ARES Team
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      loginWithMockUser(
                        "lead.programmer@gmail.com",
                        "member",
                        "Student Lead",
                      )
                    }
                    className="w-full py-2 bg-ares-cyan/15 hover:bg-ares-cyan/25 border border-ares-cyan/30 text-white font-black text-[9px] uppercase tracking-wider ares-cut-sm cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] text-center truncate"
                    title="Student Lead"
                  >
                    Member
                  </button>
                </div>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-white/5 w-full flex items-center justify-center gap-4 text-[10px] uppercase font-bold text-marble/45 tracking-widest">
              <span>Secure Shell</span>
              <span>•</span>
              <span>YPP Compliant</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Firebase Authentication proves who controls the Google account; the
  // backend authorization record determines whether that identity belongs in
  // the ARES workspace. Keep the portal fail-closed when session linking is
  // rejected or temporarily unavailable instead of rendering a half-authorized
  // dashboard that will fail later at the API or Firestore boundary.
  if (!authorizedUser) {
    return (
      <main
        id="main-content"
        className="min-h-screen bg-obsidian flex flex-col items-center justify-center p-6 relative overflow-hidden"
      >
        <SEO title="Portal Access Denied" noindex={true} />
        <div className="relative z-10 w-full max-w-md border border-ares-red/45 bg-black/70 p-8 text-center shadow-2xl ares-cut">
          <KeyRound className="mx-auto mb-5 h-10 w-10 text-ares-red" aria-hidden="true" />
          <h1 className="font-heading text-2xl font-black uppercase tracking-tight text-white">
            Portal access denied
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-marble/75">
            This Google account does not have an active ARES authorization
            record, or the secure session check is temporarily unavailable. No
            team workspace data has been unlocked.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => void logout()}
              className="clipped-button bg-ares-red px-5 py-3 text-sm font-bold uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Sign out
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="border border-white/20 px-5 py-3 text-sm font-bold uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Retry verification
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 3. Authenticated Dashboard Layout
  return (
    <div className="flex w-full min-h-screen bg-obsidian text-marble relative">
      {/* ─── DESKTOP SIDEBAR ─── */}
      <div className="hidden md:block shrink-0 self-stretch flex flex-col">
        <DashboardSidebar />
      </div>

      {/* ─── MOBILE DRAWER SIDEBAR ─── */}
      <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm md:hidden" />
          <Dialog.Content
            aria-modal="true"
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-[51] flex h-[100dvh] w-[min(90vw,18rem)] flex-col overflow-hidden border-r border-white/10 bg-obsidian shadow-2xl focus:outline-none md:hidden"
          >
            <div className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
              <Dialog.Title className="text-sm font-black uppercase tracking-widest text-white font-heading">
                Portal navigation
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center bg-ares-red text-white border border-white/10 ares-cut-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian cursor-pointer"
                  aria-label="Close sidebar"
                >
                  <X aria-hidden="true" size={18} />
                </button>
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <DashboardSidebar
                onCloseMobile={() => setMobileMenuOpen(false)}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ─── MAIN PORTAL VIEWPORT ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top-nav header */}
        <header
          style={{ top: "var(--site-announcement-height, 0px)" }}
          className="sticky z-30 flex items-center justify-between border-b border-white/5 bg-black/40 px-4 py-3 backdrop-blur-md md:hidden sm:px-6 sm:py-4"
        >
          <span className="text-lg font-black tracking-tighter text-white font-heading">
            ARES{" "}
            <span className="bg-ares-red text-white px-1.5 py-0.5 ares-cut-sm font-bold text-xs ml-1">
              23247
            </span>
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-11 w-11 items-center justify-center bg-white/5 border border-white/10 ares-cut-sm text-ares-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian cursor-pointer"
              aria-label="Open sidebar menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </header>

        {/* Core page canvas */}
        <main
          id="main-content"
          role="main"
          className="relative z-10 mx-auto w-full max-w-7xl flex-grow p-4 sm:p-6 md:p-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
